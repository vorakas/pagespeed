from datetime import datetime, timezone
import unittest

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

            def _fetch_round_cycle_reports(self, start, end):
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

    def test_build_report_cache_key_uses_15_minute_buckets(self):
        class FakeService(QaTestingReportService):
            def __init__(self):
                super().__init__("token")
                self.calls = 0

            def _fetch_round_cycle_reports(self, start, end):
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
        self.assertEqual(first["cache"]["key"], "2026-05-14T00:00Z|2026-05-15T12:00Z|tasks:sinceYesterday")
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


if __name__ == "__main__":
    unittest.main()
