# CSV Lighthouse Resampling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a single CSV Lighthouse run sample each URL N times through the PSI API, store every sample, and export raw samples plus per-URL mean/median/min/max/n so the weekly report can pool to a large, spike-resistant dataset.

**Architecture:** A new `csv_lighthouse_samples` child table holds individual measurements; the `csv_lighthouse_items` row stays "the URL under test" and carries the **median** of its samples as its representative value (so the existing UI is untouched). The executor loops N times per item, checking cancel between samples. Aggregation is computed on read in `export_csv`.

**Tech Stack:** Python 3.11, Flask, SQLite (dev) / PostgreSQL (prod), `unittest` via `pytest`, React 19 + TypeScript + Vite frontend.

**Reference spec:** [docs/superpowers/specs/2026-07-15-csv-lighthouse-resampling-design.md](../specs/2026-07-15-csv-lighthouse-resampling-design.md)

---

## File Structure

- **Modify** `data_access/connection.py` — add `csv_lighthouse_samples` table (Postgres + SQLite), add `samples_per_url` column to `csv_lighthouse_runs`, add indexes.
- **Modify** `data_access/csv_lighthouse_repository.py` — `create_run` gains `samples_per_url`; new `create_sample` and `list_samples`.
- **Modify** `config.py` — new caps `CSV_LIGHTHOUSE_MAX_SAMPLES_PER_URL`, `CSV_LIGHTHOUSE_MAX_TOTAL_SAMPLES`, `CSV_LIGHTHOUSE_MAX_WORKERS`.
- **Modify** `services/csv_lighthouse_service.py` — `create_run` gains `samples_per_url` + validation; `_process_item` samples N times; new `_collect_sample`, `_median_metrics`; `export_csv` rewritten to raw-samples-plus-summary.
- **Modify** `routes/csv_lighthouse_api.py` — read `samples_per_url` from the form.
- **Modify** `frontend/src/services/api.ts` — `createCsvLighthouseRun` sends `samples_per_url`.
- **Modify** `frontend/src/components/test-urls/CsvLighthousePanel.tsx` — samples-per-URL input on the run form.
- **Modify** `frontend/src/types/index.ts` — optional `samples_per_url` on the run type.
- **Modify** `tests/test_csv_lighthouse_repository.py`, `tests/test_csv_lighthouse_service.py` — new tests + update the export test.

**Test command (backend):** `python -m pytest tests/test_csv_lighthouse_repository.py tests/test_csv_lighthouse_service.py -v`
**Typecheck/build (frontend):** `cd frontend && npm run build`

---

## Task 1: Schema — samples table + `samples_per_url` column

**Files:**
- Modify: `data_access/connection.py` (Postgres block near line 354-434, SQLite block near line 701-774 and the `_SQLITE_MIGRATIONS` list near line 918)
- Test: `tests/test_csv_lighthouse_repository.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_csv_lighthouse_repository.py` inside `CsvLighthouseRepositoryTest`:

```python
    def test_schema_has_samples_table_and_samples_per_url_column(self):
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='csv_lighthouse_samples'"
            )
            self.assertIsNotNone(cursor.fetchone())
            cursor.execute("PRAGMA table_info(csv_lighthouse_runs)")
            columns = {row[1] for row in cursor.fetchall()}
            self.assertIn("samples_per_url", columns)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_csv_lighthouse_repository.py::CsvLighthouseRepositoryTest::test_schema_has_samples_table_and_samples_per_url_column -v`
Expected: FAIL — table `csv_lighthouse_samples` not found (fetchone returns None).

- [ ] **Step 3: Add the Postgres schema**

In `data_access/connection.py`, in `_init_postgres_schema`, immediately after the `csv_lighthouse_items` `CREATE TABLE` block (ends near line 428), add:

```python
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS csv_lighthouse_samples (
                id SERIAL PRIMARY KEY,
                run_id INTEGER NOT NULL,
                item_id INTEGER NOT NULL,
                sample_index INTEGER NOT NULL,
                status TEXT NOT NULL,
                fcp REAL,
                speed_index REAL,
                lcp REAL,
                tbt REAL,
                cls REAL,
                attempts INTEGER NOT NULL DEFAULT 1,
                duration_ms INTEGER,
                error_message TEXT,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (run_id) REFERENCES csv_lighthouse_runs (id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES csv_lighthouse_items (id) ON DELETE CASCADE
            )
        """)
```

In the same method, in the migration section near line 433-434, add:

```python
        cursor.execute("ALTER TABLE csv_lighthouse_runs ADD COLUMN IF NOT EXISTS samples_per_url INTEGER NOT NULL DEFAULT 1")
```

- [ ] **Step 4: Add the SQLite schema**

In `_init_sqlite_schema`, immediately after the `csv_lighthouse_items` `CREATE TABLE` block (ends near line 774), add:

```python
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS csv_lighthouse_samples (
                id INTEGER PRIMARY KEY,
                run_id INTEGER NOT NULL,
                item_id INTEGER NOT NULL,
                sample_index INTEGER NOT NULL,
                status TEXT NOT NULL,
                fcp REAL,
                speed_index REAL,
                lcp REAL,
                tbt REAL,
                cls REAL,
                attempts INTEGER NOT NULL DEFAULT 1,
                duration_ms INTEGER,
                error_message TEXT,
                completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (run_id) REFERENCES csv_lighthouse_runs (id) ON DELETE CASCADE,
                FOREIGN KEY (item_id) REFERENCES csv_lighthouse_items (id) ON DELETE CASCADE
            )
        """)
```

In the `_SQLITE_MIGRATIONS` list (near line 918-933), add this entry:

```python
            "ALTER TABLE csv_lighthouse_runs ADD COLUMN samples_per_url INTEGER NOT NULL DEFAULT 1",
```

- [ ] **Step 5: Add indexes**

In `_create_postgres_indexes` and `_create_sqlite_indexes`, add these two statements to each `index_statements` list:

```python
            """
            CREATE INDEX IF NOT EXISTS idx_csv_lighthouse_samples_run
            ON csv_lighthouse_samples (run_id, item_id, sample_index)
            """,
            """
            CREATE INDEX IF NOT EXISTS idx_csv_lighthouse_samples_item
            ON csv_lighthouse_samples (item_id)
            """,
```

- [ ] **Step 6: Run test to verify it passes**

Run: `python -m pytest tests/test_csv_lighthouse_repository.py::CsvLighthouseRepositoryTest::test_schema_has_samples_table_and_samples_per_url_column -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add data_access/connection.py tests/test_csv_lighthouse_repository.py
git commit -m "feat: add csv_lighthouse_samples table and samples_per_url column"
```

---

## Task 2: Repository — `create_sample`, `list_samples`, `create_run` samples_per_url

**Files:**
- Modify: `data_access/csv_lighthouse_repository.py:16-49` (`create_run`), and add two new methods
- Test: `tests/test_csv_lighthouse_repository.py`

- [ ] **Step 1: Write the failing test**

Add to `CsvLighthouseRepositoryTest`:

```python
    def test_create_run_stores_samples_per_url(self):
        run_id = self.repo.create_run(
            label="Sampled",
            strategy="desktop",
            site_keys=["www"],
            worker_count=1,
            target_budget_seconds=540,
            total_items=1,
            samples_per_url=25,
        )
        run = self.repo.get_run_detail(run_id)["run"]
        self.assertEqual(run["samples_per_url"], 25)

    def test_create_and_list_samples_round_trip(self):
        run_id = self.repo.create_run("S", "desktop", ["www"], 1, 540, 1, samples_per_url=2)
        item_id = self.repo.create_items(
            run_id,
            [
                {
                    "source_filename": "PDP.csv",
                    "group_key": "PDP",
                    "site_key": "www",
                    "original_value": "brass-lamp/",
                    "generated_url": "https://www.lampsplus.com/p/brass-lamp/",
                    "strategy": "desktop",
                }
            ],
        )[0]

        self.repo.create_sample(
            run_id=run_id,
            item_id=item_id,
            sample_index=1,
            status="passed",
            metrics={"fcp": 900, "speed_index": 1200, "lcp": 1800, "tbt": 50, "cls": 0.02},
            attempts=1,
            duration_ms=1500,
            error_message=None,
        )
        self.repo.create_sample(
            run_id=run_id,
            item_id=item_id,
            sample_index=2,
            status="failed",
            metrics=None,
            attempts=2,
            duration_ms=None,
            error_message="PageSpeed timeout",
        )

        samples = self.repo.list_samples(run_id)
        self.assertEqual([s["sample_index"] for s in samples], [1, 2])
        self.assertEqual(samples[0]["status"], "passed")
        self.assertEqual(samples[0]["fcp"], 900)
        self.assertEqual(samples[0]["attempts"], 1)
        self.assertEqual(samples[1]["status"], "failed")
        self.assertEqual(samples[1]["error_message"], "PageSpeed timeout")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_csv_lighthouse_repository.py -k "samples_per_url or samples_round_trip" -v`
Expected: FAIL — `create_run()` got an unexpected keyword argument `samples_per_url` / `create_sample` does not exist.

- [ ] **Step 3: Extend `create_run`**

In `data_access/csv_lighthouse_repository.py`, replace the `create_run` method (lines 16-49) with:

```python
    def create_run(
        self,
        label: str,
        strategy: str,
        site_keys: list[str],
        worker_count: int,
        target_budget_seconds: int | None,
        total_items: int,
        samples_per_url: int = 1,
    ) -> int:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    INSERT INTO csv_lighthouse_runs (
                        label, strategy, site_keys, worker_count,
                        target_budget_seconds, total_items, samples_per_url
                    )
                    VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                    {self._cm.returning_id()}
                    """,
                    (
                        label,
                        strategy,
                        json.dumps(site_keys),
                        worker_count,
                        target_budget_seconds,
                        total_items,
                        samples_per_url,
                    ),
                )
                return self._cm.last_insert_id(cursor)
        except Exception as exc:
            raise DatabaseError(f"Failed to create CSV Lighthouse run: {exc}") from exc
```

- [ ] **Step 4: Add `create_sample` and `list_samples`**

In the same file, add these two methods after `create_items` (after line 84):

```python
    def create_sample(
        self,
        run_id: int,
        item_id: int,
        sample_index: int,
        status: str,
        metrics: dict | None,
        attempts: int,
        duration_ms: int | None,
        error_message: str | None,
    ) -> int:
        ph = self._cm.placeholder()
        metrics = metrics or {}
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    INSERT INTO csv_lighthouse_samples (
                        run_id, item_id, sample_index, status,
                        fcp, speed_index, lcp, tbt, cls,
                        attempts, duration_ms, error_message
                    )
                    VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                    {self._cm.returning_id()}
                    """,
                    (
                        run_id,
                        item_id,
                        sample_index,
                        status,
                        metrics.get("fcp"),
                        metrics.get("speed_index"),
                        metrics.get("lcp"),
                        metrics.get("tbt"),
                        metrics.get("cls"),
                        attempts,
                        duration_ms,
                        error_message,
                    ),
                )
                return self._cm.last_insert_id(cursor)
        except Exception as exc:
            raise DatabaseError(f"Failed to create CSV Lighthouse sample: {exc}") from exc

    def list_samples(self, run_id: int) -> list[dict]:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT *
                FROM csv_lighthouse_samples
                WHERE run_id = {ph}
                ORDER BY item_id, sample_index
                """,
                (run_id,),
            )
            return self._cm.rows_to_dicts(cursor)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `python -m pytest tests/test_csv_lighthouse_repository.py -k "samples_per_url or samples_round_trip" -v`
Expected: PASS

- [ ] **Step 6: Run the full repository suite to confirm no regression**

Run: `python -m pytest tests/test_csv_lighthouse_repository.py -v`
Expected: PASS (existing positional `create_run(...)` calls still work — the new param defaults to 1).

- [ ] **Step 7: Commit**

```bash
git add data_access/csv_lighthouse_repository.py tests/test_csv_lighthouse_repository.py
git commit -m "feat: repository create_sample/list_samples and samples_per_url on create_run"
```

---

## Task 3: Config caps + service `create_run` validation

**Files:**
- Modify: `config.py:57` (after `CSV_LIGHTHOUSE_MAX_ITEMS_PER_RUN`)
- Modify: `services/csv_lighthouse_service.py` (imports near line 12-17, `create_run` near line 108-165, add validator)
- Test: `tests/test_csv_lighthouse_service.py`

- [ ] **Step 1: Write the failing test**

Add to `CsvLighthouseServiceTest`:

```python
    def test_create_run_stores_samples_per_url(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
            label="Sampled",
            samples_per_url=25,
        )
        run = self.service.get_run(result["run_id"])["run"]
        self.assertEqual(run["samples_per_url"], 25)

    def test_create_run_defaults_samples_per_url_to_one(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
        )
        run = self.service.get_run(result["run_id"])["run"]
        self.assertEqual(run["samples_per_url"], 1)

    def test_create_run_rejects_samples_per_url_over_cap(self):
        with patch.object(csv_lighthouse_service, "CSV_LIGHTHOUSE_MAX_SAMPLES_PER_URL", 10):
            with self.assertRaisesRegex(ValidationError, "samples per URL"):
                self.service.create_run(
                    [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
                    site_keys=["www"],
                    strategy="desktop",
                    samples_per_url=11,
                )
        self.assertEqual(self.repo.list_runs(), [])

    def test_create_run_rejects_too_many_total_samples(self):
        with patch.object(csv_lighthouse_service, "CSV_LIGHTHOUSE_MAX_TOTAL_SAMPLES", 1):
            with self.assertRaisesRegex(ValidationError, "total samples"):
                self.service.create_run(
                    [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
                    site_keys=["www", "mcprod"],
                    strategy="desktop",
                    samples_per_url=1,
                )
        self.assertEqual(self.repo.list_runs(), [])
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_csv_lighthouse_service.py -k "samples_per_url or total_samples" -v`
Expected: FAIL — `create_run()` got an unexpected keyword argument `samples_per_url`.

- [ ] **Step 3: Add config constants**

In `config.py`, directly after the `CSV_LIGHTHOUSE_MAX_ITEMS_PER_RUN` line (line 57), add:

```python
# Maximum PSI samples collected per URL in one run
CSV_LIGHTHOUSE_MAX_SAMPLES_PER_URL: int = int(os.getenv('CSV_LIGHTHOUSE_MAX_SAMPLES_PER_URL', '50'))

# Maximum total PSI calls (items x samples) per run
CSV_LIGHTHOUSE_MAX_TOTAL_SAMPLES: int = int(os.getenv('CSV_LIGHTHOUSE_MAX_TOTAL_SAMPLES', '3000'))
```

- [ ] **Step 4: Import the new constants in the service**

In `services/csv_lighthouse_service.py`, replace the config import block (lines 12-17) with:

```python
from config import (
    CSV_LIGHTHOUSE_MAX_FILE_BYTES,
    CSV_LIGHTHOUSE_MAX_ITEMS_PER_RUN,
    CSV_LIGHTHOUSE_MAX_ROWS_PER_FILE,
    CSV_LIGHTHOUSE_MAX_SAMPLES_PER_URL,
    CSV_LIGHTHOUSE_MAX_TOTAL_SAMPLES,
    CSV_LIGHTHOUSE_STALE_RUN_SECONDS,
)
```

- [ ] **Step 5: Add `samples_per_url` to `create_run` with validation**

In `services/csv_lighthouse_service.py`, change the `create_run` signature (line 108-114) to add the parameter:

```python
    def create_run(
        self,
        files: list[tuple[str, BinaryIO]],
        site_keys,
        strategy: str,
        label: str | None = None,
        samples_per_url: int = 1,
    ) -> dict:
        strategy = self._validate_strategy(strategy)
        site_keys = self._validate_site_keys(site_keys)
        samples_per_url = self._validate_samples_per_url(samples_per_url)
```

Then, immediately after the existing `MAX_ITEMS_PER_RUN` check (the block ending at line 141), add the total-samples check:

```python
        total_samples = len(items) * samples_per_url
        if total_samples > CSV_LIGHTHOUSE_MAX_TOTAL_SAMPLES:
            raise ValidationError(
                f"CSV Lighthouse run would make {total_samples} total samples; "
                f"maximum is {CSV_LIGHTHOUSE_MAX_TOTAL_SAMPLES}"
            )
```

Change the `self.repository.create_run(...)` call (lines 143-150) to pass the new value:

```python
        run_id = self.repository.create_run(
            label=label or "CSV Lighthouse run",
            strategy=strategy,
            site_keys=site_keys,
            worker_count=worker_count,
            target_budget_seconds=TARGET_BUDGET_SECONDS,
            total_items=len(items),
            samples_per_url=samples_per_url,
        )
```

Add the validator method next to `_validate_strategy` (after line 572):

```python
    def _validate_samples_per_url(self, samples_per_url) -> int:
        try:
            value = int(samples_per_url)
        except (TypeError, ValueError):
            raise ValidationError("samples per URL must be a whole number")
        if value < 1 or value > CSV_LIGHTHOUSE_MAX_SAMPLES_PER_URL:
            raise ValidationError(
                f"samples per URL must be between 1 and {CSV_LIGHTHOUSE_MAX_SAMPLES_PER_URL}"
            )
        return value
```

- [ ] **Step 6: Run test to verify it passes**

Run: `python -m pytest tests/test_csv_lighthouse_service.py -k "samples_per_url or total_samples" -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add config.py services/csv_lighthouse_service.py tests/test_csv_lighthouse_service.py
git commit -m "feat: samples_per_url on service create_run with cap validation"
```

---

## Task 4: Service — sample N times per item, store median as representative

**Files:**
- Modify: `services/csv_lighthouse_service.py` — imports (add `statistics`), `_run_pending_items` (line 278-318), `_process_item` (line 535-554), add `_collect_sample` + `_median_metrics`
- Test: `tests/test_csv_lighthouse_service.py`

- [ ] **Step 1: Write the failing test**

Add to `CsvLighthouseServiceTest`. Add a variable-metric fake client at module level near the other fakes (after `AlwaysFailsPageSpeedClient`, line 57):

```python
class SequencePageSpeedClient(FakePageSpeedClient):
    """Returns a scripted FCP per call so median is predictable."""

    def __init__(self, fcp_values):
        super().__init__()
        self._fcp_values = list(fcp_values)

    def test_url(self, url, strategy):
        self.calls.append((url, strategy))
        fcp = self._fcp_values[(len(self.calls) - 1) % len(self._fcp_values)]
        return {"fcp": fcp, "speed_index": 1200, "lcp": 1800, "tbt": 50, "cls": 0.02}
```

Then add these test methods:

```python
    def test_run_samples_each_url_n_times_and_stores_median(self):
        pagespeed = SequencePageSpeedClient([100, 900, 500])
        service = CsvLighthouseService(self.repo, pagespeed, start_background=False)
        result = service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
            samples_per_url=3,
        )

        service.run_pending_items(result["run_id"])
        detail = self.repo.get_run_detail(result["run_id"])
        item = detail["items"][0]
        samples = self.repo.list_samples(result["run_id"])

        self.assertEqual(len(pagespeed.calls), 3)
        self.assertEqual(len(samples), 3)
        self.assertEqual(item["status"], "passed")
        self.assertEqual(item["fcp"], 500)  # median of 100, 900, 500

    def test_single_sample_run_matches_legacy_behavior(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
        )
        self.service.run_pending_items(result["run_id"])
        detail = self.repo.get_run_detail(result["run_id"])
        item = detail["items"][0]
        samples = self.repo.list_samples(result["run_id"])

        self.assertEqual(len(self.pagespeed.calls), 1)
        self.assertEqual(len(samples), 1)
        self.assertEqual(item["fcp"], 900)

    def test_item_fails_when_all_samples_fail(self):
        pagespeed = AlwaysFailsPageSpeedClient()
        service = CsvLighthouseService(self.repo, pagespeed, start_background=False)
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
        self.assertEqual(len(samples), 2)
        self.assertTrue(all(s["status"] == "failed" for s in samples))
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_csv_lighthouse_service.py -k "samples_each_url or single_sample_run or all_samples_fail" -v`
Expected: FAIL — `item["fcp"]` is 100 (first call) not 500, and only 1 call made (loop not implemented).

- [ ] **Step 3: Import `statistics`**

In `services/csv_lighthouse_service.py`, add to the imports at the top (after `import math`, line 5):

```python
import statistics
```

- [ ] **Step 4: Pass `samples_per_url` into the executor**

In `_run_pending_items` (line 278-283), replace the top of the method:

```python
    def _run_pending_items(self, run_id: int) -> None:
        detail = self.repository.get_run_detail(run_id)
        run = detail["run"]
        max_workers = max(1, int(run.get("worker_count") or 1))
        samples_per_url = max(1, int(run.get("samples_per_url") or 1))
        self.repository.mark_run_running(run_id)
        pending_items = self.repository.pending_items(run_id)
```

Then in the nested `submit_available` (line 297-299), change the `executor.submit` call to pass `samples_per_url`:

```python
                    futures.add(
                        executor.submit(
                            self._process_item,
                            pending_items[next_index],
                            samples_per_url,
                        )
                    )
```

- [ ] **Step 5: Rewrite `_process_item` and add helpers**

In `services/csv_lighthouse_service.py`, replace `_process_item` (lines 535-554) with:

```python
    def _process_item(self, item: dict, samples_per_url: int = 1) -> None:
        if not self.repository.mark_item_running(item["id"]):
            return
        run_id = item["run_id"]
        started = time.monotonic()
        passed_samples: list[dict] = []
        total_attempts = 0
        last_error: Exception | None = None

        for sample_index in range(1, samples_per_url + 1):
            if sample_index > 1 and self.repository.should_cancel(run_id):
                break
            metrics, attempts, error = self._collect_sample(item)
            total_attempts += attempts
            if metrics is not None:
                passed_samples.append(metrics)
                self.repository.create_sample(
                    run_id=run_id,
                    item_id=item["id"],
                    sample_index=sample_index,
                    status="passed",
                    metrics=metrics,
                    attempts=attempts,
                    duration_ms=metrics.get("duration_ms"),
                    error_message=None,
                )
            else:
                last_error = error
                self.repository.create_sample(
                    run_id=run_id,
                    item_id=item["id"],
                    sample_index=sample_index,
                    status="failed",
                    metrics=None,
                    attempts=attempts,
                    duration_ms=None,
                    error_message=str(error or "PageSpeed failed"),
                )

        duration_ms = int((time.monotonic() - started) * 1000)
        if passed_samples:
            representative = self._median_metrics(passed_samples)
            representative["attempts"] = total_attempts
            representative["duration_ms"] = duration_ms
            self.repository.mark_item_passed(item["id"], representative)
        else:
            self.repository.mark_item_failed(
                item["id"],
                str(last_error or "PageSpeed failed"),
                attempts=total_attempts or MAX_LIGHTHOUSE_ATTEMPTS,
            )

    def _collect_sample(self, item: dict):
        """Run one PSI measurement with retries.

        Returns ``(metrics | None, attempts, error)``.  ``metrics`` includes a
        ``duration_ms`` for that single sample.
        """
        started = time.monotonic()
        last_error: Exception | None = None
        for attempt in range(1, MAX_LIGHTHOUSE_ATTEMPTS + 1):
            try:
                metrics = dict(
                    self.pagespeed_client.test_url(item["generated_url"], item["strategy"])
                )
                metrics["duration_ms"] = int((time.monotonic() - started) * 1000)
                return metrics, attempt, None
            except Exception as exc:
                last_error = exc
        return None, MAX_LIGHTHOUSE_ATTEMPTS, last_error

    @staticmethod
    def _median_metrics(samples: list[dict]) -> dict:
        keys = ("fcp", "speed_index", "lcp", "tbt", "cls")
        result: dict = {}
        for key in keys:
            values = [s[key] for s in samples if isinstance(s.get(key), (int, float))]
            result[key] = statistics.median(values) if values else None
        return result
```

- [ ] **Step 6: Run test to verify it passes**

Run: `python -m pytest tests/test_csv_lighthouse_service.py -k "samples_each_url or single_sample_run or all_samples_fail" -v`
Expected: PASS

- [ ] **Step 7: Run the full service suite to confirm legacy behavior holds**

Run: `python -m pytest tests/test_csv_lighthouse_service.py -v`
Expected: PASS for all pre-existing tests EXCEPT `test_export_csv_includes_saved_run_rows_and_headers`, which will fail once Task 5 changes the export format. If it still passes here, that is fine — Task 5 updates it. All retry/cancel/metrics tests must remain green (single-sample path is unchanged in behavior).

- [ ] **Step 8: Commit**

```bash
git add services/csv_lighthouse_service.py tests/test_csv_lighthouse_service.py
git commit -m "feat: sample each URL N times and store median as representative"
```

---

## Task 5: Service — rewrite `export_csv` to raw samples + per-URL summary

**Files:**
- Modify: `services/csv_lighthouse_service.py` — `export_csv` (lines 320-401), replacing `_average_metric` with summary helpers
- Test: `tests/test_csv_lighthouse_service.py` — replace `test_export_csv_includes_saved_run_rows_and_headers`

The export uses a tidy long format. **Header:**

```
run_id, label, source_filename, group_key, site_key, original_value, generated_url, strategy,
kind, sample_index, n, status, fcp, speed_index, lcp, tbt, cls, attempts, duration_ms, error_message, completed_at
```

`kind="sample"` rows carry each raw sample. `kind` in `{mean, median, min, max}` rows carry per-URL aggregates over passed samples, with `n` = passed-sample count. Old runs (no sample rows) synthesize one sample from the item's inline metrics so they still export.

- [ ] **Step 1: Write the failing test (replace the old export test)**

In `tests/test_csv_lighthouse_service.py`, DELETE the existing `test_export_csv_includes_saved_run_rows_and_headers` method (lines 331-374) and replace it with:

```python
    def test_export_csv_has_raw_samples_and_per_url_summary(self):
        pagespeed = SequencePageSpeedClient([100, 900, 500])
        service = CsvLighthouseService(self.repo, pagespeed, start_background=False)
        result = service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
            label="Export smoke",
            samples_per_url=3,
        )
        service.run_pending_items(result["run_id"])

        exported = service.export_csv(result["run_id"])
        rows = list(csv.reader(io.StringIO(exported)))
        header = rows[0]

        self.assertEqual(
            header,
            [
                "run_id", "label", "source_filename", "group_key", "site_key",
                "original_value", "generated_url", "strategy", "kind",
                "sample_index", "n", "status", "fcp", "speed_index", "lcp",
                "tbt", "cls", "attempts", "duration_ms", "error_message",
                "completed_at",
            ],
        )

        kind_idx = header.index("kind")
        fcp_idx = header.index("fcp")
        n_idx = header.index("n")

        sample_rows = [r for r in rows[1:] if r[kind_idx] == "sample"]
        self.assertEqual(len(sample_rows), 3)
        self.assertEqual([r[fcp_idx] for r in sample_rows], ["100", "900", "500"])

        mean_row = next(r for r in rows[1:] if r[kind_idx] == "mean")
        median_row = next(r for r in rows[1:] if r[kind_idx] == "median")
        min_row = next(r for r in rows[1:] if r[kind_idx] == "min")
        max_row = next(r for r in rows[1:] if r[kind_idx] == "max")

        self.assertEqual(mean_row[fcp_idx], "500")       # (100+900+500)/3, _csv_value collapses 500.0 -> 500
        self.assertEqual(median_row[fcp_idx], "500")     # median of 100,900,500
        self.assertEqual(min_row[fcp_idx], "100")
        self.assertEqual(max_row[fcp_idx], "900")
        self.assertEqual(median_row[n_idx], "3")

    def test_export_csv_synthesizes_sample_for_legacy_run(self):
        # A run whose item was marked passed directly, with no sample rows.
        run_id = self.repo.create_run("Legacy", "desktop", ["www"], 1, 540, 1)
        item_id = self.repo.create_items(
            run_id,
            [
                {
                    "source_filename": "PDP.csv",
                    "group_key": "PDP",
                    "site_key": "www",
                    "original_value": "brass-lamp/",
                    "generated_url": "https://www.lampsplus.com/p/brass-lamp/",
                    "strategy": "desktop",
                }
            ],
        )[0]
        self.repo.mark_run_running(run_id)
        self.repo.mark_item_running(item_id)
        self.repo.mark_item_passed(item_id, {"fcp": 800, "speed_index": 1000, "lcp": 1500, "tbt": 30, "cls": 0.01, "attempts": 1, "duration_ms": 1200})

        exported = self.service.export_csv(run_id)
        rows = list(csv.reader(io.StringIO(exported)))
        header = rows[0]
        kind_idx = header.index("kind")
        fcp_idx = header.index("fcp")

        sample_rows = [r for r in rows[1:] if r[kind_idx] == "sample"]
        self.assertEqual(len(sample_rows), 1)
        self.assertEqual(sample_rows[0][fcp_idx], "800")
        median_row = next(r for r in rows[1:] if r[kind_idx] == "median")
        self.assertEqual(median_row[fcp_idx], "800")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_csv_lighthouse_service.py -k "export_csv" -v`
Expected: FAIL — the old export produces the legacy header, not the new `kind`/`n` columns.

- [ ] **Step 3: Rewrite `export_csv` and its helpers**

In `services/csv_lighthouse_service.py`, replace `export_csv` and `_average_metric` (lines 320-401) with:

```python
    EXPORT_HEADER = [
        "run_id", "label", "source_filename", "group_key", "site_key",
        "original_value", "generated_url", "strategy", "kind",
        "sample_index", "n", "status", "fcp", "speed_index", "lcp",
        "tbt", "cls", "attempts", "duration_ms", "error_message",
        "completed_at",
    ]
    _METRIC_KEYS = ("fcp", "speed_index", "lcp", "tbt", "cls")

    def export_csv(self, run_id: int) -> str:
        detail = self.repository.get_run_detail(run_id)
        run = detail["run"]
        samples_by_item = self._samples_by_item(run_id, detail["items"])

        output = io.StringIO()
        writer = csv.writer(output, lineterminator="\n")
        writer.writerow(self.EXPORT_HEADER)

        sections: dict[tuple[str, str], list[dict]] = {}
        for item in detail["items"]:
            key = (item["site_key"], item["group_key"])
            sections.setdefault(key, []).append(item)

        for (_site_key, _group_key), items in sections.items():
            for item in items:
                samples = samples_by_item.get(item["id"], [])
                for sample in samples:
                    writer.writerow(self._sample_row(run, item, sample))
                passed = [s for s in samples if s["status"] == "passed"]
                for stat in ("mean", "median", "min", "max"):
                    writer.writerow(self._summary_row(run, item, passed, stat))
        return output.getvalue()

    def _samples_by_item(self, run_id: int, items: list[dict]) -> dict[int, list[dict]]:
        grouped: dict[int, list[dict]] = {}
        for sample in self.repository.list_samples(run_id):
            grouped.setdefault(sample["item_id"], []).append(sample)
        # Backward compatibility: synthesize a single sample from the item's
        # inline metrics for runs recorded before sampling existed.
        for item in items:
            if item["id"] in grouped:
                continue
            if item["status"] not in ("passed", "failed"):
                continue
            grouped[item["id"]] = [
                {
                    "item_id": item["id"],
                    "sample_index": 1,
                    "status": item["status"],
                    "fcp": item.get("fcp"),
                    "speed_index": item.get("speed_index"),
                    "lcp": item.get("lcp"),
                    "tbt": item.get("tbt"),
                    "cls": item.get("cls"),
                    "attempts": item.get("attempts"),
                    "duration_ms": item.get("duration_ms"),
                    "error_message": item.get("error_message"),
                    "completed_at": item.get("completed_at"),
                }
            ]
        return grouped

    def _sample_row(self, run: dict, item: dict, sample: dict) -> list:
        return [
            run["id"], run["label"], item["source_filename"], item["group_key"],
            item["site_key"], item["original_value"], item["generated_url"],
            item["strategy"], "sample", sample["sample_index"], "",
            sample["status"],
            self._csv_value(sample.get("fcp")),
            self._csv_value(sample.get("speed_index")),
            self._csv_value(sample.get("lcp")),
            self._csv_value(sample.get("tbt")),
            self._csv_value(sample.get("cls")),
            sample.get("attempts"),
            sample.get("duration_ms"),
            sample.get("error_message"),
            sample.get("completed_at"),
        ]

    def _summary_row(self, run: dict, item: dict, passed: list[dict], stat: str) -> list:
        return [
            run["id"], run["label"], item["source_filename"], item["group_key"],
            item["site_key"], item["original_value"], item["generated_url"],
            item["strategy"], stat, "", len(passed), "",
            self._csv_value(self._summarize(passed, "fcp", stat)),
            self._csv_value(self._summarize(passed, "speed_index", stat)),
            self._csv_value(self._summarize(passed, "lcp", stat)),
            self._csv_value(self._summarize(passed, "tbt", stat)),
            self._csv_value(self._summarize(passed, "cls", stat)),
            "", "", "", "",
        ]

    @staticmethod
    def _summarize(samples: list[dict], key: str, stat: str):
        values = [s[key] for s in samples if isinstance(s.get(key), (int, float))]
        if not values:
            return None
        if stat == "mean":
            return sum(values) / len(values)
        if stat == "median":
            return statistics.median(values)
        if stat == "min":
            return min(values)
        if stat == "max":
            return max(values)
        return None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_csv_lighthouse_service.py -k "export_csv" -v`
Expected: PASS

- [ ] **Step 5: Run the full backend suite**

Run: `python -m pytest tests/test_csv_lighthouse_repository.py tests/test_csv_lighthouse_service.py -v`
Expected: PASS. In particular `test_late_cancel_after_all_items_passed_finishes_completed_and_exports` still passes (it asserts the label appears in the export, which it still does).

- [ ] **Step 6: Commit**

```bash
git add services/csv_lighthouse_service.py tests/test_csv_lighthouse_service.py
git commit -m "feat: export raw samples plus per-URL mean/median/min/max/n"
```

---

## Task 6: API + frontend — samples-per-URL input

**Files:**
- Modify: `routes/csv_lighthouse_api.py:35-52` (`create_run`)
- Modify: `frontend/src/services/api.ts:1116-1129` (`createCsvLighthouseRun`)
- Modify: `frontend/src/components/test-urls/CsvLighthousePanel.tsx` (state near line 74, form JSX near line 349-360, submit near line 200-205)
- Modify: `frontend/src/types/index.ts` (the `CsvLighthouseRun` type)

- [ ] **Step 1: Add a backend test for the form parameter**

Add to `tests/test_csv_lighthouse_service.py` — this verifies the service layer accepts the value that the route will forward (the route itself has no dedicated test harness; the existing `tests/test_csv_lighthouse_api.py` covers routing shape). Confirm the run persists the value end-to-end via the service:

```python
    def test_create_run_accepts_string_samples_per_url_from_form(self):
        # The Flask form delivers strings; the service must coerce.
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
            samples_per_url="25",
        )
        run = self.service.get_run(result["run_id"])["run"]
        self.assertEqual(run["samples_per_url"], 25)
```

- [ ] **Step 2: Run test to verify it fails, then confirm the validator already handles it**

Run: `python -m pytest tests/test_csv_lighthouse_service.py -k "string_samples_per_url" -v`
Expected: PASS immediately — `_validate_samples_per_url` already casts with `int(...)`. (If it fails, fix the validator per Task 3 Step 5.) This locks in the string-coercion contract the route depends on.

- [ ] **Step 3: Read `samples_per_url` in the route**

In `routes/csv_lighthouse_api.py`, in `create_run`, after the `label = request.form.get("label") or None` line (line 37), add:

```python
        samples_per_url = request.form.get("samples_per_url") or 1
```

Then change the `service.create_run(...)` call (lines 47-52) to:

```python
        result = service.create_run(
            uploaded_files,
            site_keys=site_keys,
            strategy=strategy,
            label=label,
            samples_per_url=samples_per_url,
        )
```

- [ ] **Step 4: Send `samples_per_url` from the API client**

In `frontend/src/services/api.ts`, change `createCsvLighthouseRun` (lines 1116-1129) to accept and send the value:

```typescript
  async createCsvLighthouseRun(input: {
    files: File[]
    siteKeys: CsvLighthouseSiteKey[]
    strategy: Strategy
    label?: string
    samplesPerUrl?: number
  }): Promise<{ success: boolean; run_id: number; worker_count: number; total_items: number }> {
    const formData = new FormData()
    input.files.forEach((file) => formData.append("files", file))
    input.siteKeys.forEach((siteKey) => formData.append("site_keys", siteKey))
    formData.append("strategy", input.strategy)
    formData.append("samples_per_url", String(input.samplesPerUrl ?? 1))
    const label = input.label?.trim()
    if (label) {
      formData.append("label", label)
    }
```

- [ ] **Step 5: Add the samples input to the run form**

In `frontend/src/components/test-urls/CsvLighthousePanel.tsx`, add state next to the `label` state (after line 74):

```typescript
  const [samplesPerUrl, setSamplesPerUrl] = useState(25)
```

Add the input to the form, immediately after the closing `</div>` of the Run label block (after line 360, before the `<Button onClick={handleStart}` on line 361):

```tsx
            <div className="space-y-1.5">
              <label className="aurora-text-dim text-xs font-medium" htmlFor="csv-lighthouse-samples">
                Samples per URL
              </label>
              <Input
                id="csv-lighthouse-samples"
                type="number"
                min={1}
                max={50}
                value={samplesPerUrl}
                onChange={(event) =>
                  setSamplesPerUrl(Math.max(1, Math.min(50, Number(event.target.value) || 1)))
                }
                className="h-9 w-24"
              />
            </div>
```

Pass it through in `handleStart` (the `createCsvLighthouseRun` call at lines 200-205):

```typescript
      const response = await api.createCsvLighthouseRun({
        files,
        siteKeys: selectedTargets,
        strategy,
        label,
        samplesPerUrl,
      })
```

- [ ] **Step 6: Add the optional field to the run type**

In `frontend/src/types/index.ts`, find the `CsvLighthouseRun` interface (search for `worker_count`) and add, alongside the other run fields:

```typescript
  samples_per_url?: number
```

- [ ] **Step 7: Typecheck and build the frontend**

Run: `cd frontend && npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 8: Run the full backend suite one more time**

Run: `python -m pytest tests/test_csv_lighthouse_repository.py tests/test_csv_lighthouse_service.py tests/test_csv_lighthouse_api.py -v`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add routes/csv_lighthouse_api.py frontend/src/services/api.ts frontend/src/components/test-urls/CsvLighthousePanel.tsx frontend/src/types/index.ts tests/test_csv_lighthouse_service.py
git commit -m "feat: samples-per-URL input wired through API and run form"
```

---

## Post-implementation checklist

- [ ] Confirm a **PSI API key** is configured in the deployed environment before the first heavy (25+ sample) run — keyless quota will 429. Check how `PageSpeedClient(api_key=...)` is wired in `app.py`.
- [ ] Manual smoke: create a run with `samples_per_url=3` for one PDP URL across both sites, start it, confirm 6 items? No — 2 items (one per site) each with 3 samples; export shows 3 `sample` rows + 4 summary rows per URL.
- [ ] Deploy per [docs/deploy.md](../../deploy.md) (Railway CLI) when ready.

## Notes on scope

- Worker concurrency is left unchanged (existing formula, cap 4). A 25-sample run is slower but runs in the background weekly, so throughput is not on the critical path for correctness. If runs later feel too slow, raising the `MAX_WORKERS_PER_TARGET` cap is safe (even 12 workers ≈ 29 req/min, far under PSI's ~240/min) — deferred as a separate change to keep this plan surgical.
- No cross-run pooling inside Pharos — the user concatenates several weekly exports and computes the true pooled mean + median in their report tool. The raw `sample` rows make that exact.
```
