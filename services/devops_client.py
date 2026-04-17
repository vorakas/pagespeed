"""Azure DevOps REST API client.

Encapsulates pipeline listing, build querying, and build triggering
for the Azure DevOps Pipelines service.  Raises domain exceptions
on failure — never returns error dicts.
"""

from __future__ import annotations

import json
import logging
import re
from base64 import b64encode, b64decode
from pathlib import Path
from typing import Optional

import requests

from config import AZDO_API_VERSION, AZDO_REQUEST_TIMEOUT_SECONDS
from exceptions import AzureDevOpsError, AuthenticationError, RateLimitError

logger = logging.getLogger(__name__)

# Tests declared with ``[Theory(Skip = "...")]`` are skipped at xUnit
# discovery time, so Azure DevOps records the result without the
# ``InlineData`` config parameter — we can't derive a user-role pill
# from a test name that has no config.  This JSON, generated from the
# test-automation sources by ``scripts/scan_skipped_test_configs.py``,
# maps the test class name (e.g. ``T226_Windows_VerifyColorPlusItem``)
# to the config string it would have run under, so the pill lookup
# works for discovery-skipped tests too.
_SKIPPED_CONFIG_PATH = (
    Path(__file__).resolve().parent.parent / "data" / "skipped_test_configs.json"
)
try:
    _SKIPPED_TEST_CONFIGS: dict[str, str] = json.loads(
        _SKIPPED_CONFIG_PATH.read_text(encoding="utf-8")
    )
except (OSError, ValueError):
    logger.warning(
        "Could not load %s — discovery-skipped tests will show no role pill",
        _SKIPPED_CONFIG_PATH,
    )
    _SKIPPED_TEST_CONFIGS = {}


class AzureDevOpsClient:
    """Client for the Azure DevOps REST API (Pipelines & Builds).

    Constructed per-request with credentials from the request body,
    following the same stateless pattern as
    :class:`~services.azure_client.AzureLogAnalyticsClient`.

    Args:
        pat:          Personal Access Token with Build (read & execute) scope.
        organization: Azure DevOps organization name.
        project:      Azure DevOps project name.
    """

    def __init__(
        self,
        pat: str,
        organization: str = "LampsPlus",
        project: str = "TestAutomation",
    ) -> None:
        self._pat: str = pat
        self._organization: str = organization
        self._project: str = project
        self._base_url: str = (
            f"https://dev.azure.com/{organization}/{project}/_apis"
        )
        self._auth_header: str = "Basic " + b64encode(
            f":{pat}".encode("ascii")
        ).decode("ascii")

    # ------------------------------------------------------------------
    # Internal HTTP helper
    # ------------------------------------------------------------------

    def _request(
        self,
        method: str,
        path: str,
        body: Optional[dict] = None,
        params: Optional[dict] = None,
    ) -> dict:
        """Send an authenticated request to the Azure DevOps REST API.

        Args:
            method: HTTP method (GET, POST, etc.).
            path:   API path relative to ``_base_url``.
            body:   Optional JSON body for POST/PUT requests.
            params: Optional query parameters.

        Returns:
            Parsed JSON response dict.

        Raises:
            AzureDevOpsError: On HTTP or parse failures.
        """
        url = f"{self._base_url}/{path}"
        headers = {
            "Authorization": self._auth_header,
            "Content-Type": "application/json",
        }
        query_params = {"api-version": AZDO_API_VERSION}
        if params:
            query_params.update(params)

        try:
            response = requests.request(
                method,
                url,
                headers=headers,
                json=body,
                params=query_params,
                timeout=AZDO_REQUEST_TIMEOUT_SECONDS,
            )
            if response.status_code in (401, 203):
                raise AuthenticationError(
                    "Invalid or expired Personal Access Token.",
                    provider="Azure DevOps",
                )
            if response.status_code == 403:
                raise AzureDevOpsError(
                    "Access denied. Ensure the PAT has the required scopes "
                    "(Build: Read & Execute)."
                )
            if response.status_code == 429:
                retry_after = int(
                    response.headers.get("Retry-After", "30")
                )
                logger.warning(
                    "Azure DevOps rate limit hit (429). "
                    "Retry-After: %d seconds.",
                    retry_after,
                )
                raise RateLimitError(
                    "Azure DevOps rate limit exceeded. "
                    f"Retry after {retry_after} seconds.",
                    provider="Azure DevOps",
                    retry_after=retry_after,
                )
            response.raise_for_status()
            return response.json()
        except (AuthenticationError, AzureDevOpsError, RateLimitError):
            raise
        except requests.exceptions.Timeout:
            raise AzureDevOpsError("Request to Azure DevOps timed out.")
        except requests.exceptions.RequestException as exc:
            # Surface AzDO's error body — their 400 payload has the
            # specific reason (unknown parameter, bad branch, etc.)
            # that the HTTPError stringification discards. For queue
            # validation failures, the useful detail lives in
            # customProperties.ValidationResults, not in `message`.
            detail = ""
            if exc.response is not None:
                try:
                    body = exc.response.json()
                    parts = []
                    message = body.get("message")
                    if message:
                        parts.append(str(message))
                    validation = (body.get("customProperties") or {}).get(
                        "ValidationResults"
                    )
                    if validation:
                        for item in validation:
                            vmsg = item.get("message") if isinstance(item, dict) else None
                            if vmsg:
                                parts.append(vmsg)
                    detail = f" — {'; '.join(parts) if parts else body}"
                except ValueError:
                    detail = f" — {exc.response.text[:500]}"
            raise AzureDevOpsError(
                f"Error calling Azure DevOps: {exc}{detail}"
            ) from exc
        except json.JSONDecodeError as exc:
            raise AzureDevOpsError(
                "Invalid JSON response from Azure DevOps."
            ) from exc

    # ------------------------------------------------------------------
    # Connection test
    # ------------------------------------------------------------------

    def test_connection(self) -> dict:
        """Validate the PAT by fetching the project metadata.

        Uses the organization-level projects endpoint (not project-scoped).

        Returns:
            Dict with ``success`` (bool) and ``message`` (str).
        """
        try:
            url = f"https://dev.azure.com/{self._organization}/_apis/projects/{self._project}"
            headers = {
                "Authorization": self._auth_header,
                "Content-Type": "application/json",
            }
            response = requests.get(
                url,
                headers=headers,
                params={"api-version": AZDO_API_VERSION},
                timeout=AZDO_REQUEST_TIMEOUT_SECONDS,
            )
            if response.status_code in (401, 203):
                return {
                    "success": False,
                    "message": "Invalid or expired Personal Access Token.",
                }
            if response.status_code == 403:
                return {
                    "success": False,
                    "message": "Access denied. Ensure the PAT has the required scopes.",
                }
            response.raise_for_status()
            project = response.json()
            return {
                "success": True,
                "message": (
                    f"Connected to {self._organization}/{project.get('name', self._project)}."
                ),
            }
        except (AzureDevOpsError, AuthenticationError) as exc:
            return {"success": False, "message": str(exc)}

    # ------------------------------------------------------------------
    # Pipeline definitions
    # ------------------------------------------------------------------

    def list_pipelines(self) -> list[dict]:
        """Return all pipeline definitions in the project.

        Returns:
            List of compact dicts with ``id``, ``name``, and ``folder``.
        """
        data = self._request("GET", "pipelines", params={"$top": "200"})
        return [
            {
                "id": p["id"],
                "name": p.get("name", ""),
                "folder": p.get("folder", "\\"),
            }
            for p in data.get("value", [])
        ]

    # ------------------------------------------------------------------
    # Builds
    # ------------------------------------------------------------------

    def _normalize_build(self, build: dict) -> dict:
        """Extract the fields we care about from a raw build object."""
        definition = build.get("definition", {})
        requested_by = build.get("requestedBy", {})
        links = build.get("_links", {})
        web_link = links.get("web", {}).get("href", "")
        return {
            "id": build.get("id"),
            "buildNumber": build.get("buildNumber", ""),
            "status": build.get("status", "none"),
            "result": build.get("result"),
            "definitionId": definition.get("id"),
            "definitionName": definition.get("name", ""),
            "sourceBranch": build.get("sourceBranch", ""),
            "startTime": build.get("startTime"),
            "finishTime": build.get("finishTime"),
            "requestedBy": requested_by.get("displayName", ""),
            "webUrl": web_link,
        }

    def list_builds(
        self,
        definition_ids: Optional[list[int]] = None,
        top: int = 20,
    ) -> list[dict]:
        """Return recent builds, optionally filtered by definition IDs.

        Args:
            definition_ids: Optional list of pipeline definition IDs.
            top:            Maximum number of builds to return.

        Returns:
            List of normalized build dicts sorted by start time descending.
        """
        params: dict = {
            "$top": str(top),
            "queryOrder": "startTimeDescending",
        }
        if definition_ids:
            params["definitions"] = ",".join(str(d) for d in definition_ids)

        data = self._request("GET", "build/builds", params=params)
        return [self._normalize_build(b) for b in data.get("value", [])]

    def get_build(self, build_id: int) -> dict:
        """Return a single build by ID.

        Args:
            build_id: The Azure DevOps build ID.

        Returns:
            Normalized build dict.
        """
        data = self._request("GET", f"build/builds/{build_id}")
        return self._normalize_build(data)

    # ------------------------------------------------------------------
    # Failed test results
    # ------------------------------------------------------------------

    _ZEPHYR_BASE_URL = "https://lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/LP-"

    def _fetch_test_runs(self, build_id: int) -> tuple[dict, list[dict]]:
        """Fetch the build object and its associated test runs.

        Returns:
            Tuple of (build dict, list of test run dicts).
        """
        build = self._request("GET", f"build/builds/{build_id}")
        build_uri = build.get("uri", "")
        url = (
            f"https://dev.azure.com/{self._organization}/{self._project}"
            f"/_apis/test/runs"
        )
        headers = {
            "Authorization": self._auth_header,
            "Content-Type": "application/json",
        }
        response = requests.get(
            url,
            headers=headers,
            params={"buildUri": build_uri, "api-version": AZDO_API_VERSION},
            timeout=AZDO_REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return build, response.json().get("value", [])

    def _fetch_run_results(
        self, run_id: int, outcomes: str | None = None
    ) -> list[dict]:
        """Fetch test results for a single test run.

        Args:
            run_id:   Azure DevOps test run ID.
            outcomes: Optional comma-separated outcomes filter (e.g. "Failed").

        Returns:
            List of test result dicts.
        """
        url = (
            f"https://dev.azure.com/{self._organization}/{self._project}"
            f"/_apis/test/runs/{run_id}/results"
        )
        headers = {
            "Authorization": self._auth_header,
            "Content-Type": "application/json",
        }
        params: dict = {"api-version": "7.1-preview.3", "$top": "500"}
        if outcomes:
            params["outcomes"] = outcomes
        response = requests.get(
            url, headers=headers, params=params,
            timeout=AZDO_REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json().get("value", [])

    # ------------------------------------------------------------------
    # xUnit skip-reason recovery via build log parse
    # ------------------------------------------------------------------
    #
    # AzDO's TRX ingestion drops the <ErrorInfo><Message> for NotExecuted
    # results, so the test-results API never returns a skip reason (the
    # detail endpoint has no message field at all).  The xUnit runner
    # does print the reason to the VSTest task's stdout as two adjacent
    # lines:
    #     [xUnit.net HH:MM:SS.ss]     <FQN> [SKIP]
    #     [xUnit.net HH:MM:SS.ss]       <reason>
    # so we fetch the build log and pair them.

    # Matches the `... <FQN> [SKIP]` header line.
    # FQN is non-greedy because it may contain whitespace (theory
    # parameters like `Method(config: "X")`); trailing `[SKIP]` anchors.
    _SKIP_HEADER_RE = re.compile(
        r"\[xUnit\.net\s+[\d:.]+\]\s+(.+?)\s+\[SKIP\]\s*$"
    )
    # Captures everything after the `[xUnit.net HH:MM:SS.ss]` prefix,
    # wherever in the line it appears (AzDO prepends an ISO timestamp).
    _XUNIT_MESSAGE_RE = re.compile(r"\[xUnit\.net\s+[\d:.]+\]\s+(.*)")

    def _fetch_build_timeline(self, build_id: int) -> dict:
        """Return the build timeline (lists all tasks with their log IDs)."""
        url = (
            f"https://dev.azure.com/{self._organization}/{self._project}"
            f"/_apis/build/builds/{build_id}/timeline"
        )
        headers = {"Authorization": self._auth_header}
        response = requests.get(
            url, headers=headers,
            params={"api-version": AZDO_API_VERSION},
            timeout=AZDO_REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json()

    def _fetch_build_log(self, build_id: int, log_id: int) -> str:
        """Fetch a single build-task log as plain text."""
        url = (
            f"https://dev.azure.com/{self._organization}/{self._project}"
            f"/_apis/build/builds/{build_id}/logs/{log_id}"
        )
        headers = {"Authorization": self._auth_header}
        # Logs can be tens of MB; allow a longer timeout than the default.
        response = requests.get(
            url, headers=headers,
            params={"api-version": AZDO_API_VERSION},
            timeout=60,
        )
        response.raise_for_status()
        return response.text

    def _fetch_skip_reasons_from_logs(
        self, build_id: int
    ) -> dict[str, str]:
        """Return ``{automatedTestName → skip_reason}`` from VSTest logs.

        Scans every task log whose name hints at xUnit/VSTest execution.
        Non-test logs are cheap to skim since the ``[SKIP]`` regex fails
        fast on non-matching lines.
        """
        try:
            timeline = self._fetch_build_timeline(build_id)
        except requests.exceptions.RequestException as exc:
            logger.warning("Timeline fetch failed: %s", exc)
            return {}

        candidate_log_ids: list[int] = []
        all_task_names: list[tuple[str, int | None]] = []
        for record in timeline.get("records", []):
            if record.get("type") != "Task":
                continue
            display_name = record.get("name") or ""
            name = display_name.lower()
            log_info = record.get("log") or {}
            log_id = log_info.get("id") if isinstance(log_info, dict) else None
            all_task_names.append(
                (display_name, log_id if isinstance(log_id, int) else None)
            )
            if not any(k in name for k in ("vstest", "xunit", "ui tests")):
                continue
            if isinstance(log_id, int):
                candidate_log_ids.append(log_id)
        logger.info(
            "Timeline tasks for build %s: %s",
            build_id,
            [n for n, _ in all_task_names],
        )

        if not candidate_log_ids:
            logger.info("No VSTest task logs found for build %s", build_id)
            return {}

        reasons: dict[str, str] = {}
        for log_id in candidate_log_ids:
            try:
                text = self._fetch_build_log(build_id, log_id)
            except requests.exceptions.RequestException as exc:
                logger.warning(
                    "Log fetch failed (build=%s log=%s): %s",
                    build_id, log_id, exc,
                )
                continue
            lines = text.splitlines()
            for i, line in enumerate(lines):
                match = self._SKIP_HEADER_RE.search(line)
                if not match or i + 1 >= len(lines):
                    continue
                fqn = match.group(1)
                reason_line = lines[i + 1]
                reason_match = self._XUNIT_MESSAGE_RE.search(reason_line)
                reason = (
                    reason_match.group(1).strip()
                    if reason_match
                    else reason_line.strip()
                )
                if not reason:
                    continue
                reasons[fqn] = reason
                # Also index by the parameterless name so AzDO's
                # non-parameterized NotExecuted rows (static
                # `[Theory(Skip=...)]`) still match even when xUnit
                # printed the SKIP with parameters.
                bare = fqn.split("(", 1)[0]
                reasons.setdefault(bare, reason)

        logger.info(
            "Parsed %d skip reasons from %d log(s) for build %s",
            len(reasons), len(candidate_log_ids), build_id,
        )
        return reasons

    @staticmethod
    def _extract_test_id(automated_test_name: str) -> str | None:
        """Extract the T-number (e.g. 'T7024') from a test name.

        For iPhone/Android tests whose implementation class is nested
        inside a shared parent class, the FQN carries two T-numbers —
        e.g. ``...T8115_T8117_VerifyX.T8117_iPhone_VerifyX.Method(...)``
        — and only the mobile-specific one (``T8117``) is correct.  The
        test-class segment (second-to-last dot segment) always carries
        exactly that correct ID, so take the last T-number from there.
        For unnested tests the class name has a single T-number and the
        behaviour is unchanged.
        """
        import re
        parts = automated_test_name.split(".")
        class_segment = parts[-2] if len(parts) >= 2 else automated_test_name
        matches = re.findall(r"T(\d+)", class_segment)
        if matches:
            return f"T{matches[-1]}"
        # Fallback: scan the whole FQN if the class segment has no T-number.
        match = re.search(r"T(\d+)", automated_test_name)
        return f"T{match.group(1)}" if match else None

    @staticmethod
    def _extract_config(automated_test_name: str) -> str:
        """Extract the config string from a test name's parameters."""
        import re
        match = re.search(r'config:\s*"([^"]+)"', automated_test_name)
        return match.group(1) if match else ""

    @staticmethod
    def _extract_short_name(automated_test_name: str) -> str:
        """Extract a readable test name from the fully qualified name."""
        parts = automated_test_name.split(".")
        # Find the part that starts with T####_ for the class name
        for part in reversed(parts):
            if "(" in part:
                # This is the method name with params — strip params
                return part.split("(")[0]
        return parts[-1] if parts else automated_test_name

    # Prefixes that mark the start of the test action within a class
    # name, so anything between platform and the first such token is
    # the role.  Stored as prefixes (not full words) to match both
    # verb forms ("Verify", "Validate") and the noun forms teams
    # sometimes use ("Verification", "Validation").
    _ACTION_VERB_PREFIXES = (
        "Verif", "Validat", "Test", "Check", "Confirm", "Assert",
        "Ensure",
    )

    # User-role tokens encoded in the Theory `config:"..."` parameter.
    # Ordered most-specific first: SNIS_ESI_CIC must be checked before
    # SNIS_ESI so the longer, more specific match wins.
    _CONFIG_ROLE_PATTERNS: tuple[tuple[str, str], ...] = (
        ("SNIS_ESI_CIC", "Employee Signed In Company In Cart"),
        ("SNIS_UNSI", "Anonymous User"),
        ("SNIS_NPCSI", "Customer Signed In"),
        ("SNIS_PCSI", "Professional"),
        ("SNIS_ESI", "Employee Signed In"),
        ("SIS_UNSI", "Kiosk"),
        ("SIS_ESI", "Store In Session Employee Signed In"),
    )

    @classmethod
    def _extract_role_from_config(cls, config: str) -> str:
        """Map a config string to a human-readable user role.

        Returns an empty string when no known role token is present.
        Longer patterns are checked first so a config containing
        ``SNIS_ESI_CIC`` does not match the shorter ``SNIS_ESI`` rule.
        """
        if not config:
            return ""
        for pattern, role in cls._CONFIG_ROLE_PATTERNS:
            if pattern in config:
                return role
        return ""

    @classmethod
    def _extract_user_role(cls, automated_test_name: str) -> str:
        """Return the user-role segment of the nested class name, e.g. "Kiosk".

        Test class names follow the pattern
        ``T####_{Platform}_{Role?}_{Verb...}`` — when no role tokens are
        present, the test runs under the default (anonymous) user and
        an empty string is returned.
        """
        parts = automated_test_name.split(".")
        if len(parts) < 2:
            return ""
        bare_class = parts[-2].split("(", 1)[0]
        tokens = bare_class.split("_")
        if len(tokens) < 3:
            return ""
        role_tokens: list[str] = []
        # Skip tokens[0] (T-number) and tokens[1] (platform).
        for token in tokens[2:]:
            if any(
                token.startswith(prefix)
                for prefix in cls._ACTION_VERB_PREFIXES
            ):
                break
            role_tokens.append(token)
        return " ".join(role_tokens)

    def get_failed_tests(self, build_id: int) -> list[dict]:
        """Return failed test details for a build, accounting for re-runs.

        Tests that failed in the original run but passed in the re-run
        are excluded (they are effectively passed).

        Args:
            build_id: The Azure DevOps build ID.

        Returns:
            List of dicts with test failure details, sorted by test ID.
        """
        try:
            build, runs = self._fetch_test_runs(build_id)
        except requests.exceptions.RequestException as exc:
            raise AzureDevOpsError(
                f"Failed to fetch test runs: {exc}"
            ) from exc

        # Azure DevOps assigns all test runs the same auto-generated name,
        # so we identify runs by structure, not by name:
        #   - PromoCode setup/cleanup runs have exactly 1 test → skip
        #   - The original test run has the most tests
        #   - The re-run (if any) has fewer tests and a higher run ID
        #
        # We also check for "ReRun" in the name as a fallback in case
        # the runTitle from the pipeline YAML is preserved.

        # Filter out promo code runs (1 test) and sort by ID
        test_runs = [
            r for r in runs if (r.get("totalTests") or 0) > 1
        ]
        test_runs.sort(key=lambda r: r.get("id", 0))

        logger.info(
            "Filtered test runs (totalTests>1): %s",
            [(r.get("id"), r.get("totalTests")) for r in test_runs],
        )

        # Separate original (first/largest) and re-run (subsequent)
        original_runs: list[dict] = []
        rerun_runs: list[dict] = []
        if len(test_runs) == 1:
            original_runs = test_runs
        elif len(test_runs) >= 2:
            # First run is original, rest are re-runs
            original_runs = [test_runs[0]]
            rerun_runs = test_runs[1:]
        # Also check by name for explicit "ReRun" in case of 1 run
        for r in original_runs[:]:
            name = r.get("name", "")
            if "ReRun" in name or "Rerun" in name or "rerun" in name:
                original_runs.remove(r)
                rerun_runs.append(r)

        # Collect passed test keys from re-runs (these override original failures).
        # Key uses the parameterless FQN (class+method), not just test_id —
        # two tests may share a T-number but differ by user role encoded in
        # the class name (e.g. `T8030_Windows_...` vs `T8030_Windows_Kiosk_...`).
        rerun_passed_keys: set[str] = set()
        rerun_all_keys: set[str] = set()
        for run in rerun_runs:
            try:
                results = self._fetch_run_results(run["id"])
                for r in results:
                    name = r.get("automatedTestName", "")
                    test_id = self._extract_test_id(name)
                    config = self._extract_config(name)
                    if not test_id:
                        continue
                    bare_fqn = name.split("(", 1)[0]
                    key = f"{bare_fqn}|{config}"
                    rerun_all_keys.add(key)
                    if r.get("outcome") == "Passed":
                        rerun_passed_keys.add(key)
            except requests.exceptions.RequestException:
                continue

        logger.info("Re-run passed keys: %s", rerun_passed_keys)
        logger.info("Re-run all keys: %s", rerun_all_keys)

        # Collect failed tests — prefer re-run results over originals
        failed_tests: list[dict] = []
        seen_keys: set[str] = set()

        # Process re-run failures first (most recent/authoritative)
        for run in rerun_runs:
            run_id = run["id"]
            try:
                results = self._fetch_run_results(run_id)
            except requests.exceptions.RequestException:
                continue
            for r in results:
                if r.get("outcome") != "Failed":
                    continue
                name = r.get("automatedTestName", "")
                test_id = self._extract_test_id(name)
                config = self._extract_config(name)
                bare_fqn = name.split("(", 1)[0]
                key = f"{bare_fqn}|{config}"
                if not test_id or key in seen_keys:
                    continue
                seen_keys.add(key)
                result_id = r.get("id", 0)
                screenshot_id = self._find_screenshot_id(run_id, result_id)
                failed_tests.append({
                    "testId": test_id,
                    "testName": self._extract_short_name(name),
                    "config": config,
                    "errorMessage": r.get("errorMessage", ""),
                    "stackTrace": r.get("stackTrace", ""),
                    "zephyrUrl": f"{self._ZEPHYR_BASE_URL}{test_id}",
                    "isRerun": True,
                    "runId": run_id,
                    "resultId": result_id,
                    "screenshotId": screenshot_id,
                })

        # Then process original failures, skipping any that were re-run
        for run in original_runs:
            run_id = run["id"]
            try:
                results = self._fetch_run_results(run_id)
            except requests.exceptions.RequestException:
                continue
            for r in results:
                if r.get("outcome") != "Failed":
                    continue
                name = r.get("automatedTestName", "")
                test_id = self._extract_test_id(name)
                config = self._extract_config(name)
                bare_fqn = name.split("(", 1)[0]
                key = f"{bare_fqn}|{config}"
                if not test_id or key in seen_keys:
                    continue
                # Skip if this test+config was re-run (passed or already counted)
                if key in rerun_all_keys:
                    continue
                seen_keys.add(key)
                result_id = r.get("id", 0)
                screenshot_id = self._find_screenshot_id(run_id, result_id)
                failed_tests.append({
                    "testId": test_id,
                    "testName": self._extract_short_name(name),
                    "config": config,
                    "errorMessage": r.get("errorMessage", ""),
                    "stackTrace": r.get("stackTrace", ""),
                    "zephyrUrl": f"{self._ZEPHYR_BASE_URL}{test_id}",
                    "isRerun": False,
                    "runId": run_id,
                    "resultId": result_id,
                    "screenshotId": screenshot_id,
                })

        failed_tests.sort(key=lambda t: t["testId"])
        return failed_tests

    def get_skipped_tests(self, build_id: int) -> list[dict]:
        """Return tests with 'NotExecuted' outcome (skipped) for a build.

        Uses the ``NotExecuted`` outcome filter which matches tests
        explicitly skipped by the xUnit framework (``[Fact(Skip=...)]``),
        as opposed to the broader ``Others`` filter which includes all
        non-Passed/non-Failed results.

        Only looks at the original test run — re-runs don't contain
        skipped tests.

        Args:
            build_id: The Azure DevOps build ID.

        Returns:
            List of dicts with skipped test details, sorted by test ID.
        """
        try:
            build, runs = self._fetch_test_runs(build_id)
        except requests.exceptions.RequestException as exc:
            raise AzureDevOpsError(
                f"Failed to fetch test runs: {exc}"
            ) from exc

        # Filter out promo code runs (1 test) and sort by ID
        test_runs = [
            r for r in runs if (r.get("totalTests") or 0) > 1
        ]
        test_runs.sort(key=lambda r: r.get("id", 0))

        # Original run is the first (largest) run
        original_runs: list[dict] = []
        if len(test_runs) >= 1:
            original_runs = [test_runs[0]]
        # Move explicitly named re-runs out
        for r in original_runs[:]:
            name = r.get("name", "")
            if "ReRun" in name or "Rerun" in name or "rerun" in name:
                original_runs.remove(r)

        skipped_tests: list[dict] = []
        seen_keys: set[str] = set()
        # FQN → indexes into skipped_tests for rows with blank reasons,
        # so we can fill them in after parsing the build log.
        indexes_by_fqn: dict[str, list[int]] = {}

        for run in original_runs:
            try:
                results = self._fetch_run_results(run["id"])
            except requests.exceptions.RequestException:
                continue
            for r in results:
                # Only include tests explicitly marked as NotExecuted
                # (xUnit [Fact(Skip="reason")]).  The broader "Others"
                # outcome filter includes NotApplicable, Blocked, etc.
                if r.get("outcome") != "NotExecuted":
                    continue
                name = r.get("automatedTestName", "")
                test_id = self._extract_test_id(name)
                config = self._extract_config(name)
                # Discovery-skipped `[Theory(Skip=...)]` tests arrive
                # without a config parameter in the name — fall back to
                # the static mapping keyed by the test class name.
                if not config:
                    bare_parts = name.split("(", 1)[0].split(".")
                    class_name = bare_parts[-2] if len(bare_parts) >= 2 else ""
                    config = _SKIPPED_TEST_CONFIGS.get(class_name, "")
                # Dedup key uses the parameterless FQN (class+method),
                # not just test_id — two tests may share a T-number but
                # differ by user role encoded in the class name
                # (e.g. `T8030_Windows_...` vs `T8030_Windows_Kiosk_...`).
                bare_fqn = name.split("(", 1)[0]
                key = f"{bare_fqn}|{config}"
                if not test_id or key in seen_keys:
                    continue
                seen_keys.add(key)
                error_message = r.get("errorMessage", "") or ""
                user_role = (
                    self._extract_role_from_config(config)
                    or self._extract_user_role(name)
                )
                skipped_tests.append({
                    "testId": test_id,
                    "testName": self._extract_short_name(name),
                    "config": config,
                    "userRole": user_role,
                    "errorMessage": error_message,
                    "zephyrUrl": f"{self._ZEPHYR_BASE_URL}{test_id}",
                })
                if not error_message and name:
                    indexes_by_fqn.setdefault(name, []).append(
                        len(skipped_tests) - 1
                    )

        # AzDO's TRX ingestion strips skip reasons, so recover them by
        # parsing the xUnit `[SKIP]` pairs out of the VSTest task log.
        if indexes_by_fqn:
            reason_map = self._fetch_skip_reasons_from_logs(build_id)
            matched = 0
            unmatched_azdo: list[str] = []
            for fqn, indexes in indexes_by_fqn.items():
                reason = reason_map.get(fqn)
                if not reason:
                    # xUnit prints the parameterless FQN; AzDO may
                    # append "(param: value)" for theory cases.
                    reason = reason_map.get(fqn.split("(", 1)[0])
                if reason:
                    matched += 1
                    for idx in indexes:
                        skipped_tests[idx]["errorMessage"] = reason
                else:
                    unmatched_azdo.append(fqn)
            unmatched_log = [
                fqn for fqn in reason_map
                if fqn not in indexes_by_fqn
                and all(
                    fqn != k.split("(", 1)[0] for k in indexes_by_fqn
                )
            ]
            logger.info(
                "Skip reasons matched %d / %d blank skips",
                matched, len(indexes_by_fqn),
            )
            if unmatched_azdo:
                logger.info(
                    "Unmatched AzDO skips (no log reason): %s",
                    unmatched_azdo,
                )
            if unmatched_log:
                logger.info(
                    "Unmatched log reasons (no AzDO skip): %s",
                    unmatched_log,
                )

        skipped_tests.sort(key=lambda t: t["testId"])
        return skipped_tests

    # ------------------------------------------------------------------
    # Effective build status (accounts for re-run results)
    # ------------------------------------------------------------------

    def get_effective_status(self, build_id: int) -> dict:
        """Determine the effective build result by inspecting test re-runs.

        Azure DevOps marks a build as failed if the *original* test run
        had failures, even when a subsequent re-run passes everything.
        This method checks whether a re-run exists and, if so, whether
        all re-run tests passed.

        Args:
            build_id: The Azure DevOps build ID.

        Returns:
            Dict with ``effectiveResult`` ("succeeded", "failed", etc.)
            and ``hasRerun`` (bool).
        """
        build = self._request("GET", f"build/builds/{build_id}")
        raw_result = build.get("result")
        raw_status = build.get("status")

        if raw_status != "completed" or raw_result == "succeeded":
            return {"effectiveResult": raw_result, "hasRerun": False}

        try:
            _, runs = self._fetch_test_runs(build_id)
        except requests.exceptions.RequestException:
            return {"effectiveResult": raw_result, "hasRerun": False}

        rerun_run = next(
            (r for r in runs if "ReRun_" in r.get("name", "")),
            None,
        )
        if not rerun_run:
            return {"effectiveResult": raw_result, "hasRerun": False}

        try:
            test_results = self._fetch_run_results(rerun_run["id"])
        except requests.exceptions.RequestException:
            return {"effectiveResult": raw_result, "hasRerun": True}

        if not test_results:
            return {"effectiveResult": raw_result, "hasRerun": True}

        all_passed = all(
            r.get("outcome") == "Passed" for r in test_results
        )
        return {
            "effectiveResult": "succeeded" if all_passed else raw_result,
            "hasRerun": True,
        }

    # ------------------------------------------------------------------
    # Test result attachments (screenshots)
    # ------------------------------------------------------------------

    # Azure DevOps test attachments require a preview API version,
    # matching the version used by the CI pipeline YAML.
    _ATTACHMENT_API_VERSION = "7.2-preview.1"

    def _fetch_result_attachments(
        self, run_id: int, result_id: int
    ) -> list[dict]:
        """Fetch attachments for a single test result.

        Args:
            run_id:    Azure DevOps test run ID.
            result_id: Azure DevOps test result ID within the run.

        Returns:
            List of attachment dicts with ``id``, ``fileName``, and ``url``.
        """
        url = (
            f"https://dev.azure.com/{self._organization}/{self._project}"
            f"/_apis/test/runs/{run_id}/results/{result_id}/attachments"
        )
        headers = {
            "Authorization": self._auth_header,
            "Content-Type": "application/json",
        }
        response = requests.get(
            url,
            headers=headers,
            params={"api-version": self._ATTACHMENT_API_VERSION},
            timeout=AZDO_REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.json().get("value", [])

    def get_attachment_content(
        self, run_id: int, result_id: int, attachment_id: int
    ) -> bytes:
        """Download the raw bytes of a test result attachment.

        Args:
            run_id:        Azure DevOps test run ID.
            result_id:     Test result ID within the run.
            attachment_id: Attachment ID.

        Returns:
            Raw bytes of the attachment content.
        """
        url = (
            f"https://dev.azure.com/{self._organization}/{self._project}"
            f"/_apis/test/runs/{run_id}/results/{result_id}"
            f"/attachments/{attachment_id}"
        )
        headers = {
            "Authorization": self._auth_header,
        }
        response = requests.get(
            url,
            headers=headers,
            params={"api-version": self._ATTACHMENT_API_VERSION},
            timeout=AZDO_REQUEST_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        return response.content

    @staticmethod
    def _find_screenshot_attachment(
        attachments: list[dict],
    ) -> dict | None:
        """Find the first image attachment from a list of attachments."""
        image_extensions = (".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp")
        for att in attachments:
            filename = att.get("fileName", "").lower()
            if any(filename.endswith(ext) for ext in image_extensions):
                return att
        return None

    def _find_screenshot_id(
        self, run_id: int, result_id: int
    ) -> int | None:
        """Fetch attachments for a result and return the screenshot ID if found."""
        try:
            attachments = self._fetch_result_attachments(run_id, result_id)
            logger.info(
                "Attachments for run=%s result=%s: %s",
                run_id, result_id,
                [(a.get("id"), a.get("fileName")) for a in attachments],
            )
            screenshot = self._find_screenshot_attachment(attachments)
            if screenshot:
                logger.info(
                    "Screenshot found: id=%s fileName=%s",
                    screenshot.get("id"), screenshot.get("fileName"),
                )
            return screenshot.get("id") if screenshot else None
        except Exception as exc:
            logger.warning(
                "Failed to fetch attachments for run=%s result=%s: %s",
                run_id, result_id, exc,
            )
            return None

    # ------------------------------------------------------------------
    # Branches
    # ------------------------------------------------------------------

    def list_branches(self) -> list[str]:
        """Return branch names from the project's Git repositories.

        Queries all repos in the project and collects branch names,
        stripping the ``refs/heads/`` prefix.

        Returns:
            Sorted list of branch name strings.
        """
        repos_data = self._request("GET", "git/repositories")
        repos = repos_data.get("value", [])
        if not repos:
            return []

        # Collect branches from all repos (typically just one)
        branch_names: set[str] = set()
        for repo in repos:
            repo_id = repo.get("id")
            if not repo_id:
                continue
            refs_data = self._request(
                "GET",
                f"git/repositories/{repo_id}/refs",
                params={"filter": "heads/"},
            )
            for ref in refs_data.get("value", []):
                name = ref.get("name", "")
                if name.startswith("refs/heads/"):
                    branch_names.add(name.removeprefix("refs/heads/"))

        return sorted(branch_names)

    # ------------------------------------------------------------------
    # Triggering
    # ------------------------------------------------------------------

    def trigger_pipeline(
        self,
        definition_id: int,
        source_branch: str = "refs/heads/master",
        template_parameters: Optional[dict] = None,
        variables: Optional[dict] = None,
    ) -> dict:
        """Queue a new build for the given pipeline definition.

        Args:
            definition_id:       Pipeline definition ID.
            source_branch:       Git ref to build (default: master).
            template_parameters: Optional dict of template parameter
                                 overrides. Each key must be declared
                                 in the pipeline's top-level
                                 ``parameters:`` block, or AzDO rejects
                                 the queue with "Unexpected parameter".
            variables:           Optional dict of queue-time variable
                                 overrides (maps name -> string value).
                                 Each must be marked "Settable at queue
                                 time" in the pipeline/variable group
                                 settings for the override to apply.

        Returns:
            Normalized build dict for the queued build.
        """
        body: dict = {
            "definition": {"id": definition_id},
            "sourceBranch": source_branch,
        }
        if template_parameters:
            body["templateParameters"] = template_parameters
        if variables:
            body["variables"] = {
                name: {"value": str(value)} for name, value in variables.items()
            }
        data = self._request("POST", "build/builds", body=body)
        return self._normalize_build(data)

    def cancel_build(self, build_id: int) -> dict:
        """Request cancellation of an in-flight build.

        Azure DevOps has no dedicated cancel endpoint; cancellation is
        a ``PATCH`` on the build with ``status = "cancelling"``.  The
        server transitions the build through ``cancelling`` and then
        ``completed`` with ``result = "canceled"`` asynchronously.

        Args:
            build_id: The Azure DevOps build ID.

        Returns:
            Normalized build dict reflecting the post-PATCH state
            (typically ``status = "cancelling"``).
        """
        data = self._request(
            "PATCH",
            f"build/builds/{build_id}",
            body={"status": "cancelling"},
        )
        return self._normalize_build(data)

    def trigger_orchestrator(
        self,
        definition_id: int,
        template_parameters: dict,
        source_branch: str = "refs/heads/master",
    ) -> dict:
        """Queue the orchestrator pipeline with template parameters.

        Args:
            definition_id:      Orchestrator pipeline definition ID.
            template_parameters: Dict of parameter names to values
                                 (e.g. ``{"runWarmUp": "true"}``).
            source_branch:      Git ref to build.

        Returns:
            Normalized build dict for the queued orchestrator build.
        """
        body = {
            "definition": {"id": definition_id},
            "sourceBranch": source_branch,
            "templateParameters": template_parameters,
        }
        data = self._request("POST", "build/builds", body=body)
        return self._normalize_build(data)
