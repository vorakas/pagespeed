"""New Relic NerdGraph (GraphQL) API client.

Encapsulates query construction, HTTP communication, and response
parsing for Core Web Vitals, Performance Overview, and APM Metrics.
Raises ``NewRelicError`` on any failure — never returns error dicts.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Optional

import requests

from config import (
    DEFAULT_TIME_RANGE,
    NEWRELIC_GRAPHQL_ENDPOINT,
    NEWRELIC_TIMEOUT_SECONDS,
)
from enums import PerformanceStatus
from exceptions import AuthenticationError, NewRelicError
from services.validation import parse_time_range_to_minutes

logger = logging.getLogger(__name__)


class NewRelicClient:
    """Client for the New Relic NerdGraph GraphQL API.

    Args:
        api_key: New Relic User API key.
    """

    def __init__(self, api_key: Optional[str] = None) -> None:
        self._api_key: Optional[str] = api_key

    # ------------------------------------------------------------------
    # Low-level query execution
    # ------------------------------------------------------------------

    def execute_query(self, query: str) -> dict:
        """Execute a raw GraphQL query and return the JSON response.

        Args:
            query: NerdGraph GraphQL query string.

        Returns:
            Parsed JSON response dict.

        Raises:
            AuthenticationError: If the API key is missing.
            NewRelicError:       On HTTP or JSON-parse failure.
        """
        if not self._api_key:
            raise AuthenticationError("New Relic API key not configured", provider="New Relic")

        headers = {
            "Content-Type": "application/json",
            "API-Key": self._api_key,
        }

        try:
            response = requests.post(
                NEWRELIC_GRAPHQL_ENDPOINT,
                headers=headers,
                json={"query": query},
                timeout=NEWRELIC_TIMEOUT_SECONDS,
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.Timeout:
            raise NewRelicError("Request to New Relic API timed out")
        except requests.exceptions.RequestException as exc:
            raise NewRelicError(f"Error calling New Relic API: {exc}") from exc
        except json.JSONDecodeError as exc:
            raise NewRelicError("Invalid JSON response from New Relic") from exc

    # ------------------------------------------------------------------
    # Connection test
    # ------------------------------------------------------------------

    def test_connection(self) -> dict:
        """Verify API key validity by querying the current user.

        Returns:
            Dict with ``success`` (bool) and ``message`` (str).
        """
        query = """
        {
          actor {
            user {
              email
              name
            }
          }
        }
        """
        response = self.execute_query(query)

        try:
            user = response.get("data", {}).get("actor", {}).get("user", {})
            return {
                "success": True,
                "message": f"Connected as {user.get('name', 'Unknown')} ({user.get('email', 'Unknown')})",
            }
        except (KeyError, TypeError):
            return {
                "success": False,
                "message": "Connected but could not retrieve user information",
            }

    # ------------------------------------------------------------------
    # Core Web Vitals
    # ------------------------------------------------------------------

    def get_core_web_vitals(
        self,
        account_id: int,
        app_name: str,
        page_url: str,
        time_range: str = DEFAULT_TIME_RANGE,
    ) -> dict:
        """Fetch Core Web Vitals percentiles for a specific page.

        Args:
            account_id: New Relic account id.
            app_name:   Application name in New Relic.
            page_url:   Full page URL to query.
            time_range: NRQL ``SINCE`` clause value.

        Returns:
            Dict with ``success``, ``metrics``, ``metadata``, and
            ``raw_response`` keys.

        Raises:
            NewRelicError: On HTTP or parsing failure.
        """
        logger.debug("Querying CWV for app_name=%r, page_url=%r", app_name, page_url)

        query = self._build_cwv_query(account_id, app_name, page_url, time_range)
        response = self.execute_query(query)

        logger.debug("Full CWV response: %s", json.dumps(response, indent=2))

        return self._parse_cwv_response(response, account_id, app_name, page_url, time_range)

    def _build_cwv_query(
        self, account_id: int, app_name: str, page_url: str, time_range: str,
    ) -> str:
        """Build the NerdGraph query for Core Web Vitals."""
        return f"""
        {{
          actor {{
            account(id: {account_id}) {{
              lcp: nrql(query: "FROM PageViewTiming SELECT percentile(largestContentfulPaint, 50, 75, 90) AS LCP_ms WHERE appName = '{app_name}' AND pageUrl = '{page_url}' AND timingName = 'largestContentfulPaint' SINCE {time_range}") {{ results }}
              cls: nrql(query: "FROM PageViewTiming SELECT percentile(cumulativeLayoutShift, 50, 75, 90) AS CLS WHERE appName = '{app_name}' AND pageUrl = '{page_url}' AND cumulativeLayoutShift IS NOT NULL SINCE {time_range}") {{ results }}
              pageLoad: nrql(query: "FROM PageView SELECT percentile(duration, 50, 75, 90) AS PageLoad_ms WHERE appName = '{app_name}' AND pageUrl = '{page_url}' SINCE {time_range}") {{ results }}
              backend: nrql(query: "FROM PageView SELECT percentile(backendDuration, 50, 75, 90) AS Backend_ms WHERE appName = '{app_name}' AND pageUrl = '{page_url}' SINCE {time_range}") {{ results }}
              frontend: nrql(query: "FROM PageView SELECT percentile(domProcessingDuration + pageRenderingDuration, 50, 75, 90) AS Frontend_ms WHERE appName = '{app_name}' AND pageUrl = '{page_url}' SINCE {time_range}") {{ results }}
              ttfbLike: nrql(query: "FROM PageView SELECT percentile(queueDuration + networkDuration, 50, 75, 90) AS TTFB_like_ms WHERE appName = '{app_name}' AND pageUrl = '{page_url}' SINCE {time_range}") {{ results }}
              domProcessing: nrql(query: "FROM PageView SELECT percentile(domProcessingDuration, 50, 75, 90) AS DomProcessing_ms WHERE appName = '{app_name}' AND pageUrl = '{page_url}' SINCE {time_range}") {{ results }}
              inpCollectionCheck: nrql(query: "FROM BrowserInteraction SELECT count(*) AS interactions WHERE appName = '{app_name}' SINCE {time_range}") {{ results }}
              inpAnyInteractions: nrql(query: "FROM BrowserInteraction SELECT count(*) WHERE appName = '{app_name}' SINCE {time_range}") {{ results }}
            }}
          }}
        }}
        """

    def _parse_cwv_response(
        self,
        response: dict,
        account_id: int,
        app_name: str,
        page_url: str,
        time_range: str,
    ) -> dict:
        """Parse the NerdGraph response into a CWV metrics dict."""
        try:
            account_data = response.get("data", {}).get("actor", {}).get("account", {})

            logger.debug("Account data keys: %s", list(account_data.keys()))

            interactions_count = self._extract_interactions_count(account_data)
            logger.debug("Final interactions count: %d", interactions_count)

            metrics = {
                "lcp": self._extract_percentiles(account_data.get("lcp", {}).get("results", [])),
                "cls": self._extract_percentiles(account_data.get("cls", {}).get("results", [])),
                "pageLoad": self._extract_percentiles(account_data.get("pageLoad", {}).get("results", [])),
                "backend": self._extract_percentiles(account_data.get("backend", {}).get("results", [])),
                "frontend": self._extract_percentiles(account_data.get("frontend", {}).get("results", [])),
                "ttfbLike": self._extract_percentiles(account_data.get("ttfbLike", {}).get("results", [])),
                "domProcessing": self._extract_percentiles(account_data.get("domProcessing", {}).get("results", [])),
                "interactions": interactions_count,
            }

            return {
                "success": True,
                "metrics": metrics,
                "metadata": {
                    "account_id": account_id,
                    "app_name": app_name,
                    "page_url": page_url,
                    "time_range": time_range,
                },
                "raw_response": response,
            }
        except (KeyError, IndexError, TypeError) as exc:
            raise NewRelicError(f"Error parsing CWV response: {exc}") from exc

    # ------------------------------------------------------------------
    # Performance Overview
    # ------------------------------------------------------------------

    def get_performance_overview(
        self,
        account_id: int,
        app_name: str,
        time_range: str = DEFAULT_TIME_RANGE,
    ) -> dict:
        """Fetch performance overview (response time, throughput, error rate, Apdex).

        Queries both the current and previous equivalent period for
        comparison.

        Args:
            account_id: New Relic account id.
            app_name:   Application name in New Relic.
            time_range: NRQL ``SINCE`` clause value.

        Returns:
            Dict with ``success``, ``current``, ``previous``, ``metadata``,
            and ``raw_response`` keys.

        Raises:
            NewRelicError: On HTTP or parsing failure.
        """
        query = self._build_overview_query(account_id, app_name, time_range)
        response = self.execute_query(query)

        logger.debug("Performance overview response: %s", json.dumps(response, indent=2))

        return self._parse_overview_response(response, account_id, app_name, time_range)

    def _build_overview_query(
        self, account_id: int, app_name: str, time_range: str,
    ) -> str:
        """Build the NerdGraph query for performance overview with comparison period."""
        minutes = parse_time_range_to_minutes(time_range)
        previous_start = f"{minutes * 2} minutes ago"
        previous_end = f"{minutes} minutes ago"

        return f"""
        {{
          actor {{
            account(id: {account_id}) {{
              avgResponseTime: nrql(query: "SELECT average(duration) * 1000 AS 'avg_ms' FROM Transaction WHERE appName = '{app_name}' SINCE {time_range}") {{ results }}
              throughput: nrql(query: "SELECT rate(count(*), 1 minute) AS 'rpm' FROM Transaction WHERE appName = '{app_name}' SINCE {time_range}") {{ results }}
              errorRate: nrql(query: "SELECT percentage(count(*), WHERE error IS true) AS 'error_pct' FROM Transaction WHERE appName = '{app_name}' SINCE {time_range}") {{ results }}
              apdex: nrql(query: "SELECT apdex(duration, t: 0.5) AS 'apdex_score' FROM Transaction WHERE appName = '{app_name}' SINCE {time_range}") {{ results }}
              prevAvgResponseTime: nrql(query: "SELECT average(duration) * 1000 AS 'avg_ms' FROM Transaction WHERE appName = '{app_name}' SINCE {previous_start} UNTIL {previous_end}") {{ results }}
              prevThroughput: nrql(query: "SELECT rate(count(*), 1 minute) AS 'rpm' FROM Transaction WHERE appName = '{app_name}' SINCE {previous_start} UNTIL {previous_end}") {{ results }}
              prevErrorRate: nrql(query: "SELECT percentage(count(*), WHERE error IS true) AS 'error_pct' FROM Transaction WHERE appName = '{app_name}' SINCE {previous_start} UNTIL {previous_end}") {{ results }}
              prevApdex: nrql(query: "SELECT apdex(duration, t: 0.5) AS 'apdex_score' FROM Transaction WHERE appName = '{app_name}' SINCE {previous_start} UNTIL {previous_end}") {{ results }}
            }}
          }}
        }}
        """

    def _parse_overview_response(
        self, response: dict, account_id: int, app_name: str, time_range: str,
    ) -> dict:
        """Parse the NerdGraph response into current / previous metric dicts."""
        try:
            account_data = response.get("data", {}).get("actor", {}).get("account", {})

            current = {
                "avgResponseTime": self._extract_single_value(account_data.get("avgResponseTime", {}).get("results", [])),
                "throughput": self._extract_single_value(account_data.get("throughput", {}).get("results", [])),
                "errorRate": self._extract_single_value(account_data.get("errorRate", {}).get("results", [])),
                "apdex": self._extract_single_value(account_data.get("apdex", {}).get("results", [])),
            }

            previous = {
                "avgResponseTime": self._extract_single_value(account_data.get("prevAvgResponseTime", {}).get("results", [])),
                "throughput": self._extract_single_value(account_data.get("prevThroughput", {}).get("results", [])),
                "errorRate": self._extract_single_value(account_data.get("prevErrorRate", {}).get("results", [])),
                "apdex": self._extract_single_value(account_data.get("prevApdex", {}).get("results", [])),
            }

            logger.debug("Performance current: %s", current)
            logger.debug("Performance previous: %s", previous)

            return {
                "success": True,
                "current": current,
                "previous": previous,
                "metadata": {
                    "account_id": account_id,
                    "app_name": app_name,
                    "time_range": time_range,
                },
                "raw_response": response,
            }
        except (KeyError, IndexError, TypeError) as exc:
            raise NewRelicError(f"Error parsing performance overview: {exc}") from exc

    # ------------------------------------------------------------------
    # APM Metrics
    # ------------------------------------------------------------------

    def get_apm_metrics(
        self,
        account_id: int,
        app_name: str,
        time_range: str = DEFAULT_TIME_RANGE,
    ) -> dict:
        """Fetch APM metrics: transactions, database ops, external calls, errors.

        Args:
            account_id: New Relic account id.
            app_name:   Application name in New Relic.
            time_range: NRQL ``SINCE`` clause value.

        Returns:
            Dict with ``success``, ``transactions``, ``database``,
            ``external``, ``errors``, and ``metadata`` keys.

        Raises:
            NewRelicError: On HTTP or parsing failure.
        """
        query = self._build_apm_query(account_id, app_name, time_range)
        response = self.execute_query(query)

        logger.debug(
            "APM response keys: %s",
            list(response.get("data", {}).get("actor", {}).get("account", {}).keys())
            if "data" in response else "error",
        )

        try:
            account_data = response.get("data", {}).get("actor", {}).get("account", {})

            total_time = self._extract_total_time(account_data)

            transactions = self._parse_transactions(account_data, total_time)
            database = self._parse_database_ops(account_data, total_time)
            external = self._parse_external_calls(account_data, total_time)
            errors = self._parse_errors(account_data)

            logger.debug(
                "APM parsed — %d transactions, %d db ops, %d external, %d errors",
                len(transactions), len(database), len(external), len(errors),
            )

            return {
                "success": True,
                "transactions": transactions,
                "database": database,
                "external": external,
                "errors": errors,
                "metadata": {
                    "account_id": account_id,
                    "app_name": app_name,
                    "time_range": time_range,
                },
            }
        except (KeyError, IndexError, TypeError) as exc:
            raise NewRelicError(f"Error parsing APM response: {exc}") from exc

    def _build_apm_query(self, account_id: int, app_name: str, time_range: str) -> str:
        """Build the NerdGraph query for APM metrics."""
        return f"""
        {{
          actor {{
            account(id: {account_id}) {{
              transactions: nrql(query: "SELECT average(duration) * 1000 AS 'avg_ms', rate(count(*), 1 minute) AS 'rpm', percentage(count(*), WHERE error IS true) AS 'error_pct' FROM Transaction WHERE appName = '{app_name}' FACET name SINCE {time_range} LIMIT 20") {{ results }}
              database: nrql(query: "SELECT average(databaseDuration) * 1000 AS 'avg_ms', rate(count(*), 1 minute) AS 'rpm' FROM Transaction WHERE appName = '{app_name}' AND databaseDuration IS NOT NULL FACET name SINCE {time_range} LIMIT 20") {{ results }}
              external: nrql(query: "SELECT average(externalDuration) * 1000 AS 'avg_ms', rate(count(*), 1 minute) AS 'rpm' FROM Transaction WHERE appName = '{app_name}' AND externalDuration IS NOT NULL FACET name SINCE {time_range} LIMIT 20") {{ results }}
              errors: nrql(query: "SELECT count(*) AS 'error_count', latest(timestamp) AS 'last_seen' FROM TransactionError WHERE appName = '{app_name}' FACET error.class, error.message SINCE {time_range} LIMIT 20") {{ results }}
              totalTime: nrql(query: "SELECT sum(duration) AS 'total' FROM Transaction WHERE appName = '{app_name}' SINCE {time_range}") {{ results }}
            }}
          }}
        }}
        """

    def _parse_transactions(self, account_data: dict, total_time: float) -> list[dict]:
        """Parse top transactions from the APM response."""
        raw = account_data.get("transactions", {}).get("results", [])
        transactions: list[dict] = []

        for transaction in raw:
            name = transaction.get("name", "Unknown")
            avg_ms = transaction.get("avg_ms", 0) or 0
            rpm = transaction.get("rpm", 0) or 0
            error_pct = transaction.get("error_pct", 0) or 0
            time_pct = self._calculate_time_percent(avg_ms, rpm, total_time)

            transactions.append({
                "name": name,
                "avgTime": round(avg_ms, 1),
                "callsPerMin": round(rpm, 1),
                "timePercent": round(time_pct, 1),
                "status": PerformanceStatus.from_response_time(avg_ms).value,
            })

        return transactions

    def _parse_database_ops(self, account_data: dict, total_time: float) -> list[dict]:
        """Parse database operations from the APM response."""
        raw = account_data.get("database", {}).get("results", [])
        operations: list[dict] = []

        for database_operation in raw:
            name = database_operation.get("name", "Unknown")
            avg_ms = database_operation.get("avg_ms", 0) or 0
            rpm = database_operation.get("rpm", 0) or 0
            time_pct = self._calculate_time_percent(avg_ms, rpm, total_time)

            operations.append({
                "name": name,
                "avgDuration": round(avg_ms, 1),
                "callsPerMin": round(rpm, 1),
                "timePercent": round(time_pct, 1),
                "type": "SQL",
            })

        return operations

    def _parse_external_calls(self, account_data: dict, total_time: float) -> list[dict]:
        """Parse external service calls from the APM response."""
        raw = account_data.get("external", {}).get("results", [])
        calls: list[dict] = []

        for external_call in raw:
            name = external_call.get("name", "Unknown")
            avg_ms = external_call.get("avg_ms", 0) or 0
            rpm = external_call.get("rpm", 0) or 0
            time_pct = self._calculate_time_percent(avg_ms, rpm, total_time)

            calls.append({
                "name": name,
                "avgTime": round(avg_ms, 1),
                "callsPerMin": round(rpm, 1),
                "timePercent": round(time_pct, 1),
                "status": PerformanceStatus.from_response_time(avg_ms).value,
            })

        return calls

    def _parse_errors(self, account_data: dict) -> list[dict]:
        """Parse transaction errors from the APM response."""
        raw = account_data.get("errors", {}).get("results", [])
        errors: list[dict] = []

        for error_entry in raw:
            facets = error_entry.get("facet", [])
            error_class = facets[0] if len(facets) > 0 else "Unknown"
            error_message = facets[1] if len(facets) > 1 else "No message"

            errors.append({
                "errorClass": error_class,
                "errorMessage": error_message[:100],
                "count": error_entry.get("error_count", 0) or 0,
                "lastOccurrence": error_entry.get("last_seen", ""),
            })

        return errors

    # ------------------------------------------------------------------
    # Shared helpers
    # ------------------------------------------------------------------

    def _extract_percentiles(self, results: list[dict]) -> dict[str, Any]:
        """Extract p50/p75/p90 from an NRQL percentile result set."""
        if not results:
            return {"p50": None, "p75": None, "p90": None}

        result = results[0]
        logger.debug("Percentile result object: %s", result)

        p50: Any = None
        p75: Any = None
        p90: Any = None

        if result:
            metric_key = next(iter(result))
            percentile_dict = result[metric_key]
            logger.debug("Metric key=%r, percentile_dict=%s", metric_key, percentile_dict)

            if isinstance(percentile_dict, dict):
                p50 = percentile_dict.get("50") or percentile_dict.get(50)
                p75 = percentile_dict.get("75") or percentile_dict.get(75)
                p90 = percentile_dict.get("90") or percentile_dict.get(90)
            else:
                p50 = percentile_dict

        return {"p50": p50, "p75": p75, "p90": p90}

    def _extract_single_value(self, results: list[dict]) -> Any:
        """Extract a single scalar from an NRQL result set."""
        if not results:
            return None
        result = results[0]
        if not result:
            return None
        first_key = next(iter(result))
        value = result[first_key]
        if isinstance(value, dict) and "score" in value:
            return value["score"]
        return value

    def _extract_interactions_count(self, account_data: dict) -> int:
        """Extract BrowserInteraction count from CWV response data."""
        count = self._try_extract_count(
            account_data.get("inpCollectionCheck", {}).get("results", []),
        )
        if count == 0:
            count = self._try_extract_count(
                account_data.get("inpAnyInteractions", {}).get("results", []),
            )
        return count

    def _try_extract_count(self, results: list[dict]) -> int:
        """Best-effort extraction of a count value from NRQL results."""
        if not results:
            return 0

        data = results[0]
        logger.debug("Extracting count from: %s", data)

        if "interactions" in data:
            return data["interactions"]
        if "count" in data:
            return data["count"]

        if data:
            first_key = next(iter(data))
            nested = data[first_key]
            if isinstance(nested, dict):
                return nested.get("count", next(iter(nested.values()), 0)) if nested else 0
            return nested if isinstance(nested, (int, float)) else 0

        return 0

    def _extract_total_time(self, account_data: dict) -> float:
        """Extract total transaction time for percentage calculations."""
        total_time_results = account_data.get("totalTime", {}).get("results", [])
        if total_time_results:
            return total_time_results[0].get("total", 0) or 0
        return 0

    @staticmethod
    def _calculate_time_percent(avg_ms: float, rpm: float, total_time: float) -> float:
        """Calculate what percentage of total time a transaction represents."""
        if total_time <= 0 or rpm <= 0:
            return 0.0
        return ((avg_ms / 1000) * rpm / 60) / (total_time / 60) * 100
