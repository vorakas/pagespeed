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
    def test_browser_interactions_count_is_app_wide_not_page_filtered(self):
        client = NewRelicClient(api_key="x")

        query = client._build_cwv_query(
            account_id=123,
            app_name="LampsPlus",
            page_url="https://www.lampsplus.com",
            time_range="7 days ago",
        )

        self.assertIn(
            "FROM BrowserInteraction SELECT count(*) AS interactions "
            "WHERE appName = 'LampsPlus' SINCE 7 days ago",
            query,
        )
        self.assertNotIn(
            "FROM BrowserInteraction SELECT count(*) AS interactions WHERE appName = "
            "'LampsPlus' AND pageUrl",
            query,
        )
        self.assertNotIn(
            "FROM BrowserInteraction SELECT count(*) AS interactions WHERE appName = "
            "'LampsPlus' AND targetUrl",
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
