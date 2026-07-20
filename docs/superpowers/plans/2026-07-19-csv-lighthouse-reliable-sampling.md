# CSV Lighthouse Reliable N-Sample Scheduler — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collect 25 fresh, independent Lighthouse samples per URL with high reliability and the shortest wall-clock time, by replacing the burst-y per-URL worker model with an interleaved sample scheduler that respects PSI rate limits and defeats PSI's per-URL result cache.

**Architecture:** A shared, thread-safe scheduler dispatches *individual sample tasks* across a small worker pool. Each URL is serialized (one in-flight sample at a time) with a cooldown between its samples; a token-bucket `RateLimiter` throttles global request rate and adapts down on HTTP 429; PSI's `analysisUTCTimestamp` detects cached duplicates (discarded, not counted). Runs retry until each URL has 25 valid samples or a per-sample safety cap trips.

**Tech Stack:** Python 3.11, threading, `unittest`, SQLite/PostgreSQL via `ConnectionManager`; React/TypeScript frontend.

**Spec:** `docs/superpowers/specs/2026-07-19-csv-lighthouse-reliable-sampling-design.md`

**Deviation from spec (intentional, DRY):** The spec proposed a new `PageSpeedRateLimitError(PageSpeedError)`. An equivalent `RateLimitError(ExternalAPIError)` with a `retry_after` field already exists in `exceptions.py`. We reuse it (raised with `provider="Google PageSpeed"`) instead of adding a parallel class.

---

## File Structure

- `config.py` — add 4 CSV Lighthouse tunables; change `CSV_LIGHTHOUSE_MAX_WORKERS` default 16 → 6.
- `services/pagespeed_client.py` — raise `RateLimitError` on HTTP 429 with parsed `Retry-After`.
- `services/rate_limiter.py` — **new** token-bucket `RateLimiter` (injectable clock/sleep).
- `data_access/connection.py` — add `valid_samples` column to `csv_lighthouse_items` (CREATE + migrations).
- `data_access/csv_lighthouse_repository.py` — persist `valid_samples` in `mark_item_passed`; add `heartbeat` and `mark_unfinished_items_cancelled`.
- `services/csv_lighthouse_service.py` — rewrite the run engine (`_run_pending_items`), add scheduler helpers and `_ItemState`; simplify `calculate_worker_count`; remove dead `_process_item` / `_collect_sample`.
- `frontend/src/types/index.ts` — add `valid_samples` to `CsvLighthouseItem`.
- `frontend/src/components/test-urls/CsvLighthouseResultsTable.tsx` + `CsvLighthousePanel.tsx` — show valid `n / target` in the Attempts column.
- `tests/test_rate_limiter.py` — **new**.
- `tests/test_csv_lighthouse_service.py`, `tests/test_csv_lighthouse_repository.py` — update.

Run backend tests with: `python -m pytest <path> -q`. Run frontend checks from `frontend/`: `node_modules/.bin/tsc --noEmit` and `npx vitest run <path>`.

---

## Task 1: Config tunables + simplify worker count

**Files:**
- Modify: `config.py:66`
- Modify: `services/csv_lighthouse_service.py` (`calculate_worker_count`, its call site, constants)
- Test: `tests/test_csv_lighthouse_service.py` (worker-count tests)

- [ ] **Step 1: Update config**

In `config.py`, replace the `CSV_LIGHTHOUSE_MAX_WORKERS` line (currently default `'16'`) and add four tunables after it:

```python
CSV_LIGHTHOUSE_MAX_WORKERS: int = int(os.getenv('CSV_LIGHTHOUSE_MAX_WORKERS', '6'))
"""Maximum concurrent URLs tested at once in a CSV Lighthouse run."""

CSV_LIGHTHOUSE_REQUESTS_PER_MINUTE: float = float(
    os.getenv('CSV_LIGHTHOUSE_REQUESTS_PER_MINUTE', '30')
)
"""Global PSI request ceiling for a CSV Lighthouse run (token bucket; adapts down on 429)."""

CSV_LIGHTHOUSE_SAMPLE_COOLDOWN_SECONDS: float = float(
    os.getenv('CSV_LIGHTHOUSE_SAMPLE_COOLDOWN_SECONDS', '20')
)
"""Minimum gap between successive samples of the same URL (defeats PSI caching)."""

CSV_LIGHTHOUSE_CACHE_COOLDOWN_SECONDS: float = float(
    os.getenv('CSV_LIGHTHOUSE_CACHE_COOLDOWN_SECONDS', '90')
)
"""Longer cooldown applied after PSI returns a cached (duplicate) result."""

CSV_LIGHTHOUSE_MAX_ATTEMPTS_PER_SAMPLE: int = int(
    os.getenv('CSV_LIGHTHOUSE_MAX_ATTEMPTS_PER_SAMPLE', '6')
)
"""Safety cap: consecutive attempts for one sample slot before giving up on a URL."""
```

- [ ] **Step 2: Update the worker-count tests to the new formula**

In `tests/test_csv_lighthouse_service.py`, replace `test_calculate_worker_count_scales_with_samples_and_caps` and `test_create_run_scales_worker_count_with_samples` with:

```python
    def test_calculate_worker_count_scales_with_urls_and_caps(self):
        self.assertEqual(calculate_worker_count(0), 0)
        self.assertEqual(calculate_worker_count(1), 1)
        self.assertEqual(calculate_worker_count(4), 4)
        # Capped at CSV_LIGHTHOUSE_MAX_WORKERS (6).
        self.assertEqual(calculate_worker_count(12), 6)

    def test_create_run_worker_count_is_capped_url_count(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"a/\nb/\nc/\n"))],
            site_keys=["www"],
            strategy="desktop",
            samples_per_url=25,
        )
        run = self.service.get_run(result["run_id"])["run"]
        # 3 URLs -> min(6, 3) = 3 workers (no longer scaled by samples_per_url).
        self.assertEqual(run["worker_count"], 3)
```

Also update the import line near the top of the file — remove `DEFAULT_AVERAGE_SECONDS`:

```python
from services.csv_lighthouse_service import (
    CsvLighthouseService,
    calculate_worker_count,
    normalize_csv_value,
)
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `python -m pytest tests/test_csv_lighthouse_service.py::CsvLighthouseServiceTest::test_calculate_worker_count_scales_with_urls_and_caps -q`
Expected: FAIL (old signature/behavior still present, or import error).

- [ ] **Step 4: Simplify `calculate_worker_count` and its call site**

In `services/csv_lighthouse_service.py`:

Replace the imports block's `DEFAULT_AVERAGE_SECONDS` usage — keep `TARGET_BUDGET_SECONDS`, remove `DEFAULT_AVERAGE_SECONDS` and `MAX_WORKERS_PER_TARGET` if present, and remove `MAX_LIGHTHOUSE_ATTEMPTS` (it becomes dead after Task 5). At the top constants:

```python
TARGET_BUDGET_SECONDS = 540
```

Add the new config imports to the existing `from config import (...)` block:

```python
    CSV_LIGHTHOUSE_MAX_WORKERS,
    CSV_LIGHTHOUSE_REQUESTS_PER_MINUTE,
    CSV_LIGHTHOUSE_SAMPLE_COOLDOWN_SECONDS,
    CSV_LIGHTHOUSE_CACHE_COOLDOWN_SECONDS,
    CSV_LIGHTHOUSE_MAX_ATTEMPTS_PER_SAMPLE,
```

Replace the whole `calculate_worker_count` function with:

```python
def calculate_worker_count(url_count: int) -> int:
    if url_count <= 0:
        return 0
    return max(1, min(CSV_LIGHTHOUSE_MAX_WORKERS, url_count))
```

In `create_run`, change the call site:

```python
        worker_count = calculate_worker_count(len(items))
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `python -m pytest tests/test_csv_lighthouse_service.py -k "worker_count" -q`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add config.py services/csv_lighthouse_service.py tests/test_csv_lighthouse_service.py
git commit -m "feat(csv-lighthouse): cap worker count at URL count; add scheduler tunables

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: PageSpeed client raises RateLimitError on 429

**Files:**
- Modify: `services/pagespeed_client.py` (imports, `_request_with_retry`, add `_parse_retry_after`)
- Test: `tests/test_pagespeed_client.py` (**new**)

- [ ] **Step 1: Write the failing test**

Create `tests/test_pagespeed_client.py`:

```python
import unittest
from unittest.mock import Mock, patch

import requests

from exceptions import RateLimitError
from services.pagespeed_client import PageSpeedClient


def _http_error(status, headers=None):
    response = Mock()
    response.status_code = status
    response.headers = headers or {}
    exc = requests.exceptions.HTTPError(response=response)
    return response, exc


class PageSpeedClient429Test(unittest.TestCase):
    def test_429_raises_rate_limit_error_with_retry_after(self):
        response, exc = _http_error(429, {"Retry-After": "12"})
        response.raise_for_status.side_effect = exc
        with patch("services.pagespeed_client.requests.get", return_value=response):
            client = PageSpeedClient(api_key=None)
            with self.assertRaises(RateLimitError) as ctx:
                client.test_url("https://example.com/", "desktop")
        self.assertEqual(ctx.exception.retry_after, 12)
        self.assertEqual(ctx.exception.provider, "Google PageSpeed")

    def test_429_without_header_defaults_retry_after(self):
        response, exc = _http_error(429, {})
        response.raise_for_status.side_effect = exc
        with patch("services.pagespeed_client.requests.get", return_value=response):
            client = PageSpeedClient(api_key=None)
            with self.assertRaises(RateLimitError) as ctx:
                client.test_url("https://example.com/", "desktop")
        self.assertEqual(ctx.exception.retry_after, 30)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_pagespeed_client.py -q`
Expected: FAIL — currently a 429 raises `PageSpeedError`, not `RateLimitError`.

- [ ] **Step 3: Implement 429 handling**

In `services/pagespeed_client.py`, add to the imports from `exceptions`:

```python
from exceptions import PageSpeedError, RateLimitError
```

Replace the `except requests.exceptions.HTTPError as exc:` branch inside `_request_with_retry` with:

```python
            except requests.exceptions.HTTPError as exc:
                status = exc.response.status_code if exc.response is not None else None
                if status == 429:
                    raise RateLimitError(
                        self._friendly_error(url, exc),
                        provider="Google PageSpeed",
                        retry_after=self._parse_retry_after(exc.response),
                    ) from exc
                if status is not None and status >= 500 and attempt < self._MAX_RETRIES:
                    last_exception = exc
                    time.sleep(self._RETRY_BACKOFF_SECONDS)
                    continue
                raise PageSpeedError(
                    self._friendly_error(url, exc),
                ) from exc
```

Add this static method to the class (next to `_friendly_error`):

```python
    @staticmethod
    def _parse_retry_after(response) -> int:
        """Parse a Retry-After header (seconds); default 30 if absent/unparseable."""
        if response is None:
            return 30
        value = response.headers.get("Retry-After")
        if not value:
            return 30
        try:
            return max(1, int(value))
        except (TypeError, ValueError):
            return 30
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_pagespeed_client.py -q`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add services/pagespeed_client.py tests/test_pagespeed_client.py
git commit -m "feat(pagespeed): raise RateLimitError with Retry-After on HTTP 429

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: RateLimiter (token bucket, adaptive)

**Files:**
- Create: `services/rate_limiter.py`
- Test: `tests/test_rate_limiter.py` (**new**)

- [ ] **Step 1: Write the failing test**

Create `tests/test_rate_limiter.py`:

```python
import threading
import unittest

from services.rate_limiter import RateLimiter


class FakeClock:
    """Deterministic virtual clock; sleep advances time instead of blocking."""

    def __init__(self):
        self._t = 0.0
        self._lock = threading.Lock()

    def now(self):
        with self._lock:
            return self._t

    def sleep(self, seconds):
        with self._lock:
            self._t += max(0.0, seconds)


class RateLimiterTest(unittest.TestCase):
    def test_first_acquire_is_immediate(self):
        clock = FakeClock()
        limiter = RateLimiter(60, clock=clock.now, sleep_func=clock.sleep)
        limiter.acquire()
        self.assertEqual(clock.now(), 0.0)

    def test_second_acquire_waits_for_refill(self):
        clock = FakeClock()
        limiter = RateLimiter(60, clock=clock.now, sleep_func=clock.sleep)  # 1/sec
        limiter.acquire()
        limiter.acquire()
        # One token per second at 60/min, so the 2nd acquire advances ~1s.
        self.assertGreaterEqual(clock.now(), 1.0)

    def test_penalize_pauses_and_halves_rate(self):
        clock = FakeClock()
        limiter = RateLimiter(60, clock=clock.now, sleep_func=clock.sleep)
        limiter.acquire()
        limiter.penalize(retry_after=10)
        limiter.acquire()
        # Must have waited out the 10s pause.
        self.assertGreaterEqual(clock.now(), 10.0)

    def test_penalize_respects_min_rate_floor(self):
        clock = FakeClock()
        limiter = RateLimiter(60, clock=clock.now, sleep_func=clock.sleep, min_rate_per_minute=30)
        for _ in range(10):
            limiter.penalize(retry_after=0)
        self.assertGreaterEqual(limiter.effective_rate_per_minute(), 30)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `python -m pytest tests/test_rate_limiter.py -q`
Expected: FAIL — `services.rate_limiter` does not exist.

- [ ] **Step 3: Implement the RateLimiter**

Create `services/rate_limiter.py`:

```python
"""Thread-safe token-bucket rate limiter with adaptive slow-down on throttling."""

from __future__ import annotations

import threading
import time
from typing import Callable


class RateLimiter:
    """Token bucket shared across worker threads.

    Refills ``rate_per_minute`` tokens evenly over a minute. ``acquire`` blocks
    (via the injected sleep) until a token is available. ``penalize`` — called on
    HTTP 429 — halves the effective rate down to ``min_rate_per_minute`` and pauses
    all callers for ``retry_after`` seconds. ``recover`` nudges the rate back up.
    """

    def __init__(
        self,
        rate_per_minute: float,
        clock: Callable[[], float] = time.monotonic,
        sleep_func: Callable[[float], None] = time.sleep,
        min_rate_per_minute: float = 6.0,
    ) -> None:
        self._base_rate = max(1.0, float(rate_per_minute))
        self._rate = self._base_rate
        self._min_rate = min(float(min_rate_per_minute), self._base_rate)
        self._clock = clock
        self._sleep = sleep_func
        self._lock = threading.Lock()
        self._tokens = 1.0
        self._last_refill = clock()
        self._paused_until = 0.0

    def _refill(self, now: float) -> None:
        elapsed = now - self._last_refill
        if elapsed > 0:
            self._tokens = min(self._rate, self._tokens + elapsed * (self._rate / 60.0))
            self._last_refill = now

    def acquire(self) -> None:
        while True:
            with self._lock:
                now = self._clock()
                if now < self._paused_until:
                    wait = self._paused_until - now
                else:
                    self._refill(now)
                    if self._tokens >= 1.0:
                        self._tokens -= 1.0
                        return
                    wait = (1.0 - self._tokens) / (self._rate / 60.0)
            self._sleep(max(wait, 0.001))

    def penalize(self, retry_after: float = 30.0) -> None:
        with self._lock:
            self._rate = max(self._min_rate, self._rate / 2.0)
            now = self._clock()
            self._paused_until = max(self._paused_until, now + max(1.0, float(retry_after)))
            self._tokens = 0.0

    def recover(self) -> None:
        with self._lock:
            self._rate = min(self._base_rate, self._rate * 1.5)

    def effective_rate_per_minute(self) -> float:
        with self._lock:
            return self._rate
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python -m pytest tests/test_rate_limiter.py -q`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add services/rate_limiter.py tests/test_rate_limiter.py
git commit -m "feat: add adaptive token-bucket RateLimiter

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Repository — valid_samples column, heartbeat, cancel-unfinished

**Files:**
- Modify: `data_access/connection.py` (2 CREATE TABLE blocks + 2 migration lists)
- Modify: `data_access/csv_lighthouse_repository.py` (`mark_item_passed`, add `heartbeat`, add `mark_unfinished_items_cancelled`)
- Test: `tests/test_csv_lighthouse_repository.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_csv_lighthouse_repository.py` (inside the existing test class; if unsure of the class name, open the file and match the existing `def test_*` indentation):

```python
    def test_mark_item_passed_stores_valid_samples(self):
        run_id = self.repo.create_run(
            label="valid-samples", strategy="desktop", site_keys=["www"],
            worker_count=1, target_budget_seconds=60, total_items=1,
        )
        item_id = self.repo.create_items(run_id, [
            {"source_filename": "PDP.csv", "group_key": "PDP", "site_key": "www",
             "original_value": "brass-lamp/",
             "generated_url": "https://www.lampsplus.com/p/brass-lamp/", "strategy": "desktop"},
        ])[0]
        self.repo.mark_item_running(item_id)
        self.repo.mark_item_passed(item_id, {"fcp": 100, "valid_samples": 25, "attempts": 30})
        item = self.repo.get_run_detail(run_id)["items"][0]
        self.assertEqual(item["valid_samples"], 25)
        self.assertEqual(item["attempts"], 30)

    def test_mark_unfinished_items_cancelled_covers_pending_and_running(self):
        run_id = self.repo.create_run(
            label="cancel", strategy="desktop", site_keys=["www"],
            worker_count=1, target_budget_seconds=60, total_items=2,
        )
        ids = self.repo.create_items(run_id, [
            {"source_filename": "PDP.csv", "group_key": "PDP", "site_key": "www",
             "original_value": "a/", "generated_url": "https://www.lampsplus.com/p/a/", "strategy": "desktop"},
            {"source_filename": "PDP.csv", "group_key": "PDP", "site_key": "www",
             "original_value": "b/", "generated_url": "https://www.lampsplus.com/p/b/", "strategy": "desktop"},
        ])
        self.repo.mark_item_running(ids[0])  # running; ids[1] stays pending
        count = self.repo.mark_unfinished_items_cancelled(run_id)
        statuses = sorted(i["status"] for i in self.repo.get_run_detail(run_id)["items"])
        self.assertEqual(count, 2)
        self.assertEqual(statuses, ["cancelled", "cancelled"])
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_csv_lighthouse_repository.py -k "valid_samples or unfinished" -q`
Expected: FAIL — `valid_samples` column / `mark_unfinished_items_cancelled` do not exist.

- [ ] **Step 3: Add the `valid_samples` column to the schema**

In `data_access/connection.py`, in **both** `CREATE TABLE IF NOT EXISTS csv_lighthouse_items` blocks (the PostgreSQL one near line 404 and the SQLite one near line 773), add `valid_samples INTEGER` immediately after the `performance REAL,` line:

```sql
                performance REAL,
                valid_samples INTEGER,
```

In the PostgreSQL migration section (near the `ADD COLUMN IF NOT EXISTS performance` lines added earlier), add:

```python
        cursor.execute("ALTER TABLE csv_lighthouse_items ADD COLUMN IF NOT EXISTS valid_samples INTEGER")
```

In the `_SQLITE_MIGRATIONS` list (near the `ADD COLUMN performance REAL` line), add:

```python
            "ALTER TABLE csv_lighthouse_items ADD COLUMN valid_samples INTEGER",
```

- [ ] **Step 4: Persist `valid_samples` in `mark_item_passed`**

In `data_access/csv_lighthouse_repository.py`, inside `mark_item_passed`, add the column to the UPDATE and the value to the params tuple. The SET clause becomes:

```python
                    SET status = 'passed',
                        error_message = NULL,
                        fcp = {ph},
                        speed_index = {ph},
                        lcp = {ph},
                        tbt = {ph},
                        cls = {ph},
                        performance = {ph},
                        valid_samples = {ph},
                        attempts = {ph},
                        duration_ms = {ph},
                        completed_at = CURRENT_TIMESTAMP
                    WHERE id = {ph} AND status = 'running'
```

And the params tuple becomes:

```python
                    (
                        metrics.get("fcp"),
                        metrics.get("speed_index"),
                        metrics.get("lcp"),
                        metrics.get("tbt"),
                        metrics.get("cls"),
                        metrics.get("performance"),
                        metrics.get("valid_samples"),
                        metrics.get("attempts", 1),
                        metrics.get("duration_ms"),
                        item_id,
                    ),
```

- [ ] **Step 5: Add `heartbeat` and `mark_unfinished_items_cancelled`**

In `data_access/csv_lighthouse_repository.py`, add two methods (place them near `mark_pending_items_cancelled`):

```python
    def heartbeat(self, run_id: int) -> None:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            conn.cursor().execute(
                f"UPDATE csv_lighthouse_runs SET updated_at = CURRENT_TIMESTAMP WHERE id = {ph}",
                (run_id,),
            )

    def mark_unfinished_items_cancelled(self, run_id: int) -> int:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    UPDATE csv_lighthouse_items
                    SET status = 'cancelled',
                        error_message = 'Cancelled',
                        completed_at = CURRENT_TIMESTAMP
                    WHERE run_id = {ph} AND status IN ('pending', 'running')
                    """,
                    (run_id,),
                )
                cancelled = cursor.rowcount
                self._refresh_run_progress(cursor, run_id)
                return cancelled
        except Exception as exc:
            raise DatabaseError(
                f"Failed to cancel unfinished CSV Lighthouse items for run {run_id}: {exc}"
            ) from exc
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `python -m pytest tests/test_csv_lighthouse_repository.py -k "valid_samples or unfinished" -q`
Expected: PASS (2 tests).

- [ ] **Step 7: Run the full repository suite (guard against regressions)**

Run: `python -m pytest tests/test_csv_lighthouse_repository.py -q`
Expected: PASS (all).

- [ ] **Step 8: Commit**

```bash
git add data_access/connection.py data_access/csv_lighthouse_repository.py tests/test_csv_lighthouse_repository.py
git commit -m "feat(csv-lighthouse): valid_samples column, heartbeat, cancel-unfinished

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Rewrite the run engine as an interleaved scheduler

This is the core task. It replaces `_run_pending_items`, removes `_process_item` / `_collect_sample`, and updates the affected service tests (which now use a virtual clock so cooldowns don't block).

**Files:**
- Modify: `services/csv_lighthouse_service.py`
- Test: `tests/test_csv_lighthouse_service.py`

- [ ] **Step 1: Add imports, constructor injection, and `_ItemState`**

At the top of `services/csv_lighthouse_service.py`, ensure these imports exist:

```python
import threading
import time
from dataclasses import dataclass, field
```

Add the state dataclass at module level (after the constants, before `class CsvLighthouseService`):

```python
@dataclass
class _ItemState:
    """In-memory scheduling state for one URL during a run (not persisted)."""

    item: dict
    target: int
    valid_count: int = 0
    attempts_used: int = 0
    slot_attempts: int = 0
    next_eligible_at: float = 0.0
    in_flight: bool = False
    started: bool = False
    done: bool = False
    seen_timestamps: set = field(default_factory=set)
    passed_samples: list = field(default_factory=list)
```

Change the constructor to accept an injectable clock/sleep:

```python
    def __init__(
        self,
        repository,
        pagespeed_client,
        start_background: bool = True,
        time_source=time.monotonic,
        sleep_func=time.sleep,
    ):
        self.repository = repository
        self.pagespeed_client = pagespeed_client
        self.start_background = start_background
        self._now = time_source
        self._sleep = sleep_func
```

- [ ] **Step 2: Add scheduler helper methods**

Add these methods to `CsvLighthouseService` (they replace the sampling logic in `_collect_sample`/`_median_metrics` callers; keep the existing `_median_metrics`):

```python
    def _attempt_sample(self, item: dict):
        """One PSI call. Returns (metrics|None, rate_limited: bool, retry_after: float)."""
        started = self._now()
        try:
            metrics = dict(
                self.pagespeed_client.test_url(item["generated_url"], item["strategy"])
            )
            metrics["performance"] = metrics.get("performance_score")
            metrics["duration_ms"] = int((self._now() - started) * 1000)
            return metrics, False, 0.0
        except RateLimitError as exc:
            return None, True, float(getattr(exc, "retry_after", 30) or 30)
        except Exception:
            return None, False, 0.0

    @staticmethod
    def _sample_signature(metrics: dict):
        """A hashable identity for a PSI result: its analysis timestamp, or a
        metric-tuple fallback when the timestamp is absent."""
        raw = metrics.get("raw_data")
        if isinstance(raw, dict) and raw.get("fetch_time"):
            return raw["fetch_time"]
        return (
            "metrics", metrics.get("fcp"), metrics.get("lcp"),
            metrics.get("speed_index"), metrics.get("tbt"), metrics.get("cls"),
        )

    def _error_backoff(self, slot_attempts: int) -> float:
        base = CSV_LIGHTHOUSE_SAMPLE_COOLDOWN_SECONDS
        return min(
            CSV_LIGHTHOUSE_CACHE_COOLDOWN_SECONDS,
            base * (2 ** max(0, slot_attempts - 1)),
        )

    def _finalize_item(self, state: _ItemState) -> None:
        item_id = state.item["id"]
        if state.passed_samples:
            representative = self._median_metrics(state.passed_samples)
            representative["attempts"] = state.attempts_used
            durations = [
                s.get("duration_ms")
                for s in state.passed_samples
                if isinstance(s.get("duration_ms"), (int, float))
            ]
            representative["duration_ms"] = int(sum(durations)) if durations else None
            representative["valid_samples"] = state.valid_count
            self.repository.mark_item_passed(item_id, representative)
        else:
            self.repository.mark_item_failed(
                item_id,
                "No successful PSI samples within the attempt cap",
                attempts=state.attempts_used or 1,
            )
```

- [ ] **Step 3: Add the per-sample worker step**

Add this method (state math under a lock; DB/limiter side-effects outside it — safe because each URL is serialized via `in_flight`):

```python
    def _work_one_sample(self, run_id, state, limiter, lock) -> None:
        limiter.acquire()
        metrics, rate_limited, retry_after = self._attempt_sample(state.item)

        persist_sample = None
        finalize = False
        with lock:
            state.attempts_used += 1
            state.slot_attempts += 1
            now = self._now()
            if metrics is not None:
                signature = self._sample_signature(metrics)
                if signature in state.seen_timestamps:
                    state.next_eligible_at = now + CSV_LIGHTHOUSE_CACHE_COOLDOWN_SECONDS
                else:
                    state.seen_timestamps.add(signature)
                    state.valid_count += 1
                    state.slot_attempts = 0
                    state.passed_samples.append(metrics)
                    persist_sample = (state.valid_count, metrics)
                    state.next_eligible_at = now + CSV_LIGHTHOUSE_SAMPLE_COOLDOWN_SECONDS
            elif rate_limited:
                state.next_eligible_at = now + max(1.0, retry_after)
            else:
                state.next_eligible_at = now + self._error_backoff(state.slot_attempts)

            if (
                state.valid_count >= state.target
                or state.slot_attempts >= CSV_LIGHTHOUSE_MAX_ATTEMPTS_PER_SAMPLE
            ):
                if not state.done:
                    state.done = True
                    finalize = True

        if persist_sample is not None:
            index, sample_metrics = persist_sample
            self.repository.create_sample(
                run_id=run_id,
                item_id=state.item["id"],
                sample_index=index,
                status="passed",
                metrics=sample_metrics,
                attempts=1,
                duration_ms=sample_metrics.get("duration_ms"),
                error_message=None,
            )
            limiter.recover()
        elif rate_limited:
            limiter.penalize(retry_after)
            self.repository.heartbeat(run_id)
        else:
            self.repository.heartbeat(run_id)

        if finalize:
            self._finalize_item(state)
```

- [ ] **Step 4: Replace `_run_pending_items` with the scheduler**

Replace the entire existing `_run_pending_items` method with:

```python
    def _run_pending_items(self, run_id: int) -> None:
        detail = self.repository.get_run_detail(run_id)
        run = detail["run"]
        samples_per_url = max(1, int(run.get("samples_per_url") or 1))
        max_workers = max(1, int(run.get("worker_count") or 1))
        self.repository.mark_run_running(run_id)

        pending = self.repository.pending_items(run_id)
        if not pending:
            self.repository.finish_run_if_complete(run_id)
            return

        states = [_ItemState(item=item, target=samples_per_url) for item in pending]
        limiter = RateLimiter(
            CSV_LIGHTHOUSE_REQUESTS_PER_MINUTE,
            clock=self._now,
            sleep_func=self._sleep,
        )
        lock = threading.Lock()

        def claim_next():
            """Return a claimable state, ('wait', seconds), or None (all done / cancelled)."""
            with lock:
                if self.repository.should_cancel(run_id):
                    return None
                now = self._now()
                soonest = None
                for state in states:
                    if state.done or state.in_flight:
                        continue
                    if now >= state.next_eligible_at:
                        state.in_flight = True
                        return state
                    soonest = (
                        state.next_eligible_at
                        if soonest is None
                        else min(soonest, state.next_eligible_at)
                    )
                if all(state.done for state in states):
                    return None
                if soonest is not None:
                    return ("wait", max(0.05, soonest - now))
                return ("wait", 0.25)  # items in flight; poll again shortly

        def worker():
            while True:
                claim = claim_next()
                if claim is None:
                    return
                if isinstance(claim, tuple):
                    self._sleep(claim[1])
                    continue
                state = claim
                try:
                    if not state.started:
                        self.repository.mark_item_running(state.item["id"])
                        state.started = True
                    self._work_one_sample(run_id, state, limiter, lock)
                finally:
                    with lock:
                        state.in_flight = False

        threads = [threading.Thread(target=worker, daemon=False) for _ in range(max_workers)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        # Finalize any URL interrupted mid-run: keep partial data as passed, else sweep.
        for state in states:
            if not state.done and state.passed_samples:
                state.done = True
                self._finalize_item(state)

        cancelled = self.repository.mark_unfinished_items_cancelled(run_id)
        if self.repository.should_cancel(run_id) and cancelled:
            self.repository.mark_run_cancelled(run_id)
            return
        self.repository.finish_run_if_complete(run_id)
```

- [ ] **Step 5: Remove the dead per-item methods and constant**

Delete `_process_item` and `_collect_sample` from `services/csv_lighthouse_service.py` (fully superseded). If `MAX_LIGHTHOUSE_ATTEMPTS` is now referenced nowhere, delete its definition too. Add the RateLimiter/RateLimitError imports at the top:

```python
from exceptions import RateLimitError, ValidationError
from services.rate_limiter import RateLimiter
```

(The existing `from exceptions import ValidationError` line is replaced by the combined import above.)

- [ ] **Step 6: Add a virtual clock to the test setup and update existing service tests**

In `tests/test_csv_lighthouse_service.py`, add a thread-safe fake clock near the top (after imports):

```python
class FakeClock:
    def __init__(self):
        self._t = 0.0
        self._lock = threading.Lock()

    def now(self):
        with self._lock:
            return self._t

    def sleep(self, seconds):
        with self._lock:
            self._t += max(0.0, seconds)
```

Add `import threading` and `from unittest.mock import patch` at the top if not already present.

In `setUp`, build the service with the fake clock so cooldowns/limiter waits are virtual (instant):

```python
        self.pagespeed = FakePageSpeedClient()
        self.clock = FakeClock()
        self.service = CsvLighthouseService(
            self.repo, self.pagespeed, start_background=False,
            time_source=self.clock.now, sleep_func=self.clock.sleep,
        )
```

Add a helper method to the test class for building extra services with the same virtual clock:

```python
    def _make_service(self, pagespeed):
        return CsvLighthouseService(
            self.repo, pagespeed, start_background=False,
            time_source=self.clock.now, sleep_func=self.clock.sleep,
        )
```

Update the following tests to use `self._make_service(...)` instead of `CsvLighthouseService(self.repo, <psi>, start_background=False)`:
`test_run_samples_each_url_n_times_and_stores_median`, `test_item_fails_when_all_samples_fail`,
`test_export_csv_has_raw_samples_and_per_url_summary`,
`test_cancel_stops_scheduling_new_items_and_marks_pending_cancelled`,
`test_cancel_between_samples_stops_early_and_keeps_passed`,
`test_late_cancel_after_all_items_passed_finishes_completed_and_exports`.

- [ ] **Step 7: Fix the assertions that change under the new engine**

**(a)** `test_item_fails_when_all_samples_fail` — failed attempts are no longer persisted as samples. Replace its body's tail with:

```python
        service = self._make_service(pagespeed)
        result = service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
            samples_per_url=2,
        )
        service.run_pending_items(result["run_id"])
        item = self.repo.get_run_detail(result["run_id"])["items"][0]
        samples = self.repo.list_samples(result["run_id"])

        self.assertEqual(item["status"], "failed")
        self.assertEqual(len(samples), 0)  # only valid samples are persisted now
```

**(b)** The two "stop scheduling" cancel tests run with 2 URLs; force single-worker so cancellation is deterministic. Wrap each affected `create_run` in a `patch` of the worker cap, e.g. for `test_cancel_stops_scheduling_new_items_and_marks_pending_cancelled`:

```python
        service = self._make_service(
            CancellingPageSpeedClient(self.repo, lambda: run_id_holder["run_id"])
        )
        with patch.object(csv_lighthouse_service, "CSV_LIGHTHOUSE_MAX_WORKERS", 1):
            result = service.create_run(
                [("PDP.csv", io.BytesIO(b"brass-lamp/\nfloor-lamp/\n"))],
                site_keys=["www"],
                strategy="desktop",
            )
        run_id_holder["run_id"] = result["run_id"]
        service.run_pending_items(result["run_id"])
        detail = self.repo.get_run_detail(result["run_id"])
        statuses = [item["status"] for item in detail["items"]]
        self.assertEqual(detail["run"]["status"], "cancelled")
        self.assertEqual(statuses, ["passed", "cancelled"])
```

(`csv_lighthouse_service` is already imported as a module at the top of the test file.)

For `test_cancel_between_samples_stops_early_and_keeps_passed` (1 URL, samples 5) and
`test_late_cancel_after_all_items_passed_finishes_completed_and_exports` (1 URL), only swap to
`self._make_service(...)`; their existing assertions (item passed with 1 sample; run completed +
exported) still hold under the new engine.

- [ ] **Step 8: Run the full service suite**

Run: `python -m pytest tests/test_csv_lighthouse_service.py -q`
Expected: PASS (all). If a cancel test is flaky, confirm the `patch.object(..., "CSV_LIGHTHOUSE_MAX_WORKERS", 1)` wraps its `create_run`.

- [ ] **Step 9: Add a scheduler-specific test for cache-duplicate handling**

Add a scriptable client and test to `tests/test_csv_lighthouse_service.py`:

```python
class TimestampedPageSpeedClient(FakePageSpeedClient):
    """Returns scripted analysisUTCTimestamps to simulate fresh vs cached runs."""

    def __init__(self, timestamps):
        super().__init__()
        self._timestamps = list(timestamps)

    def test_url(self, url, strategy):
        self.calls.append((url, strategy))
        ts = self._timestamps[(len(self.calls) - 1) % len(self._timestamps)]
        return {
            "fcp": 900, "speed_index": 1200, "lcp": 1800, "tbt": 50, "cls": 0.02,
            "performance_score": 80, "raw_data": {"fetch_time": ts},
        }
```

```python
    def test_cached_duplicates_are_discarded_until_25_fresh(self):
        # Every other response repeats the previous timestamp (a cache hit).
        timestamps = []
        for i in range(1, 60):
            timestamps.append(i)
            timestamps.append(i)  # duplicate right after each fresh one
        pagespeed = TimestampedPageSpeedClient(timestamps)
        service = self._make_service(pagespeed)
        result = service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"], strategy="desktop", samples_per_url=25,
        )
        service.run_pending_items(result["run_id"])
        detail = self.repo.get_run_detail(result["run_id"])
        item = detail["items"][0]
        samples = self.repo.list_samples(result["run_id"])
        fetch_times = {s.get("sample_index") for s in samples}

        self.assertEqual(item["status"], "passed")
        self.assertEqual(item["valid_samples"], 25)
        self.assertEqual(len(samples), 25)          # duplicates were not persisted
        self.assertEqual(len(fetch_times), 25)      # 25 distinct sample slots
```

- [ ] **Step 10: Run the new test**

Run: `python -m pytest tests/test_csv_lighthouse_service.py::CsvLighthouseServiceTest::test_cached_duplicates_are_discarded_until_25_fresh -q`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add services/csv_lighthouse_service.py tests/test_csv_lighthouse_service.py
git commit -m "feat(csv-lighthouse): interleaved sample scheduler with rate limiting + cache detection

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Frontend — show valid `n / target` in the Attempts column

**Files:**
- Modify: `frontend/src/types/index.ts` (`CsvLighthouseItem`)
- Modify: `frontend/src/components/test-urls/CsvLighthouseResultsTable.tsx`
- Modify: `frontend/src/components/test-urls/CsvLighthousePanel.tsx` (pass `samplesPerUrl`)
- Test: `frontend/src/components/test-urls/csv-lighthouse-results.test.ts` (type default)

- [ ] **Step 1: Add `valid_samples` to the item type**

In `frontend/src/types/index.ts`, in `interface CsvLighthouseItem`, add after `attempts: number`:

```typescript
  valid_samples: number | null
```

- [ ] **Step 2: Update the test helper default so the type compiles**

In `frontend/src/components/test-urls/csv-lighthouse-results.test.ts`, add to the `item()` helper defaults (near `attempts: 1,`):

```typescript
    valid_samples: null,
```

- [ ] **Step 3: Verify types still compile**

Run (from `frontend/`): `node_modules/.bin/tsc --noEmit`
Expected: PASS (exit 0).

- [ ] **Step 4: Accept a `samplesPerUrl` prop and render n / target**

In `frontend/src/components/test-urls/CsvLighthouseResultsTable.tsx`, extend the props:

```typescript
interface CsvLighthouseResultsTableProps {
  items: CsvLighthouseItem[]
  samplesPerUrl: number
}
```

Change the component signature:

```typescript
export function CsvLighthouseResultsTable({ items, samplesPerUrl }: CsvLighthouseResultsTableProps) {
```

Replace the per-row Attempts cell:

```tsx
                  <TableCell className="aurora-num text-right">{item.attempts}</TableCell>
```

with:

```tsx
                  <TableCell className="aurora-num text-right">
                    {item.valid_samples == null ? item.attempts : `${item.valid_samples} / ${samplesPerUrl}`}
                  </TableCell>
```

Rename the header cell from `Attempts` to `Samples`:

```tsx
            <TableHead className="text-right">Samples</TableHead>
```

- [ ] **Step 5: Pass `samplesPerUrl` from the panel**

In `frontend/src/components/test-urls/CsvLighthousePanel.tsx` (line ~448), replace:

```tsx
            <CsvLighthouseResultsTable items={selectedDetail.items} />
```

with:

```tsx
            <CsvLighthouseResultsTable
              items={selectedDetail.items}
              samplesPerUrl={selectedRun?.samples_per_url ?? 1}
            />
```

`selectedRun` is already defined in this file (`const selectedRun = selectedDetail?.run ?? null`, line ~88) and `samples_per_url?: number` exists on `CsvLighthouseRun`, so no other changes are needed.

- [ ] **Step 6: Verify types + unit tests**

Run (from `frontend/`):
- `node_modules/.bin/tsc --noEmit` → exit 0
- `npx vitest run src/components/test-urls/csv-lighthouse-results.test.ts` → PASS

- [ ] **Step 7: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/components/test-urls/CsvLighthouseResultsTable.tsx frontend/src/components/test-urls/CsvLighthousePanel.tsx frontend/src/components/test-urls/csv-lighthouse-results.test.ts
git commit -m "feat(test-urls): show valid samples n/target instead of raw attempts

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Full regression pass

- [ ] **Step 1: Run all CSV Lighthouse + client + limiter backend tests**

Run: `python -m pytest tests/test_csv_lighthouse_service.py tests/test_csv_lighthouse_repository.py tests/test_csv_lighthouse_api.py tests/test_pagespeed_client.py tests/test_rate_limiter.py -q`
Expected: PASS, except the **pre-existing** unrelated failure `tests/test_csv_lighthouse_api.py::test_create_run_requires_at_least_one_file` (fails on a clean tree too — do not attempt to fix it here).

- [ ] **Step 2: Frontend checks**

Run (from `frontend/`): `node_modules/.bin/tsc --noEmit` and `npx vitest run src/components/test-urls/csv-lighthouse-results.test.ts`
Expected: PASS.

- [ ] **Step 3: Final commit if any fixups were needed**

```bash
git add -A
git commit -m "test(csv-lighthouse): regression fixups for reliable sampling

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Notes for the implementer

- **Threading + virtual clock:** production uses real `time.monotonic`/`time.sleep`; tests inject `FakeClock` so cooldowns and limiter waits advance virtual time instantly. Tests with a single URL run on one worker and are fully deterministic; multi-URL cancel tests pin `CSV_LIGHTHOUSE_MAX_WORKERS=1` for determinism.
- **Per-URL serialization:** the `in_flight` flag guarantees only one worker touches a given URL at a time, which is why DB writes in `_work_one_sample` are safe outside the lock.
- **Only valid samples are persisted** (approved). Failed/cached attempts show up only in the item's `attempts` tally; the export is now 25 clean rows per URL plus the summary.
- **Deploy:** after merge, deploy via Railway CLI (`railway up`) per `docs/deploy.md`; the new `valid_samples` column is added by the idempotent migrations on boot.
