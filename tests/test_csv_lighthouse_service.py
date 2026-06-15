import csv
import io
import os
import tempfile
import unittest

from data_access.connection import ConnectionManager
from data_access.csv_lighthouse_repository import CsvLighthouseRepository
from services.csv_lighthouse_service import (
    DEFAULT_AVERAGE_SECONDS,
    CsvLighthouseService,
    calculate_worker_count,
    normalize_csv_value,
)


class FakePageSpeedClient:
    def __init__(self):
        self.calls = []

    def test_url(self, url, strategy):
        self.calls.append((url, strategy))
        return {
            "fcp": 900,
            "speed_index": 1200,
            "lcp": 1800,
            "tbt": 50,
            "cls": 0.02,
        }


class CsvLighthouseServiceTest(unittest.TestCase):
    def setUp(self):
        self._cwd = os.getcwd()
        self.tmp = tempfile.TemporaryDirectory()
        os.chdir(self.tmp.name)
        self.conn_mgr = ConnectionManager(db_url=None)
        self.conn_mgr.init_schema()
        self.repo = CsvLighthouseRepository(self.conn_mgr)
        self.pagespeed = FakePageSpeedClient()
        self.service = CsvLighthouseService(
            self.repo, self.pagespeed, start_background=False
        )

    def tearDown(self):
        self.conn_mgr.close_all()
        os.chdir(self._cwd)
        self.tmp.cleanup()

    def test_normalize_csv_value_removes_origin_prefix_and_leading_slash(self):
        self.assertEqual(
            normalize_csv_value(" https://www.lampsplus.com/p/brass-lamp/ "),
            "brass-lamp/",
        )
        self.assertEqual(normalize_csv_value("///s/chandelier"), "chandelier")

    def test_create_run_builds_pdp_urls_for_www_and_mcprod_from_column_a(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"https://www.lampsplus.com/p/brass-lamp/\n"))],
            site_keys=["www", "mcprod"],
            strategy="mobile",
            label="PDP smoke",
        )

        detail = self.repo.get_run_detail(result["run_id"])
        urls = [item["generated_url"] for item in detail["items"]]

        self.assertEqual(result["total_items"], 2)
        self.assertEqual(
            urls,
            [
                "https://www.lampsplus.com/p/brass-lamp/",
                "https://mcprod.lampsplus.com/p/brass-lamp/",
            ],
        )

    def test_create_run_dedupes_duplicate_rows_by_site_url_strategy(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\nbrass-lamp/\n/p/brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
        )

        detail = self.repo.get_run_detail(result["run_id"])

        self.assertEqual(result["total_items"], 1)
        self.assertEqual(len(detail["items"]), 1)

    def test_calculate_worker_count_caps_at_4_and_targets_budget(self):
        self.assertEqual(calculate_worker_count(1), 1)
        self.assertEqual(calculate_worker_count(12, average_seconds=90), 2)
        self.assertEqual(calculate_worker_count(100, average_seconds=90), 4)
        self.assertEqual(DEFAULT_AVERAGE_SECONDS, 90)

    def test_run_pending_items_saves_metrics_from_pagespeed_client(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
        )

        self.service.run_pending_items(result["run_id"])
        detail = self.repo.get_run_detail(result["run_id"])
        item = detail["items"][0]

        self.assertEqual(self.pagespeed.calls, [(item["generated_url"], "desktop")])
        self.assertEqual(detail["run"]["status"], "completed")
        self.assertEqual(item["status"], "passed")
        self.assertEqual(item["fcp"], 900)
        self.assertEqual(item["speed_index"], 1200)
        self.assertEqual(item["lcp"], 1800)
        self.assertEqual(item["tbt"], 50)
        self.assertEqual(item["cls"], 0.02)

    def test_export_csv_includes_saved_run_rows_and_headers(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
            label="Export smoke",
        )
        self.service.run_pending_items(result["run_id"])

        exported = self.service.export_csv(result["run_id"])
        rows = list(csv.reader(io.StringIO(exported)))

        self.assertEqual(
            rows[0],
            [
                "run_id",
                "label",
                "source_filename",
                "group_key",
                "site_key",
                "original_value",
                "generated_url",
                "strategy",
                "status",
                "fcp",
                "speed_index",
                "lcp",
                "tbt",
                "cls",
                "error_message",
            ],
        )
        self.assertEqual(rows[1][0], str(result["run_id"]))
        self.assertEqual(rows[1][1], "Export smoke")
        self.assertEqual(rows[1][6], "https://www.lampsplus.com/p/brass-lamp/")
        self.assertEqual(rows[1][8], "passed")
        self.assertEqual(rows[1][9:14], ["900", "1200", "1800", "50", "0.02"])

