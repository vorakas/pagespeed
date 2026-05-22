from copy import deepcopy
from datetime import datetime, timezone
import unittest

import requests

from services.qa_testing_service import (
    QaTestingReportService,
    TaskWindow,
    build_status_change_jql,
    build_cycle_report,
    build_daily_burndown,
    collapse_latest_status_changes,
    extract_status_changes,
    is_round_cycle,
)


class QaTestingServiceTest(unittest.TestCase):
    def test_round_cycle_filter_accepts_only_names_ending_with_round_number(self):
        self.assertTrue(is_round_cycle("Gift Card LP Feature E2E Testing - Round 1"))
        self.assertTrue(is_round_cycle("Checkout Flow Round 12"))
        self.assertFalse(is_round_cycle("Checkout Flow Round"))
        self.assertFalse(is_round_cycle("Checkout Flow Round 1 - copy"))
        self.assertFalse(is_round_cycle("PDP Pricing Block E2E Testing - Desktop"))

    def test_build_cycle_report_rolls_up_cases_and_filters_executed_in_range(self):
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)
        cycle = {
            "key": "TC-C1557",
            "name": "Gift Card LP Feature E2E Testing - Round 1",
            "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features/Gift Card",
            "status": "In Progress",
            "items": [
                {"testCaseKey": "TC-T1", "status": "Pass", "executionDate": "2026-05-14T12:00:00.000Z", "executedBy": "qa1"},
                {"testCaseKey": "TC-T2", "status": "Fail", "actualEndDate": "2026-05-13T23:59:59.000Z", "executedBy": "qa2"},
                {"testCaseKey": "TC-T3", "status": "Not Executed"},
            ],
        }
        names = {"TC-T1": "Checkout succeeds", "TC-T2": "Gift card applies", "TC-T3": "Tax displays"}

        report = build_cycle_report(cycle, names, start, end)

        self.assertEqual(report["totalCases"], 3)
        self.assertEqual(report["executedInRange"], 1)
        self.assertEqual(report["statusCounts"], {"Pass": 1, "Fail": 1, "Not Executed": 1})
        self.assertEqual(report["rangeStatusCounts"], {"Pass": 1})
        self.assertEqual(report["progressPercent"], 67)
        self.assertEqual(report["rangeProgressPercent"], 33)
        self.assertEqual(report["testCases"][0]["name"], "Checkout succeeds")
        self.assertTrue(report["testCases"][0]["inRange"])
        self.assertFalse(report["testCases"][1]["inRange"])

    def test_build_cycle_report_places_known_root_cycles_in_expected_sections(self):
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        cases = [
            ("TC-C1426", "Bloomreach LP Feature E2E Testing - Desktop - Round 1", "LP Features"),
            ("TC-C1427", "Bloomreach LP Feature E2E Testing - Mobile - Round 1", "LP Features"),
            ("TC-C1570", "Search & Sort Page E2E Testing - Desktop - Round 1", "Desktop or Tablet"),
            ("TC-C1569", "Search & Sort Page E2E Testing - Mobile - Round 1", "Mobile"),
        ]

        for key, name, expected_section in cases:
            with self.subTest(key=key):
                report = build_cycle_report(
                    {
                        "key": key,
                        "name": name,
                        "folder": "/Adobe Commerce E2E Master Test Cycles",
                        "status": "In Progress",
                        "items": [],
                    },
                    {},
                    start,
                    end,
                )

                self.assertEqual(report["section"], expected_section)

    def test_daily_burndown_accumulates_executions_by_day(self):
        start = datetime(2026, 5, 13, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 23, 59, tzinfo=timezone.utc)
        cycles = [
            {
                "totalCases": 4,
                "testCases": [
                    {"executedAt": "2026-05-13T10:00:00.000Z"},
                    {"executedAt": "2026-05-15T10:00:00.000Z"},
                    {"executedAt": None},
                    {"executedAt": "2026-05-12T10:00:00.000Z"},
                ],
            }
        ]

        points = build_daily_burndown(cycles, start, end)

        self.assertEqual(
            points,
            [
                {"date": "2026-05-13", "executed": 1, "remaining": 3},
                {"date": "2026-05-14", "executed": 1, "remaining": 3},
                {"date": "2026-05-15", "executed": 2, "remaining": 2},
            ],
        )

    def test_extract_status_changes_returns_status_transitions_in_range(self):
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)
        issue = {
            "key": "ACE2E-100",
            "fields": {
                "summary": "Checkout task",
                "issuetype": {"name": "Task"},
                "status": {"name": "In QA"},
                "assignee": {"displayName": "Sam Tester"},
            },
            "changelog": {
                "histories": [
                    {
                        "created": "2026-05-14T08:00:00.000+0000",
                        "author": {"displayName": "Adam Blais"},
                        "items": [{"field": "status", "fromString": "To Do", "toString": "In QA"}],
                    },
                    {
                        "created": "2026-05-13T08:00:00.000+0000",
                        "items": [{"field": "status", "fromString": "Backlog", "toString": "To Do"}],
                    },
                ]
            },
        }

        changes = extract_status_changes(issue, start, end)

        self.assertEqual(len(changes), 1)
        self.assertEqual(changes[0]["key"], "ACE2E-100")
        self.assertEqual(changes[0]["fromStatus"], "To Do")
        self.assertEqual(changes[0]["toStatus"], "In QA")
        self.assertEqual(changes[0]["changedBy"], "Adam Blais")

    def test_status_change_jql_uses_exact_datetime_bounds(self):
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 12, 30, tzinfo=timezone.utc)

        jql = build_status_change_jql(start, end)

        self.assertIn('status changed AFTER "2026/05/13 17:00"', jql)
        self.assertIn('status changed BEFORE "2026/05/15 05:30"', jql)

    def test_status_change_jql_can_use_jira_since_yesterday_window(self):
        now = datetime(2026, 5, 15, 22, 30, tzinfo=timezone.utc)

        jql = build_status_change_jql(
            datetime(2026, 5, 14, 22, 30, tzinfo=timezone.utc),
            now,
            task_window=TaskWindow.SINCE_YESTERDAY,
            now=now,
        )

        self.assertIn("status changed AFTER startOfDay(-1)", jql)
        self.assertNotIn("status changed BEFORE", jql)

    def test_collapse_latest_status_changes_returns_one_row_per_task(self):
        changes = [
            {"key": "ACE2E-1", "changedAt": "2026-05-14T08:00:00Z", "toStatus": "In Progress"},
            {"key": "ACE2E-1", "changedAt": "2026-05-14T09:00:00Z", "toStatus": "QA"},
            {"key": "ACE2E-2", "changedAt": "2026-05-14T07:00:00Z", "toStatus": "Groomed"},
        ]

        collapsed = collapse_latest_status_changes(changes)

        self.assertEqual([change["key"] for change in collapsed], ["ACE2E-1", "ACE2E-2"])
        self.assertEqual(collapsed[0]["toStatus"], "QA")

    def test_build_report_returns_cached_response_for_same_range(self):
        class FakeService(QaTestingReportService):
            def __init__(self):
                super().__init__("token")
                self.cycle_calls = 0
                self.task_calls = 0

            def _fetch_round_cycle_reports(self, start, end, force_refresh=False):
                self.cycle_calls += 1
                return []

            def _fetch_task_status_changes(self, start, end, task_window=TaskWindow.SINCE_YESTERDAY):
                self.task_calls += 1
                return []

        service = FakeService()
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        first = service.build_report(start, end)
        second = service.build_report(start, end)

        self.assertEqual(service.cycle_calls, 1)
        self.assertEqual(service.task_calls, 1)
        self.assertTrue(second["cache"]["hit"])
        self.assertEqual(first["cache"]["key"], second["cache"]["key"])

    def test_build_report_uses_separate_burndown_range(self):
        class FakeService(QaTestingReportService):
            def __init__(self):
                super().__init__("token")

            def _fetch_round_cycle_reports(self, start, end, force_refresh=False):
                return [
                    {
                        "key": "TC-C1",
                        "name": "Checkout Round 1",
                        "section": "Checkout",
                        "totalCases": 1,
                        "executedCases": 1,
                        "executedInRange": 0,
                        "progressPercent": 100,
                        "rangeProgressPercent": 0,
                        "statusCounts": {"Pass": 1},
                        "rangeStatusCounts": {},
                        "testCases": [
                            {
                                "key": "TC-T1",
                                "name": "Checkout succeeds",
                                "status": "Pass",
                                "executedAt": "2026-05-12T12:00:00Z",
                                "inRange": False,
                            }
                        ],
                    }
                ]

            def _fetch_task_status_changes(self, start, end, task_window=TaskWindow.SINCE_YESTERDAY):
                return []

        service = FakeService()
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)
        burndown_start = datetime(2026, 5, 9, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end, burndown_start=burndown_start, burndown_end=end)

        self.assertEqual(report["range"]["start"], "2026-05-14T00:00:00Z")
        self.assertEqual(report["burndownRange"]["start"], "2026-05-09T00:00:00Z")
        self.assertEqual(report["burndown"][3]["date"], "2026-05-12")
        self.assertEqual(report["burndown"][3]["executed"], 1)
        self.assertEqual(report["burndown"][3]["remaining"], 0)

    def test_cycle_search_paginates_full_adobe_master_folder(self):
        def cycle(key: str, name: str) -> dict:
            return {
                "key": key,
                "name": name,
                "folder": "/Adobe Commerce E2E Master Test Cycles/Desktop or Tablet/PDP",
                "status": "In Progress",
                "testCaseCount": 0,
            }

        class FakeService(QaTestingReportService):
            def __init__(self):
                super().__init__("token")
                self.start_offsets = []

            def _get_json(self, path, params=None):
                if path.endswith("/testrun/search"):
                    start_at = int((params or {}).get("startAt") or 0)
                    self.start_offsets.append(start_at)
                    if start_at == 0:
                        return {
                            "values": [
                                cycle(f"TC-C{i}", f"Feature {i} E2E Testing - Round 1")
                                for i in range(1000, 1100)
                            ],
                            "startAt": 0,
                            "maxResults": 100,
                            "total": 101,
                        }
                    if start_at == 100:
                        return {
                            "values": [cycle("TC-C1484", "PDP E2E Testing - Desktop - Round 1")],
                            "startAt": 100,
                            "maxResults": 100,
                            "total": 101,
                        }
                    return {"values": [], "startAt": start_at, "maxResults": 100, "total": 101}
                raise AssertionError(path)

            def _fetch_cycle_details(self, cycles):
                return [{**cycle, "items": []} for cycle in cycles]

            def _fetch_task_status_changes(self, start, end, task_window=TaskWindow.SINCE_YESTERDAY):
                return []

        service = FakeService()
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end, force_refresh=True)

        self.assertEqual(service.start_offsets, [0, 100])
        self.assertEqual(report["summary"]["cycleCount"], 101)
        self.assertIn("TC-C1484", {cycle["key"] for cycle in report["cycles"]})

    def test_build_report_cache_key_uses_15_minute_buckets(self):
        class FakeService(QaTestingReportService):
            def __init__(self):
                super().__init__("token")
                self.calls = 0

            def _fetch_round_cycle_reports(self, start, end, force_refresh=False):
                self.calls += 1
                return []

            def _fetch_task_status_changes(self, start, end, task_window=TaskWindow.SINCE_YESTERDAY):
                return []

        service = FakeService()
        start = datetime(2026, 5, 14, 0, 2, tzinfo=timezone.utc)
        first_end = datetime(2026, 5, 15, 12, 1, tzinfo=timezone.utc)
        second_end = datetime(2026, 5, 15, 12, 14, tzinfo=timezone.utc)

        first = service.build_report(start, first_end)
        second = service.build_report(start, second_end)

        self.assertEqual(service.calls, 1)
        self.assertEqual(
            first["cache"]["key"],
            "2026-05-14T00:00Z|2026-05-15T12:00Z|burndown:2026-05-14T00:00Z|2026-05-15T12:00Z|tasks:sinceYesterday",
        )
        self.assertTrue(second["cache"]["hit"])

    def test_build_report_uses_cached_test_case_names_and_queues_missing_names(self):
        class FakeCache:
            def get_many(self, keys):
                return {"TC-T1": {"name": "Cached checkout case"}}

            def stale_or_missing_keys(self, keys, max_age_days=30):
                return ["TC-T2"]

        class FakeService(QaTestingReportService):
            def __init__(self):
                super().__init__("token", test_case_cache_repo=FakeCache())
                self.queued = []

            def _get_json(self, path, params=None):
                if path.endswith("/testrun/search"):
                    return [
                        {
                            "key": "TC-C1",
                            "name": "Checkout Round 1",
                            "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
                        }
                    ]
                if path.endswith("/testrun/TC-C1"):
                    return {
                        "key": "TC-C1",
                        "name": "Checkout Round 1",
                        "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
                        "items": [
                            {"testCaseKey": "TC-T1", "status": "Pass"},
                            {"testCaseKey": "TC-T2", "status": "Not Executed"},
                        ],
                    }
                raise AssertionError(path)

            def _queue_test_case_name_refresh(self, keys):
                self.queued.extend(keys)
                return len(keys)

            def _fetch_task_status_changes(self, start, end, task_window=TaskWindow.SINCE_YESTERDAY):
                return []

        service = FakeService()
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end, force_refresh=True)

        test_cases = report["cycles"][0]["testCases"]
        self.assertEqual(test_cases[0]["name"], "Cached checkout case")
        self.assertEqual(test_cases[1]["name"], "")
        self.assertEqual(service.queued, ["TC-T2"])
        self.assertEqual(report["nameCache"], {"hitCount": 1, "missCount": 1, "refreshQueued": 1})

    def test_build_report_uses_cached_jira_user_names_and_queues_missing_users(self):
        class FakeUserCache:
            def get_many(self, keys):
                return {"JIRAUSER1": {"display_name": "Jane Tester"}}

            def stale_or_missing_keys(self, keys, max_age_days=180):
                return ["JIRAUSER2"]

        class FakeService(QaTestingReportService):
            def __init__(self):
                super().__init__("token", user_cache_repo=FakeUserCache())
                self.queued_users = []

            def _get_json(self, path, params=None):
                if path.endswith("/testrun/search"):
                    return [
                        {
                            "key": "TC-C1",
                            "name": "Checkout Round 1",
                            "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
                        }
                    ]
                if path.endswith("/testrun/TC-C1"):
                    return {
                        "key": "TC-C1",
                        "name": "Checkout Round 1",
                        "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
                        "items": [
                            {"testCaseKey": "TC-T1", "status": "Pass", "assignedTo": "JIRAUSER1"},
                            {"testCaseKey": "TC-T2", "status": "Pass", "assignedTo": "JIRAUSER2"},
                        ],
                    }
                raise AssertionError(path)

            def _queue_user_refresh(self, keys):
                self.queued_users.extend(keys)
                return len(keys)

            def _fetch_task_status_changes(self, start, end, task_window=TaskWindow.SINCE_YESTERDAY):
                return []

        service = FakeService()
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end, force_refresh=True)

        test_cases = report["cycles"][0]["testCases"]
        self.assertEqual(test_cases[0]["assignedTo"], "Jane Tester")
        self.assertEqual(test_cases[1]["assignedTo"], "JIRAUSER2")
        self.assertEqual(service.queued_users, ["JIRAUSER2"])
        self.assertEqual(report["userCache"], {"hitCount": 1, "missCount": 1, "refreshQueued": 1})

    def test_build_report_returns_fresh_persistent_cache_without_jira_fetch(self):
        class FakeReportCache:
            def get(self, cache_key):
                return {
                    "report": {"summary": {"totalCases": 7}, "cycles": [], "burndown": [], "taskMovement": {}},
                    "lastRefreshedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "refreshStatus": "idle",
                }

        class FakeService(QaTestingReportService):
            def __init__(self):
                super().__init__("token", report_cache_repo=FakeReportCache())

            def _fetch_round_cycle_reports(self, start, end, force_refresh=False):
                raise AssertionError("Jira fetch should not run for fresh persistent cache")

        service = FakeService()
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end)

        self.assertEqual(report["summary"]["totalCases"], 7)
        self.assertTrue(report["cache"]["hit"])
        self.assertTrue(report["cache"]["shared"])
        self.assertFalse(report["cache"]["stale"])

    def test_build_report_uses_latest_shared_snapshot_when_requested_key_missing(self):
        class FakeReportCache:
            def __init__(self):
                self.started = False

            def get(self, cache_key):
                return None

            def get_latest_successful(self):
                return {
                    "cacheKey": "older-default-snapshot",
                    "report": {"summary": {"totalCases": 11}, "cycles": [], "burndown": [], "taskMovement": {}},
                    "lastRefreshedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "refreshStatus": "idle",
                }

            def try_start_refresh(self, *args, **kwargs):
                self.started = True
                return True

        class FakeService(QaTestingReportService):
            def __init__(self, cache):
                super().__init__("token", report_cache_repo=cache)

            def _build_report_uncached(self, *args, **kwargs):
                raise AssertionError("Normal page load should not refresh when a shared snapshot exists")

        cache = FakeReportCache()
        service = FakeService(cache)
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end)

        self.assertEqual(report["summary"]["totalCases"], 11)
        self.assertTrue(report["cache"]["hit"])
        self.assertEqual(report["cache"]["key"], "older-default-snapshot")
        self.assertFalse(cache.started)

    def test_shared_snapshot_recomputes_range_progress_for_requested_range(self):
        class FakeReportCache:
            def __init__(self):
                self.started = False

            def get(self, cache_key):
                return None

            def get_latest_successful(self):
                return {
                    "cacheKey": "older-default-snapshot",
                    "report": {
                        "range": {"start": "2026-05-10T00:00:00Z", "end": "2026-05-11T00:00:00Z"},
                        "burndownRange": {"start": "2026-05-10T00:00:00Z", "end": "2026-05-11T00:00:00Z"},
                        "summary": {
                            "cycleCount": 1,
                            "totalCases": 2,
                            "executedCases": 2,
                            "executedInRange": 0,
                            "remainingCases": 0,
                            "progressPercent": 100,
                            "rangeProgressPercent": 0,
                            "statusCounts": {"Pass": 2},
                            "rangeStatusCounts": {},
                            "taskStatusChanges": 0,
                        },
                        "cycles": [
                            {
                                "key": "TC-C1",
                                "name": "Checkout Round 1",
                                "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
                                "section": "LP Features",
                                "status": "In Progress",
                                "totalCases": 2,
                                "executedCases": 2,
                                "executedInRange": 0,
                                "progressPercent": 100,
                                "rangeProgressPercent": 0,
                                "statusCounts": {"Pass": 2},
                                "rangeStatusCounts": {},
                                "testCases": [
                                    {
                                        "key": "TC-T1",
                                        "name": "In requested range",
                                        "status": "Pass",
                                        "executedAt": "2026-05-14T12:00:00Z",
                                        "inRange": False,
                                    },
                                    {
                                        "key": "TC-T2",
                                        "name": "Outside requested range",
                                        "status": "Pass",
                                        "executedAt": "2026-05-13T12:00:00Z",
                                        "inRange": False,
                                    },
                                ],
                            }
                        ],
                        "burndown": [],
                        "taskMovement": {"jql": "old", "totalChanges": 0, "changes": []},
                    },
                    "lastRefreshedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "refreshStatus": "idle",
                }

            def try_start_refresh(self, *args, **kwargs):
                self.started = True
                return True

        class FakeService(QaTestingReportService):
            def __init__(self, cache):
                super().__init__("token", report_cache_repo=cache)

            def _build_report_uncached(self, *args, **kwargs):
                raise AssertionError("Normal page load should not refresh when a shared snapshot exists")

        cache = FakeReportCache()
        service = FakeService(cache)
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end)

        self.assertEqual(report["range"], {"start": "2026-05-14T00:00:00Z", "end": "2026-05-15T00:00:00Z"})
        self.assertEqual(report["summary"]["executedInRange"], 1)
        self.assertEqual(report["summary"]["rangeProgressPercent"], 50)
        self.assertEqual(report["summary"]["rangeStatusCounts"], {"Pass": 1})
        self.assertTrue(report["cycles"][0]["testCases"][0]["inRange"])
        self.assertFalse(report["cycles"][0]["testCases"][1]["inRange"])
        self.assertFalse(cache.started)

    def test_initial_persistent_load_builds_once_then_reuses_snapshot(self):
        class FakeReportCache:
            def __init__(self):
                self.rows = {}
                self.started = 0

            def get(self, cache_key):
                return self.rows.get(cache_key)

            def get_latest_successful(self):
                rows = list(self.rows.values())
                return rows[-1] if rows else None

            def try_start_refresh(self, *args, **kwargs):
                self.started += 1
                return True

            def save_report(self, cache_key, range_start, range_end, task_window, report):
                self.rows[cache_key] = {
                    "cacheKey": cache_key,
                    "rangeStart": range_start,
                    "rangeEnd": range_end,
                    "taskWindow": task_window,
                    "report": deepcopy(report),
                    "lastRefreshedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "refreshStatus": "idle",
                }

            def mark_refresh_failed(self, *args, **kwargs):
                return None

        class FakeService(QaTestingReportService):
            def __init__(self, cache):
                super().__init__("token", report_cache_repo=cache)
                self.build_count = 0

            def _build_report_uncached(self, *args, **kwargs):
                self.build_count += 1
                return {"summary": {"totalCases": 13}, "cycles": [], "burndown": [], "taskMovement": {}}

        cache = FakeReportCache()
        service = FakeService(cache)
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        first = service.build_report(start, end)
        second = service.build_report(start, end)
        third = service.build_report(start.replace(hour=1), end.replace(hour=1))

        self.assertFalse(first["cache"]["hit"])
        self.assertTrue(second["cache"]["hit"])
        self.assertTrue(third["cache"]["hit"])
        self.assertTrue(third["cache"]["stale"])
        self.assertEqual(service.build_count, 1)
        self.assertEqual(cache.started, 1)

    def test_force_refresh_ignores_latest_shared_snapshot_and_rebuilds(self):
        class FakeReportCache:
            def get(self, cache_key):
                return None

            def get_latest_successful(self):
                return None

            def try_start_refresh(self, *args, **kwargs):
                return True

            def save_report(self, *args, **kwargs):
                return None

            def mark_refresh_failed(self, *args, **kwargs):
                return None

        class FakeService(QaTestingReportService):
            def __init__(self):
                super().__init__("token", report_cache_repo=FakeReportCache())
                self.thread_started = False
                self.thread_force_refresh = False

            def _build_report_uncached(
                self,
                start,
                end,
                task_window=TaskWindow.SINCE_YESTERDAY,
                burndown_start=None,
                burndown_end=None,
                force_refresh=False,
            ):
                raise AssertionError("Force refresh should rebuild in the background")

            def _start_report_refresh_thread(
                self,
                cache_key,
                start,
                end,
                task_window,
                burndown_start,
                burndown_end,
                force_refresh=False,
            ):
                self.thread_started = True
                self.thread_force_refresh = force_refresh

        service = FakeService()
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end, force_refresh=True)

        self.assertEqual(report["summary"]["totalCases"], 0)
        self.assertFalse(report["cache"]["hit"])
        self.assertTrue(report["cache"]["stale"])
        self.assertTrue(report["cache"]["refreshInProgress"])
        self.assertTrue(service.thread_started)
        self.assertTrue(service.thread_force_refresh)

    def test_force_refresh_rebuilds_when_persistent_cache_exists(self):
        class FakeReportCache:
            def get(self, cache_key):
                return {
                    "report": {"summary": {"totalCases": 7}, "cycles": [], "burndown": [], "taskMovement": {}},
                    "lastRefreshedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "refreshStatus": "idle",
                }

            def try_start_refresh(self, *args, **kwargs):
                return True

            def get_latest_successful(self):
                return None

            def save_report(self, *args, **kwargs):
                return None

            def mark_refresh_failed(self, *args, **kwargs):
                return None

        class FakeService(QaTestingReportService):
            def __init__(self):
                super().__init__("token", report_cache_repo=FakeReportCache())
                self.thread_started = False
                self.thread_force_refresh = False

            def _build_report_uncached(
                self,
                start,
                end,
                task_window=TaskWindow.SINCE_YESTERDAY,
                burndown_start=None,
                burndown_end=None,
                force_refresh=False,
            ):
                raise AssertionError("Force refresh should rebuild in the background")

            def _start_report_refresh_thread(
                self,
                cache_key,
                start,
                end,
                task_window,
                burndown_start,
                burndown_end,
                force_refresh=False,
            ):
                self.thread_started = True
                self.thread_force_refresh = force_refresh

        service = FakeService()
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end, force_refresh=True)

        self.assertEqual(report["summary"]["totalCases"], 7)
        self.assertTrue(report["cache"]["hit"])
        self.assertTrue(report["cache"]["stale"])
        self.assertTrue(report["cache"]["refreshInProgress"])
        self.assertTrue(service.thread_started)
        self.assertTrue(service.thread_force_refresh)

    def test_persistent_cache_with_name_misses_still_returns_snapshot_without_refresh(self):
        class FakeReportCache:
            def __init__(self):
                self.started = False

            def get(self, cache_key):
                return {
                    "report": {
                        "summary": {"totalCases": 7},
                        "cycles": [],
                        "burndown": [],
                        "taskMovement": {},
                        "nameCache": {"hitCount": 0, "missCount": 1, "refreshQueued": 1},
                        "userCache": {"hitCount": 0, "missCount": 0, "refreshQueued": 0},
                    },
                    "lastRefreshedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "refreshStatus": "idle",
                }

            def try_start_refresh(self, *args, **kwargs):
                self.started = True
                return True

            def get_latest_successful(self):
                return None

            def save_report(self, *args, **kwargs):
                return None

            def mark_refresh_failed(self, *args, **kwargs):
                return None

        class FakeService(QaTestingReportService):
            def __init__(self, cache):
                super().__init__("token", report_cache_repo=cache)

            def _build_report_uncached(
                self,
                start,
                end,
                task_window=TaskWindow.SINCE_YESTERDAY,
                burndown_start=None,
                burndown_end=None,
                force_refresh=False,
            ):
                return {
                    "summary": {"totalCases": 9},
                    "cycles": [],
                    "burndown": [],
                    "taskMovement": {},
                    "nameCache": {"hitCount": 1, "missCount": 0, "refreshQueued": 0},
                    "userCache": {"hitCount": 1, "missCount": 0, "refreshQueued": 0},
                }

        cache = FakeReportCache()
        service = FakeService(cache)
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end)

        self.assertEqual(report["summary"]["totalCases"], 7)
        self.assertTrue(report["cache"]["hit"])
        self.assertFalse(cache.started)
        self.assertEqual(report["nameCache"]["missCount"], 1)

    def test_force_refresh_returns_stale_cache_when_refresh_already_running(self):
        class FakeReportCache:
            def get(self, cache_key):
                return {
                    "report": {"summary": {"totalCases": 7}, "cycles": [], "burndown": [], "taskMovement": {}},
                    "lastRefreshedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "refreshStatus": "refreshing",
                }

            def try_start_refresh(self, *args, **kwargs):
                return False

        class FakeService(QaTestingReportService):
            def __init__(self):
                super().__init__("token", report_cache_repo=FakeReportCache())

            def _build_report_uncached(
                self,
                start,
                end,
                task_window=TaskWindow.SINCE_YESTERDAY,
                burndown_start=None,
                burndown_end=None,
                force_refresh=False,
            ):
                raise AssertionError("Refresh should not rebuild while another refresh is active")

        service = FakeService()
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end, force_refresh=True)

        self.assertEqual(report["summary"]["totalCases"], 7)
        self.assertTrue(report["cache"]["hit"])
        self.assertTrue(report["cache"]["stale"])
        self.assertTrue(report["cache"]["refreshInProgress"])

    def test_latest_snapshot_keeps_exact_refresh_in_progress_flag(self):
        class FakeReportCache:
            def get(self, cache_key):
                return {
                    "report": None,
                    "refreshStatus": "refreshing",
                    "refreshStartedAt": "2026-05-15T12:00:00Z",
                    "refreshError": None,
                }

            def get_latest_successful(self):
                return {
                    "cacheKey": "older-cache-key",
                    "report": {"summary": {"totalCases": 7}, "cycles": [], "burndown": [], "taskMovement": {}},
                    "lastRefreshedAt": "2026-05-15T11:00:00Z",
                    "refreshStatus": "idle",
                }

            def try_start_refresh(self, *args, **kwargs):
                raise AssertionError("Latest snapshot should be used while exact refresh is active")

        service = QaTestingReportService("token", report_cache_repo=FakeReportCache())
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end)

        self.assertEqual(report["summary"]["totalCases"], 7)
        self.assertTrue(report["cache"]["hit"])
        self.assertTrue(report["cache"]["stale"])
        self.assertTrue(report["cache"]["refreshInProgress"])
        self.assertEqual(report["cache"]["refreshStartedAt"], "2026-05-15T12:00:00Z")

    def test_refreshing_persistent_cache_is_marked_stale_on_normal_read(self):
        class FakeReportCache:
            def get(self, cache_key):
                return {
                    "report": {"summary": {"totalCases": 7}, "cycles": [], "burndown": [], "taskMovement": {}},
                    "lastRefreshedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                    "refreshStatus": "refreshing",
                }

            def try_start_refresh(self, *args, **kwargs):
                raise AssertionError("Cached reads should not start another refresh")

        service = QaTestingReportService("token", report_cache_repo=FakeReportCache())
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end)

        self.assertEqual(report["summary"]["totalCases"], 7)
        self.assertTrue(report["cache"]["hit"])
        self.assertTrue(report["cache"]["stale"])
        self.assertTrue(report["cache"]["refreshInProgress"])

    def test_build_report_returns_persistent_cache_without_auto_refresh(self):
        class FakeReportCache:
            def __init__(self):
                self.started = False

            def get(self, cache_key):
                return {
                    "report": {"summary": {"totalCases": 7}, "cycles": [], "burndown": [], "taskMovement": {}},
                    "lastRefreshedAt": "2026-05-01T00:00:00Z",
                    "refreshStatus": "idle",
                }

            def try_start_refresh(self, *args, **kwargs):
                self.started = True
                return True

        class FakeService(QaTestingReportService):
            def __init__(self, cache):
                super().__init__("token", report_cache_repo=cache)
                self.thread_started = False

            def _start_report_refresh_thread(
                self,
                cache_key,
                start,
                end,
                task_window,
                burndown_start,
                burndown_end,
                force_refresh=False,
            ):
                self.thread_started = True

        cache = FakeReportCache()
        service = FakeService(cache)
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end)

        self.assertEqual(report["summary"]["totalCases"], 7)
        self.assertFalse(cache.started)
        self.assertFalse(service.thread_started)
        self.assertFalse(report["cache"]["stale"])
        self.assertFalse(report["cache"]["refreshInProgress"])

    def test_unchanged_cycle_uses_cached_detail_without_detail_fetch_on_normal_build(self):
        class FakeCycleRepo:
            def __init__(self):
                self.upserts = []

            def get_summaries(self, cycle_keys):
                return {"TC-C1": {"updated_on": "2026-05-15T12:00:00.000Z"}}

            def upsert_cycle_detail(self, detail):
                self.upserts.append(detail)

            def get_cycle_details(self, cycle_keys):
                return [
                    {
                        "key": "TC-C1",
                        "name": "Checkout Round 1",
                        "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
                        "status": "In Progress",
                        "items": [{"testCaseKey": "TC-T1", "status": "Pass"}],
                    }
                ]

        class FakeService(QaTestingReportService):
            def __init__(self, cycle_repo):
                super().__init__("token", cycle_repo=cycle_repo)

            def _get_json(self, path, params=None):
                if path.endswith("/testrun/search"):
                    return [
                        {
                            "key": "TC-C1",
                            "name": "Checkout Round 1",
                            "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
                            "updatedOn": "2026-05-15T12:00:00.000Z",
                        }
                    ]
                raise AssertionError(f"Detail fetch should not run for unchanged cycle: {path}")

            def _fetch_task_status_changes(self, start, end, task_window=TaskWindow.SINCE_YESTERDAY):
                return []

        cycle_repo = FakeCycleRepo()
        service = FakeService(cycle_repo)
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end)

        self.assertEqual(report["summary"]["cycleCount"], 1)
        self.assertEqual(report["summary"]["totalCases"], 1)
        self.assertEqual(cycle_repo.upserts, [])

    def test_force_refresh_fetches_master_cycle_list_before_details(self):
        class FakeCycleRepo:
            def get_all_summaries(self):
                return [
                    {
                        "cycle_key": "TC-C1",
                        "name": "Cached Round 1",
                        "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
                        "status": "In Progress",
                        "project_key": "TC",
                        "created_on": "2026-05-14T00:00:00.000Z",
                        "updated_on": "2026-05-14T12:00:00.000Z",
                        "test_case_count": 1,
                    }
                ]

            def upsert_cycle_detail(self, detail):
                return None

        class FakeService(QaTestingReportService):
            def __init__(self, cycle_repo):
                super().__init__("token", cycle_repo=cycle_repo)
                self.cycle_searches = 0
                self.detail_keys = []

            def _get_json(self, path, params=None):
                if path.endswith("/testrun/search"):
                    self.cycle_searches += 1
                    return [
                        {
                            "key": "TC-C1",
                            "name": "Cached Round 1",
                            "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
                            "updatedOn": "2026-05-14T12:00:00.000Z",
                        },
                        {
                            "key": "TC-C2",
                            "name": "New Round 2",
                            "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
                            "updatedOn": "2026-05-15T12:00:00.000Z",
                        },
                    ]
                if "/testrun/" in path:
                    key = path.rsplit("/", 1)[-1]
                    self.detail_keys.append(key)
                    return {
                        "key": key,
                        "name": f"{key} Round",
                        "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
                        "items": [{"testCaseKey": f"{key}-T1", "status": "Pass"}],
                    }
                raise AssertionError(path)

            def _fetch_task_status_changes(self, start, end, task_window=TaskWindow.SINCE_YESTERDAY):
                return []

        service = FakeService(FakeCycleRepo())
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end, force_refresh=True)

        self.assertEqual(service.cycle_searches, 1)
        self.assertCountEqual(service.detail_keys, ["TC-C1", "TC-C2"])
        self.assertEqual(report["summary"]["cycleCount"], 2)
        self.assertEqual(report["summary"]["totalCases"], 2)

    def test_force_refresh_fetches_detail_even_when_cycle_updated_on_unchanged(self):
        class FakeCycleRepo:
            def __init__(self):
                self.upserts = []

            def get_summaries(self, cycle_keys):
                return {"TC-C1": {"updated_on": "2026-05-15T12:00:00.000Z"}}

            def upsert_cycle_detail(self, detail):
                self.upserts.append(detail)

            def get_cycle_details(self, cycle_keys):
                return self.upserts

        class FakeService(QaTestingReportService):
            def __init__(self, cycle_repo):
                super().__init__("token", cycle_repo=cycle_repo)
                self.detail_fetches = 0

            def _get_json(self, path, params=None):
                if path.endswith("/testrun/search"):
                    return [
                        {
                            "key": "TC-C1",
                            "name": "Checkout Round 1",
                            "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
                            "updatedOn": "2026-05-15T12:00:00.000Z",
                        }
                    ]
                if path.endswith("/testrun/TC-C1"):
                    self.detail_fetches += 1
                    return {
                        "key": "TC-C1",
                        "name": "Checkout Round 1",
                        "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
                        "updatedOn": "2026-05-15T12:00:00.000Z",
                        "items": [{"testCaseKey": "TC-T1", "status": "Blocked"}],
                    }
                raise AssertionError(path)

            def _fetch_task_status_changes(self, start, end, task_window=TaskWindow.SINCE_YESTERDAY):
                return [{"key": "ACE2E-1", "changedAt": "2026-05-14T12:00:00Z"}]

        cycle_repo = FakeCycleRepo()
        service = FakeService(cycle_repo)
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end, force_refresh=True)

        self.assertEqual(service.detail_fetches, 1)
        self.assertEqual(cycle_repo.upserts[0]["items"][0]["status"], "Blocked")
        self.assertEqual(report["cycles"][0]["statusCounts"], {"Blocked": 1})
        self.assertEqual(report["summary"]["taskStatusChanges"], 1)

    def test_changed_cycle_fetches_detail_and_updates_cycle_cache(self):
        class FakeCycleRepo:
            def __init__(self):
                self.upserts = []

            def get_summaries(self, cycle_keys):
                return {"TC-C1": {"updated_on": "2026-05-14T12:00:00.000Z"}}

            def upsert_cycle_detail(self, detail):
                self.upserts.append(detail)

            def get_cycle_details(self, cycle_keys):
                return self.upserts

        class FakeService(QaTestingReportService):
            def __init__(self, cycle_repo):
                super().__init__("token", cycle_repo=cycle_repo)
                self.detail_fetches = 0

            def _get_json(self, path, params=None):
                if path.endswith("/testrun/search"):
                    return [
                        {
                            "key": "TC-C1",
                            "name": "Checkout Round 1",
                            "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
                            "updatedOn": "2026-05-15T12:00:00.000Z",
                        }
                    ]
                if path.endswith("/testrun/TC-C1"):
                    self.detail_fetches += 1
                    return {
                        "key": "TC-C1",
                        "name": "Checkout Round 1",
                        "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
                        "items": [{"testCaseKey": "TC-T1", "status": "Pass"}],
                    }
                raise AssertionError(path)

            def _fetch_task_status_changes(self, start, end, task_window=TaskWindow.SINCE_YESTERDAY):
                return []

        cycle_repo = FakeCycleRepo()
        service = FakeService(cycle_repo)
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end, force_refresh=True)

        self.assertEqual(service.detail_fetches, 1)
        self.assertEqual(cycle_repo.upserts[0]["key"], "TC-C1")
        self.assertEqual(cycle_repo.upserts[0]["updatedOn"], "2026-05-15T12:00:00.000Z")
        self.assertEqual(report["summary"]["totalCases"], 1)

    def test_cycle_search_timeout_falls_back_to_cached_cycle_list(self):
        class FakeCycleRepo:
            def __init__(self):
                self.upserts = []

            def get_all_summaries(self):
                return [
                    {
                        "cycle_key": "TC-C1",
                        "name": "Checkout Round 1",
                        "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
                        "status": "In Progress",
                        "project_key": "TC",
                        "created_on": "2026-05-14T00:00:00.000Z",
                        "updated_on": "2026-05-15T12:00:00.000Z",
                        "test_case_count": 1,
                    }
                ]

            def upsert_cycle_detail(self, detail):
                self.upserts.append(detail)

        class FakeService(QaTestingReportService):
            def __init__(self, cycle_repo):
                super().__init__("token", cycle_repo=cycle_repo)
                self.detail_keys = []

            def _fetch_adobe_master_cycles(self):
                raise requests.Timeout("cycle search timed out")

            def _fetch_cycle_details(self, cycles):
                self.detail_keys = [cycle["key"] for cycle in cycles]
                return [
                    {
                        "key": "TC-C1",
                        "name": "Checkout Round 1",
                        "folder": "/Adobe Commerce E2E Master Test Cycles/LP Features",
                        "items": [{"testCaseKey": "TC-T1", "status": "Pass"}],
                    }
                ]

            def _fetch_task_status_changes(self, start, end, task_window=TaskWindow.SINCE_YESTERDAY):
                return []

        cycle_repo = FakeCycleRepo()
        service = FakeService(cycle_repo)
        start = datetime(2026, 5, 14, 0, 0, tzinfo=timezone.utc)
        end = datetime(2026, 5, 15, 0, 0, tzinfo=timezone.utc)

        report = service.build_report(start, end, force_refresh=True)

        self.assertEqual(service.detail_keys, ["TC-C1"])
        self.assertEqual(cycle_repo.upserts[0]["key"], "TC-C1")
        self.assertEqual(report["summary"]["totalCases"], 1)


if __name__ == "__main__":
    unittest.main()
