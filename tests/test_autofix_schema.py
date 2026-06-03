import os
import tempfile
import unittest

from data_access.connection import ConnectionManager


class AutofixSchemaTest(unittest.TestCase):
    def setUp(self):
        self._cwd = os.getcwd()
        self.tmp = tempfile.TemporaryDirectory()
        os.chdir(self.tmp.name)
        self.conn_mgr = ConnectionManager(db_url=None)
        self.conn_mgr.init_schema()

    def tearDown(self):
        self.conn_mgr.close_all()
        os.chdir(self._cwd)
        self.tmp.cleanup()

    def _table_columns(self, table: str) -> set[str]:
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"PRAGMA table_info({table})")
            return {row[1] for row in cursor.fetchall()}

    def test_autofix_report_table_has_expected_columns(self):
        cols = self._table_columns("autofix_report")
        self.assertEqual(cols, {
            "build_id", "pipeline_id", "pipeline_name", "branch", "build_number",
            "build_url", "commit_sha", "generated_utc", "fetched_at",
            "failures_count", "groups_count", "fixes_count",
        })

    def test_autofix_fix_table_has_expected_columns(self):
        cols = self._table_columns("autofix_fix")
        self.assertEqual(cols, {
            "build_id", "fix_id", "signature", "test_name", "category",
            "exception_type", "confidence", "diagnosis", "reasoning", "file_path",
            "start_line", "end_line", "fix_type", "old_code", "new_code",
            "description", "status", "outcome", "actual_fix_code", "note", "updated_at",
        })

    def test_init_schema_is_idempotent(self):
        self.conn_mgr.init_schema()  # second call must not raise
        self.assertIn("build_id", self._table_columns("autofix_report"))


if __name__ == "__main__":
    unittest.main()
