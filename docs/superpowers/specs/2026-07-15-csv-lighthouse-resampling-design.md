# CSV Lighthouse Resampling — Design

**Date:** 2026-07-15
**Status:** Approved (brainstorming), pending implementation plan
**Author:** Adam Blais + Claude

## Problem

The weekly PageSpeed report is built by running the Pharos CSV Lighthouse job ~5
times and averaging the results by hand. This is statistically weak:

- **n=5 is too small.** Lighthouse lab data is noisy run-to-run.
- **Mean is spike-sensitive.** A single slow run distorts the average — the
  exact "not very scientific, prone to spikes" complaint.
- **Manual stitching.** Averaging separate run exports by hand is error-prone.

The user asked whether the internal Selenium Grid (39 Docker nodes / 9 VMs) could
run Lighthouse to get a larger dataset.

## Decision: do NOT use the Grid

Pharos does not run Lighthouse on any machine. It calls the **Google PageSpeed
Insights (PSI) API** ([services/pagespeed_client.py](../../../services/pagespeed_client.py));
Google runs Lighthouse on their infrastructure. The bottleneck is that Pharos
runs each URL **once per run** and the user manually repeats runs.

At this scale — **32 URLs × 25–50 samples = 800–1,600 PSI calls per run** — the
PSI API handles the volume trivially (authenticated quota ~25k/day). Self-hosting
Lighthouse on the Grid was rejected because it would:

- Add a subsystem to maintain (Chrome hosting, worker plumbing, result
  normalization) for volume PSI already handles.
- Produce scores that **do not match** the historical PSI weekly report — a
  discontinuity in the very report being improved.
- Risk **worse** data: concurrent audits on shared-CPU nodes inflate metric
  variance from CPU contention. (This contention risk does **not** apply to PSI —
  samples run on Google's infra, so PSI requests parallelize freely.)

The Grid would only be justified if PSI couldn't reach the URLs, or we needed
Chrome-version/device/throttle control, or we hit real quota walls. None apply.
`mcprod.lampsplus.com` and `lampsplus.com` are both **publicly reachable** by
Google, confirmed by the user.

## Approach: resample each URL N times through PSI

A single run samples each URL N times and stores every sample, so the report can
compute true mean + median + spread. The user will run this several times a week
and pool to ~100 samples per URL.

### Data model

Item stays "the URL under test" (32 rows/run). Add a child table for the
individual measurements.

**New table `csv_lighthouse_samples`:**

| column | type | notes |
|---|---|---|
| `id` | PK | |
| `item_id` | FK → `csv_lighthouse_items(id)` | |
| `run_id` | int | denormalized for run-level queries |
| `sample_index` | int | 1..N |
| `status` | text | `passed` / `failed` |
| `fcp`, `speed_index`, `lcp`, `tbt`, `cls` | numeric, nullable | one PSI measurement |
| `attempts` | int | PSI retry count for this sample |
| `duration_ms` | int | |
| `error_message` | text, nullable | |
| `completed_at` | timestamp | |

**`csv_lighthouse_runs`:** add `samples_per_url` (int, default `1`).

Migration is **additive** — existing runs/items are untouched and read back as
single-sample (see backward compatibility).

### Execution

Reuse the existing `ThreadPoolExecutor` machinery in
[services/csv_lighthouse_service.py](../../../services/csv_lighthouse_service.py)
unchanged at the item granularity. Change `_process_item`:

- Loop `samples_per_url` times. Each pass calls `pagespeed_client.test_url`
  (keeping the existing 2-attempt retry) and inserts one `csv_lighthouse_samples`
  row (passed with metrics, or failed with error).
- Check `should_cancel(run_id)` **between samples** so a long item can abort
  promptly.
- After the loop, set the item's representative metrics = **median** of its
  passed samples, and item status = `passed` if ≥1 sample passed, else `failed`.

This keeps `total_items` (32), progress tracking, dedupe, Recent Runs, cancel,
and stale-run recovery all working as-is. Because `updated_at` is touched on every
sample completion, a healthy long run stays clear of the 1,800s stale threshold.

**Concurrency:** per-item work grows ~N×, so run time scales accordingly (e.g. 32
URLs × 25 samples × ~25s ÷ workers). The old 4-worker cap
(`MAX_WORKERS_PER_TARGET`) is safe but slow; make worker count configurable and
raise it — even 12 workers is ~29 req/min, far under PSI's ~240/min ceiling. Exact
value decided in the plan.

### Statistics

All aggregation is computed on read from `csv_lighthouse_samples` — nothing
denormalized. Per URL, per metric (FCP, Speed Index, LCP, TBT, CLS), over the
**passed** samples: `mean`, `median`, `min`, `max`, `n`.

Reported statistical note carried into the plan: **mean pools correctly across
runs; median does not.** A true pooled median over ~100 samples requires the raw
samples — which is why the export carries them (below).

### CSV export

Extend `export_csv` ([csv_lighthouse_service.py](../../../services/csv_lighthouse_service.py)),
preserving the current per-`(site_key, group_key)` section structure:

1. **Raw sample rows** — one row per sample, adding `sample_index` and sample
   `completed_at` columns to the existing metric columns.
2. **Per-URL summary row** — for each URL: `mean`, `median`, `min`, `max`, `n`
   per metric.

Concatenating several weekly exports lets the report tool compute the true pooled
mean **and** median over ~100 samples. The existing group-level "Averages" row may
stay or be dropped during the plan — the per-URL summary supersedes it.

The **in-app** UI (`CsvLighthouseResultsTable`, PageComparison) is **unchanged**:
it reads the item's representative (median) metrics, so it keeps working with no
frontend results-table work.

### Frontend

Only change: add a **samples-per-URL input** (1..`MAX_SAMPLES_PER_URL`) to the run
form in `CsvLighthousePanel`, wired through the create-run API to
`samples_per_url`. Default reflects the config default.

### Config (new)

- `CSV_LIGHTHOUSE_MAX_SAMPLES_PER_URL` (default `50`) — per-URL cap.
- `CSV_LIGHTHOUSE_MAX_TOTAL_SAMPLES` (default `3000`) — bounds `items × samples`
  per run; validated in `create_run`.
- Worker concurrency value for sampling runs (name/default set in plan).

### Operational requirement

A **PSI API key** must be configured. 800–1,600 calls/run on the keyless tier will
hit 429s. Verify the key is set and passed to `PageSpeedClient` before the first
heavy run.

## Backward compatibility

- Existing runs (no `samples_per_url`, no samples rows) read as single-sample: the
  export/stats fall back to the item's own inline metrics when no
  `csv_lighthouse_samples` rows exist.
- New runs with `samples_per_url=1` behave exactly like today, and additionally
  write one sample row + set item metrics from it.

## Out of scope (YAGNI)

- Self-hosted Lighthouse / Grid integration.
- Cross-run pooling inside Pharos — the user pools exports in their report tool.
- New in-app statistics dashboards — export is the deliverable interface.
- Changing the reported metric set or adding the 0–100 category score.

## Success criteria

1. A run with `samples_per_url=N` produces N `csv_lighthouse_samples` rows per URL.
2. The item shows the **median** of its samples as its representative metrics; the
   in-app table renders unchanged.
3. Cancel aborts between samples, not just between items.
4. The CSV export contains raw sample rows **and** per-URL mean/median/min/max/n.
5. Existing (pre-migration) runs still export and display correctly.
6. `create_run` rejects requests exceeding `MAX_SAMPLES_PER_URL` or
   `MAX_TOTAL_SAMPLES` with a clear `ValidationError`.
