# Knowledge Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Pharos Knowledge page for controlled multi-domain knowledge entry, editing, archiving, search, and filtering.

**Architecture:** Add a backend slice that follows existing Pharos dependency flow: Flask blueprint routes call a `KnowledgeService`, which delegates SQL to a `KnowledgeRepository`. Add a React `/knowledge` route with typed API methods and focused UI components for domains, filters, entry list, and entry editor.

**Tech Stack:** Python 3.11, Flask, SQLite/PostgreSQL via `ConnectionManager`, pytest, React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/base-ui components, lucide-react.

---

## File Structure

Create:

- `data_access/knowledge_repository.py` - SQL for `knowledge_domains` and `knowledge_entries`.
- `services/knowledge_service.py` - validation and lifecycle rules for domains and entries.
- `routes/knowledge_api.py` - thin Flask API blueprint.
- `tests/test_knowledge_repository.py` - repository CRUD/search coverage.
- `tests/test_knowledge_service.py` - validation and lifecycle coverage.
- `tests/test_knowledge_api.py` - route smoke coverage.
- `frontend/src/pages/Knowledge.tsx` - routed Knowledge page.
- `frontend/src/components/knowledge/DomainRail.tsx` - domain list and add-domain UI.
- `frontend/src/components/knowledge/KnowledgeFilters.tsx` - search and structured filters.
- `frontend/src/components/knowledge/KnowledgeEntryList.tsx` - entry list/table.
- `frontend/src/components/knowledge/KnowledgeEntryEditor.tsx` - create/edit entry panel.

Modify:

- `data_access/connection.py` - create knowledge tables and indexes in SQLite and PostgreSQL schema setup.
- `data_access/__init__.py` - export `KnowledgeRepository`.
- `services/__init__.py` - export `KnowledgeService`.
- `routes/__init__.py` - import and register `create_knowledge_blueprint`.
- `app.py` - instantiate repository/service and pass service to route registration.
- `enums.py` - add `KnowledgeEntryType` and `KnowledgeStatus` string enums.
- `frontend/src/types/index.ts` - add Knowledge domain/entry types and request shapes.
- `frontend/src/services/api.ts` - add Knowledge API methods.
- `frontend/src/App.tsx` - lazy-load `/knowledge`.
- `frontend/src/components/layout/AppSidebar.tsx` - add Knowledge nav item.

Do not modify legacy `templates/`, `static/css/`, or `static/js/`.

---

### Task 1: Backend Schema And Repository

**Files:**
- Modify: `data_access/connection.py`
- Modify: `data_access/__init__.py`
- Create: `data_access/knowledge_repository.py`
- Create: `tests/test_knowledge_repository.py`

- [ ] **Step 1: Write failing repository tests**

Create `tests/test_knowledge_repository.py`:

```python
import sqlite3
from pathlib import Path

from data_access.connection import ConnectionManager
from data_access.knowledge_repository import KnowledgeRepository


def make_repo(tmp_path: Path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    cm = ConnectionManager(db_url=None)
    cm.init_schema()
    return KnowledgeRepository(cm)


def test_create_and_list_domains(tmp_path, monkeypatch):
    repo = make_repo(tmp_path, monkeypatch)

    domain_id = repo.create_domain("Adobe Commerce Migration", "Migration facts")

    domains = repo.list_domains()
    assert domain_id is not None
    assert domains == [
        {
            "id": domain_id,
            "name": "Adobe Commerce Migration",
            "description": "Migration facts",
            "created_at": domains[0]["created_at"],
            "updated_at": domains[0]["updated_at"],
            "archived_at": None,
        }
    ]


def test_duplicate_domain_returns_none(tmp_path, monkeypatch):
    repo = make_repo(tmp_path, monkeypatch)

    assert repo.create_domain("Pharos", "") is not None
    assert repo.create_domain("Pharos", "duplicate") is None


def test_archive_domain_sets_archived_at(tmp_path, monkeypatch):
    repo = make_repo(tmp_path, monkeypatch)
    domain_id = repo.create_domain("QA Automation", "")

    assert repo.archive_domain(domain_id) is True

    domain = repo.get_domain(domain_id)
    assert domain["archived_at"] is not None


def test_create_update_archive_and_search_entries(tmp_path, monkeypatch):
    repo = make_repo(tmp_path, monkeypatch)
    domain_id = repo.create_domain("Adobe Commerce Migration", "")

    entry_id = repo.create_entry(
        {
            "domain_id": domain_id,
            "entry_type": "Decision",
            "status": "Active",
            "title": "Checkout source of truth",
            "details": "Adobe Commerce owns checkout requirements.",
            "source": "meeting notes",
            "tags": "checkout,requirements",
        }
    )

    assert entry_id is not None

    repo.update_entry(
        entry_id,
        {
            "domain_id": domain_id,
            "entry_type": "Rule",
            "status": "Superseded",
            "title": "Checkout requirement owner",
            "details": "Migration team owns checkout requirements.",
            "source": "follow-up",
            "tags": "checkout,owner",
        },
    )
    repo.archive_entry(entry_id)

    entry = repo.get_entry(entry_id)
    assert entry["status"] == "Archived"
    assert entry["title"] == "Checkout requirement owner"

    hidden = repo.search_entries(query="checkout", include_archived=False)
    visible = repo.search_entries(query="checkout", include_archived=True)
    assert hidden == []
    assert [row["id"] for row in visible] == [entry_id]


def test_search_filters_domain_type_status_and_tag(tmp_path, monkeypatch):
    repo = make_repo(tmp_path, monkeypatch)
    migration_id = repo.create_domain("Adobe Commerce Migration", "")
    qa_id = repo.create_domain("QA Automation", "")
    repo.create_entry(
        {
            "domain_id": migration_id,
            "entry_type": "Requirement",
            "status": "Active",
            "title": "Cart discount",
            "details": "Consumer carts need discount coverage.",
            "source": "",
            "tags": "cart,discount",
        }
    )
    repo.create_entry(
        {
            "domain_id": qa_id,
            "entry_type": "Evidence",
            "status": "Draft",
            "title": "Build output",
            "details": "Automation build evidence.",
            "source": "",
            "tags": "build",
        }
    )

    rows = repo.search_entries(
        query="discount",
        domain_id=migration_id,
        entry_type="Requirement",
        status="Active",
        tag="cart",
    )

    assert len(rows) == 1
    assert rows[0]["title"] == "Cart discount"
```

- [ ] **Step 2: Run repository tests to verify failure**

Run:

```bash
python -m pytest tests/test_knowledge_repository.py -v
```

Expected: fails because `data_access.knowledge_repository` does not exist.

- [ ] **Step 3: Add knowledge tables and indexes**

In `data_access/connection.py`, add these table definitions to both `_init_postgres_schema()` and `_init_sqlite_schema()`.

PostgreSQL block:

```python
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_domains (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                archived_at TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_entries (
                id SERIAL PRIMARY KEY,
                domain_id INTEGER NOT NULL,
                entry_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Active',
                title TEXT NOT NULL,
                details TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT '',
                tags TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (domain_id) REFERENCES knowledge_domains (id)
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_knowledge_entries_domain_id
            ON knowledge_entries(domain_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_knowledge_entries_type
            ON knowledge_entries(entry_type)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_knowledge_entries_status
            ON knowledge_entries(status)
        """)
```

SQLite block:

```python
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_domains (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                archived_at TIMESTAMP
            )
        """)

        cursor.execute("""
            CREATE TABLE IF NOT EXISTS knowledge_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                domain_id INTEGER NOT NULL,
                entry_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Active',
                title TEXT NOT NULL,
                details TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT '',
                tags TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (domain_id) REFERENCES knowledge_domains (id)
            )
        """)

        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_knowledge_entries_domain_id
            ON knowledge_entries(domain_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_knowledge_entries_type
            ON knowledge_entries(entry_type)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_knowledge_entries_status
            ON knowledge_entries(status)
        """)
```

- [ ] **Step 4: Implement repository**

Create `data_access/knowledge_repository.py`:

```python
"""Repository for Pharos Knowledge Ledger storage."""

from __future__ import annotations

from typing import Any

from data_access.connection import ConnectionManager
from exceptions import DatabaseError


class KnowledgeRepository:
    """SQL access for knowledge domains and entries."""

    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm = connection_manager

    def list_domains(self, include_archived: bool = False) -> list[dict]:
        clause = "" if include_archived else "WHERE archived_at IS NULL"
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT id, name, description, created_at, updated_at, archived_at
                FROM knowledge_domains
                {clause}
                ORDER BY name
                """
            )
            return self._cm.rows_to_dicts(cursor)

    def get_domain(self, domain_id: int) -> dict | None:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT id, name, description, created_at, updated_at, archived_at
                FROM knowledge_domains
                WHERE id = {ph}
                """,
                (domain_id,),
            )
            return self._cm.row_to_dict(cursor)

    def create_domain(self, name: str, description: str = "") -> int | None:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    INSERT INTO knowledge_domains (name, description)
                    VALUES ({ph}, {ph}){self._cm.returning_id()}
                    """,
                    (name, description),
                )
                return self._cm.last_insert_id(cursor)
        except Exception as exc:
            if self._cm.is_integrity_error(exc):
                return None
            raise DatabaseError(f"Failed to create knowledge domain: {exc}") from exc

    def update_domain(self, domain_id: int, name: str, description: str) -> bool:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    UPDATE knowledge_domains
                    SET name = {ph}, description = {ph}, updated_at = CURRENT_TIMESTAMP
                    WHERE id = {ph}
                    """,
                    (name, description, domain_id),
                )
                return cursor.rowcount > 0
        except Exception as exc:
            if self._cm.is_integrity_error(exc):
                return False
            raise DatabaseError(f"Failed to update knowledge domain {domain_id}: {exc}") from exc

    def archive_domain(self, domain_id: int) -> bool:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE knowledge_domains
                SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = {ph} AND archived_at IS NULL
                """,
                (domain_id,),
            )
            return cursor.rowcount > 0

    def get_entry(self, entry_id: int) -> dict | None:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT e.id, e.domain_id, d.name AS domain_name, e.entry_type,
                       e.status, e.title, e.details, e.source, e.tags,
                       e.created_at, e.updated_at
                FROM knowledge_entries e
                JOIN knowledge_domains d ON d.id = e.domain_id
                WHERE e.id = {ph}
                """,
                (entry_id,),
            )
            return self._cm.row_to_dict(cursor)

    def create_entry(self, data: dict[str, Any]) -> int:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                INSERT INTO knowledge_entries
                    (domain_id, entry_type, status, title, details, source, tags)
                VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}){self._cm.returning_id()}
                """,
                (
                    data["domain_id"],
                    data["entry_type"],
                    data["status"],
                    data["title"],
                    data["details"],
                    data.get("source", ""),
                    data.get("tags", ""),
                ),
            )
            return self._cm.last_insert_id(cursor)

    def update_entry(self, entry_id: int, data: dict[str, Any]) -> bool:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE knowledge_entries
                SET domain_id = {ph}, entry_type = {ph}, status = {ph},
                    title = {ph}, details = {ph}, source = {ph}, tags = {ph},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = {ph}
                """,
                (
                    data["domain_id"],
                    data["entry_type"],
                    data["status"],
                    data["title"],
                    data["details"],
                    data.get("source", ""),
                    data.get("tags", ""),
                    entry_id,
                ),
            )
            return cursor.rowcount > 0

    def archive_entry(self, entry_id: int) -> bool:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE knowledge_entries
                SET status = 'Archived', updated_at = CURRENT_TIMESTAMP
                WHERE id = {ph}
                """,
                (entry_id,),
            )
            return cursor.rowcount > 0

    def search_entries(
        self,
        query: str = "",
        domain_id: int | None = None,
        entry_type: str | None = None,
        status: str | None = None,
        tag: str | None = None,
        include_archived: bool = False,
    ) -> list[dict]:
        ph = self._cm.placeholder()
        clauses: list[str] = []
        params: list[Any] = []

        if not include_archived:
            clauses.append("e.status <> 'Archived'")
            clauses.append("d.archived_at IS NULL")
        if query:
            like = f"%{query}%"
            clauses.append(
                f"(e.title LIKE {ph} OR e.details LIKE {ph} OR e.source LIKE {ph} OR e.tags LIKE {ph})"
            )
            params.extend([like, like, like, like])
        if domain_id is not None:
            clauses.append(f"e.domain_id = {ph}")
            params.append(domain_id)
        if entry_type:
            clauses.append(f"e.entry_type = {ph}")
            params.append(entry_type)
        if status:
            clauses.append(f"e.status = {ph}")
            params.append(status)
        if tag:
            clauses.append(f"e.tags LIKE {ph}")
            params.append(f"%{tag}%")

        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT e.id, e.domain_id, d.name AS domain_name, e.entry_type,
                       e.status, e.title, e.details, e.source, e.tags,
                       e.created_at, e.updated_at
                FROM knowledge_entries e
                JOIN knowledge_domains d ON d.id = e.domain_id
                {where}
                ORDER BY e.updated_at DESC, e.id DESC
                """,
                tuple(params),
            )
            return self._cm.rows_to_dicts(cursor)
```

- [ ] **Step 5: Export repository**

Modify `data_access/__init__.py`:

```python
from data_access.knowledge_repository import KnowledgeRepository
```

Add `"KnowledgeRepository"` to `__all__`.

- [ ] **Step 6: Run repository tests**

Run:

```bash
python -m pytest tests/test_knowledge_repository.py -v
```

Expected: all tests pass.

- [ ] **Step 7: Commit repository slice**

Run:

```bash
git add data_access/connection.py data_access/__init__.py data_access/knowledge_repository.py tests/test_knowledge_repository.py
git commit -m "Add knowledge repository"
```

---

### Task 2: Backend Service And Validation

**Files:**
- Modify: `enums.py`
- Modify: `services/__init__.py`
- Create: `services/knowledge_service.py`
- Create: `tests/test_knowledge_service.py`

- [ ] **Step 1: Write failing service tests**

Create `tests/test_knowledge_service.py`:

```python
import pytest

from exceptions import ValidationError
from services.knowledge_service import KnowledgeService


class FakeKnowledgeRepository:
    def __init__(self):
        self.domains = {}
        self.entries = {}
        self.next_domain_id = 1
        self.next_entry_id = 1

    def list_domains(self, include_archived=False):
        return list(self.domains.values())

    def get_domain(self, domain_id):
        return self.domains.get(domain_id)

    def create_domain(self, name, description=""):
        if any(row["name"] == name for row in self.domains.values()):
            return None
        domain_id = self.next_domain_id
        self.next_domain_id += 1
        self.domains[domain_id] = {
            "id": domain_id,
            "name": name,
            "description": description,
            "archived_at": None,
        }
        return domain_id

    def update_domain(self, domain_id, name, description):
        if domain_id not in self.domains:
            return False
        self.domains[domain_id]["name"] = name
        self.domains[domain_id]["description"] = description
        return True

    def archive_domain(self, domain_id):
        if domain_id not in self.domains:
            return False
        self.domains[domain_id]["archived_at"] = "now"
        return True

    def create_entry(self, data):
        entry_id = self.next_entry_id
        self.next_entry_id += 1
        self.entries[entry_id] = {"id": entry_id, **data}
        return entry_id

    def get_entry(self, entry_id):
        return self.entries.get(entry_id)

    def update_entry(self, entry_id, data):
        if entry_id not in self.entries:
            return False
        self.entries[entry_id].update(data)
        return True

    def archive_entry(self, entry_id):
        if entry_id not in self.entries:
            return False
        self.entries[entry_id]["status"] = "Archived"
        return True

    def search_entries(self, **kwargs):
        return list(self.entries.values())


def make_service():
    repo = FakeKnowledgeRepository()
    return KnowledgeService(repo), repo


def test_create_domain_trims_name_and_description():
    service, _repo = make_service()

    domain = service.create_domain("  Pharos  ", "  Ops hub facts  ")

    assert domain["name"] == "Pharos"
    assert domain["description"] == "Ops hub facts"


def test_create_domain_requires_name():
    service, _repo = make_service()

    with pytest.raises(ValidationError, match="Domain name is required"):
        service.create_domain("   ", "")


def test_duplicate_domain_raises_validation_error():
    service, _repo = make_service()
    service.create_domain("Pharos", "")

    with pytest.raises(ValidationError, match="already exists"):
        service.create_domain("Pharos", "")


def test_create_entry_requires_domain_type_title_and_details():
    service, _repo = make_service()

    with pytest.raises(ValidationError, match="Domain is required"):
        service.create_entry({"entry_type": "Decision", "title": "T", "details": "D"})

    with pytest.raises(ValidationError, match="Entry type is required"):
        service.create_entry({"domain_id": 1, "title": "T", "details": "D"})

    with pytest.raises(ValidationError, match="Title is required"):
        service.create_entry({"domain_id": 1, "entry_type": "Decision", "details": "D"})

    with pytest.raises(ValidationError, match="Details are required"):
        service.create_entry({"domain_id": 1, "entry_type": "Decision", "title": "T"})


def test_create_entry_rejects_unknown_type_and_status():
    service, _repo = make_service()
    service.create_domain("Migration", "")

    with pytest.raises(ValidationError, match="Invalid entry type"):
        service.create_entry(
            {"domain_id": 1, "entry_type": "Random", "title": "T", "details": "D"}
        )

    with pytest.raises(ValidationError, match="Invalid status"):
        service.create_entry(
            {
                "domain_id": 1,
                "entry_type": "Decision",
                "status": "Done",
                "title": "T",
                "details": "D",
            }
        )


def test_create_entry_rejects_archived_domain():
    service, _repo = make_service()
    service.create_domain("Migration", "")
    service.archive_domain(1)

    with pytest.raises(ValidationError, match="Cannot create entries in archived domain"):
        service.create_entry(
            {"domain_id": 1, "entry_type": "Decision", "title": "T", "details": "D"}
        )


def test_create_entry_defaults_status_to_active_and_normalizes_tags():
    service, _repo = make_service()
    service.create_domain("Migration", "")

    entry = service.create_entry(
        {
            "domain_id": 1,
            "entry_type": "Decision",
            "title": "  Checkout owner  ",
            "details": "  Migration owns it.  ",
            "source": " meeting ",
            "tags": [" checkout ", "migration", ""],
        }
    )

    assert entry["status"] == "Active"
    assert entry["title"] == "Checkout owner"
    assert entry["details"] == "Migration owns it."
    assert entry["source"] == "meeting"
    assert entry["tags"] == "checkout,migration"
```

- [ ] **Step 2: Run service tests to verify failure**

Run:

```bash
python -m pytest tests/test_knowledge_service.py -v
```

Expected: fails because `services.knowledge_service` does not exist.

- [ ] **Step 3: Add enums**

Modify `enums.py`:

```python
class KnowledgeEntryType(str, Enum):
    REQUIREMENT = "Requirement"
    RULE = "Rule"
    DECISION = "Decision"
    KNOWN_ISSUE = "Known Issue"
    PROCESS = "Process"
    ENVIRONMENT_FACT = "Environment Fact"
    OPEN_QUESTION = "Open Question"
    EVIDENCE = "Evidence"


class KnowledgeStatus(str, Enum):
    DRAFT = "Draft"
    ACTIVE = "Active"
    SUPERSEDED = "Superseded"
    ARCHIVED = "Archived"
```

- [ ] **Step 4: Implement service**

Create `services/knowledge_service.py`:

```python
"""Business rules for the Pharos Knowledge Ledger."""

from __future__ import annotations

from typing import Any

from data_access.knowledge_repository import KnowledgeRepository
from enums import KnowledgeEntryType, KnowledgeStatus
from exceptions import ValidationError


class KnowledgeService:
    """Validates and orchestrates knowledge domains and entries."""

    def __init__(self, repository: KnowledgeRepository) -> None:
        self._repo = repository

    def list_domains(self, include_archived: bool = False) -> list[dict]:
        return self._repo.list_domains(include_archived=include_archived)

    def create_domain(self, name: str, description: str = "") -> dict:
        clean_name = self._required_text(name, "Domain name is required")
        clean_description = self._text(description)
        domain_id = self._repo.create_domain(clean_name, clean_description)
        if domain_id is None:
            raise ValidationError(f"Domain '{clean_name}' already exists")
        return self._repo.get_domain(domain_id)

    def update_domain(self, domain_id: int, name: str, description: str = "") -> dict:
        clean_name = self._required_text(name, "Domain name is required")
        clean_description = self._text(description)
        updated = self._repo.update_domain(domain_id, clean_name, clean_description)
        if not updated:
            raise ValidationError(f"Domain {domain_id} was not found or name already exists")
        return self._repo.get_domain(domain_id)

    def archive_domain(self, domain_id: int) -> dict:
        archived = self._repo.archive_domain(domain_id)
        if not archived:
            raise ValidationError(f"Domain {domain_id} was not found or already archived")
        return self._repo.get_domain(domain_id)

    def search_entries(
        self,
        query: str = "",
        domain_id: int | None = None,
        entry_type: str | None = None,
        status: str | None = None,
        tag: str | None = None,
        include_archived: bool = False,
    ) -> list[dict]:
        if entry_type:
            self._validate_entry_type(entry_type)
        if status:
            self._validate_status(status)
        return self._repo.search_entries(
            query=self._text(query),
            domain_id=domain_id,
            entry_type=entry_type,
            status=status,
            tag=self._text(tag),
            include_archived=include_archived,
        )

    def get_entry(self, entry_id: int) -> dict:
        entry = self._repo.get_entry(entry_id)
        if entry is None:
            raise ValidationError(f"Entry {entry_id} was not found")
        return entry

    def create_entry(self, data: dict[str, Any]) -> dict:
        payload = self._normalize_entry_payload(data)
        domain = self._repo.get_domain(payload["domain_id"])
        if domain is None:
            raise ValidationError(f"Domain {payload['domain_id']} was not found")
        if domain.get("archived_at") is not None:
            raise ValidationError("Cannot create entries in archived domain")
        entry_id = self._repo.create_entry(payload)
        return self.get_entry(entry_id)

    def update_entry(self, entry_id: int, data: dict[str, Any]) -> dict:
        payload = self._normalize_entry_payload(data)
        domain = self._repo.get_domain(payload["domain_id"])
        if domain is None:
            raise ValidationError(f"Domain {payload['domain_id']} was not found")
        updated = self._repo.update_entry(entry_id, payload)
        if not updated:
            raise ValidationError(f"Entry {entry_id} was not found")
        return self.get_entry(entry_id)

    def archive_entry(self, entry_id: int) -> dict:
        archived = self._repo.archive_entry(entry_id)
        if not archived:
            raise ValidationError(f"Entry {entry_id} was not found")
        return self.get_entry(entry_id)

    def _normalize_entry_payload(self, data: dict[str, Any]) -> dict[str, Any]:
        domain_id = data.get("domain_id")
        if domain_id is None:
            raise ValidationError("Domain is required")
        entry_type = self._required_text(data.get("entry_type"), "Entry type is required")
        status = self._text(data.get("status")) or KnowledgeStatus.ACTIVE.value
        self._validate_entry_type(entry_type)
        self._validate_status(status)
        return {
            "domain_id": int(domain_id),
            "entry_type": entry_type,
            "status": status,
            "title": self._required_text(data.get("title"), "Title is required"),
            "details": self._required_text(data.get("details"), "Details are required"),
            "source": self._text(data.get("source")),
            "tags": self._normalize_tags(data.get("tags")),
        }

    def _validate_entry_type(self, value: str) -> None:
        allowed = {item.value for item in KnowledgeEntryType}
        if value not in allowed:
            raise ValidationError(f"Invalid entry type '{value}'")

    def _validate_status(self, value: str) -> None:
        allowed = {item.value for item in KnowledgeStatus}
        if value not in allowed:
            raise ValidationError(f"Invalid status '{value}'")

    @staticmethod
    def _text(value: Any) -> str:
        return str(value or "").strip()

    @classmethod
    def _required_text(cls, value: Any, message: str) -> str:
        text = cls._text(value)
        if not text:
            raise ValidationError(message)
        return text

    @staticmethod
    def _normalize_tags(value: Any) -> str:
        if isinstance(value, list):
            parts = [str(item).strip() for item in value]
        else:
            parts = str(value or "").split(",")
        return ",".join(part for part in parts if part)
```

- [ ] **Step 5: Export service**

Modify `services/__init__.py`:

```python
from services.knowledge_service import KnowledgeService
```

Add `"KnowledgeService"` to `__all__` if the file uses `__all__`.

- [ ] **Step 6: Run service tests**

Run:

```bash
python -m pytest tests/test_knowledge_service.py -v
```

Expected: all tests pass.

- [ ] **Step 7: Commit service slice**

Run:

```bash
git add enums.py services/__init__.py services/knowledge_service.py tests/test_knowledge_service.py
git commit -m "Add knowledge service validation"
```

---

### Task 3: Backend API And App Wiring

**Files:**
- Create: `routes/knowledge_api.py`
- Modify: `routes/__init__.py`
- Modify: `app.py`
- Create: `tests/test_knowledge_api.py`

- [ ] **Step 1: Write failing API smoke tests**

Create `tests/test_knowledge_api.py`:

```python
from app import create_app


def test_knowledge_domain_and_entry_flow(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()

    domain_response = client.post(
        "/api/knowledge/domains",
        json={"name": "Adobe Commerce Migration", "description": "Migration facts"},
    )
    assert domain_response.status_code == 201
    domain = domain_response.get_json()
    assert domain["name"] == "Adobe Commerce Migration"

    entry_response = client.post(
        "/api/knowledge/entries",
        json={
            "domain_id": domain["id"],
            "entry_type": "Decision",
            "title": "Checkout owner",
            "details": "Migration owns checkout requirements.",
            "source": "meeting notes",
            "tags": ["checkout", "requirements"],
        },
    )
    assert entry_response.status_code == 201
    entry = entry_response.get_json()
    assert entry["status"] == "Active"

    search_response = client.get("/api/knowledge/entries?query=checkout")
    assert search_response.status_code == 200
    rows = search_response.get_json()
    assert [row["id"] for row in rows] == [entry["id"]]

    archive_response = client.post(f"/api/knowledge/entries/{entry['id']}/archive")
    assert archive_response.status_code == 200
    assert archive_response.get_json()["status"] == "Archived"


def test_knowledge_api_returns_validation_error(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()

    response = client.post("/api/knowledge/domains", json={"name": "   "})

    assert response.status_code == 400
    assert response.get_json() == {"success": False, "error": "Domain name is required"}
```

- [ ] **Step 2: Run API tests to verify failure**

Run:

```bash
python -m pytest tests/test_knowledge_api.py -v
```

Expected: fails with 404 for `/api/knowledge/domains`.

- [ ] **Step 3: Implement blueprint**

Create `routes/knowledge_api.py`:

```python
"""Knowledge Ledger API routes."""

from __future__ import annotations

from flask import Blueprint, jsonify, request

from services.knowledge_service import KnowledgeService


def create_knowledge_blueprint(knowledge_service: KnowledgeService) -> Blueprint:
    bp = Blueprint("knowledge_api", __name__, url_prefix="/api/knowledge")

    @bp.get("/domains")
    def list_domains():
        include_archived = request.args.get("include_archived") == "true"
        return jsonify(knowledge_service.list_domains(include_archived=include_archived))

    @bp.post("/domains")
    def create_domain():
        payload = request.get_json(silent=True) or {}
        domain = knowledge_service.create_domain(
            payload.get("name", ""),
            payload.get("description", ""),
        )
        return jsonify(domain), 201

    @bp.put("/domains/<int:domain_id>")
    def update_domain(domain_id: int):
        payload = request.get_json(silent=True) or {}
        domain = knowledge_service.update_domain(
            domain_id,
            payload.get("name", ""),
            payload.get("description", ""),
        )
        return jsonify(domain)

    @bp.post("/domains/<int:domain_id>/archive")
    def archive_domain(domain_id: int):
        return jsonify(knowledge_service.archive_domain(domain_id))

    @bp.get("/entries")
    def search_entries():
        domain_arg = request.args.get("domain_id")
        domain_id = int(domain_arg) if domain_arg else None
        entries = knowledge_service.search_entries(
            query=request.args.get("query", ""),
            domain_id=domain_id,
            entry_type=request.args.get("entry_type") or None,
            status=request.args.get("status") or None,
            tag=request.args.get("tag") or None,
            include_archived=request.args.get("include_archived") == "true",
        )
        return jsonify(entries)

    @bp.post("/entries")
    def create_entry():
        payload = request.get_json(silent=True) or {}
        return jsonify(knowledge_service.create_entry(payload)), 201

    @bp.get("/entries/<int:entry_id>")
    def get_entry(entry_id: int):
        return jsonify(knowledge_service.get_entry(entry_id))

    @bp.put("/entries/<int:entry_id>")
    def update_entry(entry_id: int):
        payload = request.get_json(silent=True) or {}
        return jsonify(knowledge_service.update_entry(entry_id, payload))

    @bp.post("/entries/<int:entry_id>/archive")
    def archive_entry(entry_id: int):
        return jsonify(knowledge_service.archive_entry(entry_id))

    return bp
```

- [ ] **Step 4: Wire app dependencies**

Modify imports in `app.py`:

```python
    KnowledgeRepository,
```

Add service import:

```python
from services.knowledge_service import KnowledgeService
```

Instantiate after other repositories:

```python
    knowledge_repo = KnowledgeRepository(conn_mgr)
```

Instantiate after service setup:

```python
    knowledge_service = KnowledgeService(knowledge_repo)
```

Pass to `register_blueprints(...)`:

```python
        knowledge_service=knowledge_service,
```

- [ ] **Step 5: Register blueprint**

Modify `routes/__init__.py` imports:

```python
from routes.knowledge_api import create_knowledge_blueprint
from services.knowledge_service import KnowledgeService
```

Add parameter to `register_blueprints(...)`:

```python
    knowledge_service: "KnowledgeService | None" = None,
```

Register near other first-party APIs:

```python
    if knowledge_service is not None:
        app.register_blueprint(create_knowledge_blueprint(knowledge_service))
```

- [ ] **Step 6: Run API tests**

Run:

```bash
python -m pytest tests/test_knowledge_api.py -v
```

Expected: all tests pass.

- [ ] **Step 7: Run backend focused suite**

Run:

```bash
python -m pytest tests/test_knowledge_repository.py tests/test_knowledge_service.py tests/test_knowledge_api.py -v
```

Expected: all tests pass.

- [ ] **Step 8: Commit API slice**

Run:

```bash
git add app.py routes/__init__.py routes/knowledge_api.py tests/test_knowledge_api.py
git commit -m "Add knowledge API"
```

---

### Task 4: Frontend Types And API Client

**Files:**
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Add TypeScript types**

In `frontend/src/types/index.ts`, add:

```typescript
export type KnowledgeEntryType =
  | "Requirement"
  | "Rule"
  | "Decision"
  | "Known Issue"
  | "Process"
  | "Environment Fact"
  | "Open Question"
  | "Evidence"

export type KnowledgeStatus = "Draft" | "Active" | "Superseded" | "Archived"

export interface KnowledgeDomain {
  id: number
  name: string
  description: string
  created_at: string
  updated_at: string
  archived_at: string | null
}

export interface KnowledgeEntry {
  id: number
  domain_id: number
  domain_name: string
  entry_type: KnowledgeEntryType
  status: KnowledgeStatus
  title: string
  details: string
  source: string
  tags: string
  created_at: string
  updated_at: string
}

export interface KnowledgeDomainPayload {
  name: string
  description?: string
}

export interface KnowledgeEntryPayload {
  domain_id: number
  entry_type: KnowledgeEntryType
  status?: KnowledgeStatus
  title: string
  details: string
  source?: string
  tags?: string[]
}

export interface KnowledgeEntrySearchParams {
  query?: string
  domain_id?: number
  entry_type?: KnowledgeEntryType
  status?: KnowledgeStatus
  tag?: string
  include_archived?: boolean
}

export const KNOWLEDGE_ENTRY_TYPES: KnowledgeEntryType[] = [
  "Requirement",
  "Rule",
  "Decision",
  "Known Issue",
  "Process",
  "Environment Fact",
  "Open Question",
  "Evidence",
]

export const KNOWLEDGE_STATUSES: KnowledgeStatus[] = [
  "Draft",
  "Active",
  "Superseded",
  "Archived",
]
```

- [ ] **Step 2: Add API imports**

In `frontend/src/services/api.ts`, extend the type import with:

```typescript
  KnowledgeDomain,
  KnowledgeDomainPayload,
  KnowledgeEntry,
  KnowledgeEntryPayload,
  KnowledgeEntrySearchParams,
```

- [ ] **Step 3: Add API methods**

Inside the `ApiService` class in `frontend/src/services/api.ts`, add:

```typescript
  // ---------- Knowledge ----------

  async getKnowledgeDomains(includeArchived = false): Promise<KnowledgeDomain[]> {
    const params = new URLSearchParams()
    if (includeArchived) params.set("include_archived", "true")
    const query = params.toString()
    return this.request<KnowledgeDomain[]>(`/api/knowledge/domains${query ? `?${query}` : ""}`)
  }

  async createKnowledgeDomain(data: KnowledgeDomainPayload): Promise<KnowledgeDomain> {
    return this.request<KnowledgeDomain>("/api/knowledge/domains", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateKnowledgeDomain(domainId: number, data: KnowledgeDomainPayload): Promise<KnowledgeDomain> {
    return this.request<KnowledgeDomain>(`/api/knowledge/domains/${domainId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  async archiveKnowledgeDomain(domainId: number): Promise<KnowledgeDomain> {
    return this.request<KnowledgeDomain>(`/api/knowledge/domains/${domainId}/archive`, {
      method: "POST",
    })
  }

  async searchKnowledgeEntries(params: KnowledgeEntrySearchParams = {}): Promise<KnowledgeEntry[]> {
    const search = new URLSearchParams()
    if (params.query) search.set("query", params.query)
    if (params.domain_id) search.set("domain_id", String(params.domain_id))
    if (params.entry_type) search.set("entry_type", params.entry_type)
    if (params.status) search.set("status", params.status)
    if (params.tag) search.set("tag", params.tag)
    if (params.include_archived) search.set("include_archived", "true")
    const query = search.toString()
    return this.request<KnowledgeEntry[]>(`/api/knowledge/entries${query ? `?${query}` : ""}`)
  }

  async createKnowledgeEntry(data: KnowledgeEntryPayload): Promise<KnowledgeEntry> {
    return this.request<KnowledgeEntry>("/api/knowledge/entries", {
      method: "POST",
      body: JSON.stringify(data),
    })
  }

  async updateKnowledgeEntry(entryId: number, data: KnowledgeEntryPayload): Promise<KnowledgeEntry> {
    return this.request<KnowledgeEntry>(`/api/knowledge/entries/${entryId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  }

  async archiveKnowledgeEntry(entryId: number): Promise<KnowledgeEntry> {
    return this.request<KnowledgeEntry>(`/api/knowledge/entries/${entryId}/archive`, {
      method: "POST",
    })
  }
```

- [ ] **Step 4: Run frontend typecheck**

Run:

```bash
cd frontend && npm run typecheck
```

Expected: typecheck passes.

- [ ] **Step 5: Commit frontend API slice**

Run:

```bash
git add frontend/src/types/index.ts frontend/src/services/api.ts
git commit -m "Add knowledge frontend API types"
```

---

### Task 5: Frontend Knowledge Page

**Files:**
- Create: `frontend/src/pages/Knowledge.tsx`
- Create: `frontend/src/components/knowledge/DomainRail.tsx`
- Create: `frontend/src/components/knowledge/KnowledgeFilters.tsx`
- Create: `frontend/src/components/knowledge/KnowledgeEntryList.tsx`
- Create: `frontend/src/components/knowledge/KnowledgeEntryEditor.tsx`

- [ ] **Step 1: Create domain rail component**

Create `frontend/src/components/knowledge/DomainRail.tsx`:

```tsx
import { Plus, Archive } from "lucide-react"
import type { KnowledgeDomain } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

interface DomainRailProps {
  domains: KnowledgeDomain[]
  selectedDomainId: number | null
  newDomainName: string
  newDomainDescription: string
  includeArchivedDomains: boolean
  savingDomain: boolean
  onSelectDomain: (domainId: number | null) => void
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onCreateDomain: () => void
  onToggleArchivedDomains: (value: boolean) => void
}

export function DomainRail({
  domains,
  selectedDomainId,
  newDomainName,
  newDomainDescription,
  includeArchivedDomains,
  savingDomain,
  onSelectDomain,
  onNameChange,
  onDescriptionChange,
  onCreateDomain,
  onToggleArchivedDomains,
}: DomainRailProps) {
  return (
    <aside className="w-full border-r border-border bg-card/40 p-4 lg:w-72">
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Domains</h2>
          <p className="text-xs text-muted-foreground">Primary ownership for knowledge entries.</p>
        </div>
        <Button
          type="button"
          variant={selectedDomainId === null ? "secondary" : "ghost"}
          className="w-full justify-start"
          onClick={() => onSelectDomain(null)}
        >
          All Domains
        </Button>
        <div className="space-y-1">
          {domains.map((domain) => (
            <Button
              key={domain.id}
              type="button"
              variant={selectedDomainId === domain.id ? "secondary" : "ghost"}
              className="h-auto w-full justify-start px-3 py-2 text-left"
              onClick={() => onSelectDomain(domain.id)}
            >
              <span className="min-w-0 flex-1 truncate">{domain.name}</span>
              {domain.archived_at && <Archive className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
            </Button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={includeArchivedDomains}
            onChange={(event) => onToggleArchivedDomains(event.target.checked)}
          />
          Show archived domains
        </label>
      </div>
      <div className="mt-6 space-y-2">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">Add Domain</h3>
        <Input
          value={newDomainName}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Domain name"
        />
        <Textarea
          value={newDomainDescription}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder="Short description"
          rows={3}
        />
        <Button type="button" className="w-full" onClick={onCreateDomain} disabled={savingDomain}>
          <Plus className="h-4 w-4" />
          Add Domain
        </Button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Create filters component**

Create `frontend/src/components/knowledge/KnowledgeFilters.tsx`:

```tsx
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { KnowledgeEntryType, KnowledgeStatus } from "@/types"
import { KNOWLEDGE_ENTRY_TYPES, KNOWLEDGE_STATUSES } from "@/types"

interface KnowledgeFiltersProps {
  query: string
  entryType: KnowledgeEntryType | "all"
  status: KnowledgeStatus | "all"
  tag: string
  includeArchived: boolean
  onQueryChange: (value: string) => void
  onEntryTypeChange: (value: KnowledgeEntryType | "all") => void
  onStatusChange: (value: KnowledgeStatus | "all") => void
  onTagChange: (value: string) => void
  onIncludeArchivedChange: (value: boolean) => void
}

export function KnowledgeFilters({
  query,
  entryType,
  status,
  tag,
  includeArchived,
  onQueryChange,
  onEntryTypeChange,
  onStatusChange,
  onTagChange,
  onIncludeArchivedChange,
}: KnowledgeFiltersProps) {
  return (
    <div className="grid gap-3 border-b border-border bg-background/80 p-4 md:grid-cols-[minmax(220px,1fr)_180px_160px_160px_auto]">
      <label className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search title, details, source, tags"
          className="pl-9"
        />
      </label>
      <Select value={entryType} onValueChange={(value) => onEntryTypeChange(value as KnowledgeEntryType | "all")}>
        <SelectTrigger>
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {KNOWLEDGE_ENTRY_TYPES.map((type) => (
            <SelectItem key={type} value={type}>
              {type}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={status} onValueChange={(value) => onStatusChange(value as KnowledgeStatus | "all")}>
        <SelectTrigger>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {KNOWLEDGE_STATUSES.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input value={tag} onChange={(event) => onTagChange(event.target.value)} placeholder="Tag" />
      <label className="flex items-center gap-2 whitespace-nowrap text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(event) => onIncludeArchivedChange(event.target.checked)}
        />
        Archived
      </label>
    </div>
  )
}
```

- [ ] **Step 3: Create entry list component**

Create `frontend/src/components/knowledge/KnowledgeEntryList.tsx`:

```tsx
import { Archive, Clock } from "lucide-react"
import type { KnowledgeEntry } from "@/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface KnowledgeEntryListProps {
  entries: KnowledgeEntry[]
  selectedEntryId: number | null
  loading: boolean
  onSelectEntry: (entry: KnowledgeEntry) => void
}

export function KnowledgeEntryList({ entries, selectedEntryId, loading, onSelectEntry }: KnowledgeEntryListProps) {
  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading knowledge entries...</div>
  }

  if (entries.length === 0) {
    return <div className="p-6 text-sm text-muted-foreground">No matching entries.</div>
  }

  return (
    <div className="divide-y divide-border">
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          onClick={() => onSelectEntry(entry)}
          data-active={selectedEntryId === entry.id}
          className="block w-full px-5 py-4 text-left transition hover:bg-muted/50 data-[active=true]:bg-muted"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{entry.title}</h3>
            <Badge variant="secondary">{entry.entry_type}</Badge>
            <Badge variant={entry.status === "Archived" ? "outline" : "default"}>{entry.status}</Badge>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{entry.details}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span>{entry.domain_name}</span>
            {entry.source && <span>{entry.source}</span>}
            {entry.status === "Archived" && <Archive className="h-3.5 w-3.5" />}
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {new Date(entry.updated_at).toLocaleString()}
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create entry editor component**

Create `frontend/src/components/knowledge/KnowledgeEntryEditor.tsx`:

```tsx
import { Archive, Save, X } from "lucide-react"
import type { KnowledgeDomain, KnowledgeEntry, KnowledgeEntryPayload, KnowledgeEntryType, KnowledgeStatus } from "@/types"
import { KNOWLEDGE_ENTRY_TYPES, KNOWLEDGE_STATUSES } from "@/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export type KnowledgeEntryDraft = {
  domain_id: number | null
  entry_type: KnowledgeEntryType
  status: KnowledgeStatus
  title: string
  details: string
  source: string
  tags: string
}

interface KnowledgeEntryEditorProps {
  domains: KnowledgeDomain[]
  entry: KnowledgeEntry | null
  draft: KnowledgeEntryDraft
  saving: boolean
  onDraftChange: (draft: KnowledgeEntryDraft) => void
  onSave: (payload: KnowledgeEntryPayload) => void
  onArchive: () => void
  onClose: () => void
}

export function KnowledgeEntryEditor({
  domains,
  entry,
  draft,
  saving,
  onDraftChange,
  onSave,
  onArchive,
  onClose,
}: KnowledgeEntryEditorProps) {
  const setDraft = (patch: Partial<KnowledgeEntryDraft>) => onDraftChange({ ...draft, ...patch })
  const canSave = draft.domain_id !== null && draft.title.trim() && draft.details.trim()

  return (
    <aside className="w-full border-l border-border bg-card/60 p-4 xl:w-[420px]">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{entry ? "Edit Entry" : "New Entry"}</h2>
          <p className="text-xs text-muted-foreground">Controlled project memory, saved with timestamps.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close editor">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="space-y-3">
        <Select
          value={draft.domain_id === null ? "" : String(draft.domain_id)}
          onValueChange={(value) => setDraft({ domain_id: Number(value) })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Domain" />
          </SelectTrigger>
          <SelectContent>
            {domains
              .filter((domain) => !domain.archived_at)
              .map((domain) => (
                <SelectItem key={domain.id} value={String(domain.id)}>
                  {domain.name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <Select
          value={draft.entry_type}
          onValueChange={(value) => setDraft({ entry_type: value as KnowledgeEntryType })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {KNOWLEDGE_ENTRY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={draft.status} onValueChange={(value) => setDraft({ status: value as KnowledgeStatus })}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {KNOWLEDGE_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input value={draft.title} onChange={(event) => setDraft({ title: event.target.value })} placeholder="Title" />
        <Textarea
          value={draft.details}
          onChange={(event) => setDraft({ details: event.target.value })}
          placeholder="Details"
          rows={10}
        />
        <Input value={draft.source} onChange={(event) => setDraft({ source: event.target.value })} placeholder="Source" />
        <Input
          value={draft.tags}
          onChange={(event) => setDraft({ tags: event.target.value })}
          placeholder="Tags, comma separated"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!canSave || saving}
            onClick={() =>
              draft.domain_id !== null &&
              onSave({
                domain_id: draft.domain_id,
                entry_type: draft.entry_type,
                status: draft.status,
                title: draft.title,
                details: draft.details,
                source: draft.source,
                tags: draft.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
              })
            }
          >
            <Save className="h-4 w-4" />
            Save
          </Button>
          {entry && entry.status !== "Archived" && (
            <Button type="button" variant="outline" disabled={saving} onClick={onArchive}>
              <Archive className="h-4 w-4" />
              Archive
            </Button>
          )}
        </div>
      </div>
    </aside>
  )
}
```

- [ ] **Step 5: Create Knowledge page**

Create `frontend/src/pages/Knowledge.tsx`:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { api } from "@/services/api"
import type {
  KnowledgeDomain,
  KnowledgeEntry,
  KnowledgeEntryPayload,
  KnowledgeEntryType,
  KnowledgeStatus,
} from "@/types"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/layout/PageHeader"
import { DomainRail } from "@/components/knowledge/DomainRail"
import { KnowledgeFilters } from "@/components/knowledge/KnowledgeFilters"
import { KnowledgeEntryList } from "@/components/knowledge/KnowledgeEntryList"
import { KnowledgeEntryDraft, KnowledgeEntryEditor } from "@/components/knowledge/KnowledgeEntryEditor"
import { toast } from "sonner"

const EMPTY_DRAFT: KnowledgeEntryDraft = {
  domain_id: null,
  entry_type: "Decision",
  status: "Active",
  title: "",
  details: "",
  source: "",
  tags: "",
}

export function Knowledge() {
  const [domains, setDomains] = useState<KnowledgeDomain[]>([])
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null)
  const [draft, setDraft] = useState<KnowledgeEntryDraft>(EMPTY_DRAFT)
  const [query, setQuery] = useState("")
  const [entryType, setEntryType] = useState<KnowledgeEntryType | "all">("all")
  const [status, setStatus] = useState<KnowledgeStatus | "all">("all")
  const [tag, setTag] = useState("")
  const [includeArchived, setIncludeArchived] = useState(false)
  const [includeArchivedDomains, setIncludeArchivedDomains] = useState(false)
  const [newDomainName, setNewDomainName] = useState("")
  const [newDomainDescription, setNewDomainDescription] = useState("")
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [savingEntry, setSavingEntry] = useState(false)
  const [savingDomain, setSavingDomain] = useState(false)

  const activeDomains = useMemo(() => domains.filter((domain) => !domain.archived_at), [domains])

  const loadDomains = useCallback(async () => {
    const data = await api.getKnowledgeDomains(includeArchivedDomains)
    setDomains(data)
  }, [includeArchivedDomains])

  const loadEntries = useCallback(async () => {
    setLoadingEntries(true)
    try {
      const data = await api.searchKnowledgeEntries({
        query,
        domain_id: selectedDomainId ?? undefined,
        entry_type: entryType === "all" ? undefined : entryType,
        status: status === "all" ? undefined : status,
        tag,
        include_archived: includeArchived,
      })
      setEntries(data)
    } finally {
      setLoadingEntries(false)
    }
  }, [entryType, includeArchived, query, selectedDomainId, status, tag])

  useEffect(() => {
    loadDomains().catch((error) => toast.error(error.message || "Failed to load domains"))
  }, [loadDomains])

  useEffect(() => {
    loadEntries().catch((error) => toast.error(error.message || "Failed to load entries"))
  }, [loadEntries])

  const startNewEntry = () => {
    setSelectedEntry(null)
    setDraft({
      ...EMPTY_DRAFT,
      domain_id: selectedDomainId ?? activeDomains[0]?.id ?? null,
    })
  }

  const openEntry = (entry: KnowledgeEntry) => {
    setSelectedEntry(entry)
    setDraft({
      domain_id: entry.domain_id,
      entry_type: entry.entry_type,
      status: entry.status,
      title: entry.title,
      details: entry.details,
      source: entry.source,
      tags: entry.tags,
    })
  }

  const createDomain = async () => {
    setSavingDomain(true)
    try {
      const domain = await api.createKnowledgeDomain({ name: newDomainName, description: newDomainDescription })
      setNewDomainName("")
      setNewDomainDescription("")
      setSelectedDomainId(domain.id)
      await loadDomains()
      toast.success("Domain added")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add domain")
    } finally {
      setSavingDomain(false)
    }
  }

  const saveEntry = async (payload: KnowledgeEntryPayload) => {
    setSavingEntry(true)
    try {
      const saved = selectedEntry
        ? await api.updateKnowledgeEntry(selectedEntry.id, payload)
        : await api.createKnowledgeEntry(payload)
      setSelectedEntry(saved)
      await loadEntries()
      toast.success("Entry saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save entry")
    } finally {
      setSavingEntry(false)
    }
  }

  const archiveEntry = async () => {
    if (!selectedEntry) return
    setSavingEntry(true)
    try {
      const archived = await api.archiveKnowledgeEntry(selectedEntry.id)
      setSelectedEntry(archived)
      await loadEntries()
      toast.success("Entry archived")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to archive entry")
    } finally {
      setSavingEntry(false)
    }
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Knowledge"
        description="Controlled project memory with domains, dated entries, lifecycle status, and precise retrieval."
        actions={
          <Button type="button" onClick={startNewEntry} disabled={activeDomains.length === 0}>
            <Plus className="h-4 w-4" />
            Entry
          </Button>
        }
      />
      <div className="flex min-h-[calc(100vh-104px)] flex-col border-t border-border lg:flex-row">
        <DomainRail
          domains={domains}
          selectedDomainId={selectedDomainId}
          newDomainName={newDomainName}
          newDomainDescription={newDomainDescription}
          includeArchivedDomains={includeArchivedDomains}
          savingDomain={savingDomain}
          onSelectDomain={setSelectedDomainId}
          onNameChange={setNewDomainName}
          onDescriptionChange={setNewDomainDescription}
          onCreateDomain={createDomain}
          onToggleArchivedDomains={setIncludeArchivedDomains}
        />
        <section className="min-w-0 flex-1">
          <KnowledgeFilters
            query={query}
            entryType={entryType}
            status={status}
            tag={tag}
            includeArchived={includeArchived}
            onQueryChange={setQuery}
            onEntryTypeChange={setEntryType}
            onStatusChange={setStatus}
            onTagChange={setTag}
            onIncludeArchivedChange={setIncludeArchived}
          />
          <KnowledgeEntryList
            entries={entries}
            selectedEntryId={selectedEntry?.id ?? null}
            loading={loadingEntries}
            onSelectEntry={openEntry}
          />
        </section>
        {(selectedEntry || draft !== EMPTY_DRAFT) && (
          <KnowledgeEntryEditor
            domains={domains}
            entry={selectedEntry}
            draft={draft}
            saving={savingEntry}
            onDraftChange={setDraft}
            onSave={saveEntry}
            onArchive={archiveEntry}
            onClose={() => {
              setSelectedEntry(null)
              setDraft(EMPTY_DRAFT)
            }}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Run frontend typecheck**

Run:

```bash
cd frontend && npm run typecheck
```

Expected: typecheck passes. If it fails because `toast` import shape differs, inspect existing pages using `sonner` and match that import exactly.

- [ ] **Step 7: Commit page slice**

Run:

```bash
git add frontend/src/pages/Knowledge.tsx frontend/src/components/knowledge
git commit -m "Add knowledge page components"
```

---

### Task 6: Frontend Route And Navigation

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/AppSidebar.tsx`

- [ ] **Step 1: Add route**

Modify `frontend/src/App.tsx`.

Add lazy import near other pages:

```tsx
const Knowledge = lazyWithReload(() => import("@/pages/Knowledge").then((module) => ({ default: module.Knowledge })))
```

Add route inside `AppLayout` routes:

```tsx
<Route path="knowledge" element={<Knowledge />} />
```

- [ ] **Step 2: Add sidebar nav**

Modify `frontend/src/components/layout/AppSidebar.tsx`.

Add icon import:

```tsx
BookOpen,
```

Add to the `MIGRATION` section after `Requirement Questions`:

```tsx
{ label: "Knowledge", href: "/knowledge", icon: BookOpen },
```

- [ ] **Step 3: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: Vite build succeeds.

- [ ] **Step 4: Commit navigation slice**

Run:

```bash
git add frontend/src/App.tsx frontend/src/components/layout/AppSidebar.tsx
git commit -m "Add knowledge route"
```

---

### Task 7: Verification

**Files:**
- No new files.

- [ ] **Step 1: Run backend knowledge tests**

Run:

```bash
python -m pytest tests/test_knowledge_repository.py tests/test_knowledge_service.py tests/test_knowledge_api.py -v
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend tests**

Run:

```bash
cd frontend && npm run test
```

Expected: Vitest passes.

- [ ] **Step 3: Run frontend typecheck**

Run:

```bash
cd frontend && npm run typecheck
```

Expected: TypeScript passes.

- [ ] **Step 4: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: Vite build succeeds.

- [ ] **Step 5: Run app locally**

Run:

```bash
python app.py
```

Expected: Flask starts without schema or blueprint import errors.

- [ ] **Step 6: Manual browser smoke test**

Open:

```text
http://localhost:5000/knowledge
```

Expected:

- Knowledge nav item appears.
- New domain can be added.
- New entry can be saved with domain, type, title, details.
- Entry appears in list.
- Search finds the entry by title/details.
- Type/status/tag filters narrow results.
- Archive hides entry by default.
- Archived toggle shows archived entry.

- [ ] **Step 7: Final commit if verification fixes were needed**

If verification required fixes after prior commits, commit those fixes:

```bash
git add app.py routes data_access services enums.py tests frontend/src
git commit -m "Fix knowledge ledger verification issues"
```

---

## Self-Review

Spec coverage:

- Multiple domains and add-domain UI: Tasks 1, 2, 3, 5.
- Manual-only entry creation: Tasks 2, 3, 5.
- Fixed global entry types: Tasks 2, 4, 5.
- One primary domain per entry: Tasks 1, 2, 5.
- Editable in-place entries: Tasks 1, 2, 3, 5.
- Lifecycle statuses: Tasks 2, 4, 5.
- Search/filter/default archived behavior: Tasks 1, 3, 5.
- No user permissions: no auth or role tasks included.
- No document upload or AI Q&A: no upload or AI tasks included.

Red-flag scan:

- No unfinished markers or open-ended edge-case steps.

Type consistency:

- Backend uses `domain_id`, `entry_type`, `status`, `title`, `details`, `source`, `tags`.
- Frontend payloads match backend JSON field names.
- API endpoint paths match the approved design.
