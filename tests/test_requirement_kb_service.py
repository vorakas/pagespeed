import os
import tempfile
import unittest
from pathlib import Path

from data_access.connection import ConnectionManager
from services.requirement_kb_service import RequirementKbService


class RequirementKbServiceTest(unittest.TestCase):
    def setUp(self):
        self._cwd = os.getcwd()
        self.tmp = tempfile.TemporaryDirectory()
        os.chdir(self.tmp.name)
        self.vault_root = Path(self.tmp.name) / "vault"
        (self.vault_root / "raw" / "asana" / "LAMPSPLUS" / "Implementation").mkdir(parents=True)
        (self.vault_root / "raw" / "WPM" / "Task").mkdir(parents=True)

        self.asana_task = self.vault_root / "raw" / "asana" / "LAMPSPLUS" / "Implementation" / "LAMPSPLUS-445 - Minimum Price Validation Support.md"
        self.asana_task.write_text(
            "\n".join(
                [
                    "---",
                    'status: "Completed"',
                    'task_status: "Ready For UAT In Prod"',
                    'uat_status: "Conditional Pass - Production"',
                    "---",
                    "# [x] [LAMPSPLUS-445] Minimum Price Validation Support",
                    "Minimum pricing validates employee manual discounts and UMRP.",
                    "Vendor DiscountRequirement controls whether approval is required.",
                    "## Comments",
                    "QA noted that promo codes can bypass minimum pricing restrictions.",
                ]
            ),
            encoding="utf-8",
        )
        self.jira_task = self.vault_root / "raw" / "WPM" / "Task" / "DBADMIN-6393 - Update Product Pricing Table.md"
        self.jira_task.write_text(
            "\n".join(
                [
                    "---",
                    "status: Closed",
                    "---",
                    "# DBADMIN-6393: Update the AC Product Pricing Table - Part 6",
                    "Adds minimum price flags used by the cart pricing logic.",
                ]
            ),
            encoding="utf-8",
        )

        self.conn_mgr = ConnectionManager(db_url=None)
        self.conn_mgr.init_schema()
        self.service = RequirementKbService(self.conn_mgr, self.vault_root)

    def tearDown(self):
        os.chdir(self._cwd)
        self.tmp.cleanup()

    def test_discovers_jira_and_asana_candidates_from_raw_vault(self):
        candidates = self.service.discover_candidates(["minimum pricing", "UMRP"], limit=10)

        paths = {candidate["sourcePath"] for candidate in candidates}
        self.assertIn("raw/asana/LAMPSPLUS/Implementation/LAMPSPLUS-445 - Minimum Price Validation Support.md", paths)
        self.assertIn("raw/WPM/Task/DBADMIN-6393 - Update Product Pricing Table.md", paths)
        self.assertEqual(candidates[0]["sourceSystem"], "Asana")
        self.assertGreater(candidates[0]["relevanceScore"], 0)
        self.assertTrue(candidates[0]["snippets"])

    def test_creates_kb_imports_sources_and_answers_with_citations(self):
        candidates = self.service.discover_candidates(["minimum pricing", "UMRP"], limit=10)
        kb = self.service.create_knowledge_base_from_candidates(
            name="Calculator",
            description="Minimum pricing and discounting requirements",
            search_terms=["minimum pricing", "UMRP"],
            candidates=candidates,
        )

        note = self.service.add_note(
            kb["id"],
            title="QA exception",
            body="QA confirmed vendor approval is required before restricted manual discounting.",
            category="decision",
            tags=["minimum-pricing"],
        )
        answer = self.service.ask_question(kb["id"], "When is vendor approval required?")

        self.assertEqual(kb["name"], "Calculator")
        self.assertEqual(note["sourceType"], "manual_note")
        self.assertIn("vendor approval", answer["answer"].lower())
        self.assertGreaterEqual(len(answer["citations"]), 1)
        self.assertTrue(any("LAMPSPLUS-445" in citation["title"] or "QA exception" in citation["title"] for citation in answer["citations"]))

    def test_answered_questions_are_saved_as_common_questions_per_kb(self):
        candidates = self.service.discover_candidates(["minimum pricing", "UMRP"], limit=10)
        kb = self.service.create_knowledge_base_from_candidates(
            name="Calculator",
            description="Minimum pricing and discounting requirements",
            search_terms=["minimum pricing", "UMRP"],
            candidates=candidates,
        )

        first_answer = self.service.ask_question(kb["id"], "When is vendor approval required?")
        second_answer = self.service.ask_question(kb["id"], " when is vendor approval required? ")
        common_questions = self.service.list_common_questions(kb["id"])

        self.assertEqual(len(common_questions), 1)
        self.assertEqual(common_questions[0]["question"], "When is vendor approval required?")
        self.assertEqual(common_questions[0]["usageCount"], 2)
        self.assertEqual(common_questions[0]["answer"], second_answer["answer"])
        self.assertEqual(common_questions[0]["citations"], second_answer["citations"])
        self.assertIn("commonQuestionId", first_answer)
        self.assertEqual(first_answer["commonQuestionId"], second_answer["commonQuestionId"])

    def test_adds_task_source_by_task_id(self):
        kb = self.service.create_knowledge_base(
            name="Calculator",
            description="Minimum pricing and discounting requirements",
        )

        source = self.service.add_vault_source(kb["id"], "DBADMIN-6393")

        self.assertEqual(source["sourceType"], "vault_task")
        self.assertEqual(source["sourceSystem"], "Jira")
        self.assertEqual(source["sourceId"], "DBADMIN-6393")
        self.assertEqual(source["sourcePath"], "raw/WPM/Task/DBADMIN-6393 - Update Product Pricing Table.md")

    def test_removes_source_and_chunks_from_knowledge_base(self):
        kb = self.service.create_knowledge_base(
            name="Calculator",
            description="Minimum pricing and discounting requirements",
        )
        source = self.service.add_vault_source(kb["id"], "LAMPSPLUS-445")

        removed = self.service.remove_source(kb["id"], source["id"])
        sources = self.service.list_sources(kb["id"])
        answer = self.service.ask_question(kb["id"], "vendor approval")

        self.assertTrue(removed["removed"])
        self.assertEqual(removed["sourceId"], source["id"])
        self.assertEqual(sources, [])
        self.assertEqual(answer["citations"], [])


if __name__ == "__main__":
    unittest.main()
