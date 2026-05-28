from flask import Flask

from routes import blazemeter_api
from services.blazemeter_client import BlazemeterClient


def test_restore_master_reports_posts_to_blazemeter_endpoint():
    client = BlazemeterClient.__new__(BlazemeterClient)
    calls = []

    def fake_request(method, path, **kwargs):
        calls.append((method, path, kwargs))
        return {"result": {"requestId": "restore-123"}}

    client._request = fake_request

    assert client.restore_master_reports(81881183) == {"requestId": "restore-123"}
    assert calls == [("POST", "/masters/81881183/restore-reports", {})]


def test_restore_reports_route_returns_restore_request():
    class FakeClient:
        def restore_master_reports(self, master_id):
            return {"requestId": f"restore-{master_id}"}

    app = Flask(__name__)
    app.register_blueprint(
        blazemeter_api.create_blazemeter_blueprint(
            queue_service=object(),
            client=FakeClient(),
            preset_repo=object(),
            run_repo=object(),
        )
    )

    response = app.test_client().post("/api/blazemeter/masters/81881183/restore-reports")

    assert response.status_code == 200
    assert response.get_json() == {
        "success": True,
        "masterId": 81881183,
        "restore": {"requestId": "restore-81881183"},
    }


def test_test_masters_route_returns_last_reports_for_test():
    class FakeClient:
        def list_recent_masters(self, test_id, limit=5):
            return [
                {"id": 81881183, "name": f"test-{test_id}", "status": "ENDED"},
            ][:limit]

    app = Flask(__name__)
    app.register_blueprint(
        blazemeter_api.create_blazemeter_blueprint(
            queue_service=object(),
            client=FakeClient(),
            preset_repo=object(),
            run_repo=object(),
        )
    )

    response = app.test_client().get("/api/blazemeter/tests/11818872/masters?limit=10")

    assert response.status_code == 200
    assert response.get_json() == {
        "success": True,
        "testId": 11818872,
        "masters": [{"id": 81881183, "name": "test-11818872", "status": "ENDED"}],
    }
