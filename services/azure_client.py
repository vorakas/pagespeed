"""Azure Log Analytics REST API client.

Encapsulates OAuth2 token acquisition, KQL query execution, and
response parsing for IIS log analysis.  Raises domain exceptions
on failure — never returns error dicts.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Optional

import requests

from config import (
    AZURE_LOG_ANALYTICS_BASE_URL,
    AZURE_LOG_ANALYTICS_SCOPE,
    AZURE_QUERY_TIMEOUT_SECONDS,
    AZURE_TOKEN_TIMEOUT_SECONDS,
)
from exceptions import AuthenticationError, AzureError

logger = logging.getLogger(__name__)


class AzureLogAnalyticsClient:
    """Client for the Azure Monitor Log Analytics REST API.

    Args:
        tenant_id:     Azure AD tenant id.
        client_id:     App registration client id.
        client_secret: App registration client secret.
        workspace_id:  Log Analytics workspace id.
    """

    def __init__(
        self,
        tenant_id: str,
        client_id: str,
        client_secret: str,
        workspace_id: str,
    ) -> None:
        self._tenant_id: str = tenant_id
        self._client_id: str = client_id
        self._client_secret: str = client_secret
        self._workspace_id: str = workspace_id
        self._token: Optional[str] = None
        self._token_expiry: Optional[datetime] = None
        self._base_url: str = f"{AZURE_LOG_ANALYTICS_BASE_URL}/{workspace_id}/query"

    # ------------------------------------------------------------------
    # Token management
    # ------------------------------------------------------------------

    def _get_token(self) -> str:
        """Acquire or reuse an OAuth2 access token.

        Returns:
            A valid bearer token string.

        Raises:
            AuthenticationError: On token acquisition failure.
        """
        if self._token and self._token_expiry and datetime.now() < self._token_expiry:
            return self._token

        token_url = (
            f"https://login.microsoftonline.com/{self._tenant_id}/oauth2/v2.0/token"
        )
        data = {
            "grant_type": "client_credentials",
            "client_id": self._client_id,
            "client_secret": self._client_secret,
            "scope": AZURE_LOG_ANALYTICS_SCOPE,
        }

        try:
            response = requests.post(token_url, data=data, timeout=AZURE_TOKEN_TIMEOUT_SECONDS)
            response.raise_for_status()
            token_data = response.json()
        except requests.exceptions.RequestException as exc:
            raise AuthenticationError(
                f"Failed to acquire Azure token: {exc}", provider="Azure",
            ) from exc
        except (KeyError, json.JSONDecodeError) as exc:
            raise AuthenticationError(
                f"Invalid token response from Azure: {exc}", provider="Azure",
            ) from exc

        self._token = token_data["access_token"]
        expires_in = token_data.get("expires_in", 3600)
        self._token_expiry = datetime.now() + timedelta(seconds=expires_in - 60)
        return self._token

    # ------------------------------------------------------------------
    # Query execution
    # ------------------------------------------------------------------

    def execute_query(self, query: str, timespan: Optional[str] = None) -> dict:
        """Execute a KQL query against Log Analytics.

        Args:
            query:    KQL query string.
            timespan: Optional ISO 8601 duration (e.g. ``'PT24H'``).

        Returns:
            Parsed JSON response dict.

        Raises:
            AzureError: On HTTP or JSON-parse failure.
        """
        token = self._get_token()

        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        payload: dict = {"query": query}
        if timespan:
            payload["timespan"] = timespan

        try:
            response = requests.post(
                self._base_url,
                headers=headers,
                json=payload,
                timeout=AZURE_QUERY_TIMEOUT_SECONDS,
            )
            if response.status_code == 403:
                raise AzureError(
                    "Access denied. Ensure the app registration has "
                    "Log Analytics Reader role on the workspace."
                )
            response.raise_for_status()
            return response.json()
        except AzureError:
            raise
        except requests.exceptions.Timeout:
            raise AzureError("Request to Azure Log Analytics timed out")
        except requests.exceptions.RequestException as exc:
            raise AzureError(f"Error calling Azure Log Analytics: {exc}") from exc
        except json.JSONDecodeError as exc:
            raise AzureError("Invalid JSON response from Azure Log Analytics") from exc

    # ------------------------------------------------------------------
    # Response parsing (public — called by route layer)
    # ------------------------------------------------------------------

    def parse_table_response(self, response: dict) -> list[dict]:
        """Convert a Log Analytics tabular response to a list of dicts.

        The API returns ``{"tables": [{"columns": [...], "rows": [[...]]}]}``.

        Args:
            response: Raw JSON response from :meth:`execute_query`.

        Returns:
            List of row dicts keyed by column name, or empty list on
            unexpected structure.
        """
        try:
            tables = response.get("tables", [])
            if not tables:
                return []

            table = tables[0]
            columns = [col["name"] for col in table.get("columns", [])]
            rows = table.get("rows", [])

            return [dict(zip(columns, row)) for row in rows]
        except (KeyError, IndexError, TypeError) as exc:
            logger.debug("Error parsing table response: %s", exc)
            return []

    # ------------------------------------------------------------------
    # Connection test
    # ------------------------------------------------------------------

    def test_connection(self) -> dict:
        """Test connectivity and check for IIS log data.

        Returns:
            Dict with ``success`` (bool), ``message`` (str), and
            optionally ``warning`` (bool).
        """
        try:
            response = self.execute_query(
                "W3CIISLog | take 1 | project TimeGenerated, sSiteName",
            )
        except AzureError:
            try:
                self.execute_query("Heartbeat | take 1")
                return {
                    "success": True,
                    "message": (
                        "Connected to workspace, but W3CIISLog table was not found. "
                        "IIS logs may not be configured."
                    ),
                    "warning": True,
                }
            except AzureError as exc:
                return {
                    "success": False,
                    "message": f"Could not connect to workspace: {exc.message}",
                }

        rows = self.parse_table_response(response)
        if rows:
            site_name = rows[0].get("sSiteName", "Unknown")
            return {
                "success": True,
                "message": f"Connected to workspace. Found IIS log data (site: {site_name}).",
            }
        return {
            "success": True,
            "message": "Connected to workspace. W3CIISLog table exists but no recent data found.",
        }

    # ------------------------------------------------------------------
    # IIS log search
    # ------------------------------------------------------------------

    def search_logs(
        self,
        start_date: str,
        end_date: str,
        url_filter: Optional[str] = None,
        status_code: Optional[str] = None,
        site_name: Optional[str] = None,
        limit: int = 100,
        exact_url: bool = False,
    ) -> dict:
        """Search and filter IIS logs.

        Args:
            start_date:  Start datetime in ISO format.
            end_date:    End datetime in ISO format.
            url_filter:  Optional URL path filter.
            status_code: Optional status code filter (e.g. ``'4'`` for 4xx).
            site_name:   Optional IIS site name filter.
            limit:       Maximum rows to return.
            exact_url:   Use exact match for *url_filter* when ``True``.

        Returns:
            Dict with ``success``, ``logs``, ``count``, and ``metadata``.

        Raises:
            AzureError: On query execution failure.
        """
        filters: list[str] = [
            f"TimeGenerated between (datetime('{start_date}') .. datetime('{end_date}'))",
            "csUriStem !endswith '.css'",
            "csUriStem !endswith '.js'",
            "csUriStem !endswith '.png'",
            "csUriStem !endswith '.jpg'",
            "csUriStem !endswith '.gif'",
            "csUriStem !endswith '.ico'",
            "csUriStem !endswith '.woff'",
            "csUriStem !endswith '.woff2'",
            "csUriStem !endswith '.svg'",
            "csUriStem !endswith '.map'",
        ]

        if url_filter:
            operator = "==" if exact_url else "contains"
            filters.append(f"csUriStem {operator} '{url_filter}'")

        if status_code:
            if len(status_code) == 1:
                filters.append(f"scStatus startswith '{status_code}'")
            else:
                filters.append(f"scStatus == '{status_code}'")

        if site_name:
            filters.append(f"sSiteName == '{site_name}'")

        where_clause = "\n| where ".join(filters)

        query = (
            f"W3CIISLog\n"
            f"| where {where_clause}\n"
            f"| project TimeGenerated, csMethod, csUriStem, csUriQuery, "
            f"scStatus, TimeTaken, cIP, sSiteName, scBytes\n"
            f"| order by TimeGenerated desc\n"
            f"| take {limit}"
        )

        logger.debug("IIS search query: %s", query)

        response = self.execute_query(query)
        rows = self.parse_table_response(response)

        return {
            "success": True,
            "logs": rows,
            "count": len(rows),
            "metadata": {
                "start_date": start_date,
                "end_date": end_date,
                "url_filter": url_filter,
                "status_code": status_code,
                "limit": limit,
            },
        }

    # ------------------------------------------------------------------
    # Dashboard summary
    # ------------------------------------------------------------------

    def get_dashboard_summary(
        self,
        start_date: str,
        end_date: str,
        site_name: Optional[str] = None,
    ) -> dict:
        """Get aggregated dashboard summary stats.

        Args:
            start_date: Start datetime in ISO format.
            end_date:   End datetime in ISO format.
            site_name:  Optional IIS site name filter.

        Returns:
            Dict with ``success``, ``summary``, ``topPages``,
            ``statusDistribution``, and ``metadata``.

        Raises:
            AzureError: On query execution failure.
        """
        time_filter = f"TimeGenerated between (datetime('{start_date}') .. datetime('{end_date}'))"
        site_filter = f'| where sSiteName == "{site_name}"' if site_name else ""
        static_filter = (
            'csUriStem !endswith ".css" and csUriStem !endswith ".js" '
            'and csUriStem !endswith ".png" and csUriStem !endswith ".jpg" '
            'and csUriStem !endswith ".gif" and csUriStem !endswith ".ico" '
            'and csUriStem !endswith ".woff" and csUriStem !endswith ".woff2" '
            'and csUriStem !endswith ".svg" and csUriStem !endswith ".map" '
        )

        summary_query = (
            f"W3CIISLog\n| where {time_filter}\n{site_filter}\n"
            f"| where {static_filter}\n"
            f"| summarize\n"
            f"    TotalRequests = count(),\n"
            f"    ErrorCount4xx = countif(scStatus startswith \"4\"),\n"
            f"    ErrorCount5xx = countif(scStatus startswith \"5\"),\n"
            f"    AvgTimeTaken = avg(TimeTaken),\n"
            f"    P50TimeTaken = percentile(TimeTaken, 50),\n"
            f"    P90TimeTaken = percentile(TimeTaken, 90),\n"
            f"    P99TimeTaken = percentile(TimeTaken, 99),\n"
            f"    MaxTimeTaken = max(TimeTaken)"
        )

        top_pages_query = (
            f"W3CIISLog\n| where {time_filter}\n{site_filter}\n"
            f"| where {static_filter}\n"
            f"| summarize RequestCount = count(), AvgTimeTaken = avg(TimeTaken) by csUriStem\n"
            f"| order by RequestCount desc\n"
            f"| take 10"
        )

        status_query = (
            f"W3CIISLog\n| where {time_filter}\n{site_filter}\n"
            f"| summarize Count = count() by scStatus\n"
            f"| order by Count desc\n"
            f"| take 20"
        )

        summary_resp = self.execute_query(summary_query)
        top_pages_resp = self.execute_query(top_pages_query)
        status_resp = self.execute_query(status_query)

        summary_rows = self.parse_table_response(summary_resp)
        top_pages = self.parse_table_response(top_pages_resp)
        status_dist = self.parse_table_response(status_resp)

        summary: dict = {}
        if summary_rows:
            row = summary_rows[0]
            summary = {
                "totalRequests": row.get("TotalRequests", 0),
                "errorCount4xx": row.get("ErrorCount4xx", 0),
                "errorCount5xx": row.get("ErrorCount5xx", 0),
                "avgTimeTaken": round(row.get("AvgTimeTaken", 0) or 0, 1),
                "p50TimeTaken": round(row.get("P50TimeTaken", 0) or 0, 1),
                "p90TimeTaken": round(row.get("P90TimeTaken", 0) or 0, 1),
                "p99TimeTaken": round(row.get("P99TimeTaken", 0) or 0, 1),
                "maxTimeTaken": round(row.get("MaxTimeTaken", 0) or 0, 1),
            }

        formatted_top_pages: list[dict] = [
            {
                "url": page.get("csUriStem", "Unknown"),
                "requestCount": page.get("RequestCount", 0),
                "avgTimeTaken": round(page.get("AvgTimeTaken", 0) or 0, 1),
            }
            for page in top_pages
        ]

        total_for_pct = sum(status_entry.get("Count", 0) for status_entry in status_dist)
        formatted_status: list[dict] = [
            {
                "statusCode": status_entry.get("scStatus", 0),
                "count": status_entry.get("Count", 0),
                "percentage": round(
                    (status_entry.get("Count", 0) / total_for_pct * 100)
                    if total_for_pct > 0 else 0,
                    1,
                ),
            }
            for status_entry in status_dist
        ]

        return {
            "success": True,
            "summary": summary,
            "topPages": formatted_top_pages,
            "statusDistribution": formatted_status,
            "metadata": {"start_date": start_date, "end_date": end_date},
        }
