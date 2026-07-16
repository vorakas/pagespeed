import csv
import io
import os
import tempfile
import unittest
from unittest.mock import patch

from data_access.connection import ConnectionManager
from data_access.csv_lighthouse_repository import CsvLighthouseRepository
from exceptions import ValidationError
import services.csv_lighthouse_service as csv_lighthouse_service
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


class FailsOncePageSpeedClient(FakePageSpeedClient):
    def __init__(self):
        super().__init__()
        self.failures = 0

    def test_url(self, url, strategy):
        self.calls.append((url, strategy))
        if self.failures == 0:
            self.failures += 1
            raise RuntimeError("temporary PageSpeed failure")
        return {
            "fcp": 700,
            "speed_index": 1100,
            "lcp": 1600,
            "tbt": 40,
            "cls": 0.01,
        }


class AlwaysFailsPageSpeedClient(FakePageSpeedClient):
    def test_url(self, url, strategy):
        self.calls.append((url, strategy))
        raise RuntimeError("permanent PageSpeed failure")


class SequencePageSpeedClient(FakePageSpeedClient):
    """Returns a scripted FCP per call so median is predictable."""

    def __init__(self, fcp_values):
        super().__init__()
        self._fcp_values = list(fcp_values)

    def test_url(self, url, strategy):
        self.calls.append((url, strategy))
        fcp = self._fcp_values[(len(self.calls) - 1) % len(self._fcp_values)]
        return {"fcp": fcp, "speed_index": 1200, "lcp": 1800, "tbt": 50, "cls": 0.02}


class CancellingPageSpeedClient(FakePageSpeedClient):
    def __init__(self, repository, run_id_getter):
        super().__init__()
        self.repository = repository
        self.run_id_getter = run_id_getter

    def test_url(self, url, strategy):
        result = super().test_url(url, strategy)
        self.repository.request_cancel(self.run_id_getter())
        return result


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

    def test_save_library_files_upserts_recognized_files(self):
        self.service.save_library_files(
            [("PLP.csv", io.BytesIO(b"brass-lamp/\nfloor-lamp/\n"))]
        )
        library = self.service.list_library()
        self.assertEqual(len(library), 1)
        self.assertEqual(library[0]["filename"], "PLP.csv")
        self.assertEqual(library[0]["group_key"], "PLP")
        self.assertEqual(library[0]["row_count"], 2)

    def test_save_library_files_rejects_unrecognized_filename(self):
        with self.assertRaisesRegex(ValidationError, "Unrecognized CSV filename"):
            self.service.save_library_files(
                [("Unknown.csv", io.BytesIO(b"brass-lamp/\n"))]
            )
        self.assertEqual(self.service.list_library(), [])

    def test_save_library_files_persists_recognized_before_rejecting_unrecognized(self):
        with self.assertRaisesRegex(ValidationError, "Unrecognized CSV filename"):
            self.service.save_library_files(
                [
                    ("PLP.csv", io.BytesIO(b"brass-lamp/\n")),
                    ("Unknown.csv", io.BytesIO(b"floor-lamp/\n")),
                ]
            )
        library = self.service.list_library()
        self.assertEqual([f["filename"] for f in library], ["PLP.csv"])

    def test_delete_library_file_removes_it(self):
        self.service.save_library_files([("PLP.csv", io.BytesIO(b"brass-lamp/\n"))])
        self.service.delete_library_file("PLP.csv")
        self.assertEqual(self.service.list_library(), [])

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

    def test_create_run_saves_uploaded_file_records(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\nfloor-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
            label="Editable",
        )

        files = self.service.list_files(result["run_id"])

        self.assertEqual(len(files), 1)
        self.assertEqual(files[0]["filename"], "PDP.csv")
        self.assertEqual(files[0]["row_count"], 2)
        self.assertEqual(files[0]["csv_text"], "brass-lamp/\nfloor-lamp/\n")

    def test_create_run_allows_duplicate_uploaded_filenames(self):
        result = self.service.create_run(
            [
                ("PDP.csv", io.BytesIO(b"brass-lamp/\n")),
                ("PDP.csv", io.BytesIO(b"floor-lamp/\n")),
            ],
            site_keys=["www"],
            strategy="desktop",
            label="Duplicate filenames",
        )

        files = self.service.list_files(result["run_id"])
        detail = self.service.get_run(result["run_id"])

        self.assertEqual(len(files), 2)
        self.assertEqual([file["filename"] for file in files], ["PDP.csv", "PDP.csv"])
        self.assertEqual(detail["run"]["total_items"], 2)

    def test_create_run_leaves_run_pending_for_file_edits(self):
        service = CsvLighthouseService(self.repo, self.pagespeed, start_background=True)

        result = service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
        )
        detail = self.repo.get_run_detail(result["run_id"])

        self.assertEqual(detail["run"]["status"], "pending")
        self.assertEqual(self.pagespeed.calls, [])

    def test_start_run_processes_pending_run(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
        )

        detail = self.service.start_run(result["run_id"])

        self.assertEqual(detail["run"]["status"], "completed")
        self.assertEqual(len(self.pagespeed.calls), 1)

    def test_update_file_rebuilds_pending_items(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"old-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
            label="Editable",
        )
        file_id = self.service.list_files(result["run_id"])[0]["id"]

        self.service.update_file(file_id, "new-lamp/\nother-lamp/\n")
        detail = self.service.get_run(result["run_id"])
        urls = [item["generated_url"] for item in detail["items"]]

        self.assertEqual(
            urls,
            [
                "https://www.lampsplus.com/p/new-lamp/",
                "https://www.lampsplus.com/p/other-lamp/",
            ],
        )

    def test_update_file_is_rejected_after_run_starts(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"old-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
            label="Locked",
        )
        file_id = self.service.list_files(result["run_id"])[0]["id"]
        self.repo.mark_run_running(result["run_id"])

        with self.assertRaises(ValidationError):
            self.service.update_file(file_id, "new-lamp/\n")

    def test_delete_file_rebuilds_pending_items(self):
        result = self.service.create_run(
            [
                ("PDP.csv", io.BytesIO(b"old-lamp/\n")),
                ("SFP.csv", io.BytesIO(b"swing-arm/\n")),
            ],
            site_keys=["www"],
            strategy="desktop",
            label="Editable",
        )
        file_id = next(
            file["id"]
            for file in self.service.list_files(result["run_id"])
            if file["filename"] == "PDP.csv"
        )

        self.service.delete_file(file_id)
        detail = self.service.get_run(result["run_id"])

        self.assertEqual([item["source_filename"] for item in detail["items"]], ["SFP.csv"])

    def test_delete_run_removes_run_items_and_files(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
            label="Disposable",
        )
        run_id = result["run_id"]

        self.service.delete_run(run_id)

        self.assertIsNone(self.repo.get_run_detail(run_id)["run"])
        self.assertEqual(self.repo.get_run_detail(run_id)["items"], [])
        self.assertEqual(self.service.list_files(run_id), [])
        self.assertNotIn(run_id, [run["id"] for run in self.service.list_runs()])

    def test_delete_run_rejected_while_running(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
        )
        run_id = result["run_id"]
        self.repo.mark_run_running(run_id)

        with self.assertRaises(ValidationError):
            self.service.delete_run(run_id)

        self.assertIsNotNone(self.repo.get_run_detail(run_id)["run"])

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

    def test_run_samples_each_url_n_times_and_stores_median(self):
        pagespeed = SequencePageSpeedClient([100, 900, 500])
        service = CsvLighthouseService(self.repo, pagespeed, start_background=False)
        result = service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
            samples_per_url=3,
        )

        service.run_pending_items(result["run_id"])
        detail = self.repo.get_run_detail(result["run_id"])
        item = detail["items"][0]
        samples = self.repo.list_samples(result["run_id"])

        self.assertEqual(len(pagespeed.calls), 3)
        self.assertEqual(len(samples), 3)
        self.assertEqual(item["status"], "passed")
        self.assertEqual(item["fcp"], 500)  # median of 100, 900, 500

    def test_single_sample_run_matches_legacy_behavior(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
        )
        self.service.run_pending_items(result["run_id"])
        detail = self.repo.get_run_detail(result["run_id"])
        item = detail["items"][0]
        samples = self.repo.list_samples(result["run_id"])

        self.assertEqual(len(self.pagespeed.calls), 1)
        self.assertEqual(len(samples), 1)
        self.assertEqual(item["fcp"], 900)

    def test_item_fails_when_all_samples_fail(self):
        pagespeed = AlwaysFailsPageSpeedClient()
        service = CsvLighthouseService(self.repo, pagespeed, start_background=False)
        result = service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
            samples_per_url=2,
        )
        service.run_pending_items(result["run_id"])
        item = self.repo.get_run_detail(result["run_id"])["items"][0]
        samples = self.repo.list_samples(result["run_id"])

        self.assertEqual(item["status"], "failed")
        self.assertEqual(len(samples), 2)
        self.assertTrue(all(s["status"] == "failed" for s in samples))

    def test_export_csv_has_raw_samples_and_per_url_summary(self):
        # Mean (400) and median (200) differ, so the two stats are independently pinned.
        pagespeed = SequencePageSpeedClient([100, 200, 900])
        service = CsvLighthouseService(self.repo, pagespeed, start_background=False)
        result = service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
            label="Export smoke",
            samples_per_url=3,
        )
        service.run_pending_items(result["run_id"])

        exported = service.export_csv(result["run_id"])
        rows = list(csv.reader(io.StringIO(exported)))
        header = rows[0]

        self.assertEqual(
            header,
            [
                "run_id", "label", "source_filename", "group_key", "site_key",
                "original_value", "generated_url", "strategy", "kind",
                "sample_index", "n", "status", "fcp", "speed_index", "lcp",
                "tbt", "cls", "attempts", "duration_ms", "error_message",
                "completed_at",
            ],
        )

        kind_idx = header.index("kind")
        fcp_idx = header.index("fcp")
        n_idx = header.index("n")

        sample_rows = [r for r in rows[1:] if r[kind_idx] == "sample"]
        self.assertEqual(len(sample_rows), 3)
        self.assertEqual([r[fcp_idx] for r in sample_rows], ["100", "200", "900"])

        mean_row = next(r for r in rows[1:] if r[kind_idx] == "mean")
        median_row = next(r for r in rows[1:] if r[kind_idx] == "median")
        min_row = next(r for r in rows[1:] if r[kind_idx] == "min")
        max_row = next(r for r in rows[1:] if r[kind_idx] == "max")

        self.assertEqual(mean_row[fcp_idx], "400")       # (100+200+900)/3=400.0, _csv_value collapses to 400
        self.assertEqual(median_row[fcp_idx], "200")     # median of 100,200,900
        self.assertEqual(min_row[fcp_idx], "100")
        self.assertEqual(max_row[fcp_idx], "900")
        self.assertEqual(median_row[n_idx], "3")

    def test_export_csv_synthesizes_sample_for_legacy_run(self):
        # A run whose item was marked passed directly, with no sample rows.
        run_id = self.repo.create_run("Legacy", "desktop", ["www"], 1, 540, 1)
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
        self.repo.mark_item_running(item_id)
        self.repo.mark_item_passed(item_id, {"fcp": 800, "speed_index": 1000, "lcp": 1500, "tbt": 30, "cls": 0.01, "attempts": 1, "duration_ms": 1200})

        exported = self.service.export_csv(run_id)
        rows = list(csv.reader(io.StringIO(exported)))
        header = rows[0]
        kind_idx = header.index("kind")
        fcp_idx = header.index("fcp")

        sample_rows = [r for r in rows[1:] if r[kind_idx] == "sample"]
        self.assertEqual(len(sample_rows), 1)
        self.assertEqual(sample_rows[0][fcp_idx], "800")
        median_row = next(r for r in rows[1:] if r[kind_idx] == "median")
        self.assertEqual(median_row[fcp_idx], "800")

    def test_export_csv_synthesizes_failed_sample_for_legacy_failed_run(self):
        # A legacy failed item (no sample rows) synthesizes one failed sample
        # and yields summary rows with n=0 and blank stats.
        run_id = self.repo.create_run("Legacy fail", "desktop", ["www"], 1, 540, 1)
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
        self.repo.mark_item_running(item_id)
        self.repo.mark_item_failed(item_id, "PageSpeed timeout", attempts=2)

        exported = self.service.export_csv(run_id)
        rows = list(csv.reader(io.StringIO(exported)))
        header = rows[0]
        kind_idx = header.index("kind")
        fcp_idx = header.index("fcp")
        n_idx = header.index("n")
        status_idx = header.index("status")
        error_idx = header.index("error_message")

        sample_rows = [r for r in rows[1:] if r[kind_idx] == "sample"]
        self.assertEqual(len(sample_rows), 1)
        self.assertEqual(sample_rows[0][status_idx], "failed")
        self.assertEqual(sample_rows[0][fcp_idx], "")
        self.assertEqual(sample_rows[0][error_idx], "PageSpeed timeout")
        median_row = next(r for r in rows[1:] if r[kind_idx] == "median")
        self.assertEqual(median_row[n_idx], "0")
        self.assertEqual(median_row[fcp_idx], "")

    def test_create_run_recognizes_plp_filenames(self):
        from services.testdata_registry import group_for_filename

        self.assertEqual(group_for_filename("Search.csv").key, "Search")
        self.assertEqual(group_for_filename("PLP.csv").key, "PLP")
        self.assertEqual(group_for_filename("SearchToPLP.csv").key, "SearchToPLP")

    def test_create_run_recognizes_homepage_filename(self):
        from services.testdata_registry import group_for_filename

        self.assertEqual(group_for_filename("Homepage.csv").key, "Homepage")

    def test_create_run_builds_homepage_root_urls_for_selected_sites(self):
        result = self.service.create_run(
            [("Homepage.csv", io.BytesIO(b"home\n"))],
            site_keys=["www", "mcprod"],
            strategy="mobile",
            label="Homepage",
        )

        detail = self.repo.get_run_detail(result["run_id"])
        urls = [item["generated_url"] for item in detail["items"]]

        self.assertEqual(result["total_items"], 2)
        self.assertEqual(
            urls,
            [
                "https://www.lampsplus.com/",
                "https://mcprod.lampsplus.com/",
            ],
        )

    def test_create_run_homepage_respects_single_site_selection(self):
        result = self.service.create_run(
            [("Homepage.csv", io.BytesIO(b"home\n"))],
            site_keys=["www"],
            strategy="desktop",
            label="Homepage www only",
        )

        detail = self.repo.get_run_detail(result["run_id"])
        urls = [item["generated_url"] for item in detail["items"]]

        self.assertEqual(urls, ["https://www.lampsplus.com/"])

    def test_create_run_normalizes_search_to_plp_full_url_without_double_prefix(self):
        result = self.service.create_run(
            [
                (
                    "SearchToPLP.csv",
                    io.BytesIO(b"https://www.lampsplus.com/s/s_chandelier/?s=1\n"),
                )
            ],
            site_keys=["www"],
            strategy="desktop",
        )

        item = self.repo.get_run_detail(result["run_id"])["items"][0]

        self.assertEqual(item["original_value"], "chandelier")
        self.assertEqual(
            item["generated_url"], "https://www.lampsplus.com/s/s_chandelier/?s=1"
        )

    def test_create_run_normalizes_search_to_pdp_full_url_without_double_prefix(self):
        result = self.service.create_run(
            [
                (
                    "SearchToPDP.csv",
                    io.BytesIO(b"https://mcprod.lampsplus.com/s/s_chandelier/?s=1\n"),
                )
            ],
            site_keys=["mcprod"],
            strategy="mobile",
        )

        item = self.repo.get_run_detail(result["run_id"])["items"][0]

        self.assertEqual(item["original_value"], "chandelier")
        self.assertEqual(
            item["generated_url"],
            "https://mcprod.lampsplus.com/s/s_chandelier/?s=1",
        )

    def test_create_run_raises_validation_error_for_bad_csv_encoding(self):
        with self.assertRaisesRegex(ValidationError, "Unable to decode"):
            self.service.create_run(
                [("PDP.csv", io.BytesIO(b"\xff\xfe\xfa"))],
                site_keys=["www"],
                strategy="desktop",
            )

        self.assertEqual(self.repo.list_runs(), [])

    def test_create_run_raises_validation_error_for_unknown_only_uploads(self):
        with self.assertRaisesRegex(ValidationError, "recognized CSV rows"):
            self.service.create_run(
                [("Unknown.csv", io.BytesIO(b"brass-lamp/\n"))],
                site_keys=["www"],
                strategy="desktop",
            )

        self.assertEqual(self.repo.list_runs(), [])

    def test_create_run_raises_validation_error_for_empty_uploads(self):
        with self.assertRaisesRegex(ValidationError, "recognized CSV rows"):
            self.service.create_run(
                [("PDP.csv", io.BytesIO(b"\n  \n"))],
                site_keys=["www"],
                strategy="desktop",
            )

        self.assertEqual(self.repo.list_runs(), [])

    def test_create_run_rejects_csv_with_too_many_rows(self):
        with patch.object(csv_lighthouse_service, "CSV_LIGHTHOUSE_MAX_ROWS_PER_FILE", 1):
            with self.assertRaisesRegex(ValidationError, "PDP.csv exceeds 1 rows"):
                self.service.create_run(
                    [("PDP.csv", io.BytesIO(b"brass-lamp/\nfloor-lamp/\n"))],
                    site_keys=["www"],
                    strategy="desktop",
                )

        self.assertEqual(self.repo.list_runs(), [])

    def test_create_run_rejects_too_many_generated_items(self):
        with patch.object(csv_lighthouse_service, "CSV_LIGHTHOUSE_MAX_ITEMS_PER_RUN", 1):
            with self.assertRaisesRegex(
                ValidationError, "CSV Lighthouse run would create 2 items; maximum is 1"
            ):
                self.service.create_run(
                    [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
                    site_keys=["www", "mcprod"],
                    strategy="desktop",
                )

        self.assertEqual(self.repo.list_runs(), [])

    def test_create_run_stores_samples_per_url(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
            label="Sampled",
            samples_per_url=25,
        )
        run = self.service.get_run(result["run_id"])["run"]
        self.assertEqual(run["samples_per_url"], 25)

    def test_create_run_accepts_string_samples_per_url_from_form(self):
        # The Flask form delivers strings; the service must coerce.
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
            samples_per_url="25",
        )
        run = self.service.get_run(result["run_id"])["run"]
        self.assertEqual(run["samples_per_url"], 25)

    def test_create_run_defaults_samples_per_url_to_one(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
        )
        run = self.service.get_run(result["run_id"])["run"]
        self.assertEqual(run["samples_per_url"], 1)

    def test_create_run_rejects_samples_per_url_over_cap(self):
        with patch.object(csv_lighthouse_service, "CSV_LIGHTHOUSE_MAX_SAMPLES_PER_URL", 10):
            with self.assertRaisesRegex(ValidationError, "samples per URL"):
                self.service.create_run(
                    [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
                    site_keys=["www"],
                    strategy="desktop",
                    samples_per_url=11,
                )
        self.assertEqual(self.repo.list_runs(), [])

    def test_create_run_rejects_too_many_total_samples(self):
        with patch.object(csv_lighthouse_service, "CSV_LIGHTHOUSE_MAX_TOTAL_SAMPLES", 1):
            with self.assertRaisesRegex(ValidationError, "total samples"):
                self.service.create_run(
                    [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
                    site_keys=["www", "mcprod"],
                    strategy="desktop",
                    samples_per_url=1,
                )
        self.assertEqual(self.repo.list_runs(), [])

    def test_cancel_stops_scheduling_new_items_and_marks_pending_cancelled(self):
        run_id_holder = {}
        service = CsvLighthouseService(
            self.repo,
            CancellingPageSpeedClient(self.repo, lambda: run_id_holder["run_id"]),
            start_background=False,
        )
        result = service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\nfloor-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
        )
        run_id_holder["run_id"] = result["run_id"]

        service.run_pending_items(result["run_id"])
        detail = self.repo.get_run_detail(result["run_id"])
        statuses = [item["status"] for item in detail["items"]]

        self.assertEqual(detail["run"]["status"], "cancelled")
        self.assertEqual(statuses, ["passed", "cancelled"])

    def test_cancel_between_samples_stops_early_and_keeps_passed(self):
        run_id_holder = {}
        service = CsvLighthouseService(
            self.repo,
            CancellingPageSpeedClient(self.repo, lambda: run_id_holder["run_id"]),
            start_background=False,
        )
        result = service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
            samples_per_url=5,
        )
        run_id_holder["run_id"] = result["run_id"]

        service.run_pending_items(result["run_id"])
        detail = self.repo.get_run_detail(result["run_id"])
        item = detail["items"][0]
        samples = self.repo.list_samples(result["run_id"])

        # Cancel fires after sample 1's PSI call; sample 2 sees it and breaks.
        self.assertEqual(len(samples), 1)
        self.assertEqual(item["status"], "passed")

    def test_late_cancel_after_all_items_passed_finishes_completed_and_exports(self):
        run_id_holder = {}
        service = CsvLighthouseService(
            self.repo,
            CancellingPageSpeedClient(self.repo, lambda: run_id_holder["run_id"]),
            start_background=False,
        )
        result = service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
            label="Late cancel",
        )
        run_id_holder["run_id"] = result["run_id"]

        service.run_pending_items(result["run_id"])
        detail = self.repo.get_run_detail(result["run_id"])
        exported = service.export_csv(result["run_id"])

        self.assertEqual(detail["run"]["status"], "completed")
        self.assertTrue(detail["run"]["cancel_requested"])
        self.assertEqual(detail["items"][0]["status"], "passed")
        self.assertIn("Late cancel", exported)

    def test_recover_interrupted_runs_marks_running_work_interrupted(self):
        run_id = self.repo.create_run(
            label="Restarted",
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

        recovered = self.service.recover_interrupted_runs()
        detail = self.repo.get_run_detail(run_id)

        self.assertEqual(recovered, 1)
        self.assertEqual(detail["run"]["status"], "interrupted")
        self.assertIn("server restart", detail["run"]["error_message"])
        self.assertEqual([item["status"] for item in detail["items"]], ["failed", "failed"])

    def test_worker_exception_marks_run_failed_and_clears_pending_rows(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\nfloor-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
        )
        self.repo.mark_item_running = lambda item_id: (_ for _ in ()).throw(
            RuntimeError("claim failed")
        )

        self.service.run_pending_items(result["run_id"])
        detail = self.repo.get_run_detail(result["run_id"])
        statuses = [item["status"] for item in detail["items"]]

        self.assertEqual(detail["run"]["status"], "failed")
        self.assertIn("claim failed", detail["run"]["error_message"])
        self.assertEqual(statuses, ["failed", "failed"])

    def test_background_thread_is_not_daemon(self):
        created_threads = []

        class RecordingThread:
            def __init__(self, *args, **kwargs):
                self.args = args
                self.kwargs = kwargs
                created_threads.append(self)

            def start(self):
                return None

        service = CsvLighthouseService(self.repo, self.pagespeed, start_background=True)

        result = service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
        )

        with patch("services.csv_lighthouse_service.threading.Thread", RecordingThread):
            service.start_run(result["run_id"])

        self.assertEqual(created_threads[0].kwargs.get("daemon"), False)

    def test_start_run_rejects_non_pending_run(self):
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
        )
        self.repo.mark_run_running(result["run_id"])

        with self.assertRaises(ValidationError):
            self.service.start_run(result["run_id"])

    def test_page_speed_failure_retries_once_and_saves_passing_metrics(self):
        pagespeed = FailsOncePageSpeedClient()
        service = CsvLighthouseService(self.repo, pagespeed, start_background=False)
        result = service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
        )

        service.run_pending_items(result["run_id"])
        detail = self.repo.get_run_detail(result["run_id"])
        item = detail["items"][0]

        self.assertEqual(len(pagespeed.calls), 2)
        self.assertEqual(item["status"], "passed")
        self.assertEqual(item["attempts"], 2)
        self.assertEqual(item["fcp"], 700)

    def test_page_speed_failure_retries_once_and_saves_final_failure(self):
        pagespeed = AlwaysFailsPageSpeedClient()
        service = CsvLighthouseService(self.repo, pagespeed, start_background=False)
        result = service.create_run(
            [("PDP.csv", io.BytesIO(b"brass-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
        )

        service.run_pending_items(result["run_id"])
        detail = self.repo.get_run_detail(result["run_id"])
        item = detail["items"][0]

        self.assertEqual(len(pagespeed.calls), 2)
        self.assertEqual(item["status"], "failed")
        self.assertEqual(item["attempts"], 2)
        self.assertIn("permanent PageSpeed failure", item["error_message"])

    def test_create_run_uses_library_when_no_uploads(self):
        self.service.save_library_files([("PDP.csv", io.BytesIO(b"brass-lamp/\n"))])
        result = self.service.create_run(
            [], site_keys=["www"], strategy="desktop", label="From library"
        )
        detail = self.service.get_run(result["run_id"])
        self.assertEqual(result["total_items"], 1)
        self.assertEqual(
            detail["items"][0]["generated_url"],
            "https://www.lampsplus.com/p/brass-lamp/",
        )

    def test_create_run_adhoc_upload_overrides_library_file(self):
        self.service.save_library_files([("PDP.csv", io.BytesIO(b"old-lamp/\n"))])
        result = self.service.create_run(
            [("PDP.csv", io.BytesIO(b"new-lamp/\n"))],
            site_keys=["www"],
            strategy="desktop",
        )
        detail = self.service.get_run(result["run_id"])
        files = self.service.list_files(result["run_id"])
        self.assertEqual([f["filename"] for f in files], ["PDP.csv"])
        self.assertEqual(
            detail["items"][0]["generated_url"],
            "https://www.lampsplus.com/p/new-lamp/",
        )
        self.assertEqual(self.service.list_library()[0]["csv_text"], "old-lamp/\n")

    def test_create_run_adhoc_new_name_adds_without_touching_library(self):
        self.service.save_library_files([("PDP.csv", io.BytesIO(b"brass-lamp/\n"))])
        result = self.service.create_run(
            [("SFP.csv", io.BytesIO(b"swing-arm/\n"))],
            site_keys=["www"],
            strategy="desktop",
        )
        files = sorted(f["filename"] for f in self.service.list_files(result["run_id"]))
        self.assertEqual(files, ["PDP.csv", "SFP.csv"])
        self.assertEqual([f["filename"] for f in self.service.list_library()], ["PDP.csv"])

    def test_create_run_empty_library_and_no_upload_raises(self):
        with self.assertRaisesRegex(ValidationError, "No CSV files available"):
            self.service.create_run([], site_keys=["www"], strategy="desktop")
        self.assertEqual(self.repo.list_runs(), [])
