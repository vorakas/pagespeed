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
    app = create_app()
    app.config["TESTING"] = True
    client = app.test_client()

    response = client.post(
        "/api/knowledge/domains",
        json={"name": "   ", "description": "Migration facts"},
    )

    assert response.status_code == 400
    assert response.get_json() == {"success": False, "error": "Domain name is required"}
