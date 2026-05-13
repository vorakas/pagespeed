import unittest
from unittest.mock import patch

from services.migration_dashboard_service import _launch_priority_summary
from services.obsidian_sync.raw_scanner import RawTask


class LaunchPrioritySummaryTest(unittest.TestCase):
    def test_groups_active_tasks_by_launch_priority(self):
        p1 = RawTask(
            key="813621",
            source="asana",
            project="LAMPSPLUS",
            rel_path="raw/asana/LAMPSPLUS/Implementation/813621 - Image modal.md",
            summary="Zoom buttons not functioning",
            launch_priority="P1",
            status="Open",
            updated="2026-05-13",
        )
        p2 = RawTask(
            key="030313",
            source="asana",
            project="LAMPSPLUS",
            rel_path="raw/asana/LAMPSPLUS/Implementation/030313 - Cart import.md",
            summary="Cart import error",
            launch_priority="P2",
            status="Open",
        )
        done = RawTask(
            key="021302",
            source="asana",
            project="LAMPSPLUS",
            rel_path="raw/asana/LAMPSPLUS/Implementation/021302 - Store list.md",
            summary="Closed store displayed",
            launch_priority="P1",
            status="Completed",
            updated="2026-05-12",
        )

        with patch("services.migration_dashboard_service.date") as fake_date:
            fake_date.today.return_value.isoformat.return_value = "2026-05-13"
            summary = _launch_priority_summary([p1, p2, done])

        buckets = {bucket["priority"]: bucket for bucket in summary["buckets"]}
        self.assertEqual(buckets["P1"]["total"], 2)
        self.assertEqual(buckets["P1"]["active"], 1)
        self.assertEqual(buckets["P1"]["resolved"], 1)
        self.assertEqual(buckets["P1"]["items"][0]["key"], "813621")
        self.assertEqual(buckets["P2"]["active"], 1)
        self.assertEqual(summary["p1Burndown"][0]["active"], 1)

    def test_ignores_legacy_priority_without_launch_priority(self):
        task = RawTask(
            key="ACE2E-1",
            source="jira",
            project="ACE2E",
            rel_path="raw/ACE2E/ACE2E-1.md",
            summary="Legacy high priority",
            priority="High",
            status="Open",
        )

        summary = _launch_priority_summary([task])

        p1 = next(bucket for bucket in summary["buckets"] if bucket["priority"] == "P1")
        self.assertEqual(p1["active"], 0)


if __name__ == "__main__":
    unittest.main()
