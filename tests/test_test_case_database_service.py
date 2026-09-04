import pytest

from data_access.connection import ConnectionManager
from data_access.test_case_database_repository import (
    TestCaseDatabaseRepository as ChangeRepository,
)
from exceptions import ValidationError
from services.test_case_database_service import (
    MAX_ATTACHMENT_BYTES,
    TestCaseDatabaseService as ChangeService,
)


def make_service(tmp_path):
    manager = ConnectionManager(str(tmp_path / "test_case_database_service.db"))
    manager.init_schema()
    repository = ChangeRepository(manager)
    return ChangeService(repository)


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
