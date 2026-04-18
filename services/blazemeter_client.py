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
        }
