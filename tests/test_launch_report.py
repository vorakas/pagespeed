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
    parent_key=None,
    labels=None,
    components=None,
    resource_queue=None,
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
        parent_key=parent_key,
        labels=labels or [],
        components=components or [],
        resource_queue=resource_queue,
        time_spent_seconds=spent,
        remaining_estimate_seconds=remaining,
    )


def row_by_name(report, section, name):
    return next(row for row in report[section]["rows"] if row["reportGrouping"] == name)


class LaunchReportTest(unittest.TestCase):
    def test_report_contains_area_rows_for_spreadsheet_sections(self):
        report = build_launch_report([])

        self.assertEqual(len(report["lampsPlusDevelopment"]["rows"]), 28)
        self.assertEqual(len(report["e2eTesting"]["rows"]), 28)
        self.assertEqual(report["lampsPlusDevelopment"]["totals"]["rowCount"], 28)
        self.assertEqual(report["e2eTesting"]["totals"]["rowCount"], 28)

    def test_empty_development_rows_use_numeric_pending_contract(self):
        report = build_launch_report([])

        row = row_by_name(report, "lampsPlusDevelopment", "PLP")

        self.assertEqual(row["status"], "Pending")
        self.assertEqual(row["progressPercent"], 0)

    def test_lampsplus_development_matches_spreadsheet_non_qa_resource_queue_rollup(self):
        report = build_launch_report([
            task(
                "WPM-1",
                "Build PLP item",
                labels=["AC-P1"],
                components=["AC-PLP"],
                resource_queue="Front End",
                spent=7200,
                remaining=3600,
            ),
            task(
                "WPM-2",
                "QA PLP item",
                labels=["AC-P1"],
                components=["AC-PLP"],
                resource_queue="QA",
                spent=36000,
                remaining=36000,
            ),
            task(
                "WPM-3",
                "Future phase PLP item",
                labels=["AC-P2"],
                components=["AC-PLP"],
                resource_queue="Back End",
                spent=3600,
                remaining=3600,
            ),
        ])

        row = row_by_name(report, "lampsPlusDevelopment", "PLP")

        self.assertEqual(row["phaseLabel"], "AC-P1")
        self.assertEqual(row["completedHours"], 2)
        self.assertEqual(row["remainingHours"], 1)
        self.assertEqual(row["progressPercent"], 67)
        self.assertEqual(row["issueKeys"], ["WPM-1"])
        self.assertEqual(row["diagnostics"]["countedIssueCount"], 1)
        self.assertEqual(row["diagnostics"]["missingPhaseLabelCount"], 1)
        self.assertEqual(row["diagnostics"]["excludedIssueCount"], 1)

    def test_complete_development_rows_use_complete_status_contract(self):
        report = build_launch_report([
            task(
                "WPM-1",
                "Build PLP item",
                labels=["AC-P1"],
                components=["AC-PLP"],
                resource_queue="Back End",
                spent=3600,
                remaining=0,
            ),
        ])

        row = row_by_name(report, "lampsPlusDevelopment", "PLP")

        self.assertEqual(row["status"], "Complete")
        self.assertEqual(row["progressPercent"], 100)

    def test_excludes_missing_ac_p1_label_from_totals_and_flags_diagnostic(self):
        report = build_launch_report([
            task("WPM-1", "Counted", labels=["AC-P1"], components=["AC-PLP"], spent=3600),
            task("WPM-2", "Excluded", labels=["AC-P2"], components=["AC-PLP"], spent=3600),
        ])

        row = row_by_name(report, "lampsPlusDevelopment", "PLP")

        self.assertEqual(row["completedHours"], 1)
        self.assertEqual(row["diagnostics"]["missingPhaseLabelCount"], 1)
        self.assertEqual(row["diagnostics"]["excludedIssueCount"], 1)

    def test_missing_estimates_increment_row_and_section_diagnostics(self):
        report = build_launch_report([
            task("WPM-1", "No estimates", labels=["AC-P1"], components=["AC-PLP"]),
        ])

        row = row_by_name(report, "lampsPlusDevelopment", "PLP")

        self.assertEqual(row["diagnostics"]["missingEstimateCount"], 1)
        self.assertEqual(report["lampsPlusDevelopment"]["diagnostics"]["missingEstimateCount"], 1)

    def test_missing_reporting_area_increments_section_diagnostic(self):
        report = build_launch_report([
            task("WPM-1", "No mapped component", labels=["AC-P1"], components=["Nope"], spent=3600),
        ])

        diagnostics = report["lampsPlusDevelopment"]["diagnostics"]

        self.assertEqual(diagnostics["missingEpicLinkCount"], 1)
        self.assertEqual(diagnostics["countedIssueCount"], 0)

    def test_e2e_testing_matches_spreadsheet_qa_resource_queue_rollup(self):
        report = build_launch_report([
            task(
                "ACE2E-1",
                "Passing PLP test",
                status="closed",
                labels=["AC-P1"],
                components=["AC-PLP"],
                resource_queue="QA",
                spent=3600,
            ),
            task(
                "ACE2E-2",
                "Failing PLP test",
                status="failed qa",
                labels=["AC-P1"],
                components=["AC-PLP"],
                resource_queue="QA",
                remaining=7200,
            ),
            task(
                "ACE2E-3",
                "Non-QA PLP work",
                status="closed",
                labels=["AC-P1"],
                components=["AC-PLP"],
                resource_queue="Front End",
                spent=36000,
                remaining=36000,
            ),
        ])

        row = row_by_name(report, "e2eTesting", "PLP")

        self.assertIsNone(row["epicKey"])
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
        self.assertEqual(row["issueKeys"], ["ACE2E-1", "ACE2E-2"])

    def test_e2e_testing_prefers_qa_tc_summary_for_pass_fail_counts(self):
        report = build_launch_report(
            [
                task(
                    "ACE2E-1",
                    "Closed Jira QA item",
                    status="closed",
                    labels=["AC-P1"],
                    components=["AC-PLP"],
                    resource_queue="QA",
                    spent=3600,
                ),
                task(
                    "ACE2E-2",
                    "Failed Jira QA item",
                    status="failed qa",
                    labels=["AC-P1"],
                    components=["AC-PLP"],
                    resource_queue="QA",
                    remaining=7200,
                ),
            ],
            qa_tc_summary={
                "PLP": {
                    "passedTc": 12,
                    "failedTc": 4,
                    "totalTc": 20,
                }
            },
        )

        row = row_by_name(report, "e2eTesting", "PLP")

        self.assertEqual(row["passedTc"], 12)
        self.assertEqual(row["failedTc"], 4)
        self.assertEqual(row["totalTc"], 20)
        self.assertEqual(row["completedHours"], 1)
        self.assertEqual(row["remainingHours"], 2)


if __name__ == "__main__":
    unittest.main()
