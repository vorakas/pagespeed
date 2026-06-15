import io

import pytest
from flask import Flask, jsonify

from exceptions import ValidationError
import routes.csv_lighthouse_api as csv_lighthouse_api
from routes.csv_lighthouse_api import create_csv_lighthouse_blueprint


class FakeCsvLighthouseService:
    def __init__(self):
        self.create_calls = []
        self.cancelled_run_ids = []

    def create_run(self, files, site_keys, strategy, label=None):
        self.create_calls.append(
            {
                "files": [(filename, handle.read()) for filename, handle in files],
                "site_keys": site_keys,
                "strategy": strategy,
                "label": label,
            }
        )
        return {"run_id": 42, "worker_count": 3, "total_items": 9}

    def list_runs(self):
        return [
            {
                "id": 42,
                "label": "Regression batch",
                "strategy": "mobile",
                "total_items": 9,
            }
        ]

    def get_run(self, run_id):
        if run_id == 999:
            return {"run": None, "items": []}
        return {
            "run": {"id": run_id, "label": "Regression batch"},
            "items": [{"id": 7, "status": "pending"}],
        }

    def cancel_run(self, run_id):
        self.cancelled_run_ids.append(run_id)
        if run_id == 999:
            return {"run": None, "items": []}
        return {"run": {"id": run_id, "status": "cancelled"}, "items": []}

    def export_csv(self, run_id):
        return f"run_id,label\n{run_id},Regression batch\n"


@pytest.fixture()
def service():
    return FakeCsvLighthouseService()


@pytest.fixture()
def client(service):
    app = Flask(__name__)
    app.register_blueprint(create_csv_lighthouse_blueprint(service))

    @app.errorhandler(ValidationError)
    def handle_validation_error(exc):
        return jsonify({"success": False, "error": exc.message}), 400

    return app.test_client()


def test_create_run_accepts_multipart_files_label_strategy_and_site_keys(client, service):
    response = client.post(
        "/api/csv-lighthouse/runs",
        data={
            "files": [
                (io.BytesIO(b"/p/brass-lamp\n"), "PDP.csv"),
                (io.BytesIO(b"/s/chandelier\n"), "SearchToPDP.csv"),
            ],
            "label": "Regression batch",
            "strategy": "mobile",
            "site_keys": ["www", "mcprod"],
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    assert response.get_json() == {
        "success": True,
        "run_id": 42,
        "worker_count": 3,
        "total_items": 9,
    }
    assert service.create_calls == [
        {
            "files": [
                ("PDP.csv", b"/p/brass-lamp\n"),
                ("SearchToPDP.csv", b"/s/chandelier\n"),
            ],
            "site_keys": ["www", "mcprod"],
            "strategy": "mobile",
            "label": "Regression batch",
        }
    ]


def test_create_run_accepts_comma_separated_site_keys_and_default_strategy(client, service):
    response = client.post(
        "/api/csv-lighthouse/runs",
        data={
            "files": [(io.BytesIO(b"/p/brass-lamp\n"), "PDP.csv")],
            "site_keys": "www, mcprod",
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    assert service.create_calls[0]["site_keys"] == ["www", "mcprod"]
    assert service.create_calls[0]["strategy"] == "desktop"
    assert service.create_calls[0]["label"] is None


def test_create_run_requires_at_least_one_file(client):
    response = client.post(
        "/api/csv-lighthouse/runs",
        data={"site_keys": "www"},
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert response.get_json() == {
        "success": False,
        "error": "At least one CSV file is required",
    }


def test_create_run_rejects_too_many_files(client, monkeypatch):
    monkeypatch.setattr(csv_lighthouse_api, "CSV_LIGHTHOUSE_MAX_FILES", 1, raising=False)

    response = client.post(
        "/api/csv-lighthouse/runs",
        data={
            "files": [
                (io.BytesIO(b"/p/brass-lamp\n"), "PDP.csv"),
                (io.BytesIO(b"/p/floor-lamp\n"), "PDP2.csv"),
            ],
            "site_keys": "www",
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "CSV Lighthouse upload accepts at most 1 files"


def test_create_run_rejects_file_larger_than_limit_before_service_call(client, service, monkeypatch):
    monkeypatch.setattr(csv_lighthouse_api, "CSV_LIGHTHOUSE_MAX_FILE_BYTES", 4, raising=False)

    response = client.post(
        "/api/csv-lighthouse/runs",
        data={
            "files": [(io.BytesIO(b"12345"), "PDP.csv")],
            "site_keys": "www",
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "CSV file PDP.csv exceeds 4 bytes"
    assert service.create_calls == []


def test_list_runs_returns_saved_runs(client):
    response = client.get("/api/csv-lighthouse/runs")

    assert response.status_code == 200
    assert response.get_json() == {
        "success": True,
        "runs": [
            {
                "id": 42,
                "label": "Regression batch",
                "strategy": "mobile",
                "total_items": 9,
            }
        ],
    }


def test_get_run_returns_run_and_items_detail(client):
    response = client.get("/api/csv-lighthouse/runs/42")

    assert response.status_code == 200
    assert response.get_json() == {
        "success": True,
        "run": {"id": 42, "label": "Regression batch"},
        "items": [{"id": 7, "status": "pending"}],
    }


def test_get_run_returns_404_for_missing_run(client):
    response = client.get("/api/csv-lighthouse/runs/999")

    assert response.status_code == 404
    assert response.get_json() == {
        "success": False,
        "error": "CSV Lighthouse run 999 not found",
    }


def test_cancel_run_calls_service(client, service):
    response = client.post("/api/csv-lighthouse/runs/42/cancel")

    assert response.status_code == 200
    assert response.get_json() == {
        "success": True,
        "run": {"id": 42, "status": "cancelled"},
        "items": [],
    }
    assert service.cancelled_run_ids == [42]


def test_cancel_run_returns_404_for_missing_run(client, service):
    response = client.post("/api/csv-lighthouse/runs/999/cancel")

    assert response.status_code == 404
    assert response.get_json() == {
        "success": False,
        "error": "CSV Lighthouse run 999 not found",
    }
    assert service.cancelled_run_ids == []


def test_export_run_returns_csv_attachment(client):
    response = client.get("/api/csv-lighthouse/runs/42/export")

    assert response.status_code == 200
    assert response.mimetype == "text/csv"
    assert (
        response.headers["Content-Disposition"]
        == 'attachment; filename="csv-lighthouse-run-42.csv"'
    )
    assert response.get_data(as_text=True) == "run_id,label\n42,Regression batch\n"


def test_export_run_returns_404_for_missing_run(client):
    response = client.get("/api/csv-lighthouse/runs/999/export")

    assert response.status_code == 404
    assert response.get_json() == {
        "success": False,
        "error": "CSV Lighthouse run 999 not found",
    }
