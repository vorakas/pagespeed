# Zephyr History Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-runnable "Import from Zephyr" that backfills the Test Case Database from Zephyr Scale's change history for a project folder tree, deduped on Zephyr history entry id.

**Architecture:** A `ZephyrHistoryClient` isolates all HTTP calls (official `/rest/atm/1.0` search + internal `/rest/tests/1.0` allVersions/history). Pure transformer functions turn one Zephyr history entry into one `test_case_changes` record with noise filtering. `ZephyrImportService` orchestrates (parallel fetch, dedupe via new `zephyr_history_id` unique column, insert via repository). One new route `POST /api/test-case-database/import`; frontend gets an import dialog on the Test Case Database page.

**Tech Stack:** Python 3.11 / Flask / requests / ThreadPoolExecutor; SQLite + PostgreSQL via `ConnectionManager`; React 19 + TypeScript frontend. Tests: pytest (`python -m pytest tests/... -v` from repo root), frontend `npm run build` in `frontend/`.

**Spec:** `docs/superpowers/specs/2026-09-09-zephyr-history-import-design.md`

**Commit style:** plain imperative subject (no `feat:` prefix — match `git log`), trailer on every commit:
`Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`

**Verified endpoint facts (from live lampstrack):**
- `GET /rest/tests/1.0/testcase/{key}/allVersions?fields=id,...` → `[{"id":30707,"majorVersion":1,...}]` (accepts the TC key).
- `GET /rest/tests/1.0/testcase/{numericId}/history` → list of entries: `{"id":547403,"sourceId":30707,"historyDate":"...","userKey":"ablais","type":"UPDATE"|"CREATE","changeHistoryItems":[{"id":873157,"fieldName":"PRECONDITION","originalValue":"<html>","newValue":"<html>"}, ...]}`. `CREATE` entries have no `changeHistoryItems`. Values are HTML; `originalValue`/`newValue` may each be absent.
- Step items use `fieldName` like `TEST_SCRIPT.STEP.DESCRIPTION {"step":3}`; add/remove markers are `TEST_SCRIPT.STEP.ADDED {"step":1}` / `TEST_SCRIPT.STEP.REMOVED {"step":1}` with value `-`.
- Auth: `Authorization: Bearer <JIRA_PAT>` (server-side env, already wired in `app.py`).

---

### Task 1: `zephyr_history_id` column + repository support

**Files:**
- Modify: `data_access/connection.py` (Postgres schema ~line 732 after existing test-case indexes; SQLite `_SQLITE_MIGRATIONS` ~line 1216 and after the migration loop ~line 1240)
- Modify: `data_access/test_case_database_repository.py`
- Test: `tests/test_test_case_database_repository.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_test_case_database_repository.py` (reuse the existing `make_repo` / `sample_payload` helpers at the top of the file):

```python
def test_create_change_stores_zephyr_history_id(tmp_path: Path, monkeypatch) -> None:
    repo = make_repo(tmp_path, monkeypatch)

    payload = sample_payload()
    payload["zephyr_history_id"] = 547403
    change_id = repo.create_change(payload)
    created = repo.get_change(change_id)

    assert created is not None
    assert created["zephyr_history_id"] == 547403


def test_create_change_without_zephyr_history_id_allows_many_nulls(tmp_path: Path, monkeypatch) -> None:
    repo = make_repo(tmp_path, monkeypatch)

    first_id = repo.create_change(sample_payload())
    second_id = repo.create_change(sample_payload())

    assert first_id != second_id
    assert repo.get_change(first_id)["zephyr_history_id"] is None


def test_duplicate_zephyr_history_id_is_rejected(tmp_path: Path, monkeypatch) -> None:
    import sqlite3

    import pytest

    repo = make_repo(tmp_path, monkeypatch)

    payload = sample_payload()
    payload["zephyr_history_id"] = 547403
    repo.create_change(payload)

    with pytest.raises(sqlite3.IntegrityError):
        repo.create_change(payload)


def test_existing_zephyr_history_ids_returns_known_subset(tmp_path: Path, monkeypatch) -> None:
    repo = make_repo(tmp_path, monkeypatch)

    payload = sample_payload()
    payload["zephyr_history_id"] = 547403
    repo.create_change(payload)

    existing = repo.existing_zephyr_history_ids([547403, 999999])

    assert existing == {547403}
    assert repo.existing_zephyr_history_ids([]) == set()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_test_case_database_repository.py -v`
Expected: the 4 new tests FAIL (`zephyr_history_id` KeyError / no such column / no attribute `existing_zephyr_history_ids`); existing tests PASS.

- [ ] **Step 3: Add the column and unique index to both schemas**

In `data_access/connection.py`, `_init_postgres_schema`, directly after the existing `idx_test_case_change_attachments_change_id` index creation (~line 732), add:

```python
        cursor.execute("ALTER TABLE test_case_changes ADD COLUMN IF NOT EXISTS zephyr_history_id BIGINT")
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_test_case_changes_zephyr_history_id
            ON test_case_changes(zephyr_history_id)
        """)
```

In `_init_sqlite_schema`, append to `_SQLITE_MIGRATIONS` (~line 1234):

```python
            "ALTER TABLE test_case_changes ADD COLUMN zephyr_history_id INTEGER",
```

and directly AFTER the `for statement in _SQLITE_MIGRATIONS:` try/except loop (~line 1240, before the `UPDATE test_results ...` line), add:

```python
        cursor.execute("""
            CREATE UNIQUE INDEX IF NOT EXISTS idx_test_case_changes_zephyr_history_id
            ON test_case_changes(zephyr_history_id)
        """)
```

(The index must be created after the migration loop because the column does not exist until the ALTER runs on older databases. Unique indexes allow multiple NULLs in both SQLite and Postgres, so manual records are unaffected.)

- [ ] **Step 4: Extend the repository**

In `data_access/test_case_database_repository.py`:

`create_change` — include the new column:

```python
    def create_change(self, data: dict) -> int:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                INSERT INTO test_case_changes (
                    test_case_id, title, test_case_url, change_summary,
                    before_state, after_state, changed_by, change_date, status, tags,
                    zephyr_history_id
                ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                {self._cm.returning_id()}
                """,
                (
                    data["test_case_id"],
                    data["title"],
                    data["test_case_url"],
                    data["change_summary"],
                    data["before_state"],
                    data["after_state"],
                    data["changed_by"],
                    data["change_date"],
                    data["status"],
                    json.dumps(data["tags"]),
                    data.get("zephyr_history_id"),
                ),
            )
            change_id = self._cm.last_insert_id(cursor)
            self._replace_links(cursor, change_id, data)
            return change_id
```

New method (place after `search_changes`):

```python
    def existing_zephyr_history_ids(self, history_ids: list[int]) -> set[int]:
        """Return the subset of ``history_ids`` already stored on any change."""
        if not history_ids:
            return set()
        ph = self._cm.placeholder()
        placeholders = ", ".join([ph] * len(history_ids))
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT zephyr_history_id
                FROM test_case_changes
                WHERE zephyr_history_id IN ({placeholders})
                """,
                tuple(history_ids),
            )
            return {row["zephyr_history_id"] for row in self._cm.rows_to_dicts(cursor)}
```

Do NOT touch `update_change` — the UI edit path must never overwrite the dedupe key.

- [ ] **Step 5: Run tests to verify they pass**

Run: `python -m pytest tests/test_test_case_database_repository.py -v`
Expected: ALL PASS.

- [ ] **Step 6: Commit**

```bash
git add data_access/connection.py data_access/test_case_database_repository.py tests/test_test_case_database_repository.py
git commit -m "Add zephyr_history_id dedupe column to test case changes"
```
(with the Co-Authored-By trailer)

---

### Task 2: `Imported` status

**Files:**
- Modify: `services/test_case_database_service.py:11-12`
- Test: `tests/test_test_case_database_service.py`

- [ ] **Step 1: Write the failing test**

Append to `tests/test_test_case_database_service.py` (the test imports the module constants directly — no service instance needed):

```python
def test_imported_is_a_writable_status() -> None:
    from services.test_case_database_service import VALID_STATUSES, WRITABLE_STATUSES

    assert "Imported" in VALID_STATUSES
    assert "Imported" in WRITABLE_STATUSES
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest tests/test_test_case_database_service.py -v`
Expected: new test FAILS on the first assert.

- [ ] **Step 3: Implement**

In `services/test_case_database_service.py` change lines 11-12 to:

```python
VALID_STATUSES = {"Active", "Draft", "Superseded", "Archived", "Imported"}
WRITABLE_STATUSES = {"Active", "Draft", "Superseded", "Imported"}
```

- [ ] **Step 4: Run the whole service test file**

Run: `python -m pytest tests/test_test_case_database_service.py -v`
Expected: ALL PASS. If any existing test asserts the exact "Status must be one of: ..." message text, update its expected string to the new sorted list (`Active, Archived, Draft, Imported, Superseded`).

- [ ] **Step 5: Commit**

```bash
git add services/test_case_database_service.py tests/test_test_case_database_service.py
git commit -m "Add Imported status for Zephyr-imported change records"
```

---

### Task 3: `ZephyrHistoryClient`

**Files:**
- Create: `services/zephyr_history_client.py`
- Test: `tests/test_zephyr_history_client.py`

This is the ONLY file allowed to reference `/rest/tests/1.0` — that API is undocumented and a Zephyr upgrade may break it; isolation contains the blast radius.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_zephyr_history_client.py`:

```python
from unittest.mock import MagicMock, patch

from services.zephyr_history_client import ZephyrHistoryClient


def _response(payload):
    response = MagicMock()
    response.json.return_value = payload
    response.raise_for_status.return_value = None
    return response


def make_client() -> ZephyrHistoryClient:
    return ZephyrHistoryClient(jira_pat="token", jira_base_url="https://lampstrack.example.com/")


@patch("services.zephyr_history_client.requests.get")
def test_search_test_cases_paginates_and_sends_bearer(mock_get) -> None:
    page_one = [{"key": f"TC-T{i}", "name": f"Case {i}"} for i in range(100)]
    page_two = [{"key": "TC-T100", "name": "Case 100"}]
    mock_get.side_effect = [_response(page_one), _response(page_two)]

    client = make_client()
    results = client.search_test_cases(14210, "/Data Sync")

    assert len(results) == 101
    first_call = mock_get.call_args_list[0]
    assert first_call.args[0] == "https://lampstrack.example.com/rest/atm/1.0/testcase/search"
    assert first_call.kwargs["params"]["query"] == 'projectId = 14210 AND folder = "/Data Sync"'
    assert first_call.kwargs["headers"]["Authorization"] == "Bearer token"
    second_call = mock_get.call_args_list[1]
    assert second_call.kwargs["params"]["startAt"] == 100


@patch("services.zephyr_history_client.requests.get")
def test_search_test_cases_handles_dict_payload_and_dedupes(mock_get) -> None:
    mock_get.return_value = _response(
        {"results": [{"key": "TC-T1", "name": "One"}, {"key": "TC-T1", "name": "One"}]}
    )

    results = make_client().search_test_cases(14210, "/Data Sync")

    assert [row["key"] for row in results] == ["TC-T1"]


@patch("services.zephyr_history_client.requests.get")
def test_version_ids_extracts_ints(mock_get) -> None:
    mock_get.return_value = _response([{"id": 30707}, {"id": "30901"}, {"id": None}])

    ids = make_client().version_ids("TC-T14481")

    assert ids == [30707, 30901]
    call = mock_get.call_args
    assert call.args[0] == "https://lampstrack.example.com/rest/tests/1.0/testcase/TC-T14481/allVersions"
    assert call.kwargs["params"] == {"fields": "id"}


@patch("services.zephyr_history_client.requests.get")
def test_fetch_history_returns_list_or_empty(mock_get) -> None:
    mock_get.return_value = _response([{"id": 547403}])
    assert make_client().fetch_history(30707) == [{"id": 547403}]

    mock_get.return_value = _response({"unexpected": True})
    assert make_client().fetch_history(30707) == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_zephyr_history_client.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'services.zephyr_history_client'`.

- [ ] **Step 3: Implement the client**

Create `services/zephyr_history_client.py`:

```python
"""HTTP client for the Zephyr Scale APIs used by the history import.

Every call to the undocumented internal ``/rest/tests/1.0`` API lives in
this file so a Zephyr Scale upgrade that changes that API breaks exactly
one module. The official ``/rest/atm/1.0`` search is also kept here so the
import service never talks HTTP directly.
"""

from __future__ import annotations

from typing import Any

import requests

SEARCH_PAGE_SIZE = 100
REQUEST_TIMEOUT_SECONDS = 60


class ZephyrHistoryClient:
    """Fetch test case lists, version ids, and change history from Zephyr."""

    def __init__(
        self,
        jira_pat: str,
        jira_base_url: str = "https://lampstrack.lampsplus.com",
    ) -> None:
        self.jira_pat = jira_pat
        self.jira_base_url = jira_base_url.rstrip("/")

    def search_test_cases(self, project_id: int, folder: str) -> list[dict[str, Any]]:
        """List test cases in a project folder tree via the official ATM API."""
        start_at = 0
        results: list[dict[str, Any]] = []
        seen_keys: set[str] = set()
        while True:
            params: dict[str, Any] = {
                "query": f'projectId = {project_id} AND folder = "{folder}"',
                "fields": "key,name,folder",
                "maxResults": SEARCH_PAGE_SIZE,
            }
            if start_at:
                params["startAt"] = start_at
            data = self._get_json("/rest/atm/1.0/testcase/search", params)
            page = data if isinstance(data, list) else data.get("results") or data.get("values") or []
            new_count = 0
            for row in page:
                key = str(row.get("key") or "")
                if not key or key in seen_keys:
                    continue
                seen_keys.add(key)
                results.append(row)
                new_count += 1
            if len(page) < SEARCH_PAGE_SIZE or new_count == 0:
                break
            start_at += len(page)
        return results

    def version_ids(self, test_case_key: str) -> list[int]:
        """Resolve a test case key to the numeric ids of all its versions."""
        data = self._get_json(
            f"/rest/tests/1.0/testcase/{test_case_key}/allVersions",
            {"fields": "id"},
        )
        version_ids: list[int] = []
        for row in data or []:
            try:
                version_ids.append(int(row.get("id")))
            except (TypeError, ValueError):
                continue
        return version_ids

    def fetch_history(self, numeric_id: int) -> list[dict[str, Any]]:
        """Fetch the change history entries for one test case version id."""
        data = self._get_json(f"/rest/tests/1.0/testcase/{numeric_id}/history")
        return data if isinstance(data, list) else []

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.jira_pat}", "Accept": "application/json"}

    def _get_json(self, path: str, params: dict[str, Any] | None = None) -> Any:
        response = requests.get(
            f"{self.jira_base_url}{path}",
            params=params,
            headers=self._headers(),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_zephyr_history_client.py -v`
Expected: 4 PASS.

- [ ] **Step 5: Commit**

```bash
git add services/zephyr_history_client.py tests/test_zephyr_history_client.py
git commit -m "Add Zephyr history client isolating internal tests/1.0 API"
```

---

### Task 4: History-entry transformer

**Files:**
- Create: `services/zephyr_import_service.py` (module-level pure functions; the service class is Task 5)
- Test: `tests/test_zephyr_import_transform.py`

Transformation rules (from the spec):
1. Entity-decode both sides; drop items whose decoded values are equal (kills `&mdash;` vs `—` diffs).
2. Drop `TEST_SCRIPT.STEP.TEST_DATA` items where both sides reduce (tags stripped, entities decoded, whitespace and U+2060 word-joiners removed) to only `{Placeholder}` tokens or nothing.
3. `TEST_SCRIPT.STEP.ADDED` / `.REMOVED` markers never become before/after sections — they feed summary lines "Added steps 1-6" / "Removed steps 1-4".
4. If everything filters out, the entry produces no record (return `None`).
5. `type == "CREATE"` → record with summary `Test case created` and empty before/after.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_zephyr_import_transform.py`:

```python
from services.zephyr_import_service import (
    format_step_ranges,
    prettify_field_name,
    transform_entry,
)

BASE_URL = "https://lampstrack.example.com"


def make_entry(**overrides) -> dict:
    entry = {
        "id": 547403,
        "sourceId": 30707,
        "historyDate": "2026-08-13T04:13:34.957Z",
        "userKey": "ablais",
        "type": "UPDATE",
        "source": "TEST_CASE",
        "changeHistoryItems": [],
    }
    entry.update(overrides)
    return entry


BOILERPLATE_TEST_DATA = (
    '<span class="atwho-inserted">{User Roles}</span>\u2060 '
    '<span class="atwho-inserted">{Operating System}</span>\u2060 '
    '<span class="atwho-inserted">{Browser}</span>\u2060 '
)


def test_prettify_field_name_variants() -> None:
    assert prettify_field_name("PRECONDITION") == "Precondition"
    assert prettify_field_name("FOLDER") == "Folder"
    assert prettify_field_name('TEST_SCRIPT.STEP.DESCRIPTION {"step":3}') == "Step 3 — Description"
    assert prettify_field_name('TEST_SCRIPT.STEP.EXPECTED_RESULT {"step":12}') == "Step 12 — Expected Result"
    assert prettify_field_name('TEST_SCRIPT.STEP.TEST_DATA {"step":1}') == "Step 1 — Test Data"
    assert prettify_field_name("User Role") == "User Role"


def test_format_step_ranges_compresses() -> None:
    assert format_step_ranges([1, 2, 3, 5]) == "1-3, 5"
    assert format_step_ranges([4]) == "4"
    assert format_step_ranges([3, 1, 2]) == "1-3"


def test_transform_builds_record_with_sections_and_summary() -> None:
    entry = make_entry(
        changeHistoryItems=[
            {
                "id": 873157,
                "fieldName": "PRECONDITION",
                "originalValue": "<ol><li>Old precondition</li></ol>",
                "newValue": "<ol><li>New precondition</li></ol>",
            },
            {"id": 873158, "fieldName": 'TEST_SCRIPT.STEP.ADDED {"step":5}', "newValue": "-"},
            {"id": 873159, "fieldName": 'TEST_SCRIPT.STEP.ADDED {"step":6}', "newValue": "-"},
            {
                "id": 873160,
                "fieldName": 'TEST_SCRIPT.STEP.DESCRIPTION {"step":2}',
                "originalValue": "<p>Old step two</p>",
                "newValue": "<p>New step two</p>",
            },
            {"id": 873161, "fieldName": 'TEST_SCRIPT.STEP.TEST_DATA {"step":2}', "newValue": BOILERPLATE_TEST_DATA},
            {"id": 873182, "fieldName": 'TEST_SCRIPT.STEP.REMOVED {"step":1}', "originalValue": "-"},
        ]
    )

    record = transform_entry(entry, "TC-T14481", "Cart shipping address sync", BASE_URL)

    assert record is not None
    assert record["test_case_id"] == "TC-T14481"
    assert record["title"] == "Cart shipping address sync"
    assert record["test_case_url"] == f"{BASE_URL}/secure/Tests.jspa#/testCase/TC-T14481"
    assert record["changed_by"] == "ablais"
    assert record["change_date"] == "2026-08-13T04:13:34.957Z"
    assert record["status"] == "Imported"
    assert record["tags"] == ["zephyr-import"]
    assert record["zephyr_history_id"] == 547403
    assert record["associated_bugs"] == []
    assert record["associated_tasks"] == []
    assert (
        record["change_summary"]
        == "Updated Precondition; updated step 2; added steps 5-6; removed step 1"
    )
    assert "<h4>Precondition</h4><ol><li>Old precondition</li></ol>" in record["before_state"]
    assert "<h4>Precondition</h4><ol><li>New precondition</li></ol>" in record["after_state"]
    assert "<h4>Step 2 — Description</h4><p>New step two</p>" in record["after_state"]
    # Boilerplate TEST_DATA item was filtered out entirely.
    assert "Test Data" not in record["before_state"]
    assert "Test Data" not in record["after_state"]


def test_transform_drops_encoding_only_diffs() -> None:
    entry = make_entry(
        changeHistoryItems=[
            {
                "id": 871397,
                "fieldName": 'TEST_SCRIPT.STEP.DESCRIPTION {"step":3}',
                "originalValue": "<p>Wait &mdash; then refresh</p>",
                "newValue": "<p>Wait — then refresh</p>",
            }
        ]
    )

    assert transform_entry(entry, "TC-T14481", "Anything", BASE_URL) is None


def test_transform_keeps_folder_move_with_special_summary() -> None:
    entry = make_entry(
        id=547247,
        changeHistoryItems=[
            {
                "id": 871420,
                "fieldName": "FOLDER",
                "originalValue": "/Data Sync/WUP to AC/Cart Data",
                "newValue": "/Data Sync/Cart/WUP to AC",
            }
        ],
    )

    record = transform_entry(entry, "TC-T14481", "Anything", BASE_URL)

    assert record is not None
    assert record["change_summary"] == "Moved folder"
    assert "/Data Sync/WUP to AC/Cart Data" in record["before_state"]
    assert "/Data Sync/Cart/WUP to AC" in record["after_state"]


def test_transform_create_entry() -> None:
    entry = {
        "id": 547238,
        "sourceId": 30707,
        "historyDate": "2026-08-11T04:33:52.737Z",
        "userKey": "ablais",
        "type": "CREATE",
        "source": "TEST_CASE",
    }

    record = transform_entry(entry, "TC-T14481", "Cart shipping address sync", BASE_URL)

    assert record is not None
    assert record["change_summary"] == "Test case created"
    assert record["before_state"] == ""
    assert record["after_state"] == ""
    assert record["zephyr_history_id"] == 547238


def test_transform_missing_side_renders_dash_placeholder() -> None:
    entry = make_entry(
        changeHistoryItems=[
            {
                "id": 871394,
                "fieldName": "User Role",
                "newValue": "SNIS-PCSI",
            }
        ]
    )

    record = transform_entry(entry, "TC-T14481", "Anything", BASE_URL)

    assert record is not None
    assert record["change_summary"] == "Updated User Role"
    assert "<h4>User Role</h4><p>—</p>" in record["before_state"]
    assert "<h4>User Role</h4>SNIS-PCSI" in record["after_state"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_zephyr_import_transform.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'services.zephyr_import_service'`.

- [ ] **Step 3: Implement the transformer**

Create `services/zephyr_import_service.py`:

```python
"""Transform Zephyr Scale change history into Test Case Database records."""

from __future__ import annotations

import html
import re
from typing import Any

IMPORT_STATUS = "Imported"
IMPORT_TAG = "zephyr-import"

_STEP_FIELD_RE = re.compile(r'^TEST_SCRIPT\.STEP\.(?P<kind>[A-Z_]+) \{"step":(?P<step>\d+)\}$')
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_PLACEHOLDER_ONLY_RE = re.compile(r"^(\{[^{}]*\})*$")

_STEP_KIND_LABELS = {
    "DESCRIPTION": "Description",
    "EXPECTED_RESULT": "Expected Result",
    "TEST_DATA": "Test Data",
    "ADDED": "Added",
    "REMOVED": "Removed",
}


def prettify_field_name(field_name: str) -> str:
    """Human heading for a Zephyr history fieldName."""
    match = _STEP_FIELD_RE.match(field_name)
    if match:
        kind = _STEP_KIND_LABELS.get(match.group("kind"), match.group("kind").replace("_", " ").title())
        return f"Step {match.group('step')} — {kind}"
    if re.fullmatch(r"[A-Z_]+", field_name):
        return field_name.replace("_", " ").title()
    return field_name


def format_step_ranges(steps: list[int]) -> str:
    """Compress step numbers: [1,2,3,5] -> '1-3, 5'."""
    ordered = sorted(set(steps))
    ranges: list[str] = []
    start = previous = ordered[0]
    for step in ordered[1:]:
        if step == previous + 1:
            previous = step
            continue
        ranges.append(f"{start}-{previous}" if start != previous else str(start))
        start = previous = step
    ranges.append(f"{start}-{previous}" if start != previous else str(start))
    return ", ".join(ranges)


def _decoded(value: str | None) -> str:
    return html.unescape(value or "")


def _visible_text(value: str | None) -> str:
    """Tag-stripped, entity-decoded text with whitespace and word-joiners removed."""
    without_tags = _HTML_TAG_RE.sub("", value or "")
    decoded = html.unescape(without_tags)
    return re.sub(r"[\s\u2060\u200b]+", "", decoded)


def _is_noise(field_name: str, original: str | None, new: str | None) -> bool:
    if _decoded(original) == _decoded(new):
        return True
    match = _STEP_FIELD_RE.match(field_name)
    if match and match.group("kind") == "TEST_DATA":
        original_text = _visible_text(original)
        new_text = _visible_text(new)
        if _PLACEHOLDER_ONLY_RE.fullmatch(original_text) and _PLACEHOLDER_ONLY_RE.fullmatch(new_text):
            return True
    return False


def _step_marker(field_name: str) -> tuple[str, int] | None:
    """Return ('ADDED'|'REMOVED', step) for add/remove marker items, else None."""
    match = _STEP_FIELD_RE.match(field_name)
    if match and match.group("kind") in {"ADDED", "REMOVED"}:
        return match.group("kind"), int(match.group("step"))
    return None


def _steps_phrase(verb: str, steps: list[int]) -> str:
    noun = "step" if len(set(steps)) == 1 else "steps"
    return f"{verb} {noun} {format_step_ranges(steps)}"


def _compose_summary(
    surviving: list[dict[str, Any]],
    added_steps: list[int],
    removed_steps: list[int],
) -> str:
    parts: list[str] = []
    seen_fields: set[str] = set()
    updated_steps: list[int] = []
    for item in surviving:
        field_name = str(item.get("fieldName") or "")
        match = _STEP_FIELD_RE.match(field_name)
        if match:
            updated_steps.append(int(match.group("step")))
            continue
        if field_name in seen_fields:
            continue
        seen_fields.add(field_name)
        if field_name == "FOLDER":
            parts.append("Moved folder")
        else:
            parts.append(f"Updated {prettify_field_name(field_name)}")
    if updated_steps:
        parts.append(_steps_phrase("updated", updated_steps))
    if added_steps:
        parts.append(_steps_phrase("added", added_steps))
    if removed_steps:
        parts.append(_steps_phrase("removed", removed_steps))
    summary = "; ".join(parts)
    return summary[0].upper() + summary[1:] if summary else summary


def _compose_sections(surviving: list[dict[str, Any]]) -> tuple[str, str]:
    before_parts: list[str] = []
    after_parts: list[str] = []
    for item in surviving:
        heading = f"<h4>{prettify_field_name(str(item.get('fieldName') or ''))}</h4>"
        before_parts.append(heading + (item.get("originalValue") or "<p>—</p>"))
        after_parts.append(heading + (item.get("newValue") or "<p>—</p>"))
    return "".join(before_parts), "".join(after_parts)


def transform_entry(
    entry: dict[str, Any],
    test_case_key: str,
    test_case_name: str,
    jira_base_url: str,
) -> dict[str, Any] | None:
    """One Zephyr history entry (one save) -> one change record, or None if pure noise."""
    base_record = {
        "test_case_id": test_case_key,
        "title": test_case_name,
        "test_case_url": f"{jira_base_url.rstrip('/')}/secure/Tests.jspa#/testCase/{test_case_key}",
        "changed_by": str(entry.get("userKey") or ""),
        "change_date": str(entry.get("historyDate") or ""),
        "status": IMPORT_STATUS,
        "tags": [IMPORT_TAG],
        "associated_bugs": [],
        "associated_tasks": [],
        "zephyr_history_id": entry.get("id"),
    }

    if str(entry.get("type") or "").upper() == "CREATE":
        return {**base_record, "change_summary": "Test case created", "before_state": "", "after_state": ""}

    surviving: list[dict[str, Any]] = []
    added_steps: list[int] = []
    removed_steps: list[int] = []
    for item in entry.get("changeHistoryItems") or []:
        field_name = str(item.get("fieldName") or "")
        marker = _step_marker(field_name)
        if marker:
            (added_steps if marker[0] == "ADDED" else removed_steps).append(marker[1])
            continue
        if _is_noise(field_name, item.get("originalValue"), item.get("newValue")):
            continue
        surviving.append(item)

    if not surviving and not added_steps and not removed_steps:
        return None

    before_state, after_state = _compose_sections(surviving)
    return {
        **base_record,
        "change_summary": _compose_summary(surviving, added_steps, removed_steps),
        "before_state": before_state,
        "after_state": after_state,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_zephyr_import_transform.py -v`
Expected: 7 PASS. (If the "Updated Precondition; updated step 2; added steps 5-6; removed step 1" assertion fails on ordering or casing, fix the implementation — the test is the contract.)

- [ ] **Step 5: Commit**

```bash
git add services/zephyr_import_service.py tests/test_zephyr_import_transform.py
git commit -m "Add Zephyr history transformer with noise filtering"
```

---

### Task 5: `ZephyrImportService.run_import`

**Files:**
- Modify: `services/zephyr_import_service.py` (append the service class)
- Test: `tests/test_zephyr_import_service.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_zephyr_import_service.py`:

```python
import requests

from services.zephyr_import_service import ZephyrImportService


class FakeClient:
    def __init__(self) -> None:
        self.test_cases = [
            {"key": "TC-T1", "name": "Case One"},
            {"key": "TC-T2", "name": "Case Two"},
        ]
        self.versions = {"TC-T1": [101], "TC-T2": [201, 202]}
        self.histories = {
            101: [
                {
                    "id": 9001,
                    "historyDate": "2026-08-13T04:13:34.957Z",
                    "userKey": "ablais",
                    "type": "UPDATE",
                    "changeHistoryItems": [
                        {"id": 1, "fieldName": "PRECONDITION", "originalValue": "<p>a</p>", "newValue": "<p>b</p>"}
                    ],
                },
                {
                    "id": 9002,
                    "historyDate": "2026-08-11T04:33:52.737Z",
                    "userKey": "ablais",
                    "type": "UPDATE",
                    # Encoding-only diff -> filtered out entirely (skippedEmpty).
                    "changeHistoryItems": [
                        {"id": 2, "fieldName": "OBJECTIVE", "originalValue": "<p>x &mdash; y</p>", "newValue": "<p>x — y</p>"}
                    ],
                },
            ],
            # Both versions of TC-T2 return the same entry -> merged by entry id.
            201: [{"id": 9003, "historyDate": "2026-08-01T00:00:00.000Z", "userKey": "ablais", "type": "CREATE"}],
            202: [{"id": 9003, "historyDate": "2026-08-01T00:00:00.000Z", "userKey": "ablais", "type": "CREATE"}],
        }

    def search_test_cases(self, project_id, folder):
        assert project_id == 14210
        assert folder == "/Data Sync"
        return self.test_cases

    def version_ids(self, key):
        return self.versions[key]

    def fetch_history(self, numeric_id):
        return self.histories[numeric_id]


class FakeRepository:
    def __init__(self, existing=frozenset()) -> None:
        self.existing = set(existing)
        self.created: list[dict] = []

    def existing_zephyr_history_ids(self, history_ids):
        return self.existing & set(history_ids)

    def create_change(self, data):
        self.created.append(data)
        return len(self.created)


def make_service(repo=None, client=None) -> ZephyrImportService:
    return ZephyrImportService(
        jira_pat="token",
        repository=repo or FakeRepository(),
        client=client or FakeClient(),
    )


def test_run_import_creates_deduped_records_and_counts() -> None:
    repo = FakeRepository()
    service = make_service(repo=repo)

    summary = service.run_import(14210, "/Data Sync")

    assert summary["testCases"] == 2
    assert summary["recordsCreated"] == 2  # 9001 update + 9003 create; 9002 was noise
    assert summary["skippedExisting"] == 0
    assert summary["skippedEmpty"] == 1
    assert summary["failures"] == []
    created_ids = {record["zephyr_history_id"] for record in repo.created}
    assert created_ids == {9001, 9003}
    titles = {record["test_case_id"]: record["title"] for record in repo.created}
    assert titles == {"TC-T1": "Case One", "TC-T2": "Case Two"}


def test_run_import_skips_already_imported_entries() -> None:
    repo = FakeRepository(existing={9001})
    summary = make_service(repo=repo).run_import(14210, "/Data Sync")

    assert summary["recordsCreated"] == 1
    assert summary["skippedExisting"] == 1
    assert {record["zephyr_history_id"] for record in repo.created} == {9003}


def test_run_import_collects_per_case_failures() -> None:
    client = FakeClient()

    def broken_versions(key):
        if key == "TC-T2":
            raise requests.ConnectionError("boom")
        return {"TC-T1": [101]}[key]

    client.version_ids = broken_versions
    repo = FakeRepository()

    summary = make_service(repo=repo, client=client).run_import(14210, "/Data Sync")

    assert summary["recordsCreated"] == 1
    assert summary["failures"] == [{"key": "TC-T2", "error": "boom"}]


def test_run_import_requires_pat() -> None:
    import pytest

    service = ZephyrImportService(jira_pat="", repository=FakeRepository(), client=FakeClient())
    with pytest.raises(ValueError, match="JIRA_PAT is not configured"):
        service.run_import(14210, "/Data Sync")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_zephyr_import_service.py -v`
Expected: FAIL with `ImportError: cannot import name 'ZephyrImportService'`.

- [ ] **Step 3: Implement the service class**

Append to `services/zephyr_import_service.py` (add the imports at the top of the file):

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

from data_access.test_case_database_repository import TestCaseDatabaseRepository
from services.zephyr_history_client import ZephyrHistoryClient
```

then the class at the bottom:

```python
class ZephyrImportService:
    """Import Zephyr Scale change history into the Test Case Database."""

    def __init__(
        self,
        jira_pat: str,
        repository: TestCaseDatabaseRepository,
        client: ZephyrHistoryClient | None = None,
        jira_base_url: str = "https://lampstrack.lampsplus.com",
        max_workers: int = 8,
    ) -> None:
        self.jira_pat = jira_pat
        self.jira_base_url = jira_base_url.rstrip("/")
        self._repository = repository
        self._client = client or ZephyrHistoryClient(jira_pat, jira_base_url)
        self._max_workers = max_workers

    def run_import(self, project_id: int, folder: str) -> dict[str, Any]:
        if not self.jira_pat:
            raise ValueError("JIRA_PAT is not configured")

        test_cases = self._client.search_test_cases(project_id, folder)
        failures: list[dict[str, str]] = []
        histories: dict[str, tuple[str, list[dict[str, Any]]]] = {}

        with ThreadPoolExecutor(max_workers=self._max_workers) as executor:
            futures = {
                executor.submit(self._fetch_case_history, str(case.get("key") or "")): case
                for case in test_cases
                if case.get("key")
            }
            for future in as_completed(futures):
                case = futures[future]
                key = str(case.get("key") or "")
                try:
                    histories[key] = (str(case.get("name") or key), future.result())
                except Exception as exc:  # noqa: BLE001 - collected into the run summary
                    failures.append({"key": key, "error": str(exc)})

        records: list[dict[str, Any]] = []
        skipped_empty = 0
        seen_entry_ids: set[int] = set()
        for key, (name, entries) in histories.items():
            for entry in entries:
                entry_id = entry.get("id")
                if entry_id in seen_entry_ids:
                    continue
                if entry_id is not None:
                    seen_entry_ids.add(entry_id)
                record = transform_entry(entry, key, name, self.jira_base_url)
                if record is None:
                    skipped_empty += 1
                    continue
                records.append(record)

        existing_ids = self._repository.existing_zephyr_history_ids(
            [record["zephyr_history_id"] for record in records if record["zephyr_history_id"] is not None]
        )
        created = 0
        skipped_existing = 0
        for record in records:
            if record["zephyr_history_id"] in existing_ids:
                skipped_existing += 1
                continue
            self._repository.create_change(record)
            created += 1

        return {
            "testCases": len(test_cases),
            "recordsCreated": created,
            "skippedExisting": skipped_existing,
            "skippedEmpty": skipped_empty,
            "failures": failures,
        }

    def _fetch_case_history(self, test_case_key: str) -> list[dict[str, Any]]:
        """History entries across every version of one test case, merged by entry id."""
        entries: list[dict[str, Any]] = []
        seen_ids: set[int] = set()
        for version_id in self._client.version_ids(test_case_key):
            for entry in self._client.fetch_history(version_id):
                entry_id = entry.get("id")
                if entry_id in seen_ids:
                    continue
                if entry_id is not None:
                    seen_ids.add(entry_id)
                entries.append(entry)
        return entries
```

Design note: we always resolve version ids via `allVersions` and fetch history per version (merged by entry id). This resolves the spec's open check without branching — it is correct whether history hangs off the latest version or each version, at the cost of one cheap extra call per test case.

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_zephyr_import_service.py tests/test_zephyr_import_transform.py -v`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add services/zephyr_import_service.py tests/test_zephyr_import_service.py
git commit -m "Add Zephyr import service with parallel fetch and dedupe"
```

---

### Task 6: `POST /api/test-case-database/import` route

**Files:**
- Modify: `routes/test_case_database_api.py`
- Test: `tests/test_test_case_database_api.py`

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_test_case_database_api.py`. These build the blueprint directly with stub services (the existing `make_client` boots the whole app, where no `JIRA_PAT` is set — that covers the 503 default; stub-based tests cover the rest):

```python
def _import_test_app(import_service):
    from flask import Flask

    from routes.test_case_database_api import create_test_case_database_blueprint

    class StubChangeService:
        pass

    app = Flask(__name__)
    app.register_blueprint(
        create_test_case_database_blueprint(StubChangeService(), zephyr_import_service=import_service)
    )
    app.config["TESTING"] = True
    return app.test_client()


def test_import_returns_503_when_not_configured(tmp_path, monkeypatch):
    client = _import_test_app(None)
    response = client.post("/api/test-case-database/import", json={"projectId": 14210, "folder": "/Data Sync"})
    assert response.status_code == 503


def test_import_requires_project_and_folder(tmp_path, monkeypatch):
    class StubImportService:
        def run_import(self, project_id, folder):
            raise AssertionError("must not be called")

    client = _import_test_app(StubImportService())
    response = client.post("/api/test-case-database/import", json={"folder": ""})
    assert response.status_code == 400


def test_import_returns_summary(tmp_path, monkeypatch):
    class StubImportService:
        def run_import(self, project_id, folder):
            assert project_id == 14210
            assert folder == "/Data Sync"
            return {
                "testCases": 2,
                "recordsCreated": 3,
                "skippedExisting": 1,
                "skippedEmpty": 4,
                "failures": [],
            }

    client = _import_test_app(StubImportService())
    response = client.post("/api/test-case-database/import", json={"projectId": 14210, "folder": "/Data Sync"})
    assert response.status_code == 200
    assert response.get_json()["recordsCreated"] == 3


def test_import_maps_upstream_errors(tmp_path, monkeypatch):
    import requests

    class MissingPatService:
        def run_import(self, project_id, folder):
            raise ValueError("JIRA_PAT is not configured")

    class UpstreamFailureService:
        def run_import(self, project_id, folder):
            raise requests.HTTPError("500 Server Error")

    body = {"projectId": 14210, "folder": "/Data Sync"}
    assert _import_test_app(MissingPatService()).post("/api/test-case-database/import", json=body).status_code == 503
    response = _import_test_app(UpstreamFailureService()).post("/api/test-case-database/import", json=body)
    assert response.status_code == 502
    assert response.get_json()["error"] == "Zephyr API request failed"
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `python -m pytest tests/test_test_case_database_api.py -v`
Expected: new tests FAIL (`create_test_case_database_blueprint() got an unexpected keyword argument 'zephyr_import_service'` / 404); existing tests PASS.

- [ ] **Step 3: Implement the route**

In `routes/test_case_database_api.py`:

Add imports at the top:

```python
import requests

from services.zephyr_import_service import ZephyrImportService
```

Change the factory signature:

```python
def create_test_case_database_blueprint(
    test_case_database_service: TestCaseDatabaseService,
    zephyr_import_service: "ZephyrImportService | None" = None,
) -> Blueprint:
```

Add the route (after `archive_change`, before the attachment routes):

```python
    @bp.route("/import", methods=["POST"])
    def import_from_zephyr():
        if zephyr_import_service is None:
            return jsonify({"error": "Zephyr import is not configured"}), 503
        data = request.get_json(silent=True) or {}
        try:
            project_id = int(data.get("projectId") or 0)
        except (TypeError, ValueError):
            project_id = 0
        folder = str(data.get("folder") or "").strip()
        if not project_id or not folder:
            return jsonify({"error": "projectId and folder are required"}), 400
        try:
            return jsonify(zephyr_import_service.run_import(project_id, folder))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 503
        except requests.RequestException as exc:
            return jsonify({"error": "Zephyr API request failed", "details": str(exc)}), 502
```

(`requests.HTTPError` subclasses `requests.RequestException`, so one handler covers both.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `python -m pytest tests/test_test_case_database_api.py -v`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add routes/test_case_database_api.py tests/test_test_case_database_api.py
git commit -m "Add Zephyr import endpoint to test case database API"
```

---

### Task 7: Wiring in `routes/__init__.py` and `app.py`

**Files:**
- Modify: `routes/__init__.py` (signature ~line 84, registration ~line 106)
- Modify: `app.py` (service construction ~line 235, `register_blueprints` call ~line 577)

No new tests — covered by the existing app-boot API tests (`make_client` calls `create_app()`); a wiring mistake fails every test in `tests/test_test_case_database_api.py`.

- [ ] **Step 1: routes/__init__.py**

Add to the imports block:

```python
from services.zephyr_import_service import ZephyrImportService
```

Add a parameter to `register_blueprints` (after `test_case_database_service`):

```python
    zephyr_import_service: "ZephyrImportService | None" = None,
```

Change the registration:

```python
    if test_case_database_service is not None:
        app.register_blueprint(
            create_test_case_database_blueprint(
                test_case_database_service,
                zephyr_import_service=zephyr_import_service,
            )
        )
```

- [ ] **Step 2: app.py**

After `test_case_database_service = TestCaseDatabaseService(test_case_database_repo)` (~line 235), add:

```python
    from services.zephyr_import_service import ZephyrImportService

    zephyr_import_service = ZephyrImportService(
        jira_pat=JIRA_PAT or "",
        repository=test_case_database_repo,
    )
```

(Match the local-import style used for `TestDataUrlService` at ~line 239 if top-level import causes ordering friction; otherwise a top-level import is fine. `JIRA_PAT` is already imported at ~line 51.)

In the `register_blueprints(...)` call (~line 577), add:

```python
        zephyr_import_service=zephyr_import_service,
```

- [ ] **Step 3: Run the API tests (boots the full app)**

Run: `python -m pytest tests/test_test_case_database_api.py -v`
Expected: ALL PASS.

- [ ] **Step 4: Commit**

```bash
git add routes/__init__.py app.py
git commit -m "Wire Zephyr import service into app and blueprint registration"
```

---

### Task 8: Frontend types, API client, status options

**Files:**
- Modify: `frontend/src/types/index.ts:1776` (status union; `TestCaseChange`; new summary types)
- Modify: `frontend/src/services/api.ts` (~line 1146, after `archiveTestCaseChange`)
- Modify: `frontend/src/components/test-case-database/TestCaseChangeFilters.tsx:63-67`
- Modify: `frontend/src/components/test-case-database/TestCaseChangeEditor.tsx:206-208`

- [ ] **Step 1: types/index.ts**

Line 1776 becomes:

```ts
export type TestCaseChangeStatus = "Draft" | "Active" | "Superseded" | "Archived" | "Imported"
```

Add to the `TestCaseChange` interface (after `archived_at: string | null`):

```ts
  zephyr_history_id?: number | null
```

Add after `TestCaseChangeSearchParams` (~line 1833):

```ts
export interface ZephyrImportFailure {
  key: string
  error: string
}

export interface ZephyrImportSummary {
  testCases: number
  recordsCreated: number
  skippedExisting: number
  skippedEmpty: number
  failures: ZephyrImportFailure[]
}
```

- [ ] **Step 2: api.ts**

Add `ZephyrImportSummary` to the type import block at the top (alphabetical position near the other TestCaseChange types), then add after `archiveTestCaseChange` (~line 1146):

```ts
  async importZephyrHistory(params: { projectId: number; folder: string }): Promise<ZephyrImportSummary> {
    return this.request<ZephyrImportSummary>("/api/test-case-database/import", {
      method: "POST",
      body: JSON.stringify(params),
    })
  }
```

- [ ] **Step 3: Status dropdowns**

`TestCaseChangeFilters.tsx` — add after the `Superseded` item (line 66):

```tsx
              <SelectItem value="Imported">Imported</SelectItem>
```

`TestCaseChangeEditor.tsx` — add after the `Superseded` item (line 208):

```tsx
                  <SelectItem value="Imported">Imported</SelectItem>
```

- [ ] **Step 4: Verify the frontend compiles**

Run (in `frontend/`): `npm run build`
Expected: build succeeds, no type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/index.ts frontend/src/services/api.ts frontend/src/components/test-case-database/TestCaseChangeFilters.tsx frontend/src/components/test-case-database/TestCaseChangeEditor.tsx
git commit -m "Add Imported status and Zephyr import API to frontend"
```

---

### Task 9: Import dialog + page wiring

**Files:**
- Create: `frontend/src/components/test-case-database/ZephyrImportDialog.tsx`
- Modify: `frontend/src/pages/TestCaseDatabase.tsx`

- [ ] **Step 1: Create the dialog component**

Check `frontend/src/components/ui/dialog.tsx` exports (standard shadcn: `Dialog`, `DialogContent`, `DialogDescription`, `DialogFooter`, `DialogHeader`, `DialogTitle`) and `frontend/src/components/ui/input.tsx` / `label.tsx` for `Input` / `Label`. Then create `frontend/src/components/test-case-database/ZephyrImportDialog.tsx`:

```tsx
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/services/api"
import type { ZephyrImportSummary } from "@/types"

const DEFAULT_PROJECT_ID = "14210"
const DEFAULT_FOLDER = "/Data Sync"

interface ZephyrImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

export function ZephyrImportDialog({ open, onOpenChange, onImported }: ZephyrImportDialogProps) {
  const [projectId, setProjectId] = useState(DEFAULT_PROJECT_ID)
  const [folder, setFolder] = useState(DEFAULT_FOLDER)
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState<ZephyrImportSummary | null>(null)

  async function runImport() {
    const parsedProjectId = Number.parseInt(projectId, 10)
    if (!Number.isFinite(parsedProjectId) || parsedProjectId <= 0 || !folder.trim()) {
      toast.error("Project ID and folder are required")
      return
    }
    setRunning(true)
    setSummary(null)
    try {
      const result = await api.importZephyrHistory({
        projectId: parsedProjectId,
        folder: folder.trim(),
      })
      setSummary(result)
      onImported()
      toast.success(`Imported ${result.recordsCreated} change${result.recordsCreated === 1 ? "" : "s"}`)
    } catch (error) {
      toast.error("Zephyr import failed", {
        description: error instanceof Error ? error.message : "Request failed",
      })
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !running && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from Zephyr</DialogTitle>
          <DialogDescription>
            Fetches change history for every test case in the folder tree and adds
            records it has not imported before. Safe to re-run.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="zephyr-import-project">Project ID</Label>
            <Input
              id="zephyr-import-project"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              disabled={running}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="zephyr-import-folder">Folder</Label>
            <Input
              id="zephyr-import-folder"
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
              disabled={running}
            />
          </div>

          {summary && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p>
                {summary.testCases} test cases scanned — {summary.recordsCreated} created,{" "}
                {summary.skippedExisting} already imported, {summary.skippedEmpty} noise-only saves skipped.
              </p>
              {summary.failures.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-destructive">
                  {summary.failures.map((failure) => (
                    <li key={failure.key}>
                      {failure.key}: {failure.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Close
          </Button>
          <Button type="button" onClick={() => void runImport()} disabled={running}>
            {running ? "Importing…" : "Run Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

If the dialog primitive's export names differ, adapt to the actual exports — check the file first.

- [ ] **Step 2: Wire into the page**

In `frontend/src/pages/TestCaseDatabase.tsx`:

Line 1 — add the icon:

```tsx
import { Import, Plus, RefreshCw } from "lucide-react"
```

Add the component import (with the other test-case-database imports):

```tsx
import { ZephyrImportDialog } from "@/components/test-case-database/ZephyrImportDialog"
```

Add state (next to the other `useState` calls):

```tsx
  const [importOpen, setImportOpen] = useState(false)
```

In the `PageHeader` `actions` div, add a button BEFORE the Refresh button:

```tsx
            <Button
              type="button"
              variant="outline"
              onClick={() => setImportOpen(true)}
              disabled={loading}
            >
              <Import className="size-4" aria-hidden="true" />
              Import from Zephyr
            </Button>
```

Before the closing `</div>` of the page (next to `ConfirmDialog`), render:

```tsx
      <ZephyrImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => void loadChanges()}
      />
```

- [ ] **Step 3: Build**

Run (in `frontend/`): `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/test-case-database/ZephyrImportDialog.tsx frontend/src/pages/TestCaseDatabase.tsx
git commit -m "Add Zephyr import dialog to Test Case Database page"
```

---

### Task 10: Full verification

- [ ] **Step 1: Run the whole backend suite**

Run: `python -m pytest tests/ -v`
Expected: ALL PASS (no regressions outside the touched areas).

- [ ] **Step 2: Frontend production build**

Run (in `frontend/`): `npm run build`
Expected: success.

- [ ] **Step 3: Update CLAUDE.md current state**

In `C:\pagespeed-monitor\CLAUDE.md`, under **Potential Next Steps** or **Current State**, add one line noting the Test Case Database now supports Zephyr history import (`POST /api/test-case-database/import`, internal `/rest/tests/1.0` API isolated in `services/zephyr_history_client.py`). Keep it to 1-2 lines.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "Document Zephyr history import in project notes"
```

**Not in this plan:** deployment. The user deploys manually via Railway CLI ("Push to GitHub and deploy to Railway" workflow) — do not push or deploy unless asked. Live verification against lampstrack requires `JIRA_PAT`, which only exists in the Railway environment.
