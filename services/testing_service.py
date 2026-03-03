"""Business logic for PageSpeed testing workflows.

Orchestrates the PageSpeed client and repositories to run single-URL,
per-site, all-sites, and daily scheduled tests.  Raises domain
exceptions — never returns ``{'error': ...}`` dicts.
"""

from __future__ import annotations

import time
from datetime import datetime
from typing import Optional

from config import DEFAULT_STRATEGY, REQUEST_DELAY_SECONDS
from data_access import UrlRepository, TestResultRepository
from exceptions import PageSpeedError
from services.pagespeed_client import PageSpeedClient


class TestingService:
    """Coordinates PageSpeed testing across URLs and sites.

    Single Responsibility: owns the orchestration logic (delay between
    requests, result aggregation, save-on-success) while delegating
    HTTP calls to ``PageSpeedClient`` and persistence to the
    repositories.

    Args:
        pagespeed_client: Client that talks to the Google PageSpeed API.
        url_repo:         Repository for the ``urls`` table.
        test_result_repo: Repository for the ``test_results`` table.
    """

    def __init__(
        self,
        pagespeed_client: PageSpeedClient,
        url_repo: UrlRepository,
        test_result_repo: TestResultRepository,
    ) -> None:
        self._pagespeed: PageSpeedClient = pagespeed_client
        self._urls: UrlRepository = url_repo
        self._results: TestResultRepository = test_result_repo

    def test_single_url(
        self,
        url: str,
        url_id: Optional[int] = None,
        strategy: str = DEFAULT_STRATEGY,
    ) -> dict:
        """Run a PageSpeed test for a single URL.

        Args:
            url:      The full URL to test.
            url_id:   If provided, the result is persisted to the database.
            strategy: Lighthouse strategy — ``'desktop'`` or ``'mobile'``.

        Returns:
            The parsed PageSpeed result dict.

        Raises:
            PageSpeedError: If the PageSpeed API call fails.
        """
        result = self._pagespeed.test_url(url, strategy=strategy)
        if result is None:
            raise PageSpeedError(f"Failed to test URL: {url}")

        if url_id is not None:
            self._results.save(url_id, result, strategy=strategy)

        return result

    def test_site(self, site_id: int, strategy: str = DEFAULT_STRATEGY) -> list[dict]:
        """Test all URLs belonging to a site with rate-limited delays.

        Args:
            site_id:  Id of the site whose URLs to test.
            strategy: Lighthouse strategy — ``'desktop'`` or ``'mobile'``.

        Returns:
            A list of per-URL outcome dicts, each containing ``url``,
            ``success`` (bool), and optionally ``result``.
        """
        urls = self._urls.get_by_site(site_id)
        return self._test_url_batch(urls, strategy)

    def test_all(self, strategy: str = DEFAULT_STRATEGY) -> list[dict]:
        """Test every URL across all sites with rate-limited delays.

        Args:
            strategy: Lighthouse strategy — ``'desktop'`` or ``'mobile'``.

        Returns:
            A list of per-URL outcome dicts, each containing ``url``,
            ``site`` (name), ``success`` (bool), and optionally ``result``.
        """
        all_urls = self._urls.get_all_with_sites()
        return self._test_url_batch(all_urls, strategy)

    def run_daily_tests(self) -> None:
        """Scheduler target: test every URL using the desktop strategy.

        Prints progress to stdout for log visibility. Failures for
        individual URLs are logged but do not abort the batch.
        """
        print(f"Running scheduled tests at {datetime.now()}")
        all_urls = self._urls.get_all_with_sites()

        for index, url_data in enumerate(all_urls):
            result = self._pagespeed.test_url(url_data["url"], strategy=DEFAULT_STRATEGY)
            if result:
                self._results.save(url_data["id"], result, strategy=DEFAULT_STRATEGY)
                print(f"Saved result for {url_data['url']}")
            else:
                print(f"Failed to test {url_data['url']}")

            if index < len(all_urls) - 1:
                time.sleep(REQUEST_DELAY_SECONDS)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _test_url_batch(self, urls: list[dict], strategy: str) -> list[dict]:
        """Run PageSpeed tests for a list of URL dicts with delays.

        Each dict must contain at minimum ``id`` and ``url`` keys.
        An optional ``site_name`` key is forwarded as ``site`` in the
        outcome.

        Args:
            urls:     URL dicts from a repository query.
            strategy: Lighthouse strategy.

        Returns:
            A list of per-URL outcome dicts.
        """
        outcomes: list[dict] = []

        for index, url_data in enumerate(urls):
            result = self._pagespeed.test_url(url_data["url"], strategy=strategy)
            outcome: dict = {"url": url_data["url"], "success": result is not None}

            if "site_name" in url_data:
                outcome["site"] = url_data["site_name"]

            if result:
                self._results.save(url_data["id"], result, strategy=strategy)
                outcome["result"] = result

            outcomes.append(outcome)

            if index < len(urls) - 1:
                time.sleep(REQUEST_DELAY_SECONDS)

        return outcomes
