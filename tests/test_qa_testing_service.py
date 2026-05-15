from datetime import datetime, timezone
import unittest

from services.qa_testing_service import (
    build_cycle_report,
    build_daily_burndown,
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


if __name__ == "__main__":
    unittest.main()
