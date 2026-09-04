from pathlib import Path

from data_access.connection import ConnectionManager
from data_access.test_case_database_repository import TestCaseDatabaseRepository as ChangeRepository


def make_repo(tmp_path: Path, monkeypatch) -> ChangeRepository:
    monkeypatch.chdir(tmp_path)
    manager = ConnectionManager(db_url=None)
    manager.init_schema()
    return ChangeRepository(manager)


def sample_payload() -> dict:
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


def test_create_get_update_archive_and_search_changes(tmp_path: Path, monkeypatch) -> None:
    repo = make_repo(tmp_path, monkeypatch)

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
    assert updated is not None
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


def test_update_change_rejects_archived_rows(tmp_path: Path, monkeypatch) -> None:
    repo = make_repo(tmp_path, monkeypatch)
    change_id = repo.create_change(sample_payload())
    assert repo.archive_change(change_id) is True

    updated_payload = sample_payload()
    updated_payload["status"] = "Superseded"

    assert repo.update_change(change_id, updated_payload) is False
    archived = repo.get_change(change_id)
    assert archived is not None
    assert archived["status"] == "Archived"
    assert archived["archived_at"] is not None


def test_attachment_metadata_bytes_and_delete(tmp_path: Path, monkeypatch) -> None:
    repo = make_repo(tmp_path, monkeypatch)
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
    assert attachment is not None
    assert attachment["file_bytes"] == b"hello world"

    assert repo.delete_change_attachment(change_id, attachment_id) is True
    assert repo.list_change_attachments(change_id) == []
