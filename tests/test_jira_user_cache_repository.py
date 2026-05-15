import os
import tempfile
import unittest

from data_access.connection import ConnectionManager
from data_access.jira_user_cache_repository import JiraUserCacheRepository


class JiraUserCacheRepositoryTest(unittest.TestCase):
    def setUp(self):
        self._cwd = os.getcwd()
        self.tmp = tempfile.TemporaryDirectory()
        os.chdir(self.tmp.name)
        self.conn_mgr = ConnectionManager(db_url=None)
        self.conn_mgr.init_schema()
        self.repo = JiraUserCacheRepository(self.conn_mgr)

    def tearDown(self):
        self.conn_mgr.close_all()
        os.chdir(self._cwd)
        self.tmp.cleanup()

    def test_upsert_and_get_many_by_user_key(self):
        self.repo.upsert_many([
            {"userKey": "JIRAUSER37931", "displayName": "Jane Tester"},
        ])

        rows = self.repo.get_many(["JIRAUSER37931", "missing"])

        self.assertEqual(rows["JIRAUSER37931"]["display_name"], "Jane Tester")
        self.assertNotIn("missing", rows)

    def test_stale_or_missing_keys_returns_only_missing_when_fresh(self):
        self.repo.upsert_many([
            {"userKey": "JIRAUSER37931", "displayName": "Jane Tester"},
        ])

        stale = self.repo.stale_or_missing_keys(["JIRAUSER37931", "JIRAUSER404"], max_age_days=180)

        self.assertEqual(stale, ["JIRAUSER404"])


if __name__ == "__main__":
    unittest.main()
