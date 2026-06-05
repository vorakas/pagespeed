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


if __name__ == "__main__":
    unittest.main()
