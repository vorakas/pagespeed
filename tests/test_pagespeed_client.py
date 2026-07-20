import unittest
from unittest.mock import Mock, patch

import requests

from exceptions import RateLimitError
from services.pagespeed_client import PageSpeedClient


def _http_error(status, headers=None):
    response = Mock()
    response.status_code = status
    response.headers = headers or {}
    exc = requests.exceptions.HTTPError(response=response)
    return response, exc


class PageSpeedClient429Test(unittest.TestCase):
    def test_429_raises_rate_limit_error_with_retry_after(self):
        response, exc = _http_error(429, {"Retry-After": "12"})
        response.raise_for_status.side_effect = exc
        with patch("services.pagespeed_client.requests.get", return_value=response):
            client = PageSpeedClient(api_key=None)
            with self.assertRaises(RateLimitError) as ctx:
                client.test_url("https://example.com/", "desktop")
        self.assertEqual(ctx.exception.retry_after, 12)
        self.assertEqual(ctx.exception.provider, "Google PageSpeed")

    def test_429_without_header_defaults_retry_after(self):
        response, exc = _http_error(429, {})
        response.raise_for_status.side_effect = exc
        with patch("services.pagespeed_client.requests.get", return_value=response):
            client = PageSpeedClient(api_key=None)
            with self.assertRaises(RateLimitError) as ctx:
                client.test_url("https://example.com/", "desktop")
        self.assertEqual(ctx.exception.retry_after, 30)


if __name__ == "__main__":
    unittest.main()
