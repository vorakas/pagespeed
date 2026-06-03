import io
import json
import os
import tempfile
import unittest
import zipfile

from data_access.connection import ConnectionManager
from data_access.autofix_repository import AutofixRepository
from services.autofix_ingest_service import AutofixIngestService


def _report_zip(build_id: str, fixes_proposed: int) -> bytes:
    report = {
        "schemaVersion": 1,
        "generatedUtc": "2026-06-02T17:56:00Z",
        "build": {"buildId": build_id, "buildNumber": "n", "pipeline": "Functional",
                  "branch": "release/x", "buildUrl": "u", "commit": "c"},
        "summary": {"failures": 1, "groups": 1, "fixesProposed": fixes_proposed},
        "fixes": [
            {"fixId": f"{build_id}-f{i}", "signature": "s", "test": {"name": "T"},
             "category": "Locator", "exceptionType": "E", "confidence": "high",
             "diagnosis": "d", "reasoning": "r", "filePath": "p",
             "location": {"startLine": 1, "endLine": 2}, "fixType": "AddWait",
             "oldCode": "o", "newCode": "n", "description": "x"}
            for i in range(fixes_proposed)
        ],
    }
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as zf:
        zf.writestr("Autofix Report/autofix-report.json", json.dumps(report))
    return buffer.getvalue()


class FakeClient:
    """Stands in for AzureDevOpsClient — no network."""

    def __init__(self, builds_by_def, artifacts):
        self._builds = builds_by_def
        self._artifacts = artifacts  # {build_id: zip_bytes or None}

    def list_recent_builds_by_definition(self, definition_ids, per_definition=10):
        return self._builds

    def download_named_artifact(self, build_id, artifact_name):
        return self._artifacts.get(build_id)


class AutofixIngestServiceTest(unittest.TestCase):
    def setUp(self):
        self._cwd = os.getcwd()
        self.tmp = tempfile.TemporaryDirectory()
        os.chdir(self.tmp.name)
        self.conn_mgr = ConnectionManager(db_url=None)
        self.conn_mgr.init_schema()
        self.repo = AutofixRepository(self.conn_mgr)
        self.service = AutofixIngestService(self.repo, artifact_name="Autofix Report")

    def tearDown(self):
        self.conn_mgr.close_all()
        os.chdir(self._cwd)
        self.tmp.cleanup()

    def test_ingests_builds_with_artifacts_and_skips_those_without(self):
        client = FakeClient(
            builds_by_def={"17": [
                {"id": 812, "definitionId": 17},
                {"id": 813, "definitionId": 17},  # no artifact -> skipped
            ]},
            artifacts={812: _report_zip("812", 2), 813: None},
        )

        summary = self.service.ingest(client, definition_ids=[17], per_definition=5)

        self.assertEqual(summary["buildsIngested"], 1)
        builds = self.repo.get_builds()
        self.assertEqual([b["build_id"] for b in builds], ["812"])
        self.assertEqual(builds[0]["pipeline_id"], 17)   # from definitionId
        self.assertEqual(builds[0]["todo_count"], 2)

    def test_ingest_sets_fetched_at(self):
        client = FakeClient(
            builds_by_def={"17": [{"id": 900, "definitionId": 17}]},
            artifacts={900: _report_zip("900", 1)},
        )
        self.service.ingest(client, definition_ids=[17])
        builds = self.repo.get_builds()
        self.assertTrue(builds[0]["fetched_at"])  # non-empty timestamp

    def test_skips_build_when_zip_has_no_report_json(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w") as zf:
            zf.writestr("Autofix Report/report.md", "# no json here")
        client = FakeClient(
            builds_by_def={"17": [{"id": 950, "definitionId": 17}]},
            artifacts={950: buffer.getvalue()},
        )

        summary = self.service.ingest(client, definition_ids=[17])

        self.assertEqual(summary["buildsIngested"], 0)
        self.assertEqual(self.repo.get_builds(), [])

    def test_reingest_is_idempotent(self):
        client = FakeClient(
            builds_by_def={"17": [{"id": 812, "definitionId": 17}]},
            artifacts={812: _report_zip("812", 2)},
        )

        self.service.ingest(client, definition_ids=[17])
        self.service.ingest(client, definition_ids=[17])

        builds = self.repo.get_builds()
        self.assertEqual(len(builds), 1)
        self.assertEqual(builds[0]["todo_count"], 2)  # not doubled

    def test_reingest_preserves_feedback_through_ingest_path(self):
        client = FakeClient(
            builds_by_def={"17": [{"id": 812, "definitionId": 17}]},
            artifacts={812: _report_zip("812", 1)},
        )

        self.service.ingest(client, definition_ids=[17])
        fix_id = self.repo.get_fixes("812")[0]["fix_id"]
        self.repo.patch_fix("812", fix_id, status="applied", outcome="worked_as_is")

        self.service.ingest(client, definition_ids=[17])  # re-ingest same build

        fixes = self.repo.get_fixes("812")
        self.assertEqual(len(fixes), 1)
        self.assertEqual(fixes[0]["status"], "applied")
        self.assertEqual(fixes[0]["outcome"], "worked_as_is")

    def test_failing_build_is_isolated_and_counted(self):
        class BoomClient(FakeClient):
            def download_named_artifact(self, build_id, artifact_name):
                if build_id == 813:
                    raise RuntimeError("boom")
                return self._artifacts.get(build_id)

        client = BoomClient(
            builds_by_def={"17": [
                {"id": 813, "definitionId": 17},   # raises -> failed, not fatal
                {"id": 812, "definitionId": 17},   # succeeds
            ]},
            artifacts={812: _report_zip("812", 1)},
        )

        summary = self.service.ingest(client, definition_ids=[17])

        self.assertEqual(summary["buildsFailed"], 1)
        self.assertEqual(summary["buildsIngested"], 1)
        self.assertEqual([b["build_id"] for b in self.repo.get_builds()], ["812"])


if __name__ == "__main__":
    unittest.main()
