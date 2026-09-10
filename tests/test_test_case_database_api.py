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


def test_change_update_rejects_archived_record(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    created = client.post("/api/test-case-database/changes", json=payload()).get_json()
    archived_response = client.post(f"/api/test-case-database/changes/{created['id']}/archive")
    assert archived_response.status_code == 200

    response = client.put(
        f"/api/test-case-database/changes/{created['id']}",
        json=payload(),
    )

    assert response.status_code == 400
    assert response.get_json() == {
        "success": False,
        "error": "Archived test case changes cannot be edited",
    }


def test_change_routes_reject_non_object_json_payloads(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)

    create_response = client.post(
        "/api/test-case-database/changes",
        json=["not", "an", "object"],
    )
    assert create_response.status_code == 400
    assert create_response.get_json() == {
        "success": False,
        "error": "Request body must be a JSON object",
    }

    created = client.post("/api/test-case-database/changes", json=payload()).get_json()
    update_response = client.put(
        f"/api/test-case-database/changes/{created['id']}",
        json="not an object",
    )
    assert update_response.status_code == 400
    assert update_response.get_json() == {
        "success": False,
        "error": "Request body must be a JSON object",
    }


def test_change_routes_reject_json_null_payloads(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)

    create_response = client.post(
        "/api/test-case-database/changes",
        data="null",
        content_type="application/json",
    )
    assert create_response.status_code == 400
    assert create_response.get_json() == {
        "success": False,
        "error": "Request body must be a JSON object",
    }

    created = client.post("/api/test-case-database/changes", json=payload()).get_json()
    update_response = client.put(
        f"/api/test-case-database/changes/{created['id']}",
        data="null",
        content_type="application/json",
    )
    assert update_response.status_code == 400
    assert update_response.get_json() == {
        "success": False,
        "error": "Request body must be a JSON object",
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


def test_attachment_upload_requires_at_least_one_file(tmp_path, monkeypatch):
    client = make_client(tmp_path, monkeypatch)
    created = client.post("/api/test-case-database/changes", json=payload()).get_json()

    response = client.post(
        f"/api/test-case-database/changes/{created['id']}/attachments",
        data={},
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert response.get_json() == {
        "success": False,
        "error": "At least one attachment file is required",
    }


def test_attachment_upload_rejects_invalid_batch_without_partial_write(
    tmp_path,
    monkeypatch,
):
    client = make_client(tmp_path, monkeypatch)
    created = client.post("/api/test-case-database/changes", json=payload()).get_json()

    response = client.post(
        f"/api/test-case-database/changes/{created['id']}/attachments",
        data={
            "files": [
                (BytesIO(b"hello world"), "evidence.txt"),
                (BytesIO(b"x" * (10 * 1024 * 1024 + 1)), "too-large.txt"),
            ]
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert response.get_json() == {
        "success": False,
        "error": "Attachment 'too-large.txt' exceeds the 10 MB limit",
    }

    list_response = client.get(
        f"/api/test-case-database/changes/{created['id']}/attachments"
    )
    assert list_response.status_code == 200
    assert list_response.get_json() == []


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


def test_import_rejects_non_object_body(tmp_path, monkeypatch):
    class StubImportService:
        def run_import(self, project_id, folder):
            raise AssertionError("must not be called")

    client = _import_test_app(StubImportService())
    response = client.post("/api/test-case-database/import", json=[1, 2])
    assert response.status_code == 400


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
