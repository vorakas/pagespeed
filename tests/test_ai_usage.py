import unittest

from services.ai_usage import estimate_ai_cost, should_use_ai_for_requirement_question


class AiUsageTests(unittest.TestCase):
    def test_estimates_openai_cost_from_prompt_and_completion_tokens(self):
        result = estimate_ai_cost("openai", "gpt-4.1-mini", {"prompt_tokens": 1000, "completion_tokens": 500})

        self.assertEqual(result["inputTokens"], 1000)
        self.assertEqual(result["outputTokens"], 500)
        self.assertAlmostEqual(result["estimatedCost"], 0.0012)

    def test_estimates_claude_cost_from_input_and_output_tokens(self):
        result = estimate_ai_cost("claude", "claude-sonnet-4-20250514", {"input_tokens": 1000, "output_tokens": 500})

        self.assertEqual(result["inputTokens"], 1000)
        self.assertEqual(result["outputTokens"], 500)
        self.assertAlmostEqual(result["estimatedCost"], 0.0105)

    def test_routes_synthesis_questions_to_ai_when_context_exists(self):
        self.assertTrue(
            should_use_ai_for_requirement_question(
                "Can you summarize when vendor approval is required?",
                [{"score": 4}, {"score": 3}],
            )
        )

    def test_keeps_direct_lookup_questions_in_kb_search(self):
        self.assertFalse(
            should_use_ai_for_requirement_question(
                "What is AC18?",
                [{"score": 5}],
            )
        )

    def test_does_not_use_ai_without_matching_context(self):
        self.assertFalse(
            should_use_ai_for_requirement_question(
                "Can you summarize when vendor approval is required?",
                [],
            )
        )


if __name__ == "__main__":
    unittest.main()
