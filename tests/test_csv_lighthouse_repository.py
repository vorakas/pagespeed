import os
import sqlite3
import tempfile
import unittest

from data_access.connection import ConnectionManager
from data_access.csv_lighthouse_repository import CsvLighthouseRepository
from exceptions import DatabaseError


class CsvLighthouseRepositoryTest(unittest.TestCase):
    def setUp(self):
        self._cwd = os.getcwd()
        self.tmp = tempfile.TemporaryDirectory()
        os.chdir(self.tmp.name)
        self.conn_mgr = ConnectionManager(db_url=None)
        self.conn_mgr.init_schema()
        self.repo = CsvLighthouseRepository(self.conn_mgr)

    def tearDown(self):
        self.conn_mgr.close_all()
        os.chdir(self._cwd)
        self.tmp.cleanup()

    def test_schema_has_samples_table_and_samples_per_url_column(self):
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='csv_lighthouse_samples'"
            )
            self.assertIsNotNone(cursor.fetchone())
            cursor.execute("PRAGMA table_info(csv_lighthouse_runs)")
            columns = {row[1] for row in cursor.fetchall()}
            self.assertIn("samples_per_url", columns)

    def test_create_run_create_item_get_detail_round_trip(self):
        run_id = self.repo.create_run(
            label="June CSV smoke",
            strategy="mobile",
            site_keys=["production", "migration"],
            worker_count=4,
            target_budget_seconds=540,
            total_items=1,
        )

        item_ids = self.repo.create_items(
            run_id,
            [
                {
                    "source_filename": "ProductData.csv",
                    "group_key": "chair",
                    "site_key": "production",
                    "original_value": "LP-12345",
                    "generated_url": "https://www.lampsplus.com/products/lp-12345/",
                    "strategy": "mobile",
                }
            ],
        )

        detail = self.repo.get_run_detail(run_id)

        self.assertEqual(len(item_ids), 1)
        self.assertEqual(detail["run"]["id"], run_id)
        self.assertEqual(detail["run"]["label"], "June CSV smoke")
        self.assertEqual(detail["run"]["strategy"], "mobile")
        self.assertEqual(detail["run"]["site_keys"], ["production", "migration"])
        self.assertEqual(detail["run"]["status"], "pending")
        self.assertEqual(detail["run"]["worker_count"], 4)
        self.assertEqual(detail["run"]["target_budget_seconds"], 540)
        self.assertEqual(detail["run"]["total_items"], 1)
        self.assertEqual(detail["run"]["completed_items"], 0)
        self.assertEqual(detail["run"]["failed_items"], 0)
        self.assertEqual(detail["run"]["cancelled_items"], 0)
        self.assertFalse(detail["run"]["cancel_requested"])

        self.assertEqual(len(detail["items"]), 1)
        item = detail["items"][0]
        self.assertEqual(item["id"], item_ids[0])
        self.assertEqual(item["run_id"], run_id)
        self.assertEqual(item["source_filename"], "ProductData.csv")
        self.assertEqual(item["group_key"], "chair")
        self.assertEqual(item["site_key"], "production")
        self.assertEqual(item["original_value"], "LP-12345")
        self.assertEqual(item["generated_url"], "https://www.lampsplus.com/products/lp-12345/")
        self.assertEqual(item["strategy"], "mobile")
        self.assertEqual(item["status"], "pending")

    def test_update_item_metrics_and_finish_run_progress_status(self):
        run_id = self.repo.create_run(
            label="Single item",
            strategy="desktop",
            site_keys=["production"],
            worker_count=1,
            target_budget_seconds=60,
            total_items=2,
        )
        first_id, second_id = self.repo.create_items(
            run_id,
            [
                {
                    "source_filename": "Urls.csv",
                    "group_key": "home",
                    "site_key": "production",
                    "original_value": "/",
                    "generated_url": "https://www.lampsplus.com/",
                    "strategy": "desktop",
                },
                {
                    "source_filename": "Urls.csv",
                    "group_key": "sale",
                    "site_key": "production",
                    "original_value": "/sale/",
                    "generated_url": "https://www.lampsplus.com/sale/",
                    "strategy": "desktop",
                },
            ],
        )

        self.repo.mark_run_running(run_id)
        self.repo.mark_item_running(first_id)
        self.repo.mark_item_passed(
            first_id,
            {
                "fcp": 900,
                "speed_index": 1200,
                "lcp": 1800,
                "tbt": 50,
                "cls": 0.02,
                "duration_ms": 1500,
            },
        )
        self.repo.mark_item_running(second_id)
        self.repo.mark_item_failed(second_id, "PageSpeed timeout")

        detail = self.repo.get_run_detail(run_id)
        items_by_id = {item["id"]: item for item in detail["items"]}

        self.assertEqual(detail["run"]["status"], "running")
        self.assertEqual(detail["run"]["completed_items"], 1)
        self.assertEqual(detail["run"]["failed_items"], 1)
        self.assertEqual(items_by_id[first_id]["status"], "passed")
        self.assertEqual(items_by_id[first_id]["fcp"], 900)
        self.assertEqual(items_by_id[first_id]["speed_index"], 1200)
        self.assertEqual(items_by_id[first_id]["lcp"], 1800)
        self.assertEqual(items_by_id[first_id]["tbt"], 50)
        self.assertEqual(items_by_id[first_id]["cls"], 0.02)
        self.assertEqual(items_by_id[first_id]["duration_ms"], 1500)
        self.assertEqual(items_by_id[second_id]["status"], "failed")
        self.assertEqual(items_by_id[second_id]["error_message"], "PageSpeed timeout")

        self.repo.finish_run_if_complete(run_id)
        finished = self.repo.get_run_detail(run_id)["run"]

        self.assertEqual(finished["status"], "completed_with_failures")
        self.assertEqual(finished["completed_items"], 1)
        self.assertEqual(finished["failed_items"], 1)
        self.assertEqual(finished["average_item_duration_ms"], 1500)
        self.assertIsNotNone(finished["finished_at"])

    def test_item_attempts_are_saved_with_final_status(self):
        run_id = self.repo.create_run(
            label="Retry test",
            strategy="desktop",
            site_keys=["www"],
            worker_count=1,
            target_budget_seconds=540,
            total_items=2,
        )
        first_id, second_id = self.repo.create_items(
            run_id,
            [
                {
                    "source_filename": "PDP.csv",
                    "group_key": "PDP",
                    "site_key": "www",
                    "original_value": "brass-lamp/",
                    "generated_url": "https://www.lampsplus.com/p/brass-lamp/",
                    "strategy": "desktop",
                },
                {
                    "source_filename": "PDP.csv",
                    "group_key": "PDP",
                    "site_key": "www",
                    "original_value": "floor-lamp/",
                    "generated_url": "https://www.lampsplus.com/p/floor-lamp/",
                    "strategy": "desktop",
                },
            ],
        )

        self.repo.mark_run_running(run_id)
        self.repo.mark_item_running(first_id)
        self.repo.mark_item_passed(first_id, {"fcp": 100, "attempts": 2})
        self.repo.mark_item_running(second_id)
        self.repo.mark_item_failed(second_id, "PageSpeed timeout", attempts=2)

        detail = self.repo.get_run_detail(run_id)
        items_by_id = {item["id"]: item for item in detail["items"]}

        self.assertEqual(items_by_id[first_id]["attempts"], 2)
        self.assertEqual(items_by_id[second_id]["attempts"], 2)

    def test_mark_item_running_claims_pending_item_once(self):
        run_id = self.repo.create_run(
            label="Claim once",
            strategy="desktop",
            site_keys=["production"],
            worker_count=2,
            target_budget_seconds=60,
            total_items=1,
        )
        item_id = self.repo.create_items(
            run_id,
            [
                {
                    "source_filename": "Urls.csv",
                    "group_key": "home",
                    "site_key": "production",
                    "original_value": "/",
                    "generated_url": "https://www.lampsplus.com/",
                    "strategy": "desktop",
                }
            ],
        )[0]

        self.assertTrue(self.repo.mark_item_running(item_id))
        self.assertFalse(self.repo.mark_item_running(item_id))

    def test_late_terminal_update_cannot_overwrite_passed_metrics(self):
        run_id = self.repo.create_run(
            label="Guard terminal",
            strategy="desktop",
            site_keys=["production"],
            worker_count=2,
            target_budget_seconds=60,
            total_items=1,
        )
        item_id = self.repo.create_items(
            run_id,
            [
                {
                    "source_filename": "Urls.csv",
                    "group_key": "home",
                    "site_key": "production",
                    "original_value": "/",
                    "generated_url": "https://www.lampsplus.com/",
                    "strategy": "desktop",
                }
            ],
        )[0]

        self.assertTrue(self.repo.mark_item_running(item_id))
        self.repo.mark_item_passed(
            item_id,
            {
                "fcp": 900,
                "speed_index": 1200,
                "lcp": 1800,
                "tbt": 50,
                "cls": 0.02,
                "duration_ms": 1500,
            },
        )
        self.repo.mark_item_failed(item_id, "late timeout")
        self.repo.mark_item_passed(
            item_id,
            {
                "fcp": 9999,
                "speed_index": 9999,
                "lcp": 9999,
                "tbt": 9999,
                "cls": 9.99,
                "duration_ms": 9999,
            },
        )

        item = self.repo.get_run_detail(run_id)["items"][0]
        self.assertEqual(item["status"], "passed")
        self.assertIsNone(item["error_message"])
        self.assertEqual(item["fcp"], 900)
        self.assertEqual(item["speed_index"], 1200)
        self.assertEqual(item["lcp"], 1800)
        self.assertEqual(item["tbt"], 50)
        self.assertEqual(item["cls"], 0.02)
        self.assertEqual(item["duration_ms"], 1500)

    def test_finish_run_if_complete_allows_late_cancel_when_all_items_are_terminal(self):
        run_id = self.repo.create_run(
            label="Cancel requested",
            strategy="desktop",
            site_keys=["production"],
            worker_count=1,
            target_budget_seconds=60,
            total_items=1,
        )
        item_id = self.repo.create_items(
            run_id,
            [
                {
                    "source_filename": "Urls.csv",
                    "group_key": "home",
                    "site_key": "production",
                    "original_value": "/",
                    "generated_url": "https://www.lampsplus.com/",
                    "strategy": "desktop",
                }
            ],
        )[0]

        self.repo.mark_run_running(run_id)
        self.repo.request_cancel(run_id)
        self.repo.mark_item_running(item_id)
        self.repo.mark_item_passed(item_id, {"duration_ms": 100})
        self.repo.finish_run_if_complete(run_id)

        run = self.repo.get_run_detail(run_id)["run"]
        self.assertEqual(run["status"], "completed")
        self.assertTrue(run["cancel_requested"])
        self.assertIsNotNone(run["finished_at"])

    def test_finish_run_if_complete_does_not_overwrite_cancelled_run(self):
        run_id = self.repo.create_run(
            label="Cancelled",
            strategy="desktop",
            site_keys=["production"],
            worker_count=1,
            target_budget_seconds=60,
            total_items=0,
        )

        self.repo.mark_run_cancelled(run_id)
        self.repo.finish_run_if_complete(run_id)

        run = self.repo.get_run_detail(run_id)["run"]
        self.assertEqual(run["status"], "cancelled")

    def test_create_items_rejects_missing_run(self):
        with self.assertRaises(DatabaseError):
            self.repo.create_items(
                999,
                [
                    {
                        "source_filename": "Urls.csv",
                        "group_key": "home",
                        "site_key": "production",
                        "original_value": "/",
                        "generated_url": "https://www.lampsplus.com/",
                        "strategy": "desktop",
                    }
                ],
            )

    def test_run_files_round_trip(self):
        run_id = self.repo.create_run("Files", "desktop", ["www"], 1, 540, 0)

        file_id = self.repo.create_file(
            run_id,
            filename="PDP.csv",
            group_key="PDP",
            csv_text="brass-lamp/\nfloor-lamp/\n",
            row_count=2,
        )
        files = self.repo.list_files(run_id)

        self.assertEqual(files[0]["id"], file_id)
        self.assertEqual(files[0]["filename"], "PDP.csv")
        self.assertEqual(files[0]["group_key"], "PDP")
        self.assertEqual(files[0]["row_count"], 2)
        self.assertEqual(files[0]["csv_text"], "brass-lamp/\nfloor-lamp/\n")

    def test_update_file_replaces_text_and_row_count(self):
        run_id = self.repo.create_run("Files", "desktop", ["www"], 1, 540, 0)
        file_id = self.repo.create_file(run_id, "PDP.csv", "PDP", "old/\n", 1)

        self.repo.update_file(file_id, "new/\nother/\n", 2)
        saved = self.repo.get_file(file_id)

        self.assertEqual(saved["csv_text"], "new/\nother/\n")
        self.assertEqual(saved["row_count"], 2)

    def test_delete_file_removes_saved_file(self):
        run_id = self.repo.create_run("Files", "desktop", ["www"], 1, 540, 0)
        file_id = self.repo.create_file(run_id, "PDP.csv", "PDP", "old/\n", 1)

        self.repo.delete_file(file_id)

        self.assertEqual(self.repo.list_files(run_id), [])

    def test_replace_pending_items_rebuilds_total_items(self):
        run_id = self.repo.create_run("Files", "desktop", ["www"], 1, 540, 1)
        self.repo.create_items(
            run_id,
            [
                {
                    "source_filename": "PDP.csv",
                    "group_key": "PDP",
                    "site_key": "www",
                    "original_value": "old/",
                    "generated_url": "https://www.lampsplus.com/p/old/",
                    "strategy": "desktop",
                }
            ],
        )

        item_ids = self.repo.replace_pending_items(
            run_id,
            [
                {
                    "source_filename": "PDP.csv",
                    "group_key": "PDP",
                    "site_key": "www",
                    "original_value": "new/",
                    "generated_url": "https://www.lampsplus.com/p/new/",
                    "strategy": "desktop",
                },
                {
                    "source_filename": "PDP.csv",
                    "group_key": "PDP",
                    "site_key": "www",
                    "original_value": "other/",
                    "generated_url": "https://www.lampsplus.com/p/other/",
                    "strategy": "desktop",
                },
            ],
        )
        detail = self.repo.get_run_detail(run_id)

        self.assertEqual(len(item_ids), 2)
        self.assertEqual(detail["run"]["total_items"], 2)
        self.assertEqual(
            [item["generated_url"] for item in detail["items"]],
            [
                "https://www.lampsplus.com/p/new/",
                "https://www.lampsplus.com/p/other/",
            ],
        )

    def test_raw_sqlite_connection_enforces_csv_item_foreign_key(self):
        with self.conn_mgr.get_connection() as conn:
            cursor = conn.cursor()
            with self.assertRaises(sqlite3.IntegrityError):
                cursor.execute(
                    """
                    INSERT INTO csv_lighthouse_items (
                        run_id, source_filename, group_key, site_key,
                        original_value, generated_url, strategy
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        999,
                        "Urls.csv",
                        "home",
                        "production",
                        "/",
                        "https://www.lampsplus.com/",
                        "desktop",
                    ),
                )

    def test_mark_pending_items_cancelled_keeps_terminal_rows_as_is(self):
        run_id = self.repo.create_run(
            label="Cancel pending",
            strategy="desktop",
            site_keys=["www"],
            worker_count=1,
            target_budget_seconds=60,
            total_items=2,
        )
        first_id, second_id = self.repo.create_items(
            run_id,
            [
                {
                    "source_filename": "PDP.csv",
                    "group_key": "PDP",
                    "site_key": "www",
                    "original_value": "brass-lamp/",
                    "generated_url": "https://www.lampsplus.com/p/brass-lamp/",
                    "strategy": "desktop",
                },
                {
                    "source_filename": "PDP.csv",
                    "group_key": "PDP",
                    "site_key": "www",
                    "original_value": "floor-lamp/",
                    "generated_url": "https://www.lampsplus.com/p/floor-lamp/",
                    "strategy": "desktop",
                },
            ],
        )
        self.repo.mark_item_running(first_id)
        self.repo.mark_item_passed(first_id, {"duration_ms": 100})

        self.repo.mark_pending_items_cancelled(run_id)
        self.repo.mark_run_cancelled(run_id)
        detail = self.repo.get_run_detail(run_id)

        self.assertEqual(detail["run"]["status"], "cancelled")
        self.assertEqual(detail["run"]["completed_items"], 1)
        self.assertEqual(detail["run"]["failed_items"], 0)
        self.assertEqual(detail["run"]["cancelled_items"], 1)
        self.assertEqual(
            [item["status"] for item in detail["items"]], ["passed", "cancelled"]
        )

    def test_mark_run_failed_marks_unfinished_items_failed(self):
        run_id = self.repo.create_run(
            label="Interrupted",
            strategy="desktop",
            site_keys=["www"],
            worker_count=1,
            target_budget_seconds=60,
            total_items=2,
        )
        self.repo.create_items(
            run_id,
            [
                {
                    "source_filename": "PDP.csv",
                    "group_key": "PDP",
                    "site_key": "www",
                    "original_value": "brass-lamp/",
                    "generated_url": "https://www.lampsplus.com/p/brass-lamp/",
                    "strategy": "desktop",
                },
                {
                    "source_filename": "PDP.csv",
                    "group_key": "PDP",
                    "site_key": "www",
                    "original_value": "floor-lamp/",
                    "generated_url": "https://www.lampsplus.com/p/floor-lamp/",
                    "strategy": "desktop",
                },
            ],
        )

        self.repo.mark_run_failed(run_id, "worker crashed")
        detail = self.repo.get_run_detail(run_id)

        self.assertEqual(detail["run"]["status"], "failed")
        self.assertEqual(detail["run"]["failed_items"], 2)
        self.assertIn("worker crashed", detail["run"]["error_message"])
        self.assertEqual([item["status"] for item in detail["items"]], ["failed", "failed"])

    def test_recover_interrupted_runs_marks_running_run_and_items_terminal(self):
        run_id = self.repo.create_run(
            label="Recover running",
            strategy="desktop",
            site_keys=["www"],
            worker_count=1,
            target_budget_seconds=60,
            total_items=2,
        )
        first_id, _second_id = self.repo.create_items(
            run_id,
            [
                {
                    "source_filename": "PDP.csv",
                    "group_key": "PDP",
                    "site_key": "www",
                    "original_value": "brass-lamp/",
                    "generated_url": "https://www.lampsplus.com/p/brass-lamp/",
                    "strategy": "desktop",
                },
                {
                    "source_filename": "PDP.csv",
                    "group_key": "PDP",
                    "site_key": "www",
                    "original_value": "floor-lamp/",
                    "generated_url": "https://www.lampsplus.com/p/floor-lamp/",
                    "strategy": "desktop",
                },
            ],
        )
        self.repo.mark_run_running(run_id)
        self.repo.mark_item_running(first_id)
        with self.conn_mgr.get_connection() as conn:
            conn.execute(
                """
                UPDATE csv_lighthouse_runs
                SET updated_at = datetime('now', '-31 minutes')
                WHERE id = ?
                """,
                (run_id,),
            )

        recovered = self.repo.recover_interrupted_runs(
            "Run interrupted by server restart", stale_seconds=1800
        )
        detail = self.repo.get_run_detail(run_id)

        self.assertEqual(recovered, 1)
        self.assertEqual(detail["run"]["status"], "interrupted")
        self.assertEqual(detail["run"]["failed_items"], 2)
        self.assertEqual(detail["run"]["cancelled_items"], 0)
        self.assertIn("server restart", detail["run"]["error_message"])
        self.assertEqual([item["status"] for item in detail["items"]], ["failed", "failed"])

    def test_recover_interrupted_runs_skips_fresh_pending_and_running_runs(self):
        pending_id = self.repo.create_run(
            label="Fresh pending",
            strategy="desktop",
            site_keys=["www"],
            worker_count=1,
            target_budget_seconds=60,
            total_items=0,
        )
        running_id = self.repo.create_run(
            label="Fresh running",
            strategy="desktop",
            site_keys=["www"],
            worker_count=1,
            target_budget_seconds=60,
            total_items=0,
        )
        self.repo.mark_run_running(running_id)

        recovered = self.repo.recover_interrupted_runs(
            "Run interrupted by server restart", stale_seconds=1800
        )

        self.assertEqual(recovered, 0)
        self.assertEqual(self.repo.get_run_detail(pending_id)["run"]["status"], "pending")
        self.assertEqual(self.repo.get_run_detail(running_id)["run"]["status"], "running")

    def test_recover_interrupted_runs_recovers_only_stale_runs(self):
        fresh_id = self.repo.create_run(
            label="Fresh running",
            strategy="desktop",
            site_keys=["www"],
            worker_count=1,
            target_budget_seconds=60,
            total_items=0,
        )
        stale_id = self.repo.create_run(
            label="Stale running",
            strategy="desktop",
            site_keys=["www"],
            worker_count=1,
            target_budget_seconds=60,
            total_items=0,
        )
        self.repo.mark_run_running(fresh_id)
        self.repo.mark_run_running(stale_id)
        with self.conn_mgr.get_connection() as conn:
            conn.execute(
                """
                UPDATE csv_lighthouse_runs
                SET updated_at = datetime('now', '-31 minutes')
                WHERE id = ?
                """,
                (stale_id,),
            )

        recovered = self.repo.recover_interrupted_runs(
            "Run interrupted by server restart", stale_seconds=1800
        )

        self.assertEqual(recovered, 1)
        self.assertEqual(self.repo.get_run_detail(fresh_id)["run"]["status"], "running")
        stale = self.repo.get_run_detail(stale_id)["run"]
        self.assertEqual(stale["status"], "interrupted")
        self.assertIn("server restart", stale["error_message"])

    def test_list_library_is_empty_on_fresh_schema(self):
        self.assertEqual(self.repo.list_library(), [])

    def test_upsert_library_file_inserts_then_updates_by_filename(self):
        self.repo.upsert_library_file("PLP.csv", "PLP", "a/\nb/\n", 2)
        self.repo.upsert_library_file("PLP.csv", "PLP", "c/\n", 1)
        library = self.repo.list_library()
        self.assertEqual(len(library), 1)
        self.assertEqual(library[0]["filename"], "PLP.csv")
        self.assertEqual(library[0]["row_count"], 1)
        self.assertEqual(library[0]["csv_text"], "c/\n")

    def test_delete_library_file_removes_row(self):
        self.repo.upsert_library_file("PLP.csv", "PLP", "a/\n", 1)
        self.repo.delete_library_file("PLP.csv")
        self.assertEqual(self.repo.list_library(), [])

    def test_mark_item_running_refreshes_stale_run_activity(self):
        run_id = self.repo.create_run(
            label="Active worker",
            strategy="desktop",
            site_keys=["www"],
            worker_count=1,
            target_budget_seconds=60,
            total_items=1,
        )
        item_id = self.repo.create_items(
            run_id,
            [
                {
                    "source_filename": "PDP.csv",
                    "group_key": "PDP",
                    "site_key": "www",
                    "original_value": "brass-lamp/",
                    "generated_url": "https://www.lampsplus.com/p/brass-lamp/",
                    "strategy": "desktop",
                }
            ],
        )[0]
        self.repo.mark_run_running(run_id)
        with self.conn_mgr.get_connection() as conn:
            conn.execute(
                """
                UPDATE csv_lighthouse_runs
                SET updated_at = datetime('now', '-31 minutes')
                WHERE id = ?
                """,
                (run_id,),
            )

        self.assertTrue(self.repo.mark_item_running(item_id))
        recovered = self.repo.recover_interrupted_runs(
            "Run interrupted by server restart", stale_seconds=1800
        )

        detail = self.repo.get_run_detail(run_id)
        self.assertEqual(recovered, 0)
        self.assertEqual(detail["run"]["status"], "running")
        self.assertEqual(detail["items"][0]["status"], "running")


if __name__ == "__main__":
    unittest.main()
