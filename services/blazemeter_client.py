"""BlazeMeter REST API client.

Encapsulates test listing, run (master) status, start, and stop
operations for the BlazeMeter load-testing service.  Raises domain
exceptions on failure — never returns error dicts.

BlazeMeter vocabulary note:
    * **Test**   — a reusable test definition (id)
    * **Master** — a single execution of a test (run/session id)
"""

from __future__ import annotations

import logging
from base64 import b64encode
from typing import Any, Optional

import requests

from config import (
    BLAZEMETER_BASE_URL,
    BLAZEMETER_TIMEOUT_SECONDS,
)
from exceptions import AuthenticationError, BlazemeterError, RateLimitError

logger = logging.getLogger(__name__)


def _safe_index(seq: Any, idx: int) -> Any:
    """Return ``seq[idx]`` if possible, else None — survives non-lists."""
    if isinstance(seq, list) and 0 <= idx < len(seq):
        return seq[idx]
    return None


class BlazemeterClient:
    """Client for the BlazeMeter v4 REST API.

    Designed with Single Responsibility: only knows how to talk to
    BlazeMeter.  Credential storage, queueing, and HTTP dispatch live
    elsewhere.  All collaborators (HTTP transport, credentials) are
    injected at construction time — no module-level state.

    Args:
        api_key_id:      BlazeMeter API key ID.
        api_key_secret:  BlazeMeter API key secret.
        workspace_id:    Workspace ID used to scope project/test listings.

    Project scoping is **per-request**, not per-client: callers pass a
    ``project_id`` into :meth:`list_tests` to pick which project's tests
    to return.  This keeps a single client instance usable across every
    project in the account.
    """

    def __init__(
        self,
        api_key_id: str,
        api_key_secret: str,
        workspace_id: Optional[str] = None,
    ) -> None:
        if not api_key_id or not api_key_secret:
            raise AuthenticationError(
                "BlazeMeter API key ID and secret are required",
                provider="BlazeMeter",
            )
        self._workspace_id: Optional[str] = workspace_id
        self._base_url: str = BLAZEMETER_BASE_URL
        token = f"{api_key_id}:{api_key_secret}".encode("ascii")
        self._auth_header: str = "Basic " + b64encode(token).decode("ascii")

    @property
    def workspace_id(self) -> Optional[str]:
        return self._workspace_id

    # ------------------------------------------------------------------
    # Internal HTTP helper
    # ------------------------------------------------------------------

    def _request(
        self,
        method: str,
        path: str,
        params: Optional[dict] = None,
        body: Optional[dict] = None,
    ) -> dict:
        """Send an authenticated request to the BlazeMeter API.

        Raises:
            AuthenticationError: On 401/403 responses.
            RateLimitError:      On 429 responses.
            BlazemeterError:     On any other HTTP / parse failure.
        """
        url = f"{self._base_url}{path}"
        headers = {
            "Authorization": self._auth_header,
            "Content-Type": "application/json",
        }
        try:
            response = requests.request(
                method,
                url,
                headers=headers,
                params=params,
                json=body,
                timeout=BLAZEMETER_TIMEOUT_SECONDS,
            )
        except requests.exceptions.Timeout as exc:
            raise BlazemeterError("BlazeMeter request timed out") from exc
        except requests.exceptions.RequestException as exc:
            raise BlazemeterError(f"BlazeMeter request failed: {exc}") from exc

        if response.status_code in (401, 403):
            raise AuthenticationError(
                "Invalid BlazeMeter credentials or insufficient permissions",
                provider="BlazeMeter",
            )
        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", "30"))
            raise RateLimitError(
                "BlazeMeter rate limit reached",
                provider="BlazeMeter",
                retry_after=retry_after,
            )
        if not response.ok:
            detail = self._extract_error_detail(response)
            raise BlazemeterError(
                f"BlazeMeter API error {response.status_code}: {detail}"
            )

        try:
            return response.json()
        except ValueError as exc:
            raise BlazemeterError("Invalid JSON from BlazeMeter") from exc

    @staticmethod
    def _extract_error_detail(response: requests.Response) -> str:
        """Best-effort pull of a human-readable message from an error payload."""
        try:
            payload = response.json()
        except ValueError:
            return response.text[:200] or response.reason
        if isinstance(payload, dict):
            err = payload.get("error") or {}
            if isinstance(err, dict):
                return err.get("message") or str(err)
            return str(err) or str(payload)
        return str(payload)

    # ------------------------------------------------------------------
    # Public operations
    # ------------------------------------------------------------------

    def test_connection(self) -> dict:
        """Hit ``/user`` to verify credentials and return account summary."""
        payload = self._request("GET", "/user")
        user = payload.get("result", {}) if isinstance(payload, dict) else {}
        return {
            "success": True,
            "user": {
                "id": user.get("id"),
                "email": user.get("email"),
                "displayName": user.get("displayName") or user.get("firstName"),
            },
            "workspaceId": self._workspace_id,
        }

    def list_projects(self, limit: int = 200) -> list[dict]:
        """Return every project visible in the configured workspace."""
        params: dict[str, Any] = {"limit": limit}
        if self._workspace_id:
            params["workspaceId"] = self._workspace_id
        payload = self._request("GET", "/projects", params=params)
        results = payload.get("result", []) if isinstance(payload, dict) else []
        return [self._project_project(p) for p in results]

    def list_tests(
        self,
        project_id: Optional[int | str] = None,
        limit: int = 200,
    ) -> list[dict]:
        """Return tests scoped to *project_id*, or the whole workspace.

        Args:
            project_id: Optional BlazeMeter project id to filter by.  When
                        omitted, tests from every project in the configured
                        workspace are returned.
            limit:      Maximum number of tests to return.
        """
        params: dict[str, Any] = {"limit": limit}
        if project_id:
            params["projectId"] = project_id
        elif self._workspace_id:
            params["workspaceId"] = self._workspace_id

        payload = self._request("GET", "/tests", params=params)
        results = payload.get("result", []) if isinstance(payload, dict) else []
        return [self._project_test(t) for t in results]

    def start_test(self, test_id: int) -> dict:
        """Start a test and return the resulting master (run) summary."""
        payload = self._request("POST", f"/tests/{test_id}/start")
        master = payload.get("result", {}) if isinstance(payload, dict) else {}
        return self._project_master(master)

    def stop_master(self, master_id: int) -> dict:
        """Terminate a running master; returns the master summary."""
        payload = self._request("POST", f"/masters/{master_id}/terminate")
        master = payload.get("result", {}) if isinstance(payload, dict) else {}
        return self._project_master(master)

    def get_master(self, master_id: int) -> dict:
        """Return the current state of a master (run)."""
        payload = self._request("GET", f"/masters/{master_id}")
        master = payload.get("result", {}) if isinstance(payload, dict) else {}
        return self._project_master(master)

    def get_master_status(self, master_id: int) -> dict:
        """Return the detailed status sub-resource for a master."""
        payload = self._request("GET", f"/masters/{master_id}/status")
        status = payload.get("result", {}) if isinstance(payload, dict) else {}
        return {
            "status": status.get("status"),
            "progress": status.get("progress"),
            "sessionsStatus": status.get("sessionsStatus"),
        }

    def list_recent_masters(self, test_id: int, limit: int = 5) -> list[dict]:
        """Return the most recent masters for a given test id."""
        params = {"testId": test_id, "limit": limit, "sort[]": "-created"}
        payload = self._request("GET", "/masters", params=params)
        results = payload.get("result", []) if isinstance(payload, dict) else []
        return [self._project_master(m) for m in results]

    # ------------------------------------------------------------------
    # Post-test reports (only call after a master has terminated)
    # ------------------------------------------------------------------

    def get_master_summary(self, master_id: int) -> dict:
        """Return the aggregated run-level summary (hits, error %, percentiles)."""
        payload = self._request(
            "GET", f"/masters/{master_id}/reports/main/summary",
        )
        result = payload.get("result", {}) if isinstance(payload, dict) else {}
        # BM returns either a summary dict directly or `{ summary: [...] }`
        if isinstance(result, dict) and isinstance(result.get("summary"), list) and result["summary"]:
            entry = result["summary"][0]
        else:
            entry = result if isinstance(result, dict) else {}
        return self._project_summary(entry)

    def get_master_aggregate(self, master_id: int) -> list[dict]:
        """Return per-label aggregated stats (one row per URL/transaction)."""
        payload = self._request(
            "GET", f"/masters/{master_id}/reports/aggregatereport/data",
        )
        results = payload.get("result", []) if isinstance(payload, dict) else []
        if not isinstance(results, list):
            return []
        return [self._project_aggregate_row(r) for r in results]

    def get_master_timeline(
        self, master_id: int, granularity: Optional[int] = None,
    ) -> dict:
        """Return time-series data (response time, users, errors, throughput)."""
        params: dict[str, Any] = {}
        if granularity is not None:
            params["granularity"] = granularity
        payload = self._request(
            "GET", f"/masters/{master_id}/reports/timeline/data",
            params=params or None,
        )
        result = payload.get("result", {}) if isinstance(payload, dict) else {}
        return self._project_timeline(result if isinstance(result, dict) else {})

    def get_master_errors(self, master_id: int) -> list[dict]:
        """Return error breakdown (per-label messages + counts)."""
        payload = self._request(
            "GET", f"/masters/{master_id}/reports/errorsreport/data",
        )
        results = payload.get("result", []) if isinstance(payload, dict) else []
        if not isinstance(results, list):
            return []
        return [self._project_error_row(r) for r in results]

    def get_master_ci_status(self, master_id: int) -> dict:
        """Return CI pass/fail status (present only when CI gates were configured)."""
        payload = self._request("GET", f"/masters/{master_id}/ci-status")
        result = payload.get("result", {}) if isinstance(payload, dict) else {}
        if not isinstance(result, dict):
            return {}
        return {
            "failures": result.get("failures") or [],
            "failuresCount": result.get("failuresCount"),
            "passed": result.get("passed"),
            "reason": result.get("reason"),
            "thresholds": result.get("thresholds") or [],
        }

    def get_master_thresholds(self, master_id: int) -> list[dict]:
        """Return threshold/SLA results (list of threshold checks with pass/fail)."""
        payload = self._request("GET", f"/masters/{master_id}/thresholds")
        result = payload.get("result", []) if isinstance(payload, dict) else []
        if isinstance(result, dict):
            # Some BM accounts return `{ data: [...] }` shape.
            inner = result.get("data") or result.get("thresholds")
            if isinstance(inner, list):
                return inner
            return []
        return result if isinstance(result, list) else []

    def get_master_full(self, master_id: int) -> dict:
        """Return the master plus the expanded config blob."""
        payload = self._request("GET", f"/masters/{master_id}/full")
        result = payload.get("result", {}) if isinstance(payload, dict) else {}
        return result if isinstance(result, dict) else {}

    # ------------------------------------------------------------------
    # Response projection (keep only the fields the UI actually uses)
    # ------------------------------------------------------------------

    @staticmethod
    def _project_project(project: dict) -> dict:
        return {
            "id": project.get("id"),
            "name": project.get("name"),
            "workspaceId": project.get("workspaceId"),
            "description": project.get("description"),
            "testsCount": project.get("testsCount"),
            "updated": project.get("updated"),
        }

    @staticmethod
    def _project_test(test: dict) -> dict:
        return {
            "id": test.get("id"),
            "name": test.get("name"),
            "testType": test.get("configuration", {}).get("type") if isinstance(test.get("configuration"), dict) else test.get("testType"),
            "projectId": test.get("projectId"),
            "workspaceId": test.get("workspaceId"),
            "updated": test.get("updated"),
        }

    @staticmethod
    def _project_master(master: dict) -> dict:
        return {
            "id": master.get("id"),
            "testId": master.get("testId"),
            "name": master.get("name"),
            "status": master.get("status"),
            "reportStatus": master.get("reportStatus"),
            "created": master.get("created"),
            "ended": master.get("ended"),
            "note": master.get("note"),
            "publicTokenUrl": master.get("publicTokenUrl"),
            "maxUsers": master.get("maxUsers") or master.get("maxConcurrency"),
        }

    @staticmethod
    def _project_summary(entry: dict) -> dict:
        """Flatten BlazeMeter's summary response into UI-friendly keys.

        BM's summary payload uses keys that differ slightly across API
        revisions (``avg``/``average``, ``tp90``/``percentileResponseTime90``).
        This helper normalises whichever shape we get.
        """
        def pick(*keys: str) -> Any:
            for k in keys:
                if k in entry and entry[k] is not None:
                    return entry[k]
            return None

        return {
            "hits": pick("hits", "samples"),
            "failed": pick("failed", "errors", "errorsCount"),
            "errorRate": pick("errorsRate", "errorRate", "errorPct"),
            "avgResponseTime": pick("avg", "average", "avgResponseTime"),
            "minResponseTime": pick("min", "minResponseTime"),
            "maxResponseTime": pick("max", "maxResponseTime"),
            "p50": pick("tp50", "percentileResponseTime50", "median", "p50"),
            "p90": pick("tp90", "percentileResponseTime90", "p90"),
            "p95": pick("tp95", "percentileResponseTime95", "p95"),
            "p99": pick("tp99", "percentileResponseTime99", "p99"),
            "avgLatency": pick("avgLatency", "latency"),
            # Pure bandwidth rate keys only — avgBytes is per-hit, not per-second
            "avgBandwidth": pick("avgBandwidth", "bandwidth", "bytesPerSec"),
            # Total bytes transferred over the whole run (if BM exposes it)
            "totalBytes": pick("bytes", "totalBytes", "totalBandwidth"),
            # Average bytes per hit — lets the UI derive bandwidth as hits × avgBytesPerHit / duration
            "avgBytesPerHit": pick("avgBytes", "bytesPerHit"),
            "avgThroughput": pick("avgThroughput", "throughput", "hitsPerSec", "avgHits"),
            "duration": pick("duration"),
            "startTime": pick("first", "startTime", "startedAt"),
            "endTime": pick("last", "endTime", "endedAt"),
            "maxUsers": pick("maxUsers", "usersMax", "maxConcurrency"),
        }

    @staticmethod
    def _project_aggregate_row(row: dict) -> dict:
        """Normalise a per-label aggregate row."""
        def pick(*keys: str) -> Any:
            for k in keys:
                if k in row and row[k] is not None:
                    return row[k]
            return None

        def pick_percentile(p: int) -> Any:
            """Pull the p-th percentile from BM's various shapes.

            Different BM API revisions emit ``percentileResponseTime90``,
            ``tp90``, ``90line``, ``perc_90_0`` at the row level — or nest
            them under ``quantiles``/``percentiles`` as ``{"90.0": 800}``.
            """
            flat_keys = (
                f"percentileResponseTime{p}",
                f"tp{p}",
                f"p{p}",
                f"{p}line",
                f"perc_{p}_0",
            )
            for key in flat_keys:
                if key in row and row[key] is not None:
                    return row[key]
            for container_key in ("quantiles", "percentiles"):
                container = row.get(container_key)
                if isinstance(container, dict):
                    for nested_key in (str(p), f"{p}.0", float(p)):
                        if nested_key in container and container[nested_key] is not None:
                            return container[nested_key]
            return None

        return {
            "labelId": pick("labelId", "id"),
            "labelName": pick("labelName", "name", "label"),
            "samples": pick("samples", "hits"),
            "errors": pick("errors", "errorsCount"),
            "errorRate": pick("errorsRate", "errorRate"),
            "avgResponseTime": pick("avgResponseTime", "avg", "average"),
            "minResponseTime": pick("minResponseTime", "min"),
            "maxResponseTime": pick("maxResponseTime", "max"),
            "p50": pick("medianResponseTime") or pick_percentile(50),
            "p90": pick_percentile(90),
            "p95": pick_percentile(95),
            "p99": pick_percentile(99),
            "avgLatency": pick("avgLatency", "latency"),
            "avgThroughput": pick("avgThroughput", "throughput", "hitsPerSec"),
            "avgBytes": pick("avgBytes", "bytes", "avgBandwidth"),
        }

    @staticmethod
    def _project_timeline(result: dict) -> dict:
        """Normalise timeline data to a list of time-bucketed points.

        Returns `{ points: [{ t, avgResponseTime, errorRate, users, throughput }] }`
        so the frontend can render a sparkline directly.
        """
        # BM timeline is typically returned as `{ labels: [...], interval: N,
        # series: { avgResponseTime: [...], errorRate: [...], users: [...],
        # hits: [...] } }` OR as `[{ label, data }]`.  Support both.
        points: list[dict] = []

        series = result.get("series") if isinstance(result.get("series"), dict) else None
        labels = result.get("labels") if isinstance(result.get("labels"), list) else None
        interval = result.get("interval") or result.get("granularity")

        if series and labels:
            for i, t in enumerate(labels):
                points.append({
                    "t": t,
                    "avgResponseTime": _safe_index(series.get("avgResponseTime"), i),
                    "errorRate": _safe_index(series.get("errorRate"), i),
                    "users": _safe_index(series.get("users"), i),
                    "hits": _safe_index(series.get("hits"), i),
                })
        elif isinstance(result.get("metrics"), list):
            # Alternative shape: `{ metrics: [{ timestamp, values: {...} }] }`
            for entry in result["metrics"]:
                if not isinstance(entry, dict):
                    continue
                values = entry.get("values") or {}
                points.append({
                    "t": entry.get("timestamp") or entry.get("t"),
                    "avgResponseTime": values.get("avgResponseTime") or values.get("avg"),
                    "errorRate": values.get("errorRate"),
                    "users": values.get("users"),
                    "hits": values.get("hits") or values.get("throughput"),
                })

        return {"points": points, "interval": interval}

    @staticmethod
    def _project_error_row(row: dict) -> dict:
        return {
            "labelId": row.get("labelId") or row.get("id"),
            "labelName": row.get("labelName") or row.get("name") or row.get("label"),
            "errorCode": row.get("errorCode") or row.get("rc") or row.get("responseCode"),
            "count": row.get("count") or row.get("errorsCount") or row.get("errors"),
            "message": row.get("errorMessage") or row.get("message") or row.get("error"),
        }
