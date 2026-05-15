import os
import tempfile
import unittest

from data_access.connection import ConnectionManager
from data_access.qa_cycle_repository import QaCycleRepository


class QaCycleRepositoryTest(unittest.TestCase):
    def setUp(self):
        self._cwd = os.getcwd()
        self.tmp = tempfile.TemporaryDirectory()
        os.chdir(self.tmp.name)
        self.conn_mgr = ConnectionManager(db_url=None)
        self.conn_mgr.init_schema()
        self.repo = QaCycleRepository(self.conn_mgr)

    def tearDown(self):
        self.conn_mgr.close_all()
        os.chdir(self._cwd)
        self.tmp.cleanup()

    def test_upsert_cycle_detail_and_read_summary(self):
        self.repo.upsert_cycle_detail({
            "key": "TC-C1",
            "name": "Checkout Round 1",
            "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features/Checkout",
            "status": "In Progress",
            "projectKey": "TC",
            "updatedOn": "2026-05-15T10:00:00.000Z",
            "items": [{"testCaseKey": "TC-T1", "status": "Pass", "assignedTo": "JIRAUSER1"}],
        })

        summaries = self.repo.get_summaries(["TC-C1"])

        self.assertEqual(summaries["TC-C1"]["updated_on"], "2026-05-15T10:00:00.000Z")
        self.assertEqual(summaries["TC-C1"]["section"], "LP Features")

    def test_replace_cycle_items_on_detail_upsert(self):
        self.repo.upsert_cycle_detail({
            "key": "TC-C1",
            "name": "Checkout Round 1",
            "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
            "status": "In Progress",
            "items": [
                {"testCaseKey": "TC-T1", "status": "Pass"},
                {"testCaseKey": "TC-T2", "status": "Fail"},
            ],
        })
        self.repo.upsert_cycle_detail({
            "key": "TC-C1",
            "name": "Checkout Round 1",
            "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
            "status": "Done",
            "items": [{"testCaseKey": "TC-T1", "status": "Pass"}],
        })

        details = self.repo.get_cycle_details(["TC-C1"])

        self.assertEqual(len(details), 1)
        self.assertEqual(details[0]["status"], "Done")
        self.assertEqual([item["testCaseKey"] for item in details[0]["items"]], ["TC-T1"])


if __name__ == "__main__":
    unittest.main()
