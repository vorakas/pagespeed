import os
import tempfile
import unittest

from data_access.connection import ConnectionManager
from data_access.qa_test_case_cache_repository import QaTestCaseCacheRepository


class QaTestCaseCacheRepositoryTest(unittest.TestCase):
    def setUp(self):
        self._cwd = os.getcwd()
        self.tmp = tempfile.TemporaryDirectory()
        os.chdir(self.tmp.name)
        self.conn_mgr = ConnectionManager(db_url=None)
        self.conn_mgr.init_schema()
        self.repo = QaTestCaseCacheRepository(self.conn_mgr)

    def tearDown(self):
        self.conn_mgr.close_all()
        os.chdir(self._cwd)
        self.tmp.cleanup()

    def test_upsert_and_get_many_by_key(self):
        self.repo.upsert_many([
            {
                "testCaseKey": "TC-T1",
                "name": "Checkout succeeds",
                "folder": "/Checkout",
                "status": "Approved",
                "priority": "High",
            }
        ])

        rows = self.repo.get_many(["TC-T1", "TC-T2"])

        self.assertEqual(rows["TC-T1"]["name"], "Checkout succeeds")
        self.assertEqual(rows["TC-T1"]["folder"], "/Checkout")
        self.assertNotIn("TC-T2", rows)

    def test_stale_or_missing_keys_returns_only_uncached_keys_when_fresh(self):
        self.repo.upsert_many([
            {"testCaseKey": "TC-T1", "name": "Checkout succeeds"},
        ])

        stale = self.repo.stale_or_missing_keys(["TC-T1", "TC-T2"], max_age_days=30)

        self.assertEqual(stale, ["TC-T2"])


if __name__ == "__main__":
    unittest.main()
