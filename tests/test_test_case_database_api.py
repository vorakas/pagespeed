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
