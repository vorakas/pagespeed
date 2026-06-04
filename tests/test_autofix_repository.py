import os
import tempfile
import unittest

from data_access.connection import ConnectionManager
from data_access.autofix_repository import AutofixRepository


def _report_row(build_id="812", fixes_count=2):
    return {
        "build_id": build_id,
        "pipeline_id": 17,
        "pipeline_name": "Functional",
        "branch": "release/x",
        "build_number": "20260602.3",
        "build_url": "https://dev.azure.com/lp/_build/results?buildId=" + build_id,
        "commit_sha": "abc123",
        "generated_utc": "2026-06-02T17:56:00Z",
        "fetched_at": "2026-06-02 18:00:00",
        "failures_count": 8,
        "groups_count": 3,
        "fixes_count": fixes_count,
    }


def _fix_row(fix_id="f1", build_id="812"):
    return {
        "build_id": build_id,
        "fix_id": fix_id,
        "signature": "Locator|ElementNotFound|Cart.cs:88|a1b2",
        "test_name": "X.CartTests.RemovesItem",
        "category": "Locator",
        "exception_type": "ElementNotFoundException",
        "confidence": "high",
        "diagnosis": "stale locator",
        "reasoning": "id changed",
        "file_path": "LampsPlus/CartDesktop.cs",
        "start_line": 87,
        "end_line": 88,
        "fix_type": "UpdateLocatorValue",
        "old_code": "Find();",
        "new_code": "FindBySelector();",
        "description": "use selector",
    }


class AutofixRepositoryTest(unittest.TestCase):
    def setUp(self):
        self._cwd = os.getcwd()
        self.tmp = tempfile.TemporaryDirectory()
        os.chdir(self.tmp.name)
        self.conn_mgr = ConnectionManager(db_url=None)
        self.conn_mgr.init_schema()
        self.repo = AutofixRepository(self.conn_mgr)

    def tearDown(self):
        self.conn_mgr.close_all()
        os.chdir(self._cwd)
        self.tmp.cleanup()

    def test_upsert_then_get_fixes(self):
        self.repo.upsert_report(_report_row(), [_fix_row("f1"), _fix_row("f2")])
        fixes = self.repo.get_fixes("812")
        self.assertEqual({f["fix_id"] for f in fixes}, {"f1", "f2"})
        self.assertEqual(fixes[0]["status"], "todo")
        self.assertEqual(fixes[0]["start_line"], 87)

    def test_get_builds_returns_rollup_counts(self):
        self.repo.upsert_report(_report_row(), [_fix_row("f1"), _fix_row("f2")])
        self.repo.patch_fix("812", "f1", status="applied")
        builds = self.repo.get_builds()
        self.assertEqual(len(builds), 1)
        self.assertEqual(builds[0]["build_id"], "812")
        self.assertEqual(builds[0]["todo_count"], 1)
        self.assertEqual(builds[0]["applied_count"], 1)
        self.assertEqual(builds[0]["dismissed_count"], 0)

    def test_reupsert_preserves_feedback_but_updates_content(self):
        self.repo.upsert_report(_report_row(), [_fix_row("f1")])
        self.repo.patch_fix("812", "f1", status="dismissed",
                            outcome="not_a_real_issue", note="flaky", actual_fix_code="// none")
        changed = _fix_row("f1")
        changed["new_code"] = "FindByCss();"
        self.repo.upsert_report(_report_row(), [changed])
        fixes = self.repo.get_fixes("812")
        self.assertEqual(len(fixes), 1)
        self.assertEqual(fixes[0]["new_code"], "FindByCss();")
        self.assertEqual(fixes[0]["status"], "dismissed")
        self.assertEqual(fixes[0]["outcome"], "not_a_real_issue")
        self.assertEqual(fixes[0]["note"], "flaky")
        self.assertEqual(fixes[0]["actual_fix_code"], "// none")

    def test_patch_fix_returns_false_for_missing_row(self):
        self.assertFalse(self.repo.patch_fix("nope", "nope", status="applied"))

    def test_get_builds_with_zero_fixes_has_zero_counts(self):
        self.repo.upsert_report(_report_row(fixes_count=0), [])
        builds = self.repo.get_builds()
        self.assertEqual(len(builds), 1)
        self.assertEqual(builds[0]["todo_count"], 0)
        self.assertEqual(builds[0]["applied_count"], 0)
        self.assertEqual(builds[0]["dismissed_count"], 0)

    def test_patch_fix_with_no_fields_returns_false(self):
        self.repo.upsert_report(_report_row(), [_fix_row("f1")])
        self.assertFalse(self.repo.patch_fix("812", "f1"))

    def test_get_corrections_includes_outcome_rows(self):
        self.repo.upsert_report(_report_row(), [_fix_row("f1")])
        self.repo.patch_fix("812", "f1", outcome="worked_with_edits",
                            actual_fix_code="FindByCss();", note="real fix")
        corrections = self.repo.get_corrections()
        self.assertEqual(len(corrections), 1)
        self.assertEqual(corrections[0]["signature"],
                         "Locator|ElementNotFound|Cart.cs:88|a1b2")
        self.assertEqual(corrections[0]["outcome"], "worked_with_edits")
        self.assertEqual(corrections[0]["actual_fix_code"], "FindByCss();")

    def test_get_corrections_includes_worked_as_is(self):
        self.repo.upsert_report(_report_row(), [_fix_row("f1")])
        self.repo.patch_fix("812", "f1", status="applied", outcome="worked_as_is")
        corrections = self.repo.get_corrections()
        self.assertEqual(len(corrections), 1)
        self.assertEqual(corrections[0]["outcome"], "worked_as_is")

    def test_get_corrections_includes_dismissed_without_outcome(self):
        self.repo.upsert_report(_report_row(), [_fix_row("f1")])
        self.repo.patch_fix("812", "f1", status="dismissed")
        corrections = self.repo.get_corrections()
        self.assertEqual(len(corrections), 1)
        self.assertEqual(corrections[0]["status"], "dismissed")

    def test_get_corrections_excludes_untriaged_rows(self):
        # f1 has feedback, f2 is left at default (status=todo, no outcome)
        self.repo.upsert_report(_report_row(), [_fix_row("f1"), _fix_row("f2")])
        self.repo.patch_fix("812", "f1", outcome="didnt_work")
        corrections = self.repo.get_corrections()
        self.assertEqual({c["fix_id"] for c in corrections}, {"f1"})


if __name__ == "__main__":
    unittest.main()
