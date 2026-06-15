# CSV Lighthouse Runs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build saved CSV-driven Lighthouse runs on the Test URLs page, using current BlazeMeter CSV files to test generated LampsPlus and Adobe Commerce URLs within a 9-minute target window.

**Architecture:** Add a DB-backed `csv_lighthouse` backend domain: repository for durable runs/items, service for CSV parsing, URL construction reuse, bounded PageSpeed workers, and route layer for create/list/detail/cancel. Add a focused React panel under Test URLs for upload, target selection, progress polling, saved runs, and CSV export.

**Tech Stack:** Python 3.11, Flask blueprints, SQLite/PostgreSQL repository pattern, existing `PageSpeedClient`, React 19, TypeScript, Vite, Tailwind/shadcn UI.

---

## File Structure

- Create `data_access/csv_lighthouse_repository.py`: SQL persistence for run rows and item rows.
- Modify `data_access/__init__.py`: export `CsvLighthouseRepository`.
- Modify `data_access/connection.py`: initialize `csv_lighthouse_runs` and `csv_lighthouse_items` tables.
- Create `services/csv_lighthouse_service.py`: run creation, URL normalization, dedupe, worker execution, cancellation, CSV export.
- Modify `services/__init__.py`: export `CsvLighthouseService`.
- Create `routes/csv_lighthouse_api.py`: multipart start, list, detail, cancel, export endpoints.
- Modify `routes/__init__.py`: register CSV Lighthouse blueprint.
- Modify `app.py`: instantiate repository/service and pass blueprint dependency.
- Create `tests/test_csv_lighthouse_repository.py`: schema and persistence tests.
- Create `tests/test_csv_lighthouse_service.py`: URL construction, dedupe, worker count, save/export/cancel behavior.
- Create `tests/test_csv_lighthouse_api.py`: route contract tests with fake service.
- Modify `frontend/src/types/index.ts`: CSV Lighthouse API types.
- Modify `frontend/src/services/api.ts`: client methods for start/list/detail/cancel/export.
- Create `frontend/src/components/test-urls/CsvLighthousePanel.tsx`: upload/run/progress/saved-run UI.
- Create `frontend/src/components/test-urls/CsvLighthouseResultsTable.tsx`: dense saved result table.
- Modify `frontend/src/pages/TestUrls.tsx`: mount panel below existing batch controls.

---

### Task 1: Repository And Schema

**Files:**
- Modify: `data_access/connection.py`
- Create: `data_access/csv_lighthouse_repository.py`
- Modify: `data_access/__init__.py`
- Test: `tests/test_csv_lighthouse_repository.py`

- [ ] **Step 1: Write failing repository tests**

Create `tests/test_csv_lighthouse_repository.py`:

```python
from data_access.connection import ConnectionManager
from data_access.csv_lighthouse_repository import CsvLighthouseRepository


def make_repo():
    cm = ConnectionManager(db_url=None)
    cm.init_schema()
    return CsvLighthouseRepository(cm)


def test_create_run_and_items_round_trip():
    repo = make_repo()

    run_id = repo.create_run(
        label="Round 1 PDP",
        strategy="desktop",
        site_keys=["www"],
        worker_count=2,
        target_budget_seconds=540,
        total_items=1,
    )
    repo.create_items(run_id, [
        {
            "source_filename": "PDP.csv",
            "group_key": "PDP",
            "site_key": "www",
            "original_value": "maxim-paramount-16-inchw-natural-aged-brass-led-ceiling-light__0000e/",
            "generated_url": "https://www.lampsplus.com/p/maxim-paramount-16-inchw-natural-aged-brass-led-ceiling-light__0000e/",
            "strategy": "desktop",
        }
    ])

    detail = repo.get_run_detail(run_id)

    assert detail["run"]["id"] == run_id
    assert detail["run"]["label"] == "Round 1 PDP"
    assert detail["run"]["status"] == "queued"
    assert detail["run"]["total_items"] == 1
    assert detail["items"][0]["generated_url"].endswith("__0000e/")
    assert detail["items"][0]["status"] == "pending"


def test_update_item_result_updates_run_progress():
    repo = make_repo()
    run_id = repo.create_run("Run", "desktop", ["www"], 1, 540, 1)
    item_id = repo.create_items(run_id, [{
        "source_filename": "PDP.csv",
        "group_key": "PDP",
        "site_key": "www",
        "original_value": "abc/",
        "generated_url": "https://www.lampsplus.com/p/abc/",
        "strategy": "desktop",
    }])[0]

    repo.mark_run_running(run_id)
    repo.mark_item_running(item_id)
    repo.mark_item_passed(item_id, {
        "fcp": 1200,
        "speed_index": 1800,
        "lcp": 2400,
        "tbt": 75,
        "cls": 0.02,
    })
    repo.finish_run_if_complete(run_id)

    detail = repo.get_run_detail(run_id)

    assert detail["run"]["status"] == "completed"
    assert detail["run"]["completed_items"] == 1
    assert detail["run"]["failed_items"] == 0
    assert detail["items"][0]["fcp"] == 1200
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
python -m pytest tests/test_csv_lighthouse_repository.py -q
```

Expected: fails with `ModuleNotFoundError: No module named 'data_access.csv_lighthouse_repository'`.

- [ ] **Step 3: Add schema initialization**

In `data_access/connection.py`, add the run and item table creation to both schema helpers. In `_init_postgres_schema()`, use `SERIAL PRIMARY KEY`:

```python
cursor.execute("""
    CREATE TABLE IF NOT EXISTS csv_lighthouse_runs (
        id SERIAL PRIMARY KEY,
        label TEXT NOT NULL,
        strategy TEXT NOT NULL DEFAULT 'desktop',
        site_keys TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        worker_count INTEGER NOT NULL DEFAULT 1,
        target_budget_seconds INTEGER NOT NULL DEFAULT 540,
        total_items INTEGER NOT NULL DEFAULT 0,
        completed_items INTEGER NOT NULL DEFAULT 0,
        failed_items INTEGER NOT NULL DEFAULT 0,
        cancel_requested INTEGER NOT NULL DEFAULT 0,
        average_item_duration_ms INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP,
        finished_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
""")
```

In `_init_sqlite_schema()`, add the same two tables with SQLite primary keys:

```python
cursor.execute("""
    CREATE TABLE IF NOT EXISTS csv_lighthouse_runs (
        id INTEGER PRIMARY KEY,
        label TEXT NOT NULL,
        strategy TEXT NOT NULL DEFAULT 'desktop',
        site_keys TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        worker_count INTEGER NOT NULL DEFAULT 1,
        target_budget_seconds INTEGER NOT NULL DEFAULT 540,
        total_items INTEGER NOT NULL DEFAULT 0,
        completed_items INTEGER NOT NULL DEFAULT 0,
        failed_items INTEGER NOT NULL DEFAULT 0,
        cancel_requested INTEGER NOT NULL DEFAULT 0,
        average_item_duration_ms INTEGER,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        started_at TIMESTAMP,
        finished_at TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
""")
cursor.execute("""
    CREATE TABLE IF NOT EXISTS csv_lighthouse_items (
        id INTEGER PRIMARY KEY,
        run_id INTEGER NOT NULL,
        source_filename TEXT NOT NULL,
        group_key TEXT NOT NULL,
        site_key TEXT NOT NULL,
        original_value TEXT NOT NULL,
        generated_url TEXT NOT NULL,
        strategy TEXT NOT NULL DEFAULT 'desktop',
        status TEXT NOT NULL DEFAULT 'pending',
        error_message TEXT,
        fcp REAL,
        speed_index REAL,
        lcp REAL,
        tbt REAL,
        cls REAL,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        duration_ms INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES csv_lighthouse_runs (id) ON DELETE CASCADE,
        UNIQUE(run_id, site_key, generated_url, strategy)
    )
""")
```

- [ ] **Step 4: Add repository implementation**

Create `data_access/csv_lighthouse_repository.py` with methods used by the tests and later tasks:

```python
from __future__ import annotations

import json
from typing import Any

from data_access.connection import ConnectionManager
from exceptions import DatabaseError


class CsvLighthouseRepository:
    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm = connection_manager

    def create_run(self, label: str, strategy: str, site_keys: list[str], worker_count: int, target_budget_seconds: int, total_items: int) -> int:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""INSERT INTO csv_lighthouse_runs
                        (label, strategy, site_keys, worker_count, target_budget_seconds, total_items)
                        VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}){self._cm.returning_id()}""",
                    (label, strategy, json.dumps(site_keys), worker_count, target_budget_seconds, total_items),
                )
                return self._cm.last_insert_id(cursor)
        except Exception as exc:
            raise DatabaseError(f"Failed to create CSV Lighthouse run: {exc}") from exc

    def create_items(self, run_id: int, items: list[dict[str, Any]]) -> list[int]:
        ids: list[int] = []
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                for item in items:
                    cursor.execute(
                        f"""INSERT INTO csv_lighthouse_items
                            (run_id, source_filename, group_key, site_key, original_value, generated_url, strategy)
                            VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}){self._cm.returning_id()}""",
                        (
                            run_id,
                            item["source_filename"],
                            item["group_key"],
                            item["site_key"],
                            item["original_value"],
                            item["generated_url"],
                            item["strategy"],
                        ),
                    )
                    ids.append(self._cm.last_insert_id(cursor))
                cursor.execute(f"UPDATE csv_lighthouse_runs SET total_items = {ph} WHERE id = {ph}", (len(ids), run_id))
            return ids
        except Exception as exc:
            raise DatabaseError(f"Failed to create CSV Lighthouse items: {exc}") from exc

    def list_runs(self, limit: int = 20) -> list[dict[str, Any]]:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            rows = conn.cursor().execute(
                f"SELECT * FROM csv_lighthouse_runs ORDER BY created_at DESC, id DESC LIMIT {ph}",
                (limit,),
            ).fetchall()
        return [self._run_dict(row) for row in rows]

    def get_run_detail(self, run_id: int) -> dict[str, Any]:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            run = cursor.execute(f"SELECT * FROM csv_lighthouse_runs WHERE id = {ph}", (run_id,)).fetchone()
            items = cursor.execute(
                f"SELECT * FROM csv_lighthouse_items WHERE run_id = {ph} ORDER BY site_key, source_filename, id",
                (run_id,),
            ).fetchall()
        if not run:
            raise DatabaseError(f"CSV Lighthouse run {run_id} not found")
        return {"run": self._run_dict(run), "items": [self._item_dict(row) for row in items]}

    def mark_run_running(self, run_id: int) -> None:
        self._execute("UPDATE csv_lighthouse_runs SET status = 'running', started_at = COALESCE(started_at, CURRENT_TIMESTAMP), updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status IN ('queued', 'running')", (run_id,))

    def request_cancel(self, run_id: int) -> None:
        self._execute("UPDATE csv_lighthouse_runs SET cancel_requested = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (run_id,))

    def mark_item_running(self, item_id: int) -> None:
        self._execute("UPDATE csv_lighthouse_items SET status = 'running', started_at = CURRENT_TIMESTAMP WHERE id = ?", (item_id,))

    def mark_item_passed(self, item_id: int, metrics: dict[str, Any]) -> None:
        self._execute(
            """UPDATE csv_lighthouse_items
               SET status = 'passed', fcp = ?, speed_index = ?, lcp = ?, tbt = ?, cls = ?,
                   completed_at = CURRENT_TIMESTAMP,
                   duration_ms = CAST((julianday(CURRENT_TIMESTAMP) - julianday(started_at)) * 86400000 AS INTEGER)
               WHERE id = ?""",
            (metrics.get("fcp"), metrics.get("speed_index"), metrics.get("lcp"), metrics.get("tbt"), metrics.get("cls"), item_id),
        )

    def mark_item_failed(self, item_id: int, error_message: str) -> None:
        self._execute(
            """UPDATE csv_lighthouse_items
               SET status = 'failed', error_message = ?, completed_at = CURRENT_TIMESTAMP,
                   duration_ms = CAST((julianday(CURRENT_TIMESTAMP) - julianday(started_at)) * 86400000 AS INTEGER)
               WHERE id = ?""",
            (error_message, item_id),
        )

    def finish_run_if_complete(self, run_id: int) -> None:
        detail = self.get_run_detail(run_id)
        items = detail["items"]
        completed = sum(1 for item in items if item["status"] in {"passed", "failed", "cancelled"})
        failed = sum(1 for item in items if item["status"] == "failed")
        status = "running"
        if completed == len(items):
            status = "completed_with_failures" if failed else "completed"
        avg = self._average_duration(items)
        self._execute(
            """UPDATE csv_lighthouse_runs
               SET status = ?, completed_items = ?, failed_items = ?, average_item_duration_ms = ?,
                   finished_at = CASE WHEN ? != 'running' THEN CURRENT_TIMESTAMP ELSE finished_at END,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = ?""",
            (status, completed, failed, avg, status, run_id),
        )

    def pending_items(self, run_id: int) -> list[dict[str, Any]]:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            rows = conn.cursor().execute(
                f"SELECT * FROM csv_lighthouse_items WHERE run_id = {ph} AND status = 'pending' ORDER BY id",
                (run_id,),
            ).fetchall()
        return [self._item_dict(row) for row in rows]

    def should_cancel(self, run_id: int) -> bool:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            row = conn.cursor().execute(f"SELECT cancel_requested FROM csv_lighthouse_runs WHERE id = {ph}", (run_id,)).fetchone()
        return bool(row and row["cancel_requested"])

    def mark_run_cancelled(self, run_id: int) -> None:
        self._execute("UPDATE csv_lighthouse_runs SET status = 'cancelled', finished_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (run_id,))

    def _execute(self, sql: str, params: tuple[Any, ...]) -> None:
        with self._cm.get_connection() as conn:
            conn.cursor().execute(self._query(sql), params)

    def _query(self, sql: str) -> str:
        return sql.replace("?", self._cm.placeholder())

    def _run_dict(self, row: Any) -> dict[str, Any]:
        data = dict(row)
        data["site_keys"] = json.loads(data.get("site_keys") or "[]")
        return data

    def _item_dict(self, row: Any) -> dict[str, Any]:
        return dict(row)

    def _average_duration(self, items: list[dict[str, Any]]) -> int | None:
        durations = [item["duration_ms"] for item in items if item.get("duration_ms")]
        return int(sum(durations) / len(durations)) if durations else None
```

- [ ] **Step 5: Export repository**

In `data_access/__init__.py`, add:

```python
from data_access.csv_lighthouse_repository import CsvLighthouseRepository
```

Add `CsvLighthouseRepository` to `__all__` if the file defines it.

- [ ] **Step 6: Run repository tests**

Run:

```bash
python -m pytest tests/test_csv_lighthouse_repository.py -q
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add data_access/connection.py data_access/csv_lighthouse_repository.py data_access/__init__.py tests/test_csv_lighthouse_repository.py
git commit -m "Add CSV Lighthouse persistence"
```

---

### Task 2: Service Layer

**Files:**
- Create: `services/csv_lighthouse_service.py`
- Modify: `services/__init__.py`
- Test: `tests/test_csv_lighthouse_service.py`

- [ ] **Step 1: Write failing service tests**

Create `tests/test_csv_lighthouse_service.py`:

```python
import io
import time

from data_access.connection import ConnectionManager
from data_access.csv_lighthouse_repository import CsvLighthouseRepository
from services.csv_lighthouse_service import CsvLighthouseService, normalize_csv_value


class FakePageSpeed:
    def __init__(self):
        self.urls = []

    def test_url(self, url, strategy="desktop"):
        self.urls.append((url, strategy))
        return {
            "fcp": 1000,
            "speed_index": 1500,
            "lcp": 2200,
            "tbt": 50,
            "cls": 0.01,
        }


def make_service(page_speed=None):
    cm = ConnectionManager(db_url=None)
    cm.init_schema()
    repo = CsvLighthouseRepository(cm)
    return CsvLighthouseService(repo, page_speed or FakePageSpeed(), start_background=False), repo


def test_normalize_csv_value_removes_origin_and_leading_slash():
    assert normalize_csv_value(" https://www.lampsplus.com/p/abc/ ") == "abc/"
    assert normalize_csv_value("/abc/") == "abc/"
    assert normalize_csv_value("abc/") == "abc/"


def test_create_run_builds_pdp_urls_for_both_targets():
    service, repo = make_service()
    files = [("PDP.csv", io.BytesIO(b"maxim-paramount-16-inchw-natural-aged-brass-led-ceiling-light__0000e/\\n"))]

    run = service.create_run(files, ["www", "mcprod"], "desktop", "PDP load")
    detail = repo.get_run_detail(run["run_id"])
    urls = [item["generated_url"] for item in detail["items"]]

    assert "https://www.lampsplus.com/p/maxim-paramount-16-inchw-natural-aged-brass-led-ceiling-light__0000e/" in urls
    assert "https://mcprod.lampsplus.com/p/maxim-paramount-16-inchw-natural-aged-brass-led-ceiling-light__0000e/" in urls


def test_create_run_dedupes_duplicate_rows():
    service, repo = make_service()
    files = [("PDP.csv", io.BytesIO(b"abc/\\nabc/\\n"))]

    run = service.create_run(files, ["www"], "desktop", "")
    detail = repo.get_run_detail(run["run_id"])

    assert len(detail["items"]) == 1


def test_worker_count_calculation_caps_at_four():
    service, _ = make_service()

    assert service.calculate_worker_count(url_count=1, average_seconds=90) == 1
    assert service.calculate_worker_count(url_count=20, average_seconds=90) == 4


def test_run_pending_items_saves_metrics():
    fake = FakePageSpeed()
    service, repo = make_service(fake)
    run = service.create_run([("PDP.csv", io.BytesIO(b"abc/\\n"))], ["www"], "desktop", "Run")

    service.run_pending_items(run["run_id"])
    detail = repo.get_run_detail(run["run_id"])

    assert detail["run"]["status"] == "completed"
    assert detail["items"][0]["fcp"] == 1000
    assert fake.urls == [("https://www.lampsplus.com/p/abc/", "desktop")]
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
python -m pytest tests/test_csv_lighthouse_service.py -q
```

Expected: fails with `ModuleNotFoundError: No module named 'services.csv_lighthouse_service'`.

- [ ] **Step 3: Implement service**

Create `services/csv_lighthouse_service.py`:

```python
from __future__ import annotations

import csv
import io
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from typing import BinaryIO

from data_access.csv_lighthouse_repository import CsvLighthouseRepository
from exceptions import ValidationError
from services.pagespeed_client import PageSpeedClient
from services.testdata_registry import SITES, group_for_filename, open_url

TARGET_BUDGET_SECONDS = 540
DEFAULT_AVERAGE_SECONDS = 90
MAX_WORKERS_PER_TARGET = 4
VALID_STRATEGIES = {"desktop", "mobile"}


def normalize_csv_value(value: str) -> str:
    cleaned = (value or "").strip()
    for origin in SITES.values():
        for prefix in (origin + "/p/", origin + "/sfp/", origin + "/s/", origin + "/more-like-this/"):
            if cleaned.startswith(prefix):
                cleaned = cleaned[len(prefix):]
                break
        if cleaned.startswith(origin):
            cleaned = cleaned[len(origin):]
    return cleaned.lstrip("/")


def parse_column_a(file_bytes: bytes) -> list[str]:
    text = file_bytes.decode("utf-8-sig", errors="replace")
    values: list[str] = []
    for row in csv.reader(io.StringIO(text)):
        if row:
            value = normalize_csv_value(row[0])
            if value:
                values.append(value)
    return values


class CsvLighthouseService:
    def __init__(
        self,
        repository: CsvLighthouseRepository,
        pagespeed_client: PageSpeedClient,
        *,
        start_background: bool = True,
    ) -> None:
        self._repo = repository
        self._pagespeed = pagespeed_client
        self._start_background = start_background

    def calculate_worker_count(self, url_count: int, average_seconds: int = DEFAULT_AVERAGE_SECONDS) -> int:
        if url_count <= 0:
            return 1
        needed = (url_count * average_seconds + TARGET_BUDGET_SECONDS - 1) // TARGET_BUDGET_SECONDS
        return max(1, min(MAX_WORKERS_PER_TARGET, needed))

    def create_run(self, files: list[tuple[str, BinaryIO]], site_keys: list[str], strategy: str, label: str | None = None) -> dict:
        self._validate(site_keys, strategy)
        items = self._build_items(files, site_keys, strategy)
        if not items:
            raise ValidationError("No recognized CSV rows were found")
        worker_count = self.calculate_worker_count(len(items))
        run_label = label.strip() if label and label.strip() else f"CSV Lighthouse {datetime.now().strftime('%Y-%m-%d %H:%M')} {'/'.join(site_keys)}"
        run_id = self._repo.create_run(run_label, strategy, site_keys, worker_count, TARGET_BUDGET_SECONDS, len(items))
        self._repo.create_items(run_id, items)
        if self._start_background:
            thread = threading.Thread(target=self.run_pending_items, args=(run_id,), daemon=True)
            thread.start()
        return {"run_id": run_id, "worker_count": worker_count, "total_items": len(items)}

    def list_runs(self) -> list[dict]:
        return self._repo.list_runs()

    def get_run(self, run_id: int) -> dict:
        return self._repo.get_run_detail(run_id)

    def cancel_run(self, run_id: int) -> dict:
        self._repo.request_cancel(run_id)
        return {"success": True}

    def run_pending_items(self, run_id: int) -> None:
        detail = self._repo.get_run_detail(run_id)
        worker_count = detail["run"]["worker_count"]
        self._repo.mark_run_running(run_id)
        with ThreadPoolExecutor(max_workers=worker_count) as executor:
            futures = []
            for item in self._repo.pending_items(run_id):
                if self._repo.should_cancel(run_id):
                    break
                futures.append(executor.submit(self._run_one_item, item))
            for future in as_completed(futures):
                future.result()
                self._repo.finish_run_if_complete(run_id)
                if self._repo.should_cancel(run_id):
                    self._repo.mark_run_cancelled(run_id)
                    break
        self._repo.finish_run_if_complete(run_id)

    def export_csv(self, run_id: int) -> str:
        detail = self._repo.get_run_detail(run_id)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Run Label", "Target", "CSV File", "Group", "Original Value", "Generated URL", "Status", "FCP", "Speed Index", "LCP", "TBT", "CLS", "Error"])
        for item in detail["items"]:
            writer.writerow([
                detail["run"]["label"], item["site_key"], item["source_filename"], item["group_key"],
                item["original_value"], item["generated_url"], item["status"], item["fcp"],
                item["speed_index"], item["lcp"], item["tbt"], item["cls"], item["error_message"],
            ])
        return output.getvalue()

    def _run_one_item(self, item: dict) -> None:
        self._repo.mark_item_running(item["id"])
        try:
            result = self._pagespeed.test_url(item["generated_url"], item["strategy"])
            self._repo.mark_item_passed(item["id"], {
                "fcp": result.get("fcp"),
                "speed_index": result.get("speed_index"),
                "lcp": result.get("lcp"),
                "tbt": result.get("tbt"),
                "cls": result.get("cls"),
            })
        except Exception as exc:
            self._repo.mark_item_failed(item["id"], str(exc))

    def _build_items(self, files: list[tuple[str, BinaryIO]], site_keys: list[str], strategy: str) -> list[dict]:
        seen: set[tuple[str, str, str]] = set()
        items: list[dict] = []
        for filename, stream in files:
            group = group_for_filename(filename)
            if group is None:
                continue
            for value in parse_column_a(stream.read()):
                for site_key in site_keys:
                    url = open_url(group, site_key, value)
                    key = (site_key, url, strategy)
                    if key in seen:
                        continue
                    seen.add(key)
                    items.append({
                        "source_filename": filename,
                        "group_key": group.key,
                        "site_key": site_key,
                        "original_value": value,
                        "generated_url": url,
                        "strategy": strategy,
                    })
        return items

    def _validate(self, site_keys: list[str], strategy: str) -> None:
        if strategy not in VALID_STRATEGIES:
            raise ValidationError("Strategy must be desktop or mobile")
        if not site_keys:
            raise ValidationError("At least one target site is required")
        invalid = [site for site in site_keys if site not in SITES]
        if invalid:
            raise ValidationError(f"Unknown target site: {', '.join(invalid)}")
```

- [ ] **Step 4: Export service**

In `services/__init__.py`, add:

```python
from services.csv_lighthouse_service import CsvLighthouseService
```

Add `CsvLighthouseService` to `__all__` if present.

- [ ] **Step 5: Run service tests**

Run:

```bash
python -m pytest tests/test_csv_lighthouse_service.py -q
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add services/csv_lighthouse_service.py services/__init__.py tests/test_csv_lighthouse_service.py
git commit -m "Add CSV Lighthouse service"
```

---

### Task 3: API Routes And App Wiring

**Files:**
- Create: `routes/csv_lighthouse_api.py`
- Modify: `routes/__init__.py`
- Modify: `app.py`
- Test: `tests/test_csv_lighthouse_api.py`

- [ ] **Step 1: Write failing route tests**

Create `tests/test_csv_lighthouse_api.py`:

```python
import io

from flask import Flask

from routes.csv_lighthouse_api import create_csv_lighthouse_blueprint


class FakeService:
    def create_run(self, files, site_keys, strategy, label):
        assert site_keys == ["www"]
        assert strategy == "desktop"
        assert label == "Run"
        assert files[0][0] == "PDP.csv"
        return {"run_id": 7, "worker_count": 1, "total_items": 1}

    def list_runs(self):
        return [{"id": 7, "label": "Run"}]

    def get_run(self, run_id):
        return {"run": {"id": run_id}, "items": []}

    def cancel_run(self, run_id):
        return {"success": True}

    def export_csv(self, run_id):
        return "Run Label,Target\\nRun,www\\n"


def make_client():
    app = Flask(__name__)
    app.register_blueprint(create_csv_lighthouse_blueprint(FakeService()))
    return app.test_client()


def test_create_run_route_accepts_multipart():
    client = make_client()
    response = client.post(
        "/api/csv-lighthouse/runs",
        data={
            "label": "Run",
            "strategy": "desktop",
            "site_keys": "www",
            "files": (io.BytesIO(b"abc/\\n"), "PDP.csv"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    assert response.get_json()["run_id"] == 7


def test_export_route_returns_csv():
    client = make_client()
    response = client.get("/api/csv-lighthouse/runs/7/export")

    assert response.status_code == 200
    assert response.headers["Content-Type"].startswith("text/csv")
    assert b"Run Label" in response.data
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
python -m pytest tests/test_csv_lighthouse_api.py -q
```

Expected: fails with `ModuleNotFoundError: No module named 'routes.csv_lighthouse_api'`.

- [ ] **Step 3: Implement route**

Create `routes/csv_lighthouse_api.py`:

```python
from __future__ import annotations

from flask import Blueprint, Response, jsonify, request

from exceptions import ValidationError
from services.csv_lighthouse_service import CsvLighthouseService


def create_csv_lighthouse_blueprint(service: CsvLighthouseService) -> Blueprint:
    bp = Blueprint("csv_lighthouse_api", __name__)

    @bp.route("/api/csv-lighthouse/runs", methods=["POST"])
    def create_run():
        files = [(file.filename, file.stream) for file in request.files.getlist("files") if file.filename]
        site_keys = [value for value in request.form.getlist("site_keys") if value]
        if not site_keys and request.form.get("site_keys"):
            site_keys = [value.strip() for value in request.form["site_keys"].split(",") if value.strip()]
        strategy = request.form.get("strategy", "desktop")
        label = request.form.get("label")
        if not files:
            raise ValidationError("At least one CSV file is required")
        result = service.create_run(files, site_keys, strategy, label)
        return jsonify({"success": True, **result})

    @bp.route("/api/csv-lighthouse/runs", methods=["GET"])
    def list_runs():
        return jsonify({"success": True, "runs": service.list_runs()})

    @bp.route("/api/csv-lighthouse/runs/<int:run_id>", methods=["GET"])
    def get_run(run_id: int):
        return jsonify({"success": True, **service.get_run(run_id)})

    @bp.route("/api/csv-lighthouse/runs/<int:run_id>/cancel", methods=["POST"])
    def cancel_run(run_id: int):
        return jsonify(service.cancel_run(run_id))

    @bp.route("/api/csv-lighthouse/runs/<int:run_id>/export", methods=["GET"])
    def export_run(run_id: int):
        csv_text = service.export_csv(run_id)
        return Response(
            csv_text,
            mimetype="text/csv",
            headers={"Content-Disposition": f"attachment; filename=csv-lighthouse-run-{run_id}.csv"},
        )

    return bp
```

- [ ] **Step 4: Wire app dependencies**

In `routes/__init__.py`, import and register:

```python
from routes.csv_lighthouse_api import create_csv_lighthouse_blueprint
```

Add `csv_lighthouse_service` to `register_blueprints(...)`, then add:

```python
app.register_blueprint(create_csv_lighthouse_blueprint(csv_lighthouse_service))
```

In `app.py`, instantiate after `pagespeed_client` and repositories:

```python
csv_lighthouse_repo = CsvLighthouseRepository(connection_manager)
csv_lighthouse_service = CsvLighthouseService(csv_lighthouse_repo, pagespeed_client)
```

Pass `csv_lighthouse_service=csv_lighthouse_service` into `register_blueprints(...)`.

- [ ] **Step 5: Run backend tests**

Run:

```bash
python -m pytest tests/test_csv_lighthouse_repository.py tests/test_csv_lighthouse_service.py tests/test_csv_lighthouse_api.py -q
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add routes/csv_lighthouse_api.py routes/__init__.py app.py tests/test_csv_lighthouse_api.py
git commit -m "Expose CSV Lighthouse API"
```

---

### Task 4: Frontend Types And API Client

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Add TypeScript types**

In `frontend/src/types/index.ts`, add:

```ts
export type CsvLighthouseRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "completed_with_failures"
  | "cancelled"
  | "failed"
  | "interrupted"

export type CsvLighthouseItemStatus = "pending" | "running" | "passed" | "failed" | "cancelled"
export type CsvLighthouseSiteKey = "www" | "mcprod"

export interface CsvLighthouseRun {
  id: number
  label: string
  strategy: Strategy
  site_keys: CsvLighthouseSiteKey[]
  status: CsvLighthouseRunStatus
  worker_count: number
  target_budget_seconds: number
  total_items: number
  completed_items: number
  failed_items: number
  average_item_duration_ms: number | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

export interface CsvLighthouseItem {
  id: number
  run_id: number
  source_filename: string
  group_key: string
  site_key: CsvLighthouseSiteKey
  original_value: string
  generated_url: string
  strategy: Strategy
  status: CsvLighthouseItemStatus
  error_message: string | null
  fcp: number | null
  speed_index: number | null
  lcp: number | null
  tbt: number | null
  cls: number | null
}

export interface CsvLighthouseRunDetail {
  run: CsvLighthouseRun
  items: CsvLighthouseItem[]
}
```

- [ ] **Step 2: Add API client methods**

In `frontend/src/services/api.ts`, import the new types and add methods near the Testing section:

```ts
async createCsvLighthouseRun(input: {
  files: File[]
  siteKeys: CsvLighthouseSiteKey[]
  strategy: Strategy
  label?: string
}): Promise<{ success: boolean; run_id: number; worker_count: number; total_items: number }> {
  const form = new FormData()
  input.files.forEach((file) => form.append("files", file))
  input.siteKeys.forEach((siteKey) => form.append("site_keys", siteKey))
  form.append("strategy", input.strategy)
  if (input.label?.trim()) form.append("label", input.label.trim())
  const response = await fetch(`${this.baseUrl}/api/csv-lighthouse/runs`, {
    method: "POST",
    body: form,
  })
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(errorData.error || `Request failed: ${response.status}`)
  }
  return response.json()
}

async listCsvLighthouseRuns(): Promise<{ success: boolean; runs: CsvLighthouseRun[] }> {
  return this.request("/api/csv-lighthouse/runs")
}

async getCsvLighthouseRun(runId: number): Promise<{ success: boolean } & CsvLighthouseRunDetail> {
  return this.request(`/api/csv-lighthouse/runs/${runId}`)
}

async cancelCsvLighthouseRun(runId: number): Promise<{ success: boolean }> {
  return this.request(`/api/csv-lighthouse/runs/${runId}/cancel`, { method: "POST" })
}

getCsvLighthouseExportUrl(runId: number): string {
  return `${this.baseUrl}/api/csv-lighthouse/runs/${runId}/export`
}
```

- [ ] **Step 3: Run frontend type check/build**

Run:

```bash
cd frontend && npm run build
```

Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services/api.ts
git commit -m "Add CSV Lighthouse frontend API"
```

---

### Task 5: Frontend Panel

**Files:**
- Create: `frontend/src/components/test-urls/CsvLighthouseResultsTable.tsx`
- Create: `frontend/src/components/test-urls/CsvLighthousePanel.tsx`
- Modify: `frontend/src/pages/TestUrls.tsx`

- [ ] **Step 1: Create results table**

Create `frontend/src/components/test-urls/CsvLighthouseResultsTable.tsx`:

```tsx
import type { CsvLighthouseItem } from "@/types"
import { formatMetric } from "@/lib/utils"

export function CsvLighthouseResultsTable({ items }: { items: CsvLighthouseItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No Lighthouse rows saved for this run.</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left">Target</th>
            <th className="px-3 py-2 text-left">Group</th>
            <th className="px-3 py-2 text-left">Value</th>
            <th className="px-3 py-2 text-left">URL</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-right">FCP</th>
            <th className="px-3 py-2 text-right">Speed Index</th>
            <th className="px-3 py-2 text-right">LCP</th>
            <th className="px-3 py-2 text-right">TBT</th>
            <th className="px-3 py-2 text-right">CLS</th>
            <th className="px-3 py-2 text-left">Error</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-t border-border">
              <td className="px-3 py-2 font-medium">{item.site_key}</td>
              <td className="px-3 py-2">{item.group_key}</td>
              <td className="max-w-56 truncate px-3 py-2" title={item.original_value}>{item.original_value}</td>
              <td className="max-w-96 truncate px-3 py-2" title={item.generated_url}>
                <a href={item.generated_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                  {item.generated_url}
                </a>
              </td>
              <td className="px-3 py-2">{item.status}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMetric(item.fcp, "ms")}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMetric(item.speed_index, "ms")}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMetric(item.lcp, "ms")}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMetric(item.tbt, "ms")}</td>
              <td className="px-3 py-2 text-right tabular-nums">{item.cls ?? "-"}</td>
              <td className="max-w-72 truncate px-3 py-2 text-destructive" title={item.error_message ?? ""}>{item.error_message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Create panel**

Create `frontend/src/components/test-urls/CsvLighthousePanel.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, Loader2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { api } from "@/services/api"
import type { CsvLighthouseRun, CsvLighthouseRunDetail, CsvLighthouseSiteKey, Strategy } from "@/types"
import { CsvLighthouseResultsTable } from "./CsvLighthouseResultsTable"

const TARGETS: Array<{ key: CsvLighthouseSiteKey; label: string }> = [
  { key: "mcprod", label: "Adobe Commerce" },
  { key: "www", label: "LampsPlus" },
]

export function CsvLighthousePanel({ strategy }: { strategy: Strategy }) {
  const [files, setFiles] = useState<File[]>([])
  const [label, setLabel] = useState("")
  const [siteKeys, setSiteKeys] = useState<CsvLighthouseSiteKey[]>(["mcprod", "www"])
  const [runs, setRuns] = useState<CsvLighthouseRun[]>([])
  const [detail, setDetail] = useState<CsvLighthouseRunDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeRun = detail?.run.status === "queued" || detail?.run.status === "running" ? detail.run : null
  const progress = detail?.run.total_items ? Math.round((detail.run.completed_items / detail.run.total_items) * 100) : 0

  const loadRuns = useCallback(async () => {
    const response = await api.listCsvLighthouseRuns()
    setRuns(response.runs)
  }, [])

  const loadDetail = useCallback(async (runId: number) => {
    const response = await api.getCsvLighthouseRun(runId)
    setDetail({ run: response.run, items: response.items })
  }, [])

  useEffect(() => {
    void loadRuns()
  }, [loadRuns])

  useEffect(() => {
    if (!activeRun) return
    const id = window.setInterval(() => void loadDetail(activeRun.id), 5000)
    return () => window.clearInterval(id)
  }, [activeRun, loadDetail])

  const canStart = files.length > 0 && siteKeys.length > 0 && !loading
  const estimatedWarning = useMemo(() => {
    const estimatedRows = files.length * siteKeys.length
    return estimatedRows > 24 ? "Large runs may need the full 9-minute window. Pharos will use bounded backend workers." : null
  }, [files.length, siteKeys.length])

  async function startRun() {
    if (!canStart) return
    setLoading(true)
    setError(null)
    try {
      const response = await api.createCsvLighthouseRun({ files, siteKeys, strategy, label })
      await loadRuns()
      await loadDetail(response.run_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start CSV Lighthouse run")
    } finally {
      setLoading(false)
    }
  }

  async function cancelRun() {
    if (!activeRun) return
    await api.cancelCsvLighthouseRun(activeRun.id)
    await loadDetail(activeRun.id)
  }

  function toggleTarget(siteKey: CsvLighthouseSiteKey, checked: boolean) {
    setSiteKeys((prev) => checked ? [...new Set([...prev, siteKey])] : prev.filter((key) => key !== siteKey))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>CSV Lighthouse Runs</CardTitle>
        <CardDescription>Upload current BlazeMeter CSVs and save Lighthouse performance metrics for generated URLs.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Run label" />
          <label className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium">
            <Upload className="h-4 w-4" />
            {files.length ? `${files.length} file(s)` : "Choose CSV files"}
            <input type="file" accept=".csv" multiple className="sr-only" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
          </label>
        </div>

        <div className="flex flex-wrap gap-4">
          {TARGETS.map((target) => (
            <label key={target.key} className="flex items-center gap-2 text-sm">
              <Checkbox checked={siteKeys.includes(target.key)} onCheckedChange={(checked) => toggleTarget(target.key, checked === true)} />
              {target.label}
            </label>
          ))}
        </div>

        {estimatedWarning && <p className="text-sm text-muted-foreground">{estimatedWarning}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Button onClick={startRun} disabled={!canStart}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Start Lighthouse Run
          </Button>
          {activeRun && <Button variant="outline" onClick={cancelRun}>Cancel Run</Button>}
          {detail && (
            <Button variant="outline" asChild>
              <a href={api.getCsvLighthouseExportUrl(detail.run.id)}>
                <Download className="mr-2 h-4 w-4" />
                Download CSV
              </a>
            </Button>
          )}
        </div>

        {detail && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-medium">{detail.run.label}</span>
              <span className="text-muted-foreground">{detail.run.completed_items}/{detail.run.total_items} complete</span>
            </div>
            <Progress value={progress} />
            <CsvLighthouseResultsTable items={detail.items} />
          </div>
        )}

        {runs.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Saved Runs</h3>
            <div className="grid gap-2">
              {runs.map((run) => (
                <button key={run.id} type="button" onClick={() => void loadDetail(run.id)} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-muted">
                  <span>{run.label}</span>
                  <span className="text-muted-foreground">{run.status}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Mount panel in Test URLs**

In `frontend/src/pages/TestUrls.tsx`, add:

```tsx
import { CsvLighthousePanel } from "@/components/test-urls/CsvLighthousePanel"
```

Render below the existing batch testing controls and above the per-site results tabs:

```tsx
<CsvLighthousePanel strategy={strategy} />
```

- [ ] **Step 4: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/test-urls/CsvLighthousePanel.tsx frontend/src/components/test-urls/CsvLighthouseResultsTable.tsx frontend/src/pages/TestUrls.tsx
git commit -m "Add CSV Lighthouse panel"
```

---

### Task 6: Full Verification

**Files:**
- No new files unless a verification fix is required.

- [ ] **Step 1: Run backend tests**

Run:

```bash
python -m pytest tests/test_csv_lighthouse_repository.py tests/test_csv_lighthouse_service.py tests/test_csv_lighthouse_api.py -q
```

Expected: all pass.

- [ ] **Step 2: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Smoke test with tiny CSV**

Create a local `PDP.csv` containing:

```text
maxim-paramount-16-inchw-natural-aged-brass-led-ceiling-light__0000e/
```

Start the app, upload that CSV, select only `www`, start the run, and verify the saved item URL is:

```text
https://www.lampsplus.com/p/maxim-paramount-16-inchw-natural-aged-brass-led-ceiling-light__0000e/
```

- [ ] **Step 4: Verify saved CSV export**

Open the saved run and click Download CSV.

Expected CSV headers:

```text
Run Label,Target,CSV File,Group,Original Value,Generated URL,Status,FCP,Speed Index,LCP,TBT,CLS,Error
```

- [ ] **Step 5: Commit verification fixes if needed**

If any verification fix was required:

```bash
git add <changed-files>
git commit -m "Fix CSV Lighthouse verification issues"
```

If no fixes were needed, do not create an empty commit.
