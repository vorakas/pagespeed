import os
import tempfile
import unittest

from flask import Flask

from data_access.connection import ConnectionManager
from data_access.autofix_repository import AutofixRepository
from routes.autofix_api import create_autofix_blueprint


class _StubIngest:
    """Records the ingest call and seeds the repo, without network."""

    def __init__(self, repo):
        self._repo = repo
        self.calls = []

    def ingest(self, client, definition_ids, per_definition=10):
        self.calls.append((definition_ids, per_definition))
        self._repo.upsert_report(
            {
                "build_id": "812", "pipeline_id": 17, "pipeline_name": "Functional",
                "branch": "release/x", "build_number": "n", "build_url": "u",
                "commit_sha": "c", "generated_utc": "2026-06-02T17:56:00Z",
                "fetched_at": "2026-06-02 18:00:00",
                "failures_count": 1, "groups_count": 1, "fixes_count": 1,
            },
            [{
                "build_id": "812", "fix_id": "f1", "signature": "s", "test_name": "T",
                "category": "Locator", "exception_type": "E", "confidence": "high",
                "diagnosis": "d", "reasoning": "r", "file_path": "p",
                "start_line": 1, "end_line": 2, "fix_type": "AddWait",
                "old_code": "o", "new_code": "n", "description": "x",
            }],
        )
        return {"buildsIngested": 1, "buildsScanned": 1, "buildsFailed": 0, "definitionsScanned": 1}


class AutofixApiTest(unittest.TestCase):
    def setUp(self):
        self._cwd = os.getcwd()
        self.tmp = tempfile.TemporaryDirectory()
        os.chdir(self.tmp.name)
        self.conn_mgr = ConnectionManager(db_url=None)
        self.conn_mgr.init_schema()
        self.repo = AutofixRepository(self.conn_mgr)
        self.ingest = _StubIngest(self.repo)

        app = Flask(__name__)
        app.register_blueprint(create_autofix_blueprint(
            repository=self.repo,
            ingest_service=self.ingest,
            server_pat="server-pat",
            server_organization="lp",
            server_project="TA",
            autofix_pipeline_ids=[17],
        ))
        self.client = app.test_client()

    def tearDown(self):
        self.conn_mgr.close_all()
        os.chdir(self._cwd)
        self.tmp.cleanup()

    def test_refresh_uses_configured_ids_and_ingests(self):
        resp = self.client.post("/api/autofix/refresh", json={})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.get_json()["success"])
        self.assertEqual(self.ingest.calls, [([17], 10)])

    def test_refresh_body_overrides_definition_ids(self):
        self.client.post("/api/autofix/refresh", json={"definition_ids": [99], "per_definition": 3})
        self.assertEqual(self.ingest.calls[-1], ([99], 3))

    def test_refresh_400_when_no_definition_ids(self):
        app = Flask(__name__)
        app.register_blueprint(create_autofix_blueprint(
            repository=self.repo, ingest_service=self.ingest,
            server_pat="server-pat", autofix_pipeline_ids=[],
        ))
        resp = app.test_client().post("/api/autofix/refresh", json={})
        self.assertEqual(resp.status_code, 400)

    def test_get_builds_and_fixes(self):
        self.client.post("/api/autofix/refresh", json={})

        builds = self.client.get("/api/autofix/builds").get_json()
        self.assertTrue(builds["success"])
        self.assertEqual(builds["builds"][0]["buildId"], "812")
        self.assertEqual(builds["builds"][0]["todoCount"], 1)

        fixes = self.client.get("/api/autofix/builds/812/fixes").get_json()
        self.assertEqual(fixes["fixes"][0]["fixId"], "f1")

    def test_patch_fix_updates_status(self):
        self.client.post("/api/autofix/refresh", json={})
        resp = self.client.patch("/api/autofix/fixes/812/f1",
                                 json={"status": "applied", "outcome": "worked_as_is"})
        self.assertEqual(resp.status_code, 200)
        fixes = self.client.get("/api/autofix/builds/812/fixes").get_json()["fixes"]
        self.assertEqual(fixes[0]["status"], "applied")
        self.assertEqual(fixes[0]["outcome"], "worked_as_is")

    def test_patch_rejects_invalid_status(self):
        self.client.post("/api/autofix/refresh", json={})
        resp = self.client.patch("/api/autofix/fixes/812/f1", json={"status": "bogus"})
        self.assertEqual(resp.status_code, 400)

    def test_patch_404_for_unknown_fix(self):
        resp = self.client.patch("/api/autofix/fixes/000/zzz", json={"status": "applied"})
        self.assertEqual(resp.status_code, 404)

    def test_corrections_returns_camelcase_feedback_rows(self):
        # Seed a build + fix, then attach human feedback.
        self.client.post("/api/autofix/refresh", json={})
        patch = self.client.patch(
            "/api/autofix/fixes/812/f1",
            json={"outcome": "worked_with_edits",
                  "actual_fix_code": "FindByCss();", "note": "real fix"},
        )
        self.assertEqual(patch.status_code, 200)

        resp = self.client.get("/api/autofix/corrections")
        self.assertEqual(resp.status_code, 200)
        body = resp.get_json()
        self.assertTrue(body["success"])
        self.assertEqual(len(body["corrections"]), 1)
        row = body["corrections"][0]
        # camelCase keys produced by _camelize
        self.assertEqual(row["outcome"], "worked_with_edits")
        self.assertEqual(row["actualFixCode"], "FindByCss();")
        self.assertEqual(row["filePath"], "p")
        self.assertEqual(row["testName"], "T")

    def test_corrections_empty_when_no_feedback(self):
        self.client.post("/api/autofix/refresh", json={})
        resp = self.client.get("/api/autofix/corrections")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.get_json()["corrections"], [])


if __name__ == "__main__":
    unittest.main()
