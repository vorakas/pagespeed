import unittest

from services.launch_report import build_launch_report
from services.obsidian_sync.raw_scanner import RawTask


def task(
    key,
    summary,
    *,
    task_type="Task",
    status=None,
    epic_link=None,
    labels=None,
    spent=None,
    remaining=None,
):
    return RawTask(
        key=key,
        source="jira",
        project=key.split("-", 1)[0],
        rel_path=f"{key}.md",
        summary=summary,
        task_type=task_type,
        status=status,
        epic_link=epic_link,
        labels=labels or [],
        time_spent_seconds=spent,
        remaining_estimate_seconds=remaining,
    )


def row_by_name(report, section, name):
    return next(row for row in report[section]["rows"] if row["reportGrouping"] == name)


class LaunchReportTest(unittest.TestCase):
    def test_report_contains_fixed_canonical_row_counts(self):
        report = build_launch_report([])

        self.assertEqual(len(report["lampsPlusDevelopment"]["rows"]), 25)
        self.assertEqual(len(report["e2eTesting"]["rows"]), 32)
        self.assertEqual(report["lampsPlusDevelopment"]["totals"]["rowCount"], 25)
        self.assertEqual(report["e2eTesting"]["totals"]["rowCount"], 32)

    def test_development_rollup_resolves_epic_link_key_to_spreadsheet_grouping(self):
        report = build_launch_report([
            task("ACM-4", "AC Implementation - Commerce Implementation", task_type="Epic"),
            task(
                "WPM-5471",
                "Build commerce item",
                epic_link="ACM-4",
                labels=["AC-P1"],
                spent=7200,
                remaining=3600,
            ),
            task(
                "WPM-5470",
                "Build second commerce item",
                epic_link="ACM-4",
                labels=["AC-P1"],
                spent=3600,
                remaining=0,
            ),
        ])

        row = row_by_name(report, "lampsPlusDevelopment", "AC Implementation - Commerce Implementation")

        self.assertEqual(row["epicKey"], "ACM-4")
        self.assertEqual(row["phaseLabel"], "AC-P1")
        self.assertEqual(row["completedHours"], 3)
        self.assertEqual(row["remainingHours"], 1)
        self.assertEqual(row["issueKeys"], ["WPM-5470", "WPM-5471"])
        self.assertEqual(row["diagnostics"]["countedIssueCount"], 2)
        self.assertEqual(row["diagnostics"]["missingPhaseLabelCount"], 0)

    def test_excludes_missing_ac_p1_label_from_totals_and_flags_diagnostic(self):
        report = build_launch_report([
            task("ACM-4", "AC Implementation - Commerce Implementation", task_type="Epic"),
            task("WPM-5471", "Counted", epic_link="ACM-4", labels=["AC-P1"], spent=3600),
            task("WPM-5472", "Excluded", epic_link="ACM-4", labels=["AC-P2"], spent=3600),
        ])

        row = row_by_name(report, "lampsPlusDevelopment", "AC Implementation - Commerce Implementation")

        self.assertEqual(row["completedHours"], 1)
        self.assertEqual(row["diagnostics"]["missingPhaseLabelCount"], 1)
        self.assertEqual(row["diagnostics"]["excludedIssueCount"], 1)

    def test_missing_estimates_increment_row_and_section_diagnostics(self):
        report = build_launch_report([
            task("ACM-4", "AC Implementation - Commerce Implementation", task_type="Epic"),
            task("WPM-5471", "No estimates", epic_link="ACM-4", labels=["AC-P1"]),
        ])

        row = row_by_name(report, "lampsPlusDevelopment", "AC Implementation - Commerce Implementation")

        self.assertEqual(row["diagnostics"]["missingEstimateCount"], 1)
        self.assertEqual(report["lampsPlusDevelopment"]["diagnostics"]["missingEstimateCount"], 1)

    def test_unresolved_epic_link_increments_section_diagnostic(self):
        report = build_launch_report([
            task("WPM-5471", "Orphaned commerce task", epic_link="NOPE-1", labels=["AC-P1"], spent=3600),
        ])

        diagnostics = report["lampsPlusDevelopment"]["diagnostics"]

        self.assertEqual(diagnostics["unresolvedEpicNameCount"], 1)
        self.assertEqual(diagnostics["countedIssueCount"], 0)

    def test_missing_epic_link_increments_section_diagnostic(self):
        report = build_launch_report([
            task("WPM-5471", "No epic commerce task", labels=["AC-P1"], spent=3600),
        ])

        diagnostics = report["lampsPlusDevelopment"]["diagnostics"]

        self.assertEqual(diagnostics["missingEpicLinkCount"], 1)

    def test_e2e_counts_closed_and_failed_qa_by_grouping(self):
        report = build_launch_report([
            task("ACE2E-33", "AC E2E - Account Management", task_type="Epic"),
            task(
                "ACE2E-40",
                "Passing account test",
                status="Closed",
                epic_link="ACE2E-33",
                labels=["AC-P1"],
                spent=3600,
            ),
            task(
                "ACE2E-41",
                "Failing account test",
                status="Failed QA",
                epic_link="ACE2E-33",
                labels=["AC-P1"],
                remaining=7200,
            ),
        ])

        row = row_by_name(report, "e2eTesting", "AC E2E - Account Management")

        self.assertEqual(row["epicKey"], "ACE2E-33")
        self.assertEqual(row["phaseLabel"], "AC-P1")
        self.assertIn("countedIssueCount", row["diagnostics"])
        self.assertIn("excludedIssueCount", row["diagnostics"])
        self.assertIn("missingEpicLinkCount", row["diagnostics"])
        self.assertIn("unresolvedEpicNameCount", row["diagnostics"])
        self.assertIn("missingPhaseLabelCount", row["diagnostics"])
        self.assertIn("missingEstimateCount", row["diagnostics"])
        self.assertEqual(row["passedTc"], 1)
        self.assertEqual(row["failedTc"], 1)
        self.assertEqual(row["completedHours"], 1)
        self.assertEqual(row["remainingHours"], 2)


if __name__ == "__main__":
    unittest.main()
