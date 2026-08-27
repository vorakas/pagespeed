from io import BytesIO

from app import create_app


def test_knowledge_domain_and_entry_flow(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PHAROS_DISABLE_SCHEDULER", "1")
    app = create_app()
    app.config["TESTING"] = True
    assert "scheduler_lease" not in app.extensions
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
            "title": "Checkout service owns cart handoff",
            "details": "Checkout migration keeps cart handoff inside Adobe Commerce.",
            "source": "migration notes",
            "tags": ["checkout", "adobe-commerce"],
        },
    )

    assert entry_response.status_code == 201
    entry = entry_response.get_json()
    assert entry["status"] == "Active"

    search_response = client.get("/api/knowledge/entries?query=checkout")

    assert search_response.status_code == 200
    entries = search_response.get_json()
    assert [result["id"] for result in entries] == [entry["id"]]

    archive_response = client.post(f"/api/knowledge/entries/{entry['id']}/archive")

    assert archive_response.status_code == 200
    archived_entry = archive_response.get_json()
    assert archived_entry["status"] == "Archived"


def test_knowledge_api_returns_validation_error(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PHAROS_DISABLE_SCHEDULER", "1")
    app = create_app()
    app.config["TESTING"] = True
    assert "scheduler_lease" not in app.extensions
    client = app.test_client()

    response = client.post(
        "/api/knowledge/domains",
        json={"name": "   ", "description": "Migration facts"},
    )

    assert response.status_code == 400
    assert response.get_json() == {"success": False, "error": "Domain name is required"}


def test_knowledge_api_rejects_malformed_entry_domain_id(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PHAROS_DISABLE_SCHEDULER", "1")
    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()

    domain_response = client.post(
        "/api/knowledge/domains",
        json={"name": "Adobe Commerce Migration"},
    )
    domain = domain_response.get_json()
    entry_response = client.post(
        "/api/knowledge/entries",
        json={
            "domain_id": domain["id"],
            "entry_type": "Decision",
            "title": "Checkout owner",
            "details": "Checkout migration owner.",
        },
    )
    entry = entry_response.get_json()

    create_response = client.post(
        "/api/knowledge/entries",
        json={
            "domain_id": "abc",
            "entry_type": "Decision",
            "title": "Bad domain",
            "details": "Bad domain payload.",
        },
    )
    update_response = client.put(
        f"/api/knowledge/entries/{entry['id']}",
        json={"domain_id": "abc"},
    )

    assert create_response.status_code == 400
    assert create_response.get_json() == {
        "success": False,
        "error": "domain_id must be a positive integer",
    }
    assert update_response.status_code == 400
    assert update_response.get_json() == {
        "success": False,
        "error": "domain_id must be a positive integer",
    }


def test_knowledge_api_separates_archived_entries_from_archived_domains(
    tmp_path, monkeypatch
):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PHAROS_DISABLE_SCHEDULER", "1")
    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()

    domain_response = client.post(
        "/api/knowledge/domains",
        json={"name": "Retired Domain"},
    )
    domain = domain_response.get_json()
    entry_response = client.post(
        "/api/knowledge/entries",
        json={
            "domain_id": domain["id"],
            "entry_type": "Evidence",
            "title": "Cart migration note",
            "details": "Cart coverage from retired project.",
        },
    )
    entry = entry_response.get_json()
    client.post(f"/api/knowledge/domains/{domain['id']}/archive")

    include_entries_response = client.get(
        "/api/knowledge/entries?query=cart&include_archived=true"
    )
    include_domains_response = client.get(
        "/api/knowledge/entries?query=cart&include_archived=true&include_archived_domains=true"
    )

    assert include_entries_response.status_code == 200
    assert include_entries_response.get_json() == []
    assert include_domains_response.status_code == 200
    assert [result["id"] for result in include_domains_response.get_json()] == [
        entry["id"]
    ]


def test_knowledge_entry_attachment_flow(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PHAROS_DISABLE_SCHEDULER", "1")
    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()

    domain_response = client.post(
        "/api/knowledge/domains",
        json={"name": "Testing Tips"},
    )
    domain = domain_response.get_json()
    entry_response = client.post(
        "/api/knowledge/entries",
        json={
            "domain_id": domain["id"],
            "entry_type": "Process",
            "title": "Kiosk Testing",
            "details": "Chrome DevTools kiosk notes.",
            "source": "",
            "tags": ["kiosk"],
        },
    )
    entry = entry_response.get_json()

    upload_response = client.post(
        f"/api/knowledge/entries/{entry['id']}/attachments",
        data={
            "files": [
                (BytesIO(b"plain evidence"), "notes.txt"),
                (BytesIO(b"\x89PNG\r\n\x1a\nimage-bytes"), "kiosk.png"),
            ],
        },
        content_type="multipart/form-data",
    )

    assert upload_response.status_code == 201
    attachments = upload_response.get_json()
    assert [attachment["filename"] for attachment in attachments] == [
        "notes.txt",
        "kiosk.png",
    ]
    assert attachments[0]["file_size"] == len(b"plain evidence")
    assert "file_bytes" not in attachments[0]

    list_response = client.get(f"/api/knowledge/entries/{entry['id']}/attachments")
    assert list_response.status_code == 200
    listed = list_response.get_json()
    assert [attachment["filename"] for attachment in listed] == ["notes.txt", "kiosk.png"]

    file_response = client.get(
        f"/api/knowledge/entries/{entry['id']}/attachments/{listed[0]['id']}/file"
    )
    assert file_response.status_code == 200
    assert file_response.data == b"plain evidence"
    assert file_response.headers["Content-Disposition"].startswith("attachment;")

    delete_response = client.delete(
        f"/api/knowledge/entries/{entry['id']}/attachments/{listed[0]['id']}"
    )
    assert delete_response.status_code == 204

    remaining_response = client.get(f"/api/knowledge/entries/{entry['id']}/attachments")
    remaining = remaining_response.get_json()
    assert [attachment["filename"] for attachment in remaining] == ["kiosk.png"]


def test_knowledge_entry_attachment_rejects_oversized_file(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setenv("PHAROS_DISABLE_SCHEDULER", "1")
    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()

    domain_response = client.post("/api/knowledge/domains", json={"name": "Testing Tips"})
    domain = domain_response.get_json()
    entry_response = client.post(
        "/api/knowledge/entries",
        json={
            "domain_id": domain["id"],
            "entry_type": "Process",
            "title": "Kiosk Testing",
            "details": "Chrome DevTools kiosk notes.",
        },
    )
    entry = entry_response.get_json()

    response = client.post(
        f"/api/knowledge/entries/{entry['id']}/attachments",
        data={"files": [(BytesIO(b"x" * (10 * 1024 * 1024 + 1)), "large.bin")]},
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert response.get_json() == {
        "success": False,
        "error": "Attachment 'large.bin' exceeds the 10 MB limit",
    }
