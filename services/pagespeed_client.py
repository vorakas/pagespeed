"""Google PageSpeed Insights API client.

Encapsulates HTTP communication with the PageSpeed Insights REST API
and parsing of Lighthouse results.  Raises ``PageSpeedError`` on any
failure — never returns ``None``.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

import requests

from config import (
    DEFAULT_STRATEGY,
    PAGESPEED_API_URL,
    PAGESPEED_TIMEOUT_SECONDS,
)
from exceptions import PageSpeedError

logger = logging.getLogger(__name__)

# Lighthouse audit-ref ids used to extract metric weights
_WEIGHT_AUDIT_IDS: dict[str, str] = {
    "fcp": "first-contentful-paint",
    "lcp": "largest-contentful-paint",
    "cls": "cumulative-layout-shift",
    "tbt": "total-blocking-time",
    "si": "speed-index",
}


class PageSpeedClient:
    """Client for Google PageSpeed Insights v5.

    Args:
        api_key: Optional API key.  ``None`` uses unauthenticated quota.
    """

    _MAX_RETRIES: int = 1
    _RETRY_BACKOFF_SECONDS: int = 5

    def __init__(self, api_key: Optional[str] = None) -> None:
        self._api_key: Optional[str] = api_key

    def test_url(self, url: str, strategy: str = DEFAULT_STRATEGY) -> dict:
        """Run a Lighthouse audit via the PageSpeed Insights API.

        Retries once on timeout before giving up.

        Args:
            url:      The URL to test.
            strategy: ``'desktop'`` or ``'mobile'``.

        Returns:
            Parsed result dict containing scores, metrics, and raw audit data.

        Raises:
            PageSpeedError: On any HTTP or parsing failure.
        """
        params: dict[str, Any] = {
            "url": url,
            "strategy": strategy,
            "category": ["performance", "accessibility", "best-practices", "seo"],
        }
        if self._api_key:
            params["key"] = self._api_key

        data = self._request_with_retry(url, params)
        return self._parse_results(data)

    def _request_with_retry(self, url: str, params: dict[str, Any]) -> dict:
        """Send the PSI request, retrying once on timeout."""
        last_exception: requests.exceptions.RequestException | None = None

        for attempt in range(1 + self._MAX_RETRIES):
            try:
                if attempt == 0:
                    logger.info("Testing %s ...", url)
                else:
                    logger.info("Retrying %s (attempt %d) ...", url, attempt + 1)

                response = requests.get(
                    PAGESPEED_API_URL, params=params, timeout=PAGESPEED_TIMEOUT_SECONDS,
                )
                response.raise_for_status()
                return response.json()
            except (requests.exceptions.Timeout, requests.exceptions.ConnectionError) as exc:
                last_exception = exc
                if attempt < self._MAX_RETRIES:
                    time.sleep(self._RETRY_BACKOFF_SECONDS)
                    continue
            except requests.exceptions.RequestException as exc:
                raise PageSpeedError(
                    self._friendly_error(url, exc),
                ) from exc

        raise PageSpeedError(
            self._friendly_error(url, last_exception),
        ) from last_exception

    @staticmethod
    def _friendly_error(url: str, exc: requests.exceptions.RequestException | None) -> str:
        """Convert raw requests exceptions into concise, user-facing messages."""
        if isinstance(exc, requests.exceptions.Timeout):
            return (
                f"Google PageSpeed timed out after {PAGESPEED_TIMEOUT_SECONDS}s for {url} "
                f"— the page may be too heavy or the API is overloaded"
            )
        if isinstance(exc, requests.exceptions.ConnectionError):
            return f"Could not connect to Google PageSpeed API while testing {url}"
        if isinstance(exc, requests.exceptions.HTTPError) and exc.response is not None:
            return (
                f"Google PageSpeed returned HTTP {exc.response.status_code} for {url}"
            )
        return f"Google PageSpeed request failed for {url}"

    # ------------------------------------------------------------------
    # Parsing helpers — each stays under ~30 lines
    # ------------------------------------------------------------------

    def _parse_results(self, data: dict) -> dict:
        """Top-level parser that delegates to specialised sub-parsers.

        Raises:
            PageSpeedError: If the response structure is unexpected.
        """
        try:
            lighthouse: dict = data.get("lighthouseResult", {})
            categories: dict = lighthouse.get("categories", {})
            audits: dict = lighthouse.get("audits", {})

            result = self._parse_scores(categories)
            result.update(self._parse_metrics(audits))
            result["raw_data"] = self._parse_audits(data, categories, audits)
            return result
        except Exception as exc:
            raise PageSpeedError(f"Error parsing results: {exc}") from exc

    def _parse_scores(self, categories: dict) -> dict:
        """Extract the four Lighthouse category scores (0-100 scale)."""

        def _score(key: str) -> Optional[float]:
            raw = categories.get(key, {}).get("score")
            return raw * 100 if raw is not None else None

        return {
            "performance_score": _score("performance"),
            "accessibility_score": _score("accessibility"),
            "best_practices_score": _score("best-practices"),
            "seo_score": _score("seo"),
        }

    def _parse_metrics(self, audits: dict) -> dict:
        """Extract Core Web Vitals and supporting timing metrics."""
        metrics_items = (
            audits.get("metrics", {}).get("details", {}).get("items", [{}])
        )
        metrics: dict = metrics_items[0] if metrics_items else {}

        return {
            "fcp": metrics.get("firstContentfulPaint"),
            "lcp": metrics.get("largestContentfulPaint"),
            "cls": audits.get("cumulative-layout-shift", {}).get("numericValue"),
            "tti": metrics.get("interactive"),
            "tbt": metrics.get("totalBlockingTime"),
            "speed_index": metrics.get("speedIndex"),
            "inp": audits.get("interaction-to-next-paint", {}).get("numericValue"),
            "ttfb": audits.get("server-response-time", {}).get("numericValue"),
            "total_byte_weight": audits.get("total-byte-weight", {}).get("numericValue"),
        }

    def _parse_audits(self, data: dict, categories: dict, audits: dict) -> dict:
        """Assemble raw_data dict from categorised audit refs and metadata."""
        lighthouse: dict = data.get("lighthouseResult", {})
        perf_category: dict = categories.get("performance", {})
        audit_refs: list[dict] = perf_category.get("auditRefs", [])

        opportunities, failed_audits, diagnostics = self._categorize_audit_refs(
            audit_refs, audits,
        )

        metric_weights: dict[str, int] = {
            alias: next(
                (ref.get("weight", 0) for ref in audit_refs if ref.get("id") == ref_id),
                0,
            )
            for alias, ref_id in _WEIGHT_AUDIT_IDS.items()
        }

        return {
            "fetch_time": data.get("analysisUTCTimestamp"),
            "final_url": lighthouse.get("finalUrl"),
            "opportunities": opportunities[:10],
            "failed_audits": failed_audits[:10],
            "diagnostics": diagnostics[:5],
            "metric_weights": metric_weights,
        }

    @staticmethod
    def _categorize_audit_refs(
        audit_refs: list[dict], audits: dict,
    ) -> tuple[list[dict], list[dict], list[dict]]:
        """Walk audit refs and bucket into opportunities, failures, diagnostics."""
        opportunities: list[dict] = []
        failed: list[dict] = []
        diagnostics: list[dict] = []

        for ref in audit_refs:
            audit_id = ref.get("id", "")
            ad = audits.get(audit_id, {})
            if not ad:
                continue
            info: dict = {
                "id": audit_id, "title": ad.get("title"),
                "description": ad.get("description"), "score": ad.get("score"),
                "displayValue": ad.get("displayValue"),
                "numericValue": ad.get("numericValue"), "weight": ref.get("weight", 0),
            }
            if ad.get("details", {}).get("type") == "opportunity":
                savings = ad.get("details", {}).get("overallSavingsMs", 0)
                if savings > 0:
                    info["savingsMs"] = savings
                    opportunities.append(info)
            elif ad.get("score") is not None:
                if ad["score"] < 1:
                    failed.append(info)
            else:
                diagnostics.append(info)

        opportunities.sort(key=lambda x: x.get("savingsMs", 0), reverse=True)
        return opportunities, failed, diagnostics
