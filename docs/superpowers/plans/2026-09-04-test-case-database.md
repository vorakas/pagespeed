# Test Case Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a manual Test Case Database tab for searchable Zephyr test case change records, structured bug/task links, clickable URLs, and attachments.

**Architecture:** Add a separate backend subsystem that follows Pharos' Routes to Services to Data Access pattern. Reuse the Knowledge tab's attachment and search ideas, but keep Test Case Database tables and React components separate because the field model is test-case-specific.

**Tech Stack:** Python 3.11, Flask, SQLite/PostgreSQL schema setup, pytest, React 19, TypeScript, Vite 8, Tailwind CSS 4, shadcn/ui/base-ui primitives, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-04-test-case-database-design.md`

## Global Constraints

- React frontend only: do not modify `templates/`, `static/css/`, or `static/js/`.
- Version 1 is manual only: no Zephyr API import, webhook sync, polling, or history parsing.
- New tab label is exactly `Test Case Database`.
- `Associated Bugs` and `Associated Tasks` are structured rows with `label` and `url`.
- Link URLs must be clickable and open in a new tab.
- Attachments use the Knowledge tab behavior: upload, list, download, delete, and 10 MB per-file limit.
- Backend keeps route handlers thin, validation in service, SQL in repository.
- Search covers keyword, test case ID, title, test case URL, change summary, before/after text, changed by, tags, associated bug/task labels, and associated bug/task URLs.
- Use context-mode for exploration in this repo. Keep shell output under control.

---

## File Structure

Create:

- `data_access/test_case_database_repository.py`: SQL persistence for changes, structured links, attachments, and search.
- `services/test_case_database_service.py`: validation, normalization, attachment byte limits, and service-facing workflows.
- `routes/test_case_database_api.py`: Flask blueprint under `/api/test-case-database`.
- `tests/test_test_case_database_repository.py`: repository coverage for CRUD, links, search, archive, attachments.
- `tests/test_test_case_database_service.py`: validation coverage for required fields, URLs, links, and attachments.
- `tests/test_test_case_database_api.py`: HTTP flow coverage for CRUD, search, archive, and attachments.
- `frontend/src/pages/TestCaseDatabase.tsx`: page state, loading, save/archive, attachment coordination.
- `frontend/src/components/test-case-database/TestCaseChangeFilters.tsx`: keyword/status/tag/archive controls.
- `frontend/src/components/test-case-database/TestCaseChangeList.tsx`: compact selectable record list.
- `frontend/src/components/test-case-database/TestCaseChangeEditor.tsx`: create/edit form, structured link rows, attachments.

Modify:

- `data_access/connection.py`: add PostgreSQL and SQLite tables/indexes.
- `data_access/__init__.py`: export `TestCaseDatabaseRepository`.
- `services/__init__.py`: export `TestCaseDatabaseService`.
- `routes/__init__.py`: import/register `create_test_case_database_blueprint`.
- `app.py`: instantiate repository/service and pass service into route registration.
- `frontend/src/types/index.ts`: add Test Case Database types.
- `frontend/src/services/api.ts`: add typed API methods.
- `frontend/src/App.tsx`: add route for `/test-case-database`.
- `frontend/src/components/layout/AppSidebar.tsx`: add nav item.

Do not add shared abstractions until duplication is proven painful. Copying the Knowledge attachment pattern is acceptable for v1 because the parent models differ.

---

### Task 1: Backend Data Model And Repository

**Files:**
- Modify: `data_access/connection.py`
- Create: `data_access/test_case_database_repository.py`
- Modify: `data_access/__init__.py`
- Test: `tests/test_test_case_database_repository.py`

**Interfaces:**
- Produces class: `TestCaseDatabaseRepository(connection_manager: ConnectionManager)`
- Produces method: `create_change(data: dict) -> int`
- Produces method: `get_change(change_id: int) -> dict | None`
- Produces method: `update_change(change_id: int, data: dict) -> bool`
- Produces method: `archive_change(change_id: int) -> bool`
- Produces method: `search_changes(query: str = "", test_case_id: str | None = None, status: str | None = None, tag: str | None = None, include_archived: bool = False) -> list[dict]`
- Produces method: `list_change_attachments(change_id: int) -> list[dict]`
- Produces method: `get_change_attachment(change_id: int, attachment_id: int) -> dict | None`
- Produces method: `create_change_attachment(change_id: int, filename: str, mime_type: str, file_size: int, file_bytes: bytes) -> int`
- Produces method: `delete_change_attachment(change_id: int, attachment_id: int) -> bool`
- Change dictionaries include `associated_bugs` and `associated_tasks` arrays of `{ "id": int, "label": str, "url": str }`.

- [ ] **Step 1: Write failing repository tests**

Create `tests/test_test_case_database_repository.py`:

```python
from data_access.connection import ConnectionManager
from data_access.test_case_database_repository import TestCaseDatabaseRepository


def make_repo(tmp_path):
    db_path = tmp_path / "test_case_database.db"
    manager = ConnectionManager(str(db_path))
    manager.init_schema()
    return TestCaseDatabaseRepository(manager)


def sample_payload():
    return {
        "test_case_id": "LP-12345",
        "title": "Checkout applies tax after address update",
        "test_case_url": "https://zephyr.example.com/test/LP-12345",
        "change_summary": "Expected tax assertion changed after MAO update.",
        "before_state": "Tax was asserted before address normalization.",
        "after_state": "Tax is asserted after address normalization.",
        "changed_by": "Leslie",
        "change_date": "2026-09-04",
        "status": "Active",
        "tags": ["checkout", "tax"],
        "associated_bugs": [
            {
                "label": "BUG-7788",
                "url": "https://jira.example.com/browse/BUG-7788",
            }
        ],
        "associated_tasks": [
            {
                "label": "TASK-9911",
                "url": "https://jira.example.com/browse/TASK-9911",
            }
        ],
    }


def test_create_get_update_archive_and_search_changes(tmp_path):
    repo = make_repo(tmp_path)

    change_id = repo.create_change(sample_payload())
    created = repo.get_change(change_id)

    assert created is not None
    assert created["test_case_id"] == "LP-12345"
    assert created["tags"] == ["checkout", "tax"]
    assert created["associated_bugs"] == [
        {
            "id": created["associated_bugs"][0]["id"],
            "label": "BUG-7788",
            "url": "https://jira.example.com/browse/BUG-7788",
        }
    ]
    assert created["associated_tasks"][0]["label"] == "TASK-9911"

    updated_payload = sample_payload()
    updated_payload["title"] = "Checkout tax recalculation after address update"
    updated_payload["status"] = "Superseded"
    updated_payload["tags"] = ["checkout", "tax", "mao"]
    updated_payload["associated_bugs"] = [
        {
            "label": "BUG-9999",
            "url": "https://jira.example.com/browse/BUG-9999",
        }
    ]
    updated_payload["associated_tasks"] = []

    assert repo.update_change(change_id, updated_payload) is True
    updated = repo.get_change(change_id)
    assert updated["title"] == "Checkout tax recalculation after address update"
    assert updated["status"] == "Superseded"
    assert updated["tags"] == ["checkout", "tax", "mao"]
    assert [link["label"] for link in updated["associated_bugs"]] == ["BUG-9999"]
    assert updated["associated_tasks"] == []

    by_keyword = repo.search_changes(query="recalculation")
    by_bug_url = repo.search_changes(query="BUG-9999")
    by_tag = repo.search_changes(tag="mao")
    by_status = repo.search_changes(status="Superseded")

    assert [row["id"] for row in by_keyword] == [change_id]
    assert [row["id"] for row in by_bug_url] == [change_id]
    assert [row["id"] for row in by_tag] == [change_id]
    assert [row["id"] for row in by_status] == [change_id]

    assert repo.archive_change(change_id) is True
    assert repo.search_changes(query="recalculation") == []
    archived = repo.search_changes(query="recalculation", include_archived=True)
    assert [row["id"] for row in archived] == [change_id]
    assert archived[0]["archived_at"] is not None


def test_attachment_metadata_bytes_and_delete(tmp_path):
    repo = make_repo(tmp_path)
    change_id = repo.create_change(sample_payload())

    attachment_id = repo.create_change_attachment(
        change_id=change_id,
        filename="evidence.txt",
        mime_type="text/plain",
        file_size=11,
        file_bytes=b"hello world",
    )

    metadata = repo.list_change_attachments(change_id)
    assert metadata == [
        {
            "id": attachment_id,
            "change_id": change_id,
            "filename": "evidence.txt",
            "mime_type": "text/plain",
            "file_size": 11,
            "created_at": metadata[0]["created_at"],
        }
    ]

    attachment = repo.get_change_attachment(change_id, attachment_id)
    assert attachment["file_bytes"] == b"hello world"

    assert repo.delete_change_attachment(change_id, attachment_id) is True
    assert repo.list_change_attachments(change_id) == []
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
python -m pytest tests/test_test_case_database_repository.py -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'data_access.test_case_database_repository'`.

- [ ] **Step 3: Add schema to PostgreSQL setup**

In `data_access/connection.py`, add these table definitions near the existing Knowledge tables in `_init_postgres_schema()`:

```python
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_case_changes (
                id SERIAL PRIMARY KEY,
                test_case_id TEXT NOT NULL,
                title TEXT NOT NULL,
                test_case_url TEXT NOT NULL DEFAULT '',
                change_summary TEXT NOT NULL,
                before_state TEXT NOT NULL DEFAULT '',
                after_state TEXT NOT NULL DEFAULT '',
                changed_by TEXT NOT NULL DEFAULT '',
                change_date TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'Active',
                tags TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                archived_at TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_case_change_links (
                id SERIAL PRIMARY KEY,
                change_id INTEGER NOT NULL,
                link_type TEXT NOT NULL,
                label TEXT NOT NULL,
                url TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (change_id) REFERENCES test_case_changes (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_case_change_attachments (
                id SERIAL PRIMARY KEY,
                change_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                mime_type TEXT NOT NULL DEFAULT '',
                file_size INTEGER NOT NULL DEFAULT 0,
                file_bytes BYTEA NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (change_id) REFERENCES test_case_changes (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_test_case_changes_test_case_id
            ON test_case_changes(test_case_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_test_case_changes_status
            ON test_case_changes(status)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_test_case_change_links_change_id
            ON test_case_change_links(change_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_test_case_change_attachments_change_id
            ON test_case_change_attachments(change_id)
        """)
```

- [ ] **Step 4: Add schema to SQLite setup**

In `_init_sqlite_schema()`, add the SQLite version:

```python
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_case_changes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_case_id TEXT NOT NULL,
                title TEXT NOT NULL,
                test_case_url TEXT NOT NULL DEFAULT '',
                change_summary TEXT NOT NULL,
                before_state TEXT NOT NULL DEFAULT '',
                after_state TEXT NOT NULL DEFAULT '',
                changed_by TEXT NOT NULL DEFAULT '',
                change_date TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'Active',
                tags TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                archived_at TIMESTAMP
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_case_change_links (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                change_id INTEGER NOT NULL,
                link_type TEXT NOT NULL,
                label TEXT NOT NULL,
                url TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (change_id) REFERENCES test_case_changes (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS test_case_change_attachments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                change_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                mime_type TEXT NOT NULL DEFAULT '',
                file_size INTEGER NOT NULL DEFAULT 0,
                file_bytes BLOB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (change_id) REFERENCES test_case_changes (id) ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_test_case_changes_test_case_id
            ON test_case_changes(test_case_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_test_case_changes_status
            ON test_case_changes(status)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_test_case_change_links_change_id
            ON test_case_change_links(change_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_test_case_change_attachments_change_id
            ON test_case_change_attachments(change_id)
        """)
```

- [ ] **Step 5: Implement repository**

Create `data_access/test_case_database_repository.py`:

```python
"""Persistence for the Test Case Database."""

from __future__ import annotations

import json
from typing import Any

from data_access.connection import ConnectionManager


class TestCaseDatabaseRepository:
    """Store manual test case change records, links, and attachments."""

    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._connection_manager = connection_manager

    def _rows_to_dicts(self, cursor: Any, rows: list[Any]) -> list[dict]:
        columns = [description[0] for description in cursor.description]
        return [dict(zip(columns, row)) for row in rows]

    def _placeholder(self) -> str:
        return self._connection_manager.placeholder

    def _last_insert_id(self, cursor: Any) -> int:
        if self._connection_manager.is_postgres:
            return int(cursor.fetchone()[0])
        return int(cursor.lastrowid)

    def _normalize_change(self, row: dict) -> dict:
        tags = row.get("tags") or "[]"
        if isinstance(tags, str):
            try:
                row["tags"] = json.loads(tags)
            except json.JSONDecodeError:
                row["tags"] = []
        row["associated_bugs"] = []
        row["associated_tasks"] = []
        return row

    def _load_links(self, change_ids: list[int]) -> dict[int, dict[str, list[dict]]]:
        if not change_ids:
            return {}
        ph = self._placeholder()
        placeholders = ", ".join([ph] * len(change_ids))
        with self._connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT id, change_id, link_type, label, url
                FROM test_case_change_links
                WHERE change_id IN ({placeholders})
                ORDER BY id
                """,
                tuple(change_ids),
            )
            rows = self._rows_to_dicts(cursor, cursor.fetchall())

        grouped = {
            change_id: {"associated_bugs": [], "associated_tasks": []}
            for change_id in change_ids
        }
        for row in rows:
            key = "associated_bugs" if row["link_type"] == "bug" else "associated_tasks"
            grouped[row["change_id"]][key].append(
                {"id": row["id"], "label": row["label"], "url": row["url"]}
            )
        return grouped

    def _attach_links(self, changes: list[dict]) -> list[dict]:
        grouped = self._load_links([int(change["id"]) for change in changes])
        for change in changes:
            link_set = grouped.get(change["id"], {})
            change["associated_bugs"] = link_set.get("associated_bugs", [])
            change["associated_tasks"] = link_set.get("associated_tasks", [])
        return changes

    def get_change(self, change_id: int) -> dict | None:
        ph = self._placeholder()
        with self._connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"SELECT * FROM test_case_changes WHERE id = {ph}",
                (change_id,),
            )
            rows = self._rows_to_dicts(cursor, cursor.fetchall())
        if not rows:
            return None
        return self._attach_links([self._normalize_change(rows[0])])[0]

    def create_change(self, data: dict) -> int:
        ph = self._placeholder()
        returning = " RETURNING id" if self._connection_manager.is_postgres else ""
        with self._connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                INSERT INTO test_case_changes (
                    test_case_id, title, test_case_url, change_summary,
                    before_state, after_state, changed_by, change_date, status, tags
                ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}){returning}
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
                ),
            )
            change_id = self._last_insert_id(cursor)
            self._replace_links(cursor, change_id, data)
            conn.commit()
            return change_id

    def update_change(self, change_id: int, data: dict) -> bool:
        ph = self._placeholder()
        with self._connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE test_case_changes
                SET test_case_id = {ph}, title = {ph}, test_case_url = {ph},
                    change_summary = {ph}, before_state = {ph}, after_state = {ph},
                    changed_by = {ph}, change_date = {ph}, status = {ph}, tags = {ph},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = {ph}
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
                    change_id,
                ),
            )
            updated = cursor.rowcount > 0
            if updated:
                self._replace_links(cursor, change_id, data)
            conn.commit()
            return updated

    def _replace_links(self, cursor: Any, change_id: int, data: dict) -> None:
        ph = self._placeholder()
        cursor.execute(
            f"DELETE FROM test_case_change_links WHERE change_id = {ph}",
            (change_id,),
        )
        link_rows = []
        for link in data.get("associated_bugs", []):
            link_rows.append((change_id, "bug", link["label"], link["url"]))
        for link in data.get("associated_tasks", []):
            link_rows.append((change_id, "task", link["label"], link["url"]))
        for row in link_rows:
            cursor.execute(
                f"""
                INSERT INTO test_case_change_links (change_id, link_type, label, url)
                VALUES ({ph}, {ph}, {ph}, {ph})
                """,
                row,
            )

    def archive_change(self, change_id: int) -> bool:
        ph = self._placeholder()
        with self._connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE test_case_changes
                SET status = 'Archived', archived_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = {ph} AND archived_at IS NULL
                """,
                (change_id,),
            )
            conn.commit()
            return cursor.rowcount > 0

    def search_changes(
        self,
        query: str = "",
        test_case_id: str | None = None,
        status: str | None = None,
        tag: str | None = None,
        include_archived: bool = False,
    ) -> list[dict]:
        ph = self._placeholder()
        where = []
        params: list[Any] = []
        if not include_archived:
            where.append("c.archived_at IS NULL")
        if query:
            like = f"%{query.lower()}%"
            where.append(
                """(
                    LOWER(c.test_case_id) LIKE {ph} OR LOWER(c.title) LIKE {ph}
                    OR LOWER(c.test_case_url) LIKE {ph}
                    OR LOWER(c.change_summary) LIKE {ph}
                    OR LOWER(c.before_state) LIKE {ph}
                    OR LOWER(c.after_state) LIKE {ph}
                    OR LOWER(c.changed_by) LIKE {ph}
                    OR LOWER(c.tags) LIKE {ph}
                    OR EXISTS (
                        SELECT 1 FROM test_case_change_links l
                        WHERE l.change_id = c.id
                        AND (LOWER(l.label) LIKE {ph} OR LOWER(l.url) LIKE {ph})
                    )
                )""".format(ph=ph)
            )
            params.extend([like] * 10)
        if test_case_id:
            where.append(f"LOWER(c.test_case_id) = {ph}")
            params.append(test_case_id.lower())
        if status:
            where.append(f"c.status = {ph}")
            params.append(status)
        if tag:
            where.append(f"LOWER(c.tags) LIKE {ph}")
            params.append(f"%{tag.lower()}%")
        where_sql = f"WHERE {' AND '.join(where)}" if where else ""
        with self._connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT c.*
                FROM test_case_changes c
                {where_sql}
                ORDER BY c.change_date DESC, c.updated_at DESC, c.id DESC
                """,
                tuple(params),
            )
            changes = [self._normalize_change(row) for row in self._rows_to_dicts(cursor, cursor.fetchall())]
        return self._attach_links(changes)

    def list_change_attachments(self, change_id: int) -> list[dict]:
        ph = self._placeholder()
        with self._connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT id, change_id, filename, mime_type, file_size, created_at
                FROM test_case_change_attachments
                WHERE change_id = {ph}
                ORDER BY created_at DESC, id DESC
                """,
                (change_id,),
            )
            return self._rows_to_dicts(cursor, cursor.fetchall())

    def get_change_attachment(self, change_id: int, attachment_id: int) -> dict | None:
        ph = self._placeholder()
        with self._connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT id, change_id, filename, mime_type, file_size, file_bytes, created_at
                FROM test_case_change_attachments
                WHERE change_id = {ph} AND id = {ph}
                """,
                (change_id, attachment_id),
            )
            rows = self._rows_to_dicts(cursor, cursor.fetchall())
            return rows[0] if rows else None

    def create_change_attachment(
        self,
        change_id: int,
        filename: str,
        mime_type: str,
        file_size: int,
        file_bytes: bytes,
    ) -> int:
        ph = self._placeholder()
        returning = " RETURNING id" if self._connection_manager.is_postgres else ""
        with self._connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                INSERT INTO test_case_change_attachments (
                    change_id, filename, mime_type, file_size, file_bytes
                ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}){returning}
                """,
                (change_id, filename, mime_type, file_size, file_bytes),
            )
            attachment_id = self._last_insert_id(cursor)
            conn.commit()
            return attachment_id

    def delete_change_attachment(self, change_id: int, attachment_id: int) -> bool:
        ph = self._placeholder()
        with self._connection_manager.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                DELETE FROM test_case_change_attachments
                WHERE change_id = {ph} AND id = {ph}
                """,
                (change_id, attachment_id),
            )
            conn.commit()
            return cursor.rowcount > 0
```

- [ ] **Step 6: Export repository**

In `data_access/__init__.py`, add:

```python
from data_access.test_case_database_repository import TestCaseDatabaseRepository
```

Add `"TestCaseDatabaseRepository"` to `__all__` if that file defines `__all__`.

- [ ] **Step 7: Run focused repository tests**

Run:

```bash
python -m pytest tests/test_test_case_database_repository.py -q
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

Run:

```bash
git add data_access/connection.py data_access/test_case_database_repository.py data_access/__init__.py tests/test_test_case_database_repository.py
git commit -m "Add test case database repository"
```

---

### Task 2: Backend Service Validation

**Files:**
- Create: `services/test_case_database_service.py`
- Modify: `services/__init__.py`
- Test: `tests/test_test_case_database_service.py`

**Interfaces:**
- Consumes repository methods from Task 1.
- Produces constant: `MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024`
- Produces class: `TestCaseDatabaseService(repository: TestCaseDatabaseRepository)`
- Produces method: `search_changes(query: str = "", test_case_id: str | None = None, status: str | None = None, tag: str | None = None, include_archived: bool = False) -> list[dict]`
- Produces method: `get_change(change_id: int) -> dict`
- Produces method: `create_change(data: dict) -> dict`
- Produces method: `update_change(change_id: int, data: dict) -> dict`
- Produces method: `archive_change(change_id: int) -> dict`
- Produces method: `list_change_attachments(change_id: int) -> list[dict]`
- Produces method: `add_change_attachment(change_id: int, filename: str, mime_type: str, file_size: int, file_bytes: bytes) -> dict`
- Produces method: `get_change_attachment(change_id: int, attachment_id: int) -> dict`
- Produces method: `delete_change_attachment(change_id: int, attachment_id: int) -> None`

- [ ] **Step 1: Write failing service tests**

Create `tests/test_test_case_database_service.py`:

```python
import pytest

from data_access.connection import ConnectionManager
from data_access.test_case_database_repository import TestCaseDatabaseRepository
from exceptions import ValidationError
from services.test_case_database_service import (
    MAX_ATTACHMENT_BYTES,
    TestCaseDatabaseService,
)


def make_service(tmp_path):
    manager = ConnectionManager(str(tmp_path / "test_case_database_service.db"))
    manager.init_schema()
    repository = TestCaseDatabaseRepository(manager)
    return TestCaseDatabaseService(repository)


def valid_payload():
    return {
        "test_case_id": " LP-456 ",
        "title": " Cart smoke test ",
        "test_case_url": " https://zephyr.example.com/test/LP-456 ",
        "change_summary": " Adds coverage for cart warning copy. ",
        "before_state": " Old assertion checked generic copy. ",
        "after_state": " New assertion checks exact warning copy. ",
        "changed_by": " Kyle ",
        "change_date": "2026-09-04",
        "status": "Active",
        "tags": "cart, warnings",
        "associated_bugs": [
            {
                "label": " BUG-100 ",
                "url": " https://jira.example.com/browse/BUG-100 ",
            }
        ],
        "associated_tasks": [
            {
                "label": " TASK-200 ",
                "url": " https://jira.example.com/browse/TASK-200 ",
            }
        ],
    }


def test_create_change_normalizes_payload(tmp_path):
    service = make_service(tmp_path)

    change = service.create_change(valid_payload())

    assert change["test_case_id"] == "LP-456"
    assert change["title"] == "Cart smoke test"
    assert change["test_case_url"] == "https://zephyr.example.com/test/LP-456"
    assert change["change_summary"] == "Adds coverage for cart warning copy."
    assert change["tags"] == ["cart", "warnings"]
    assert change["associated_bugs"][0]["label"] == "BUG-100"
    assert change["associated_tasks"][0]["url"] == "https://jira.example.com/browse/TASK-200"


@pytest.mark.parametrize(
    "field,message",
    [
        ("test_case_id", "Test case ID is required"),
        ("title", "Title is required"),
        ("change_summary", "Change summary is required"),
    ],
)
def test_required_fields(field, message, tmp_path):
    service = make_service(tmp_path)
    payload = valid_payload()
    payload[field] = "   "

    with pytest.raises(ValidationError, match=message):
        service.create_change(payload)


@pytest.mark.parametrize(
    "url",
    ["ftp://zephyr.example.com/test/LP-456", "notaurl", "www.example.com/no-scheme"],
)
def test_rejects_invalid_test_case_url(url, tmp_path):
    service = make_service(tmp_path)
    payload = valid_payload()
    payload["test_case_url"] = url

    with pytest.raises(ValidationError, match="Test case URL must be an http or https URL"):
        service.create_change(payload)


def test_rejects_incomplete_structured_link(tmp_path):
    service = make_service(tmp_path)
    payload = valid_payload()
    payload["associated_bugs"] = [{"label": "BUG-100", "url": ""}]

    with pytest.raises(ValidationError, match="Associated Bugs row 1 URL is required"):
        service.create_change(payload)


def test_attachment_validation_and_lookup(tmp_path):
    service = make_service(tmp_path)
    change = service.create_change(valid_payload())

    with pytest.raises(ValidationError, match="Attachment filename is required"):
        service.add_change_attachment(change["id"], "", "text/plain", 4, b"test")

    with pytest.raises(ValidationError, match="exceeds the 10 MB limit"):
        service.add_change_attachment(
            change["id"],
            "large.txt",
            "text/plain",
            MAX_ATTACHMENT_BYTES + 1,
            b"x",
        )

    attachment = service.add_change_attachment(
        change["id"],
        "note.txt",
        "text/plain",
        4,
        b"test",
    )
    assert attachment["filename"] == "note.txt"
    assert service.get_change_attachment(change["id"], attachment["id"])["file_bytes"] == b"test"
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
python -m pytest tests/test_test_case_database_service.py -q
```

Expected: FAIL with `ModuleNotFoundError: No module named 'services.test_case_database_service'`.

- [ ] **Step 3: Implement service**

Create `services/test_case_database_service.py`:

```python
"""Business logic for the Test Case Database."""

from __future__ import annotations

from urllib.parse import urlparse

from data_access.test_case_database_repository import TestCaseDatabaseRepository
from exceptions import ValidationError

MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
VALID_STATUSES = {"Active", "Draft", "Superseded", "Archived"}


class TestCaseDatabaseService:
    """Validate and normalize manual test case change records."""

    def __init__(self, repository: TestCaseDatabaseRepository) -> None:
        self._repository = repository

    def search_changes(
        self,
        query: str = "",
        test_case_id: str | None = None,
        status: str | None = None,
        tag: str | None = None,
        include_archived: bool = False,
    ) -> list[dict]:
        normalized_status = self._validate_status(status, required=False)
        return self._repository.search_changes(
            query=(query or "").strip(),
            test_case_id=(test_case_id or "").strip() or None,
            status=normalized_status,
            tag=(tag or "").strip() or None,
            include_archived=include_archived,
        )

    def get_change(self, change_id: int) -> dict:
        change = self._repository.get_change(change_id)
        if not change:
            raise ValidationError("Test case change not found")
        return change

    def create_change(self, data: dict) -> dict:
        payload = self._normalize_payload(data)
        change_id = self._repository.create_change(payload)
        return self.get_change(change_id)

    def update_change(self, change_id: int, data: dict) -> dict:
        self.get_change(change_id)
        payload = self._normalize_payload(data)
        if not self._repository.update_change(change_id, payload):
            raise ValidationError("Test case change not found")
        return self.get_change(change_id)

    def archive_change(self, change_id: int) -> dict:
        self.get_change(change_id)
        if not self._repository.archive_change(change_id):
            raise ValidationError("Test case change is already archived")
        return self.get_change(change_id)

    def list_change_attachments(self, change_id: int) -> list[dict]:
        self.get_change(change_id)
        return self._repository.list_change_attachments(change_id)

    def add_change_attachment(
        self,
        change_id: int,
        filename: str,
        mime_type: str,
        file_size: int,
        file_bytes: bytes,
    ) -> dict:
        self.get_change(change_id)
        filename = (filename or "").strip()
        mime_type = (mime_type or "").strip()
        if not filename:
            raise ValidationError("Attachment filename is required")
        if file_size > MAX_ATTACHMENT_BYTES or len(file_bytes) > MAX_ATTACHMENT_BYTES:
            raise ValidationError(f"Attachment '{filename}' exceeds the 10 MB limit")
        attachment_id = self._repository.create_change_attachment(
            change_id=change_id,
            filename=filename,
            mime_type=mime_type,
            file_size=file_size,
            file_bytes=file_bytes,
        )
        attachment = self._repository.get_change_attachment(change_id, attachment_id)
        if not attachment:
            raise ValidationError("Attachment not found")
        attachment.pop("file_bytes", None)
        return attachment

    def get_change_attachment(self, change_id: int, attachment_id: int) -> dict:
        self.get_change(change_id)
        attachment = self._repository.get_change_attachment(change_id, attachment_id)
        if not attachment:
            raise ValidationError("Attachment not found")
        return attachment

    def delete_change_attachment(self, change_id: int, attachment_id: int) -> None:
        self.get_change(change_id)
        if not self._repository.delete_change_attachment(change_id, attachment_id):
            raise ValidationError("Attachment not found")

    def _normalize_payload(self, data: dict) -> dict:
        payload = {
            "test_case_id": self._trim(data.get("test_case_id")),
            "title": self._trim(data.get("title")),
            "test_case_url": self._trim(data.get("test_case_url")),
            "change_summary": self._trim(data.get("change_summary")),
            "before_state": self._trim(data.get("before_state")),
            "after_state": self._trim(data.get("after_state")),
            "changed_by": self._trim(data.get("changed_by")),
            "change_date": self._trim(data.get("change_date")),
            "status": self._validate_status(data.get("status") or "Active"),
            "tags": self._normalize_tags(data.get("tags")),
            "associated_bugs": self._normalize_links(
                data.get("associated_bugs"),
                "Associated Bugs",
            ),
            "associated_tasks": self._normalize_links(
                data.get("associated_tasks"),
                "Associated Tasks",
            ),
        }
        if not payload["test_case_id"]:
            raise ValidationError("Test case ID is required")
        if not payload["title"]:
            raise ValidationError("Title is required")
        if not payload["change_summary"]:
            raise ValidationError("Change summary is required")
        if payload["test_case_url"]:
            self._validate_http_url(
                payload["test_case_url"],
                "Test case URL must be an http or https URL",
            )
        return payload

    def _normalize_links(self, value: object, label: str) -> list[dict]:
        if not value:
            return []
        if not isinstance(value, list):
            raise ValidationError(f"{label} must be a list")
        links = []
        for index, raw_link in enumerate(value, start=1):
            if not isinstance(raw_link, dict):
                raise ValidationError(f"{label} row {index} must be an object")
            row_label = self._trim(raw_link.get("label"))
            row_url = self._trim(raw_link.get("url"))
            if not row_label:
                raise ValidationError(f"{label} row {index} label is required")
            if not row_url:
                raise ValidationError(f"{label} row {index} URL is required")
            self._validate_http_url(
                row_url,
                f"{label} row {index} URL must be an http or https URL",
            )
            links.append({"label": row_label, "url": row_url})
        return links

    def _validate_http_url(self, value: str, message: str) -> None:
        parsed = urlparse(value)
        if parsed.scheme not in {"http", "https"} or not parsed.netloc:
            raise ValidationError(message)

    def _validate_status(self, status: str | None, required: bool = True) -> str | None:
        value = self._trim(status)
        if not value:
            if required:
                raise ValidationError("Status is required")
            return None
        if value not in VALID_STATUSES:
            raise ValidationError(f"Status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return value

    def _normalize_tags(self, value: object) -> list[str]:
        if value is None:
            return []
        if isinstance(value, str):
            raw_tags = value.split(",")
        elif isinstance(value, list):
            raw_tags = value
        else:
            raise ValidationError("Tags must be a list or comma-separated string")
        tags = []
        for raw_tag in raw_tags:
            tag = self._trim(raw_tag)
            if tag and tag not in tags:
                tags.append(tag)
        return tags

    def _trim(self, value: object) -> str:
        return str(value or "").strip()
```

- [ ] **Step 4: Export service**

In `services/__init__.py`, add:

```python
from services.test_case_database_service import TestCaseDatabaseService
```

Add `"TestCaseDatabaseService"` to `__all__` if that file defines `__all__`.

- [ ] **Step 5: Run service and repository tests**

Run:

```bash
python -m pytest tests/test_test_case_database_repository.py tests/test_test_case_database_service.py -q
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add services/test_case_database_service.py services/__init__.py tests/test_test_case_database_service.py
git commit -m "Add test case database service"
```

---

### Task 3: Backend API And App Wiring

**Files:**
- Create: `routes/test_case_database_api.py`
- Modify: `routes/__init__.py`
- Modify: `app.py`
- Test: `tests/test_test_case_database_api.py`

**Interfaces:**
- Consumes `TestCaseDatabaseService` from Task 2.
- Produces blueprint factory: `create_test_case_database_blueprint(test_case_database_service: TestCaseDatabaseService) -> Blueprint`
- Produces routes under `/api/test-case-database`.
- `POST /changes` and `PUT /changes/<change_id>` accept the normalized payload shape from Task 2.
- Attachment upload accepts multipart files under `files`, matching Knowledge attachments.

- [ ] **Step 1: Write failing API tests**

Create `tests/test_test_case_database_api.py`:

```python
from io import BytesIO

from app import create_app


def make_client(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PHAROS_DISABLE_SCHEDULER", "1")
    app = create_app()
    app.config["TESTING"] = True
    assert "scheduler_lease" not in app.extensions
    return app.test_client()


def payload():
    return {
        "test_case_id": "LP-12345",
        "title": "Checkout applies tax after address update",
        "test_case_url": "https://zephyr.example.com/test/LP-12345",
        "change_summary": "Expected tax assertion changed after MAO update.",
        "before_state": "Tax was asserted before address normalization.",
        "after_state": "Tax is asserted after address normalization.",
        "changed_by": "Leslie",
        "change_date": "2026-09-04",
        "status": "Active",
        "tags": ["checkout", "tax"],
        "associated_bugs": [
            {
                "label": "BUG-7788",
                "url": "https://jira.example.com/browse/BUG-7788",
            }
        ],
        "associated_tasks": [
            {
                "label": "TASK-9911",
                "url": "https://jira.example.com/browse/TASK-9911",
            }
        ],
    }


def test_change_crud_search_and_archive_flow(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)

    create_response = client.post("/api/test-case-database/changes", json=payload())

    assert create_response.status_code == 201
    created = create_response.get_json()
    assert created["test_case_id"] == "LP-12345"
    assert created["associated_bugs"][0]["label"] == "BUG-7788"

    search_response = client.get("/api/test-case-database/changes?q=BUG-7788")
    assert search_response.status_code == 200
    assert [row["id"] for row in search_response.get_json()] == [created["id"]]

    update_payload = payload()
    update_payload["status"] = "Superseded"
    update_payload["associated_tasks"] = [
        {
            "label": "TASK-2222",
            "url": "https://jira.example.com/browse/TASK-2222",
        }
    ]
    update_response = client.put(
        f"/api/test-case-database/changes/{created['id']}",
        json=update_payload,
    )
    assert update_response.status_code == 200
    updated = update_response.get_json()
    assert updated["status"] == "Superseded"
    assert updated["associated_tasks"][0]["label"] == "TASK-2222"

    archive_response = client.post(f"/api/test-case-database/changes/{created['id']}/archive")
    assert archive_response.status_code == 200
    assert archive_response.get_json()["status"] == "Archived"

    hidden_response = client.get("/api/test-case-database/changes?q=LP-12345")
    assert hidden_response.status_code == 200
    assert hidden_response.get_json() == []

    archived_response = client.get(
        "/api/test-case-database/changes?q=LP-12345&include_archived=true"
    )
    assert archived_response.status_code == 200
    assert [row["id"] for row in archived_response.get_json()] == [created["id"]]


def test_change_validation_error(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    invalid_payload = payload()
    invalid_payload["associated_bugs"] = [{"label": "BUG-7788", "url": "notaurl"}]

    response = client.post("/api/test-case-database/changes", json=invalid_payload)

    assert response.status_code == 400
    assert response.get_json() == {
        "success": False,
        "error": "Associated Bugs row 1 URL must be an http or https URL",
    }


def test_attachment_upload_download_delete_flow(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    created = client.post("/api/test-case-database/changes", json=payload()).get_json()

    upload_response = client.post(
        f"/api/test-case-database/changes/{created['id']}/attachments",
        data={
            "files": [
                (BytesIO(b"hello world"), "evidence.txt"),
                (BytesIO(b"image-bytes"), "screen.png"),
            ]
        },
        content_type="multipart/form-data",
    )

    assert upload_response.status_code == 201
    attachments = upload_response.get_json()
    assert [item["filename"] for item in attachments] == ["evidence.txt", "screen.png"]

    list_response = client.get(
        f"/api/test-case-database/changes/{created['id']}/attachments"
    )
    assert list_response.status_code == 200
    assert len(list_response.get_json()) == 2

    first_attachment_id = attachments[0]["id"]
    download_response = client.get(
        f"/api/test-case-database/changes/{created['id']}/attachments/{first_attachment_id}/file"
    )
    assert download_response.status_code == 200
    assert download_response.data == b"hello world"

    delete_response = client.delete(
        f"/api/test-case-database/changes/{created['id']}/attachments/{first_attachment_id}"
    )
    assert delete_response.status_code == 204
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
python -m pytest tests/test_test_case_database_api.py -q
```

Expected: FAIL with 404 for `/api/test-case-database/changes`.

- [ ] **Step 3: Implement routes**

Create `routes/test_case_database_api.py`:

```python
"""HTTP API for the Test Case Database."""

from __future__ import annotations

from io import BytesIO

from flask import Blueprint, jsonify, request, send_file

from exceptions import ValidationError
from services.test_case_database_service import (
    MAX_ATTACHMENT_BYTES,
    TestCaseDatabaseService,
)


def create_test_case_database_blueprint(
    test_case_database_service: TestCaseDatabaseService,
) -> Blueprint:
    """Create the Test Case Database API blueprint."""

    bp = Blueprint(
        "test_case_database_api",
        __name__,
        url_prefix="/api/test-case-database",
    )

    @bp.route("/changes", methods=["GET"])
    def search_changes():
        return jsonify(
            test_case_database_service.search_changes(
                query=request.args.get("q", ""),
                test_case_id=request.args.get("test_case_id"),
                status=request.args.get("status"),
                tag=request.args.get("tag"),
                include_archived=_include_archived(),
            )
        )

    @bp.route("/changes", methods=["POST"])
    def create_change():
        change = test_case_database_service.create_change(request.get_json() or {})
        return jsonify(change), 201

    @bp.route("/changes/<int:change_id>", methods=["GET"])
    def get_change(change_id: int):
        return jsonify(test_case_database_service.get_change(change_id))

    @bp.route("/changes/<int:change_id>", methods=["PUT"])
    def update_change(change_id: int):
        return jsonify(
            test_case_database_service.update_change(
                change_id,
                request.get_json() or {},
            )
        )

    @bp.route("/changes/<int:change_id>/archive", methods=["POST"])
    def archive_change(change_id: int):
        return jsonify(test_case_database_service.archive_change(change_id))

    @bp.route("/changes/<int:change_id>/attachments", methods=["GET"])
    def list_change_attachments(change_id: int):
        return jsonify(test_case_database_service.list_change_attachments(change_id))

    @bp.route("/changes/<int:change_id>/attachments", methods=["POST"])
    def upload_change_attachments(change_id: int):
        uploaded_files = request.files.getlist("files")
        if not uploaded_files:
            raise ValidationError("At least one attachment file is required")

        attachments = []
        for uploaded_file in uploaded_files:
            file_bytes = uploaded_file.read()
            if len(file_bytes) > MAX_ATTACHMENT_BYTES:
                raise ValidationError(
                    f"Attachment '{uploaded_file.filename}' exceeds the 10 MB limit"
                )
            attachments.append(
                test_case_database_service.add_change_attachment(
                    change_id=change_id,
                    filename=uploaded_file.filename or "",
                    mime_type=uploaded_file.mimetype or "",
                    file_size=len(file_bytes),
                    file_bytes=file_bytes,
                )
            )
        return jsonify(attachments), 201

    @bp.route(
        "/changes/<int:change_id>/attachments/<int:attachment_id>/file",
        methods=["GET"],
    )
    def download_change_attachment(change_id: int, attachment_id: int):
        attachment = test_case_database_service.get_change_attachment(
            change_id,
            attachment_id,
        )
        return send_file(
            BytesIO(attachment["file_bytes"]),
            mimetype=attachment.get("mime_type") or "application/octet-stream",
            as_attachment=True,
            download_name=attachment["filename"],
        )

    @bp.route(
        "/changes/<int:change_id>/attachments/<int:attachment_id>",
        methods=["DELETE"],
    )
    def delete_change_attachment(change_id: int, attachment_id: int):
        test_case_database_service.delete_change_attachment(change_id, attachment_id)
        return "", 204

    return bp


def _include_archived() -> bool:
    return request.args.get("include_archived", "").lower() in {"1", "true", "yes"}
```

- [ ] **Step 4: Register blueprint**

In `routes/__init__.py`, import the route factory:

```python
from routes.test_case_database_api import create_test_case_database_blueprint
```

Add a nullable parameter to `register_blueprints`:

```python
    test_case_database_service: "TestCaseDatabaseService | None" = None,
```

Register after Knowledge if the service exists:

```python
    if test_case_database_service:
        app.register_blueprint(
            create_test_case_database_blueprint(test_case_database_service)
        )
```

- [ ] **Step 5: Wire app dependencies**

In `app.py`, import:

```python
from data_access import TestCaseDatabaseRepository
from services.test_case_database_service import TestCaseDatabaseService
```

Instantiate near the Knowledge repository/service:

```python
    test_case_database_repo = TestCaseDatabaseRepository(conn_mgr)
    test_case_database_service = TestCaseDatabaseService(test_case_database_repo)
```

Pass into `register_blueprints`:

```python
        test_case_database_service=test_case_database_service,
```

- [ ] **Step 6: Run backend API tests**

Run:

```bash
python -m pytest tests/test_test_case_database_repository.py tests/test_test_case_database_service.py tests/test_test_case_database_api.py -q
```

Expected: PASS.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add routes/test_case_database_api.py routes/__init__.py app.py tests/test_test_case_database_api.py
git commit -m "Add test case database API"
```

---

### Task 4: Frontend Types And API Client

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`

**Interfaces:**
- Consumes backend routes from Task 3.
- Produces TypeScript types: `TestCaseChangeLink`, `TestCaseChangeAttachment`, `TestCaseChange`, `TestCaseChangePayload`, `TestCaseChangeSearchParams`.
- Produces API methods on the existing exported API client:
  - `searchTestCaseChanges(params?: TestCaseChangeSearchParams): Promise<TestCaseChange[]>`
  - `createTestCaseChange(data: TestCaseChangePayload): Promise<TestCaseChange>`
  - `updateTestCaseChange(changeId: number, data: TestCaseChangePayload): Promise<TestCaseChange>`
  - `archiveTestCaseChange(changeId: number): Promise<TestCaseChange>`
  - `listTestCaseChangeAttachments(changeId: number): Promise<TestCaseChangeAttachment[]>`
  - `uploadTestCaseChangeAttachments(changeId: number, files: File[]): Promise<TestCaseChangeAttachment[]>`
  - `downloadTestCaseChangeAttachment(changeId: number, attachmentId: number): Promise<Blob>`
  - `deleteTestCaseChangeAttachment(changeId: number, attachmentId: number): Promise<void>`

- [ ] **Step 1: Add TypeScript types**

In `frontend/src/types/index.ts`, add:

```ts
export type TestCaseChangeStatus = "Draft" | "Active" | "Superseded" | "Archived"

export interface TestCaseChangeLink {
  id?: number
  label: string
  url: string
}

export interface TestCaseChangeAttachment {
  id: number
  change_id: number
  filename: string
  mime_type: string
  file_size: number
  created_at: string
}

export interface TestCaseChange {
  id: number
  test_case_id: string
  title: string
  test_case_url: string
  change_summary: string
  before_state: string
  after_state: string
  changed_by: string
  change_date: string
  status: TestCaseChangeStatus
  tags: string[]
  associated_bugs: TestCaseChangeLink[]
  associated_tasks: TestCaseChangeLink[]
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface TestCaseChangePayload {
  test_case_id: string
  title: string
  test_case_url: string
  change_summary: string
  before_state: string
  after_state: string
  changed_by: string
  change_date: string
  status: TestCaseChangeStatus
  tags: string[]
  associated_bugs: TestCaseChangeLink[]
  associated_tasks: TestCaseChangeLink[]
}

export interface TestCaseChangeSearchParams {
  q?: string
  test_case_id?: string
  status?: TestCaseChangeStatus | "all"
  tag?: string
  include_archived?: boolean
}
```

- [ ] **Step 2: Import types in API client**

In `frontend/src/services/api.ts`, add the new types to the existing import from `@/types`.

- [ ] **Step 3: Add API client methods**

In `frontend/src/services/api.ts`, add methods near the Knowledge section:

```ts
  // ---------- Test Case Database ----------

  async searchTestCaseChanges(params: TestCaseChangeSearchParams = {}): Promise<TestCaseChange[]> {
    const searchParams = new URLSearchParams()
    if (params.q) searchParams.set("q", params.q)
    if (params.test_case_id) searchParams.set("test_case_id", params.test_case_id)
    if (params.status && params.status !== "all") searchParams.set("status", params.status)
    if (params.tag) searchParams.set("tag", params.tag)
    if (params.include_archived) searchParams.set("include_archived", "true")
    const queryString = searchParams.toString()
    return this.request<TestCaseChange[]>(
      `/api/test-case-database/changes${queryString ? `?${queryString}` : ""}`
    )
  }

  async createTestCaseChange(data: TestCaseChangePayload): Promise<TestCaseChange> {
    return this.request<TestCaseChange>("/api/test-case-database/changes", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateTestCaseChange(changeId: number, data: TestCaseChangePayload): Promise<TestCaseChange> {
    return this.request<TestCaseChange>(`/api/test-case-database/changes/${changeId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  async archiveTestCaseChange(changeId: number): Promise<TestCaseChange> {
    return this.request<TestCaseChange>(`/api/test-case-database/changes/${changeId}/archive`, {
      method: "POST",
    })
  }

  async listTestCaseChangeAttachments(changeId: number): Promise<TestCaseChangeAttachment[]> {
    return this.request<TestCaseChangeAttachment[]>(
      `/api/test-case-database/changes/${changeId}/attachments`
    )
  }

  async uploadTestCaseChangeAttachments(
    changeId: number,
    files: File[]
  ): Promise<TestCaseChangeAttachment[]> {
    const formData = new FormData()
    files.forEach((file) => formData.append("files", file))
    const response = await fetch(
      `${this.baseUrl}/api/test-case-database/changes/${changeId}/attachments`,
      {
        method: "POST",
        body: formData,
      }
    )
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Upload failed" }))
      throw new Error(error.error || "Upload failed")
    }
    return response.json()
  }

  async downloadTestCaseChangeAttachment(changeId: number, attachmentId: number): Promise<Blob> {
    const response = await fetch(
      `${this.baseUrl}/api/test-case-database/changes/${changeId}/attachments/${attachmentId}/file`
    )
    if (!response.ok) throw new Error("Download failed")
    return response.blob()
  }

  async deleteTestCaseChangeAttachment(changeId: number, attachmentId: number): Promise<void> {
    await this.request<void>(
      `/api/test-case-database/changes/${changeId}/attachments/${attachmentId}`,
      { method: "DELETE" }
    )
  }
```

- [ ] **Step 4: Run frontend type check through build**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS. Fix task-caused TypeScript errors before committing.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add frontend/src/types/index.ts frontend/src/services/api.ts
git commit -m "Add test case database API client"
```

---

### Task 5: Frontend Page And Components

**Files:**
- Create: `frontend/src/pages/TestCaseDatabase.tsx`
- Create: `frontend/src/components/test-case-database/TestCaseChangeFilters.tsx`
- Create: `frontend/src/components/test-case-database/TestCaseChangeList.tsx`
- Create: `frontend/src/components/test-case-database/TestCaseChangeEditor.tsx`

**Interfaces:**
- Consumes API methods and types from Task 4.
- Produces named export `TestCaseDatabase`.
- Produces component `TestCaseChangeFilters`.
- Produces component `TestCaseChangeList`.
- Produces component `TestCaseChangeEditor`.
- Editor callbacks:
  - `onSave(draft: TestCaseChangePayload): Promise<void>`
  - `onArchive(changeId: number): Promise<void>`
  - `onUploadAttachments(files: File[]): Promise<void>`
  - `onDownloadAttachment(attachment: TestCaseChangeAttachment): Promise<void>`
  - `onDeleteAttachment(attachmentId: number): Promise<void>`

- [ ] **Step 1: Create filters component**

Create `frontend/src/components/test-case-database/TestCaseChangeFilters.tsx`:

```tsx
import { Search } from "lucide-react"
import type { TestCaseChangeStatus } from "@/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

interface TestCaseChangeFiltersProps {
  query: string
  status: TestCaseChangeStatus | "all"
  tag: string
  includeArchived: boolean
  onQueryChange: (value: string) => void
  onStatusChange: (value: TestCaseChangeStatus | "all") => void
  onTagChange: (value: string) => void
  onIncludeArchivedChange: (value: boolean) => void
}

export function TestCaseChangeFilters({
  query,
  status,
  tag,
  includeArchived,
  onQueryChange,
  onStatusChange,
  onTagChange,
  onIncludeArchivedChange,
}: TestCaseChangeFiltersProps) {
  return (
    <div className="grid gap-3 border-b border-border bg-card/30 p-4 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem_auto]">
      <div className="space-y-1.5">
        <Label htmlFor="test-case-search">Search</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="test-case-search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="pl-9"
            placeholder="Keyword, test ID, bug, task, owner"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Status</Label>
        <Select value={status} onValueChange={(value) => onStatusChange(value as TestCaseChangeStatus | "all")}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Draft">Draft</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Superseded">Superseded</SelectItem>
            <SelectItem value="Archived">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="test-case-tag">Tag</Label>
        <Input
          id="test-case-tag"
          value={tag}
          onChange={(event) => onTagChange(event.target.value)}
          placeholder="checkout"
        />
      </div>
      <div className="flex items-end gap-2 pb-2">
        <Switch checked={includeArchived} onCheckedChange={onIncludeArchivedChange} />
        <span className="text-sm text-muted-foreground">Archived</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create list component**

Create `frontend/src/components/test-case-database/TestCaseChangeList.tsx`:

```tsx
import { Paperclip } from "lucide-react"
import type { TestCaseChange } from "@/types"
import { cn, formatDateTime } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface TestCaseChangeListProps {
  changes: TestCaseChange[]
  selectedId: number | null
  loading: boolean
  onSelect: (change: TestCaseChange) => void
}

export function TestCaseChangeList({
  changes,
  selectedId,
  loading,
  onSelect,
}: TestCaseChangeListProps) {
  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Loading test case changes...</div>
  }

  if (changes.length === 0) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        No test case changes match the current filters.
      </div>
    )
  }

  return (
    <div className="divide-y divide-border">
      {changes.map((change) => (
        <button
          key={change.id}
          type="button"
          onClick={() => onSelect(change)}
          className={cn(
            "grid w-full gap-2 px-4 py-3 text-left transition-colors hover:bg-accent/30 lg:grid-cols-[8rem_minmax(14rem,1fr)_8rem_9rem_8rem_7rem]",
            selectedId === change.id && "bg-accent/40"
          )}
        >
          <span className="font-mono text-xs text-foreground">{change.test_case_id}</span>
          <span className="min-w-0 truncate text-sm font-medium">{change.title}</span>
          <Badge variant="outline" className="w-fit">{change.status}</Badge>
          <span className="text-xs text-muted-foreground">{change.change_date || "No date"}</span>
          <span className="truncate text-xs text-muted-foreground">{change.changed_by || "Unassigned"}</span>
          <span className="flex items-center gap-2 text-xs text-muted-foreground">
            B{change.associated_bugs.length} T{change.associated_tasks.length}
            <Paperclip className="size-3" aria-hidden="true" />
          </span>
          <span className="col-span-full line-clamp-2 text-xs text-muted-foreground">
            {change.change_summary}
          </span>
          <span className="col-span-full truncate text-xs text-muted-foreground">
            {formatDateTime(change.updated_at)}
          </span>
        </button>
      ))}
    </div>
  )
}
```

If `formatDateTime` is not exported from `@/lib/utils`, replace that one usage with:

```tsx
new Date(change.updated_at).toLocaleString()
```

- [ ] **Step 3: Create editor component**

Create `frontend/src/components/test-case-database/TestCaseChangeEditor.tsx` with this structure. Keep the component focused on form state and presentation; parent page owns persistence:

```tsx
import { Download, ExternalLink, FileUp, Plus, Save, Trash2 } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import type {
  TestCaseChange,
  TestCaseChangeAttachment,
  TestCaseChangeLink,
  TestCaseChangePayload,
  TestCaseChangeStatus,
} from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

const EMPTY_DRAFT: TestCaseChangePayload = {
  test_case_id: "",
  title: "",
  test_case_url: "",
  change_summary: "",
  before_state: "",
  after_state: "",
  changed_by: "",
  change_date: new Date().toISOString().slice(0, 10),
  status: "Active",
  tags: [],
  associated_bugs: [],
  associated_tasks: [],
}

interface TestCaseChangeEditorProps {
  selectedChange: TestCaseChange | null
  attachments: TestCaseChangeAttachment[]
  attachmentsLoading: boolean
  attachmentsUploading: boolean
  saving: boolean
  onSave: (draft: TestCaseChangePayload) => Promise<void>
  onArchive: (changeId: number) => Promise<void>
  onUploadAttachments: (files: File[]) => Promise<void>
  onDownloadAttachment: (attachment: TestCaseChangeAttachment) => Promise<void>
  onDeleteAttachment: (attachmentId: number) => Promise<void>
}

export function TestCaseChangeEditor({
  selectedChange,
  attachments,
  attachmentsLoading,
  attachmentsUploading,
  saving,
  onSave,
  onArchive,
  onUploadAttachments,
  onDownloadAttachment,
  onDeleteAttachment,
}: TestCaseChangeEditorProps) {
  const [draft, setDraft] = useState<TestCaseChangePayload>(EMPTY_DRAFT)
  const isSaved = selectedChange !== null

  useEffect(() => {
    if (!selectedChange) {
      setDraft({ ...EMPTY_DRAFT, change_date: new Date().toISOString().slice(0, 10) })
      return
    }
    setDraft({
      test_case_id: selectedChange.test_case_id,
      title: selectedChange.title,
      test_case_url: selectedChange.test_case_url,
      change_summary: selectedChange.change_summary,
      before_state: selectedChange.before_state,
      after_state: selectedChange.after_state,
      changed_by: selectedChange.changed_by,
      change_date: selectedChange.change_date,
      status: selectedChange.status,
      tags: selectedChange.tags,
      associated_bugs: selectedChange.associated_bugs,
      associated_tasks: selectedChange.associated_tasks,
    })
  }, [selectedChange])

  const tagText = useMemo(() => draft.tags.join(", "), [draft.tags])

  function updateField<K extends keyof TestCaseChangePayload>(
    key: K,
    value: TestCaseChangePayload[K]
  ) {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  function updateLinks(
    key: "associated_bugs" | "associated_tasks",
    links: TestCaseChangeLink[]
  ) {
    setDraft((current) => ({ ...current, [key]: links }))
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-base font-semibold">
            {isSaved ? selectedChange.title : "New test case change"}
          </h2>
          <p className="text-xs text-muted-foreground">
            Manual history for Zephyr test case updates.
          </p>
        </div>
        <div className="flex gap-2">
          {selectedChange && !selectedChange.archived_at ? (
            <Button type="button" variant="outline" onClick={() => onArchive(selectedChange.id)}>
              Archive
            </Button>
          ) : null}
          <Button type="button" onClick={() => onSave(draft)} disabled={saving}>
            <Save className="size-4" aria-hidden="true" />
            Save
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-6 overflow-auto p-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Test Case ID" value={draft.test_case_id} onChange={(value) => updateField("test_case_id", value)} />
            <Field label="Title" value={draft.title} onChange={(value) => updateField("title", value)} />
            <Field label="Test Case URL" value={draft.test_case_url} onChange={(value) => updateField("test_case_url", value)} />
            <Field label="Changed By" value={draft.changed_by} onChange={(value) => updateField("changed_by", value)} />
            <Field label="Change Date" type="date" value={draft.change_date} onChange={(value) => updateField("change_date", value)} />
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={draft.status} onValueChange={(value) => updateField("status", value as TestCaseChangeStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Superseded">Superseded</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <TextBlock label="Change Summary" value={draft.change_summary} onChange={(value) => updateField("change_summary", value)} />
          <div className="grid gap-4 lg:grid-cols-2">
            <TextBlock label="Before" value={draft.before_state} onChange={(value) => updateField("before_state", value)} />
            <TextBlock label="After" value={draft.after_state} onChange={(value) => updateField("after_state", value)} />
          </div>
          <Field
            label="Tags"
            value={tagText}
            onChange={(value) => updateField("tags", value.split(",").map((tag) => tag.trim()).filter(Boolean))}
          />
        </div>

        <aside className="space-y-5">
          <LinkRows
            title="Associated Bugs"
            links={draft.associated_bugs}
            onChange={(links) => updateLinks("associated_bugs", links)}
          />
          <LinkRows
            title="Associated Tasks"
            links={draft.associated_tasks}
            onChange={(links) => updateLinks("associated_tasks", links)}
          />
          <Attachments
            disabled={!isSaved}
            attachments={attachments}
            loading={attachmentsLoading}
            uploading={attachmentsUploading}
            onUpload={onUploadAttachments}
            onDownload={onDownloadAttachment}
            onDelete={onDeleteAttachment}
          />
        </aside>
      </div>
    </section>
  )
}

function Field({
  label,
  value,
  type = "text",
  onChange,
}: {
  label: string
  value: string
  type?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  )
}

function TextBlock({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={5} />
    </div>
  )
}

function LinkRows({
  title,
  links,
  onChange,
}: {
  title: string
  links: TestCaseChangeLink[]
  onChange: (links: TestCaseChangeLink[]) => void
}) {
  return (
    <div className="space-y-2 rounded border border-border p-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...links, { label: "", url: "" }])}>
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
      </div>
      <div className="space-y-2">
        {links.map((link, index) => (
          <div key={index} className="grid gap-2">
            <Input
              value={link.label}
              placeholder="BUG-1234"
              onChange={(event) => {
                const next = [...links]
                next[index] = { ...next[index], label: event.target.value }
                onChange(next)
              }}
            />
            <div className="flex gap-2">
              <Input
                value={link.url}
                placeholder="https://..."
                onChange={(event) => {
                  const next = [...links]
                  next[index] = { ...next[index], url: event.target.value }
                  onChange(next)
                }}
              />
              {link.url ? (
                <Button type="button" variant="outline" size="icon" asChild>
                  <a href={link.url} target="_blank" rel="noreferrer" aria-label={`Open ${link.label || title} link`}>
                    <ExternalLink className="size-4" aria-hidden="true" />
                  </a>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => onChange(links.filter((_, itemIndex) => itemIndex !== index))}
                aria-label={`Remove ${title} row ${index + 1}`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Attachments({
  disabled,
  attachments,
  loading,
  uploading,
  onUpload,
  onDownload,
  onDelete,
}: {
  disabled: boolean
  attachments: TestCaseChangeAttachment[]
  loading: boolean
  uploading: boolean
  onUpload: (files: File[]) => Promise<void>
  onDownload: (attachment: TestCaseChangeAttachment) => Promise<void>
  onDelete: (attachmentId: number) => Promise<void>
}) {
  return (
    <div className="space-y-2 rounded border border-border p-3">
      <h3 className="text-sm font-semibold">Attachments</h3>
      <Input
        type="file"
        multiple
        disabled={disabled || uploading}
        onChange={(event) => {
          const files = Array.from(event.target.files || [])
          if (files.length) void onUpload(files)
          event.currentTarget.value = ""
        }}
      />
      <p className="text-xs text-muted-foreground">
        {disabled ? "Save the record before adding attachments." : "10 MB limit per file."}
      </p>
      {loading ? <p className="text-xs text-muted-foreground">Loading attachments...</p> : null}
      <div className="space-y-2">
        {attachments.map((attachment) => (
          <div key={attachment.id} className="flex items-center justify-between gap-2 rounded border border-border/70 p-2">
            <span className="min-w-0 truncate text-xs">{attachment.filename}</span>
            <div className="flex gap-1">
              <Button type="button" variant="outline" size="icon" onClick={() => onDownload(attachment)}>
                <Download className="size-4" aria-hidden="true" />
              </Button>
              <Button type="button" variant="outline" size="icon" onClick={() => onDelete(attachment.id)}>
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      {uploading ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <FileUp className="size-3" aria-hidden="true" />
          Uploading...
        </p>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Create page state container**

Create `frontend/src/pages/TestCaseDatabase.tsx`:

```tsx
import { Plus, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { TestCaseChangeEditor } from "@/components/test-case-database/TestCaseChangeEditor"
import { TestCaseChangeFilters } from "@/components/test-case-database/TestCaseChangeFilters"
import { TestCaseChangeList } from "@/components/test-case-database/TestCaseChangeList"
import { Button } from "@/components/ui/button"
import { api } from "@/services/api"
import type {
  TestCaseChange,
  TestCaseChangeAttachment,
  TestCaseChangePayload,
  TestCaseChangeStatus,
} from "@/types"

export function TestCaseDatabase() {
  const [changes, setChanges] = useState<TestCaseChange[]>([])
  const [selectedChange, setSelectedChange] = useState<TestCaseChange | null>(null)
  const [attachments, setAttachments] = useState<TestCaseChangeAttachment[]>([])
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<TestCaseChangeStatus | "all">("all")
  const [tag, setTag] = useState("")
  const [includeArchived, setIncludeArchived] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [attachmentsUploading, setAttachmentsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const attachmentRequestIdRef = useRef(0)

  const selectedId = selectedChange?.id ?? null

  const loadChanges = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)
    setError(null)
    try {
      const loaded = await api.searchTestCaseChanges({
        q: query,
        status,
        tag,
        include_archived: includeArchived,
      })
      if (requestId === requestIdRef.current) {
        setChanges(loaded)
        setSelectedChange((current) => {
          if (!current) return loaded[0] ?? null
          return loaded.find((change) => change.id === current.id) ?? loaded[0] ?? null
        })
      }
    } catch (loadError) {
      if (requestId === requestIdRef.current) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load test case changes")
      }
    } finally {
      if (requestId === requestIdRef.current) setLoading(false)
    }
  }, [includeArchived, query, status, tag])

  const loadAttachments = useCallback(async (changeId: number) => {
    const requestId = attachmentRequestIdRef.current + 1
    attachmentRequestIdRef.current = requestId
    setAttachmentsLoading(true)
    setAttachments([])
    try {
      const loaded = await api.listTestCaseChangeAttachments(changeId)
      if (requestId === attachmentRequestIdRef.current) setAttachments(loaded)
    } catch (loadError) {
      if (requestId === attachmentRequestIdRef.current) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load attachments")
      }
    } finally {
      if (requestId === attachmentRequestIdRef.current) setAttachmentsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadChanges()
  }, [loadChanges])

  useEffect(() => {
    if (!selectedId) {
      setAttachments([])
      setAttachmentsLoading(false)
      return
    }
    void loadAttachments(selectedId)
  }, [loadAttachments, selectedId])

  const visibleTitle = useMemo(() => {
    if (loading) return "Loading"
    return `${changes.length} ${changes.length === 1 ? "record" : "records"}`
  }, [changes.length, loading])

  async function saveChange(draft: TestCaseChangePayload) {
    setSaving(true)
    setError(null)
    try {
      const saved = selectedChange
        ? await api.updateTestCaseChange(selectedChange.id, draft)
        : await api.createTestCaseChange(draft)
      setSelectedChange(saved)
      await loadChanges()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save test case change")
    } finally {
      setSaving(false)
    }
  }

  async function archiveChange(changeId: number) {
    setSaving(true)
    setError(null)
    try {
      const archived = await api.archiveTestCaseChange(changeId)
      setSelectedChange(archived)
      await loadChanges()
    } catch (archiveError) {
      setError(archiveError instanceof Error ? archiveError.message : "Failed to archive test case change")
    } finally {
      setSaving(false)
    }
  }

  async function uploadAttachments(files: File[]) {
    if (!selectedChange) return
    setAttachmentsUploading(true)
    setError(null)
    try {
      await api.uploadTestCaseChangeAttachments(selectedChange.id, files)
      await loadAttachments(selectedChange.id)
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload attachments")
    } finally {
      setAttachmentsUploading(false)
    }
  }

  async function downloadAttachment(attachment: TestCaseChangeAttachment) {
    if (!selectedChange) return
    const blob = await api.downloadTestCaseChangeAttachment(selectedChange.id, attachment.id)
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = attachment.filename
    link.click()
    URL.revokeObjectURL(url)
  }

  async function deleteAttachment(attachmentId: number) {
    if (!selectedChange) return
    await api.deleteTestCaseChangeAttachment(selectedChange.id, attachmentId)
    await loadAttachments(selectedChange.id)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">Test Case Database</h1>
          <p className="text-sm text-muted-foreground">{visibleTitle}</p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={loadChanges}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Refresh
          </Button>
          <Button type="button" onClick={() => setSelectedChange(null)}>
            <Plus className="size-4" aria-hidden="true" />
            New Change
          </Button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <TestCaseChangeFilters
        query={query}
        status={status}
        tag={tag}
        includeArchived={includeArchived}
        onQueryChange={setQuery}
        onStatusChange={setStatus}
        onTagChange={setTag}
        onIncludeArchivedChange={setIncludeArchived}
      />

      <main className="grid min-h-0 flex-1 lg:grid-rows-[minmax(12rem,32vh)_1fr]">
        <section className="min-h-0 overflow-auto border-b border-border">
          <TestCaseChangeList
            changes={changes}
            selectedId={selectedChange?.id ?? null}
            loading={loading}
            onSelect={setSelectedChange}
          />
        </section>
        <section className="min-h-0 overflow-hidden bg-card/20">
          <TestCaseChangeEditor
            selectedChange={selectedChange}
            attachments={attachments}
            attachmentsLoading={attachmentsLoading}
            attachmentsUploading={attachmentsUploading}
            saving={saving}
            onSave={saveChange}
            onArchive={archiveChange}
            onUploadAttachments={uploadAttachments}
            onDownloadAttachment={downloadAttachment}
            onDeleteAttachment={deleteAttachment}
          />
        </section>
      </main>
    </div>
  )
}
```

- [ ] **Step 5: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS. Fix import or component API errors in the new files.

- [ ] **Step 6: Commit Task 5**

Run:

```bash
git add frontend/src/pages/TestCaseDatabase.tsx frontend/src/components/test-case-database/TestCaseChangeFilters.tsx frontend/src/components/test-case-database/TestCaseChangeList.tsx frontend/src/components/test-case-database/TestCaseChangeEditor.tsx
git commit -m "Add test case database page"
```

---

### Task 6: Routing, Navigation, And Full Verification

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/AppSidebar.tsx`

**Interfaces:**
- Consumes named page export from Task 5.
- Produces React route `/test-case-database`.
- Produces sidebar item with label `Test Case Database`.

- [ ] **Step 1: Wire route**

In `frontend/src/App.tsx`, add the lazy page binding next to the existing `Knowledge` binding:

```tsx
const TestCaseDatabase = lazyWithReload(() =>
  import("@/pages/TestCaseDatabase").then((module) => ({ default: module.TestCaseDatabase })),
)
```

Inside the app route children, add the route after the existing `knowledge` route:

```tsx
<Route path="test-case-database" element={<TestCaseDatabase />} />
```

- [ ] **Step 2: Wire sidebar item**

In `frontend/src/components/layout/AppSidebar.tsx`, add `BookOpenCheck` to the existing `lucide-react` import.

Add this item to the `MIGRATION` section immediately after `Knowledge`:

```tsx
{
  label: "Test Case Database",
  href: "/test-case-database",
  icon: BookOpenCheck,
}
```

- [ ] **Step 3: Run full backend tests for this feature**

Run:

```bash
python -m pytest tests/test_test_case_database_repository.py tests/test_test_case_database_service.py tests/test_test_case_database_api.py -q
```

Expected: PASS.

- [ ] **Step 4: Run frontend build**

Run:

```bash
cd frontend
npm run build
```

Expected: PASS.

- [ ] **Step 5: Run app smoke check**

Run the backend in one terminal:

```bash
python app.py
```

Run the frontend in a second terminal:

```bash
cd frontend
npm run dev -- --host 127.0.0.1
```

Open the Vite localhost URL and navigate to `/test-case-database`. Manually verify:

- Sidebar shows `Test Case Database`.
- Creating a record with test case URL, one bug link, and one task link succeeds.
- Record appears in search results by test case ID.
- Search by bug label returns the record.
- Test case, bug, and task links open in new tabs.
- Attachments are disabled before first save.
- Uploading a small `.txt` file after save shows it in the attachment list.
- Downloading the attachment returns the same file bytes.
- Archiving removes the record from default search.
- Enabling archived records shows the archived record.

- [ ] **Step 6: Commit Task 6**

Run:

```bash
git add frontend/src/App.tsx frontend/src/components/layout/AppSidebar.tsx
git commit -m "Wire test case database navigation"
```

---

## Self-Review Checklist

- Spec coverage: Tasks 1 through 3 cover database tables, service validation, API routes, manual-only behavior, structured bug/task links, clickable URL storage, search, archive, and attachments.
- UI coverage: Tasks 4 through 6 cover types, API client, searchable tab, list, editor, structured link rows, new-record attachment disablement, and route/sidebar navigation.
- Out-of-scope check: No task adds Zephyr sync, import, webhook, polling, or history parsing.
- Type consistency: Backend uses `test_case_id`, `test_case_url`, `change_summary`, `before_state`, `after_state`, `changed_by`, `change_date`, `associated_bugs`, and `associated_tasks`; frontend types and payloads use the same property names.
- Verification: Repository, service, API, frontend build, and manual smoke checks are listed with explicit commands and expected outcomes.
