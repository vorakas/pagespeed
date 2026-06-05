import unittest
from unittest.mock import MagicMock

from exceptions import NewRelicError
from services.newrelic_client import NewRelicClient


class NewRelicClientApmMetricsTest(unittest.TestCase):
    def test_apm_metrics_raises_newrelic_error_when_account_missing(self):
        client = NewRelicClient(api_key="x")
        client.execute_query = MagicMock(return_value={"data": {"actor": {"account": None}}})

        with self.assertRaises(NewRelicError):
            client.get_apm_metrics(account_id=123, app_name="Missing App")


class NewRelicClientCwvQueryTest(unittest.TestCase):
    def test_browser_interactions_count_is_homepage_scoped_with_query_variants(self):
        client = NewRelicClient(api_key="x")

        query = client._build_cwv_query(
            account_id=123,
            app_name="LampsPlus",
            page_url="https://www.lampsplus.com",
            time_range="7 days ago",
        )

        self.assertIn(
            "FROM BrowserInteraction SELECT count(*) AS interactions "
            "WHERE appName = 'LampsPlus' AND (targetUrl = 'https://www.lampsplus.com'",
            query,
        )
        self.assertIn("targetUrl = 'https://www.lampsplus.com/'", query)
        self.assertIn("targetUrl LIKE 'https://www.lampsplus.com?%'", query)
        self.assertIn("targetUrl LIKE 'https://www.lampsplus.com/?%'", query)
        self.assertIn("targetGroupedUrl = 'https://www.lampsplus.com/'", query)
        self.assertIn("targetGroupedUrl LIKE 'https://www.lampsplus.com/?%'", query)
        self.assertNotIn("WHERE appName = 'LampsPlus' SINCE 7 days ago", query)
        self.assertNotIn("targetUrl LIKE 'https://www.lampsplus.com/%'", query)

    def test_browser_interactions_count_normalizes_bare_homepage_host(self):
        client = NewRelicClient(api_key="x")

        query = client._build_cwv_query(
            account_id=123,
            app_name="LampsPlus",
            page_url="www.lampsplus.com",
            time_range="7 days ago",
        )

        self.assertIn("targetUrl = 'www.lampsplus.com'", query)
        self.assertIn("targetUrl = 'https://www.lampsplus.com/'", query)
        self.assertIn("targetUrl LIKE 'www.lampsplus.com/?%'", query)
        self.assertIn(
            "targetGroupedUrl LIKE 'https://www.lampsplus.com/?%'",
            query,
        )

    def test_extract_interactions_count_prefers_aliased_browser_interaction_count(self):
        client = NewRelicClient(api_key="x")

        count = client._extract_interactions_count(
            {
                "inpCollectionCheck": {"results": [{"interactions": 156000}]},
                "inpAnyInteractions": {"results": [{"count": 122676}]},
            },
        )

        self.assertEqual(count, 156000)


if __name__ == "__main__":
    unittest.main()
