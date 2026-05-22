import os
import tempfile
import unittest

from data_access.connection import ConnectionManager
from data_access.qa_report_cache_repository import QaReportCacheRepository


class QaReportCacheRepositoryTest(unittest.TestCase):
    def setUp(self):
        self._cwd = os.getcwd()
        self.tmp = tempfile.TemporaryDirectory()
        os.chdir(self.tmp.name)
        self.conn_mgr = ConnectionManager(db_url=None)
        self.conn_mgr.init_schema()
        self.repo = QaReportCacheRepository(self.conn_mgr)

    def tearDown(self):
        self.conn_mgr.close_all()
        os.chdir(self._cwd)
        self.tmp.cleanup()

    def test_save_and_get_report_snapshot(self):
        self.repo.save_report(
            "range-key",
            "2026-05-14T00:00Z",
            "2026-05-15T00:00Z",
            "sinceYesterday",
            {"summary": {"totalCases": 10}},
        )

        row = self.repo.get("range-key")

        self.assertEqual(row["report"]["summary"]["totalCases"], 10)
        self.assertEqual(row["refreshStatus"], "idle")
        self.assertIsNotNone(row["lastRefreshedAt"])

    def test_try_start_refresh_blocks_active_refresh(self):
        self.assertTrue(
            self.repo.try_start_refresh(
                "range-key",
                "2026-05-14T00:00Z",
                "2026-05-15T00:00Z",
                "sinceYesterday",
            )
        )

        self.assertFalse(
            self.repo.try_start_refresh(
                "range-key",
                "2026-05-14T00:00Z",
                "2026-05-15T00:00Z",
                "sinceYesterday",
            )
        )

    def test_mark_refresh_failed_records_error(self):
        self.repo.try_start_refresh(
            "range-key",
            "2026-05-14T00:00Z",
            "2026-05-15T00:00Z",
            "sinceYesterday",
        )

        self.repo.mark_refresh_failed("range-key", "Jira timeout")
        row = self.repo.get("range-key")

        self.assertEqual(row["refreshStatus"], "failed")
        self.assertEqual(row["refreshError"], "Jira timeout")

    def test_update_refresh_metadata_records_visible_progress(self):
        self.repo.try_start_refresh(
            "range-key",
            "2026-05-14T00:00Z",
            "2026-05-15T00:00Z",
            "sinceYesterday",
        )

        self.repo.update_refresh_metadata(
            "range-key",
            {
                "stage": "fetchingCycleDetails",
                "message": "Fetching Jira cycle details 10/25",
                "completedItems": 10,
                "totalItems": 25,
                "warnings": ["Cycle discovery fell back to cached data"],
            },
        )
        row = self.repo.get("range-key")

        self.assertEqual(row["refreshStatus"], "refreshing")
        self.assertIsNone(row["refreshError"])
        self.assertEqual(row["refreshMetadata"]["stage"], "fetchingCycleDetails")
        self.assertEqual(row["refreshMetadata"]["completedItems"], 10)
        self.assertEqual(row["refreshMetadata"]["warnings"], ["Cycle discovery fell back to cached data"])

    def test_get_latest_successful_returns_most_recent_saved_snapshot(self):
        self.repo.save_report(
            "older-key",
            "2026-05-14T00:00Z",
            "2026-05-15T00:00Z",
            "sinceYesterday",
            {"summary": {"totalCases": 7}},
        )
        self.repo.save_report(
            "newer-key",
            "2026-05-15T00:00Z",
            "2026-05-16T00:00Z",
            "sinceYesterday",
            {"summary": {"totalCases": 11}},
        )
        self.repo.try_start_refresh(
            "incomplete-key",
            "2026-05-16T00:00Z",
            "2026-05-17T00:00Z",
            "sinceYesterday",
        )

        row = self.repo.get_latest_successful()

        self.assertEqual(row["cacheKey"], "newer-key")
        self.assertEqual(row["report"]["summary"]["totalCases"], 11)


if __name__ == "__main__":
    unittest.main()
