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

        The ATM search's ``folder`` clause only matches a folder exactly, so
        the subtree's folder paths are resolved first via the internal
        folder-tree endpoint and each folder is queried exactly. Scanning the
        whole project instead (10k+ test cases in TC) exceeds the production
        request timeout.
        """
        escaped_project = project_key.replace('"', '\\"')
        folder_prefix = folder.rstrip("/")
        results: list[dict[str, Any]] = []
        seen_keys: set[str] = set()
        for folder_path in self.folder_paths(self.project_id(project_key), folder_prefix):
            escaped_folder = folder_path.replace('"', '\\"')
            query = f'projectKey = "{escaped_project}" AND folder = "{escaped_folder}"'
            for row in self._search_pages(query):
                key = str(row.get("key") or "")
                if not key or key in seen_keys:
                    continue
                seen_keys.add(key)
                if self._in_folder_tree(str(row.get("folder") or ""), folder_prefix):
                    results.append(row)
        return results

    def project_id(self, project_key: str) -> int:
        """Resolve a Jira project key to its numeric id (official Jira API)."""
        data = self._get_json(f"/rest/api/2/project/{project_key}")
        return int(data["id"])

    def folder_paths(self, project_id: int, folder: str) -> list[str]:
        """The requested folder path plus every descendant folder path.

        Uses the internal folder-tree endpoint — the same unsupported API
        family as the history endpoints, so it stays isolated in this client.
        """
        target = folder.rstrip("/")
        if not target:
            return []
        tree = self._get_json(f"/rest/tests/1.0/project/{project_id}/foldertree/testcase")
        node: dict[str, Any] | None = tree if isinstance(tree, dict) else None
        found_path = ""
        for segment in [part for part in target.split("/") if part]:
            children = (node or {}).get("children") or []
            node = next(
                (child for child in children if str(child.get("name") or "") == segment),
                None,
            )
            if node is None:
                return []
            found_path = f"{found_path}/{segment}"

        paths: list[str] = []

        def collect(current: dict[str, Any], path: str) -> None:
            paths.append(path)
            for child in current.get("children") or []:
                collect(child, f"{path}/{str(child.get('name') or '')}")

        collect(node, found_path)
        return paths

    def _search_pages(self, query: str) -> list[dict[str, Any]]:
        start_at = 0
        rows: list[dict[str, Any]] = []
        seen_keys: set[str] = set()
        while True:
            params: dict[str, Any] = {
                "query": query,
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
                rows.append(row)
                new_count += 1
            if len(page) < SEARCH_PAGE_SIZE or new_count == 0:
                break
            start_at += len(page)
        return rows

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
