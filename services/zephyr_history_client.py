"""HTTP client for the Zephyr Scale APIs used by the history import.

Every call to the undocumented internal ``/rest/tests/1.0`` API lives in
this file so a Zephyr Scale upgrade that changes that API breaks exactly
one module. The official ``/rest/atm/1.0`` search is also kept here so the
import service never talks HTTP directly.
"""

from __future__ import annotations

from typing import Any

import requests

SEARCH_PAGE_SIZE = 100
REQUEST_TIMEOUT_SECONDS = 60


class ZephyrHistoryClient:
    """Fetch test case lists, version ids, and change history from Zephyr."""

    def __init__(
        self,
        jira_pat: str,
        jira_base_url: str = "https://lampstrack.lampsplus.com",
    ) -> None:
        self.jira_pat = jira_pat
        self.jira_base_url = jira_base_url.rstrip("/")

    def search_test_cases(self, project_key: str, folder: str) -> list[dict[str, Any]]:
        """List test cases in a project folder tree via the official ATM API.

        The ATM search's ``folder`` clause only matches a folder exactly and
        ``projectId`` is not a recognized query field, so the query filters by
        project key and the folder subtree is matched client-side.
        """
        escaped_project = project_key.replace('"', '\\"')
        folder_prefix = folder.rstrip("/")
        start_at = 0
        results: list[dict[str, Any]] = []
        seen_keys: set[str] = set()
        while True:
            params: dict[str, Any] = {
                "query": f'projectKey = "{escaped_project}"',
                "fields": "key,name,folder",
                "maxResults": SEARCH_PAGE_SIZE,
            }
            if start_at:
                params["startAt"] = start_at
            data = self._get_json("/rest/atm/1.0/testcase/search", params)
            page = data if isinstance(data, list) else data.get("results") or data.get("values") or []
            new_count = 0
            for row in page:
                key = str(row.get("key") or "")
                if not key or key in seen_keys:
                    continue
                seen_keys.add(key)
                new_count += 1
                if self._in_folder_tree(str(row.get("folder") or ""), folder_prefix):
                    results.append(row)
            if len(page) < SEARCH_PAGE_SIZE or new_count == 0:
                break
            start_at += len(page)
        return results

    @staticmethod
    def _in_folder_tree(folder: str, folder_prefix: str) -> bool:
        return folder == folder_prefix or folder.startswith(folder_prefix + "/")

    def version_ids(self, test_case_key: str) -> list[int]:
        """Resolve a test case key to the numeric ids of all its versions."""
        data = self._get_json(
            f"/rest/tests/1.0/testcase/{test_case_key}/allVersions",
            {"fields": "id"},
        )
        version_ids: list[int] = []
        for row in data or []:
            try:
                version_ids.append(int(row.get("id")))
            except (TypeError, ValueError):
                continue
        return version_ids

    def fetch_history(self, numeric_id: int) -> list[dict[str, Any]]:
        """Fetch the change history entries for one test case version id."""
        data = self._get_json(f"/rest/tests/1.0/testcase/{numeric_id}/history")
        return data if isinstance(data, list) else []

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.jira_pat}", "Accept": "application/json"}

    def _get_json(self, path: str, params: dict[str, Any] | None = None) -> Any:
        response = requests.get(
            f"{self.jira_base_url}{path}",
            params=params,
            headers=self._headers(),
            timeout=REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()
