"""HTTP page validator.

Fetches a URL server-side (following redirects) and confirms a CSS readiness
selector is present in the returned HTML — the same assertion the JMeter load
test makes.  Pure I/O; holds no state beyond a reusable requests session.
"""

from __future__ import annotations

import logging
import re

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Matches the EDS API's {"redirected_url": "https://host/path..."} and
# captures the path portion (everything after the host).
_REDIRECT_RE = re.compile(r'"redirected_url"\s*:\s*"https://[^/]+([^"]+)"')

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 Pharos-TestData-Validator"
)


class PageValidator:
    """Validate that a page returns 200 and contains a readiness selector."""

    _TIMEOUT_SECONDS: int = 20

    def __init__(self) -> None:
        self._session = requests.Session()
        self._session.headers.update({"User-Agent": _USER_AGENT})

    def validate_selector(self, url: str, selector: str) -> tuple[bool, str, str]:
        """Fetch ``url`` and check ``selector`` is present.

        Returns ``(ok, reason, final_url)``.
        """
        try:
            resp = self._session.get(
                url, timeout=self._TIMEOUT_SECONDS, allow_redirects=True,
            )
        except requests.exceptions.RequestException as exc:
            return (False, f"request failed: {exc}", url)

        final_url = resp.url
        if resp.status_code != 200:
            return (False, f"HTTP {resp.status_code} (missing)", final_url)

        soup = BeautifulSoup(resp.text, "html.parser")
        if soup.select_one(selector) is not None:
            return (True, "ok", final_url)
        return (
            False,
            "readiness selector not found (unavailable / out-of-stock)",
            final_url,
        )

    def resolve_search_to_pdp(
        self, api_url: str, base_url: str, selector: str,
    ) -> tuple[bool, str, str]:
        """Resolve the SearchToPDP redirect API then validate the final PDP."""
        try:
            resp = self._session.get(
                api_url, timeout=self._TIMEOUT_SECONDS, allow_redirects=True,
            )
        except requests.exceptions.RequestException as exc:
            return (False, f"search API request failed: {exc}", api_url)

        if resp.status_code != 200:
            return (False, f"search API HTTP {resp.status_code}", resp.url)

        match = _REDIRECT_RE.search(resp.text)
        if match is None:
            return (False, "no redirect (SKU not found)", api_url)

        pdp_url = f"{base_url}{match.group(1)}"
        return self.validate_selector(pdp_url, selector)
