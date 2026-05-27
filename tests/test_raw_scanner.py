from datetime import date
from pathlib import Path
import tempfile
import unittest

from services.obsidian_sync.raw_scanner import RawTask, RawTaskScanner, new_bugs
from services.obsidian_sync.vault_reader import VaultReader


class RawScannerNewBugsTest(unittest.TestCase):
    def test_parses_asana_launch_priority_into_api_payload(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            task_path = (
                root
                / "raw"
                / "asana"
                / "LAMPSPLUS"
                / "Implementation"
                / "813621 - Image modal bug.md"
            )
            task_path.parent.mkdir(parents=True)
            task_path.write_text(
                "---\n"
                "status: Open\n"
                "created: 2026-05-13\n"
                "launch_priority: P1\n"
                "---\n"
                "body\n",
                encoding="utf-8",
            )

            tasks = list(RawTaskScanner(VaultReader(root)).iter_tasks())

        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0].launch_priority, "P1")
        self.assertEqual(tasks[0].to_dict()["launchPriority"], "P1")

    def test_parses_jira_labels_into_api_payload(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            task_path = (
                root
                / "raw"
                / "WPM"
                / "Task"
                / "WPM-5471 - Build commerce item.md"
            )
            task_path.parent.mkdir(parents=True)
            task_path.write_text(
                "---\n"
                "key: WPM-5471\n"
                "summary: \"Build commerce item\"\n"
                "type: Task\n"
                "status: Closed\n"
                "labels: [\"AC-P1\", \"adobe-commerce\"]\n"
                "components: [\"AC-PLP\", \"AC-Header & Footer\"]\n"
                "---\n"
                "body\n",
                encoding="utf-8",
            )

            tasks = list(RawTaskScanner(VaultReader(root)).iter_tasks())

        self.assertEqual(len(tasks), 1)
        self.assertEqual(tasks[0].labels, ["AC-P1", "adobe-commerce"])
        self.assertEqual(tasks[0].to_dict()["labels"], ["AC-P1", "adobe-commerce"])
        self.assertEqual(tasks[0].components, ["AC-PLP", "AC-Header & Footer"])
        self.assertEqual(tasks[0].to_dict()["components"], ["AC-PLP", "AC-Header & Footer"])

    def test_asana_implementation_items_without_type_count_as_new_bugs(self):
        today = date(2026, 5, 13)
        task = RawTask(
            key="813621",
            source="asana",
            project="LAMPSPLUS",
            rel_path="raw/asana/LAMPSPLUS/Implementation/813621 - Image modal bug.md",
            summary="Zoom buttons not functioning",
            task_type=None,
            status="Open",
            created=today.isoformat(),
        )

        self.assertEqual(new_bugs([task], window_days=1, today=today), [task])

    def test_asana_non_implementation_items_without_type_do_not_count_as_new_bugs(self):
        today = date(2026, 5, 13)
        task = RawTask(
            key="390722",
            source="asana",
            project="LAMPSPLUS",
            rel_path="raw/asana/LAMPSPLUS/Action Items/390722 - API endpoint.md",
            summary="Provide API endpoint",
            task_type=None,
            status="Open",
            created=today.isoformat(),
        )

        self.assertEqual(new_bugs([task], window_days=1, today=today), [])


if __name__ == "__main__":
    unittest.main()
