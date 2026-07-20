# CSV Lighthouse — Reliable N-Sample Scheduler

**Date:** 2026-07-19
**Status:** Approved (design)
**Component:** `services/csv_lighthouse_service.py`, `services/pagespeed_client.py`, `config.py`, `frontend/src/components/test-urls/CsvLighthouseResultsTable.tsx`

## Problem

A CSV Lighthouse run with `samples_per_url = 25` (file `AC_Warmup`) produced mostly-failed
samples and finished in ~6 minutes instead of the expected ~30. Investigation of the exported
run (run 42) showed:

- **25 samples did fire per URL** — not a sampling bug.
- Most samples failed **instantly** with Google-side errors (`HTTP 400`, `429 rate limit`,
  `500`) returning in ~300 ms rather than running a real ~30–70 s Lighthouse audit.
- The few "passed" repeats returned **identical metrics in ~300 ms** — PSI served a **cached**
  result for the same URL rather than a fresh run.
- The item-level **"Attempts"** column summed per-sample PSI retries (each failed sample = 2
  attempts), so it read ~43 for a 25-sample URL — alarming but just counting retries.

### Root cause

Commit `3362bf1` (2026-07-15, "perf: scale CSV Lighthouse worker count with samples_per_url")
raised concurrency from a cap of **4** (`MAX_WORKERS_PER_TARGET`) to **16**
(`CSV_LIGHTHOUSE_MAX_WORKERS`) and scaled it by `urls × samples`. A 25-sample run now fans out to
16 URLs tested concurrently, each firing samples back-to-back. That 4×→16× jump in simultaneous
requests crosses Google PageSpeed Insights' per-minute rate limit. Google didn't change; our own
concurrency did. Two failure modes compound it:

1. **No 429 back-off** — `PageSpeedClient._request_with_retry` retries only 5xx/timeouts; 429 and
   4xx raise immediately, so a rate-limited call fails instantly.
2. **No per-URL spacing** — a URL's 25 samples run back-to-back, so successes hit PSI's per-URL
   result cache (identical, non-independent data) and fast failures re-fire immediately (burst).

## Goal

**25 fresh, independent, successful Lighthouse samples per URL, in the shortest time compatible
with high reliability.** "Statistical measurement" is the purpose (confirmed): each sample must be
an independent Lighthouse run, so PSI's per-URL cache must be defeated by spacing. Failure policy
(confirmed): **retry until 25 valid**, bounded by a per-sample safety cap.

## Non-goals

- Cache warming of the origin / cache-busting query params (would measure cold-cache performance
  and distort results).
- Running Lighthouse locally/headless instead of PSI.
- Changing metric semantics (median-of-samples as the representative value stays).

## Design — Approach A: continuous interleaved sample scheduler

Replace the "one worker owns a URL and loops all its samples" model with a **shared scheduler**
that dispatches *individual sample tasks* across a worker pool, interleaving URLs so any single
URL's samples are naturally spaced (defeating the cache) while workers stay busy.

### Components

#### 1. `PageSpeedClient` (`services/pagespeed_client.py`)
- Add `PageSpeedRateLimitError(PageSpeedError)` raised on **HTTP 429**, carrying an optional
  `retry_after` parsed from the `Retry-After` header. This lets the scheduler distinguish rate
  limiting from other errors and back off globally.
- The existing 5xx/timeout retry stays. 429 no longer raises a generic error immediately — it
  raises the typed rate-limit error (the scheduler owns the back-off).
- No change needed to expose the cache timestamp: `test_url` already returns
  `raw_data.fetch_time` (= `analysisUTCTimestamp`); the scheduler reads it.

#### 2. `RateLimiter` (new, e.g. `services/rate_limiter.py`)
- Thread-safe **token bucket**, shared by all workers in a run.
- `acquire()` blocks until a token is available; refills at `requests_per_minute`.
- **Adaptive:** `penalize()` (called on 429) halves the effective rate down to a floor and applies
  a global pause (honoring `retry_after` when present); the rate recovers slowly after a quiet
  period.
- Takes an injectable **clock + sleep** for testability.

#### 3. Scheduler (rewrite of `_run_pending_items` / `_process_item` in `CsvLighthouseService`)

Per-run in-memory state, one record per URL (item):
```
target        = samples_per_url          # 25
valid_count   = 0
attempts_used = 0                         # total PSI calls for this URL
next_eligible_at = 0                      # cooldown gate (clock time)
seen_timestamps = set()                   # analysisUTCTimestamp values already recorded
```

Worker loop (`N` threads), each iteration:
1. If cancel requested → stop.
2. `item = pick_next_eligible()` — thread-safe selection of a URL with
   `valid_count < target` and `now ≥ next_eligible_at`. If none: if all items complete → exit;
   else sleep until the soonest `next_eligible_at`, then retry.
3. `rate_limiter.acquire()`.
4. Run one `test_url(item.url, strategy)` and classify:

| Outcome | Detection | Action |
|---|---|---|
| Fresh success | `raw_data.fetch_time` not in `seen_timestamps` (fallback: metric tuple unseen) | persist valid sample (`sample_index = valid_count+1`); `valid_count++`; `next_eligible_at = now + base_cooldown` |
| Cached duplicate | timestamp already in `seen_timestamps` | discard (not counted); `next_eligible_at = now + cache_cooldown` (longer); `attempts_used++` |
| Rate limited (429) | `PageSpeedRateLimitError` | `rate_limiter.penalize(retry_after)`; `next_eligible_at = now + backoff`; `attempts_used++` |
| Error (4xx/5xx/timeout) | `PageSpeedError` | `next_eligible_at = now + exponential_backoff(attempts_for_slot)`; `attempts_used++` |

5. If the current sample slot exceeds `CSV_LIGHTHOUSE_MAX_ATTEMPTS_PER_SAMPLE` consecutive
   non-fresh attempts → give up on this URL's remaining slots, record the shortfall on the item
   (`error_message` note), and mark it terminal.

**Concurrency:** `N = min(CSV_LIGHTHOUSE_MAX_WORKERS, num_urls)`. Worker count is no longer scaled
by `samples_per_url` (reverts the regression).

When every URL is terminal (reached `target` valid, or hit the safety cap), finalize each item:
compute the median across its valid samples as the representative metric (existing
`_median_metrics`, now including `performance`), set `attempts = attempts_used`, and mark passed
(or failed if `valid_count == 0`). Then `finish_run_if_complete`.

#### 4. Persistence (`data_access/csv_lighthouse_repository.py`)
- **Store only valid samples** (approved decision). Failed/cached attempts are not persisted as
  sample rows; they're reflected only in the item's `attempts` tally. This yields a clean export
  (25 rows/URL + summary) instead of the mostly-failed dump from run 42.
- No schema change required (the `performance` column from the prior change already exists).
  `create_sample` / `list_samples` / `mark_item_passed` are reused as-is.

#### 5. Frontend (`CsvLighthouseResultsTable.tsx`)
- Relabel the **"Attempts"** column to show valid **`n / target`** (e.g. `25 / 25`) so the run's
  data completeness is legible instead of a raw retry sum. The raw `attempts` remains in the CSV
  export for auditing.

### Config additions (`config.py`, all env-overridable)

| Name | Default | Purpose |
|---|---|---|
| `CSV_LIGHTHOUSE_MAX_WORKERS` | **6** (was 16) | concurrent URLs in flight |
| `CSV_LIGHTHOUSE_REQUESTS_PER_MINUTE` | 30 | token-bucket ceiling (adaptive) |
| `CSV_LIGHTHOUSE_SAMPLE_COOLDOWN_SECONDS` | 20 | base gap between a URL's samples |
| `CSV_LIGHTHOUSE_CACHE_COOLDOWN_SECONDS` | 90 | longer gap after a cached duplicate |
| `CSV_LIGHTHOUSE_MAX_ATTEMPTS_PER_SAMPLE` | 6 | safety cap per sample slot |

`calculate_worker_count` is simplified to `min(CSV_LIGHTHOUSE_MAX_WORKERS, num_urls)`; the
`samples_per_url` scaling and `TARGET_BUDGET_SECONDS`-based sizing are removed.

### Data flow

```
create_run  → items (one per URL×site), run.worker_count = min(MAX_WORKERS, num_urls)
start_run   → scheduler:
                N workers ⇄ shared eligible-URL queue + shared RateLimiter
                each PSI call → classify → update per-URL state → persist valid samples
              → all URLs terminal → finalize medians → finish_run
export_csv  → 25 valid samples/URL + mean/median/min/max summary (+ performance column)
```

### Cancellation

The scheduler checks `should_cancel(run_id)` at the top of each worker iteration and before
acquiring a token; on cancel it stops dispatching, marks remaining pending items cancelled, and
sets the run cancelled — preserving the existing behavior.

## Error handling

- **429:** typed error → adaptive rate reduction + timed pause (Retry-After aware) → retry. Never
  a terminal failure unless the per-sample cap is exhausted.
- **5xx / timeout:** existing client retry, then scheduler exponential backoff → retry.
- **4xx (non-429):** treated as a transient per-slot failure with backoff (some PSI 400s are
  transient under load), bounded by the safety cap.
- **Permanent failure:** a URL that exhausts the safety cap on a slot finishes with `valid_count`
  samples and an explanatory `error_message`; the run completes rather than hanging.

## Testing

Unit tests (`tests/test_csv_lighthouse_service.py`, plus a new `tests/test_rate_limiter.py`) with
an **injected clock + sleep** (cooldowns don't actually block) and a scriptable fake PSI client:

1. Each URL ends with **exactly 25** valid samples with **distinct** timestamps (independence).
2. **Cached duplicates** (repeated timestamp) are discarded, not counted, and retried after the
   longer cooldown.
3. **429** N times then success → no terminal failure; `RateLimiter.penalize` invoked.
4. **Safety cap:** a permanently-failing URL terminates after the cap with `valid_count < 25` and
   does not hang.
5. **Interleaving:** with multiple URLs, a single URL's samples are spaced (never two in flight
   for the same URL back-to-back below `base_cooldown`).
6. **Cancellation** mid-run stops promptly and marks the run cancelled.
7. `RateLimiter` unit tests: token refill rate, blocking, adaptive penalize/recover.
8. Existing tests updated: `calculate_worker_count` new signature/behavior; export now contains
   only valid samples.

Timing-sensitive logic is deterministic via the injected clock, so tests are fast and stable.

## Risks / trade-offs

- **Approved:** only valid samples are persisted → the raw per-attempt PSI failure log is no
  longer in the export (it was useful for this diagnosis; acceptable going forward).
- **Approved:** concurrency default drops to 6 and worker scaling by samples is reverted.
- A legitimately unreachable PSI (sustained outage) makes runs slow before the safety cap trips;
  the per-sample cap bounds this per URL.
- PSI's exact cache TTL is unknown; timestamp-based detection + escalating cooldown adapts without
  needing the precise value.
