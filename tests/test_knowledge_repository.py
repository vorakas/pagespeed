import sqlite3
from pathlib import Path

from data_access.connection import ConnectionManager
from data_access.knowledge_repository import KnowledgeRepository


def make_repo(tmp_path: Path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    cm = ConnectionManager(db_url=None)
    cm.init_schema()
    return KnowledgeRepository(cm)


class RecordingCursor:
    def __init__(self):
        self.sql = ""
        self.params = []

    def execute(self, sql, params=None):
        self.sql = sql
        self.params = list(params or [])

    def fetchall(self):
        return []


class RecordingConnection:
    def __init__(self):
        self.cursor_instance = RecordingCursor()

    def cursor(self):
        return self.cursor_instance


class RecordingConnectionContext:
    def __init__(self, connection):
        self.connection = connection

    def __enter__(self):
        return self.connection

    def __exit__(self, exc_type, exc, traceback):
        return False


class RecordingConnectionManager:
    def __init__(self):
        self.connection = RecordingConnection()

    def placeholder(self):
        return "%s"

    def get_connection(self):
        return RecordingConnectionContext(self.connection)

    def rows_to_dicts(self, cursor):
        return []


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
    assert entry["domain_name"] == "Adobe Commerce Migration"

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


def test_search_is_case_insensitive(tmp_path, monkeypatch):
    repo = make_repo(tmp_path, monkeypatch)
    domain_id = repo.create_domain("Adobe Commerce Migration", "")
    entry_id = repo.create_entry(
        {
            "domain_id": domain_id,
            "entry_type": "Requirement",
            "status": "Active",
            "title": "Checkout Requirement",
            "details": "Adobe Commerce owns CART pricing.",
            "source": "Migration Notes",
            "tags": "Checkout,Pricing",
        }
    )

    rows = repo.search_entries(query="cart", tag="pricing")

    assert [row["id"] for row in rows] == [entry_id]


def test_search_query_sql_normalizes_query_fields():
    cm = RecordingConnectionManager()
    repo = KnowledgeRepository(cm)

    repo.search_entries(query="CheCkOut")

    sql = " ".join(cm.connection.cursor_instance.sql.split())
    assert "LOWER(e.title) LIKE" in sql
    assert "LOWER(e.details) LIKE" in sql
    assert "LOWER(e.source) LIKE" in sql
    assert "LOWER(e.tags) LIKE" in sql
    assert "e.title LIKE" not in sql
    assert "e.details LIKE" not in sql
    assert "e.source LIKE" not in sql
    assert "e.tags LIKE" not in sql
    assert cm.connection.cursor_instance.params == [
        "%checkout%",
        "%checkout%",
        "%checkout%",
        "%checkout%",
    ]


def test_update_entry_partial_payload_preserves_omitted_fields(tmp_path, monkeypatch):
    repo = make_repo(tmp_path, monkeypatch)
    domain_id = repo.create_domain("Adobe Commerce Migration", "")
    entry_id = repo.create_entry(
        {
            "domain_id": domain_id,
            "entry_type": "Decision",
            "status": "Draft",
            "title": "Original title",
            "details": "Original details",
            "source": "meeting notes",
            "tags": "checkout,owner",
        }
    )

    assert repo.update_entry(entry_id, {"title": "Updated title"}) is True

    entry = repo.get_entry(entry_id)
    assert entry["domain_id"] == domain_id
    assert entry["entry_type"] == "Decision"
    assert entry["status"] == "Draft"
    assert entry["title"] == "Updated title"
    assert entry["details"] == "Original details"
    assert entry["source"] == "meeting notes"
    assert entry["tags"] == "checkout,owner"


def test_search_excludes_archived_domains(tmp_path, monkeypatch):
    repo = make_repo(tmp_path, monkeypatch)
    domain_id = repo.create_domain("Adobe Commerce Migration", "")
    entry_id = repo.create_entry(
        {
            "domain_id": domain_id,
            "entry_type": "Requirement",
            "status": "Active",
            "title": "Cart migration",
            "details": "Cart checkout coverage.",
            "source": "",
            "tags": "cart",
        }
    )

    repo.archive_domain(domain_id)

    hidden = repo.search_entries(query="cart", include_archived=False)
    visible = repo.search_entries(query="cart", include_archived=True)
    assert hidden == []
    assert [row["id"] for row in visible] == [entry_id]
