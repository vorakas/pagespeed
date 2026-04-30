"""Standalone Applitools batch fetcher + Pharos uploader.

Why this exists
---------------
Pharos runs on Railway, whose egress is blocked from the corporate
Applitools server. Without that path, the dashboard can't pull failed
visual-test rows for the regression spreadsheet. This helper sidesteps
the firewall by running on a QA laptop — which *is* allowed to talk to
Applitools — and uploading the rows back to Pharos via plain outbound
HTTPS (which every corporate machine already does for normal browsing).

What it does
------------
1. Reads the Applitools API key + Pharos upload token from a tiny
   ``config.ini`` next to the executable. First run prompts for both
   and writes the file. Subsequent runs are non-interactive.
2. Takes a ``BATCH_ID`` from argv (or prompts for it).
3. GETs the batch from Applitools, filters to Unresolved/Failed rows,
   and POSTs the result to ``<pharos_url>/api/applitools/upload-batch``
   with the upload token in the ``X-Pharos-Helper-Token`` header.
4. Prints a single-line success/failure summary and exits.

Distribution
------------
Bundle as a single Windows .exe with PyInstaller — see ``build.bat`` /
the README in this folder. QA never needs Python installed.

Design notes
------------
The class :class:`ApplitoolsFetcher` is the single piece of business
logic; everything around it (config I/O, CLI plumbing) is procedural.
That follows Single Responsibility — the class talks to APIs, full
stop. It depends on injected `requests`-compatible callables so it can
be unit-tested without the network, although tests live separately.
"""

from __future__ import annotations

import configparser
import re
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

import requests


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Pharos prod URL — overridable via config.ini for staging/local dev.
DEFAULT_PHAROS_URL: str = "https://pagespeed-production.up.railway.app"

# Applitools Eyes server. Same default the deleted Pharos client used.
DEFAULT_APPLITOOLS_BASE: str = "https://lampspluseyes.applitools.com/api/v1"

# Same Zephyr base as the Azure DevOps integration so test rows in the
# spreadsheet hyperlink consistently regardless of source.
ZEPHYR_BASE_URL: str = "https://lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/LP-"

# Statuses worth reporting to Pharos. Anything else (e.g. "Passed",
# "New") is dropped at the source so the regression spreadsheet stays
# laser-focused on test rows that need QA attention.
KEPT_STATUSES: frozenset[str] = frozenset({"unresolved", "failed"})

# Applitools has shipped several spellings for the test list over the
# years — enumerate them so we don't break on a server upgrade.
TEST_CONTAINER_KEYS: tuple[str, ...] = ("sessions", "items", "tests", "results")

REQUEST_TIMEOUT_SECONDS: int = 60

# T-number embedded in the test name (last match wins when multiple
# appear, matching the legacy ApplitoolsResultsExtractor.py behavior).
_TEST_ID_RE = re.compile(r"(T\d+)\b")


# ---------------------------------------------------------------------------
# Config file (sits next to the .exe, written on first run)
# ---------------------------------------------------------------------------

CONFIG_FILENAME: str = "config.ini"
CONFIG_SECTION: str = "applitools_helper"


@dataclass(frozen=True)
class HelperConfig:
    """User-supplied configuration. Immutable so passing it around is safe."""

    applitools_api_key: str
    pharos_url: str
    pharos_upload_token: str
    applitools_base_url: str = DEFAULT_APPLITOOLS_BASE


def _config_path() -> Path:
    """Return the absolute path to config.ini, alongside the running exe.

    PyInstaller's onefile bundle sets ``sys.frozen`` and writes the exe
    path to ``sys.executable``; in regular Python that's the interpreter,
    so we fall back to the script's directory. Either way, the config
    sits next to whatever the user double-clicks.
    """
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent / CONFIG_FILENAME
    return Path(__file__).resolve().parent / CONFIG_FILENAME


def load_or_prompt_config() -> HelperConfig:
    """Read ``config.ini`` if present; otherwise prompt and write it."""
    path = _config_path()
    parser = configparser.ConfigParser()

    if path.exists():
        parser.read(path, encoding="utf-8")
        section = parser[CONFIG_SECTION] if CONFIG_SECTION in parser else {}
        return HelperConfig(
            applitools_api_key=section.get("applitools_api_key", "").strip(),
            pharos_url=(section.get("pharos_url") or DEFAULT_PHAROS_URL).strip().rstrip("/"),
            pharos_upload_token=section.get("pharos_upload_token", "").strip(),
            applitools_base_url=(
                section.get("applitools_base_url") or DEFAULT_APPLITOOLS_BASE
            ).strip().rstrip("/"),
        )

    print("First-run setup — these answers are saved to config.ini next to the exe.")
    print("(Press Enter to accept defaults shown in [brackets].)")
    print()
    api_key = input("Applitools API key (X-Eyes-Api-Key): ").strip()
    while not api_key:
        api_key = input("Required. Applitools API key: ").strip()

    upload_token = input("Pharos upload token (ask Adam): ").strip()
    while not upload_token:
        upload_token = input("Required. Pharos upload token: ").strip()

    pharos_url = input(f"Pharos URL [{DEFAULT_PHAROS_URL}]: ").strip() or DEFAULT_PHAROS_URL
    pharos_url = pharos_url.rstrip("/")

    applitools_base = input(
        f"Applitools server base URL [{DEFAULT_APPLITOOLS_BASE}]: "
    ).strip() or DEFAULT_APPLITOOLS_BASE
    applitools_base = applitools_base.rstrip("/")

    parser[CONFIG_SECTION] = {
        "applitools_api_key": api_key,
        "applitools_base_url": applitools_base,
        "pharos_url": pharos_url,
        "pharos_upload_token": upload_token,
    }
    with open(path, "w", encoding="utf-8") as fh:
        parser.write(fh)
    print(f"Saved {path}")
    print()
    return HelperConfig(
        applitools_api_key=api_key,
        applitools_base_url=applitools_base,
        pharos_url=pharos_url,
        pharos_upload_token=upload_token,
    )


# ---------------------------------------------------------------------------
# Applitools fetch + upload
# ---------------------------------------------------------------------------


class ApplitoolsFetcher:
    """Fetch a single Applitools batch and ship the rows to Pharos."""

    def __init__(self, config: HelperConfig) -> None:
        self._config: HelperConfig = config

    def run(self, batch_id: str) -> int:
        """Fetch + upload one batch. Returns process exit code."""
        try:
            raw_tests, tests = self._fetch_batch_rows(batch_id)
        except _Exit as exc:
            print(f"ERROR (Applitools): {exc}")
            return 1

        if not tests:
            # Print *why* we ended up with zero rows, so QA can spot
            # whether the batch genuinely has no failures, the status
            # filter rejected everything, or test names are missing
            # the T-number that links rows to Zephyr.
            self._print_diagnosis(batch_id, raw_tests)

        try:
            stored = self._upload(batch_id, tests)
        except _Exit as exc:
            print(f"ERROR (Pharos upload): {exc}")
            return 2

        print(
            f"OK — uploaded {stored} row(s) for batch {batch_id} to "
            f"{self._config.pharos_url}."
        )
        return 0

    @staticmethod
    def _print_diagnosis(batch_id: str, raw_tests: list[dict[str, Any]]) -> None:
        total = len(raw_tests)
        if total == 0:
            print(
                f"Batch {batch_id}: Applitools returned 0 tests. "
                f"Either the batch id is wrong or the JSON layout uses a "
                f"key the helper doesn't recognise yet "
                f"(known keys: {', '.join(TEST_CONTAINER_KEYS)})."
            )
            return

        # Tally what the filters found so we can point at the right step.
        status_counts: dict[str, int] = {}
        for t in raw_tests:
            key = str(t.get("status", "")).strip().lower() or "<no-status>"
            status_counts[key] = status_counts.get(key, 0) + 1
        kept_statuses = sum(c for s, c in status_counts.items() if s in KEPT_STATUSES)
        sample_names = [
            (t.get("testName") or t.get("name") or "<unnamed>")[:80]
            for t in raw_tests[:3]
        ]
        print(
            f"Batch {batch_id}: {total} total tests, "
            f"{kept_statuses} matched status filter ({', '.join(sorted(KEPT_STATUSES))}), "
            f"0 had a recognisable T-number in the name."
        )
        print(f"  status distribution: {status_counts}")
        print(f"  sample names: {sample_names}")
        print(
            "  (uploading an empty list anyway so Pharos still renders the section.)"
        )

    # -- Applitools side ----------------------------------------------------

    def _fetch_batch_rows(
        self, batch_id: str,
    ) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        """Fetch a batch and return ``(raw_tests, normalized_rows)``.

        ``raw_tests`` is whatever Applitools handed back, used for the
        diagnostic print when the normaliser produces no rows.
        ``normalized_rows`` is what we actually upload.
        """
        url = f"{self._config.applitools_base_url}/batches/{batch_id}"
        headers = {
            "X-Eyes-Api-Key": self._config.applitools_api_key,
            "Accept": "application/json",
        }
        try:
            response = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT_SECONDS)
        except requests.exceptions.Timeout:
            raise _Exit(f"Request to {url} timed out after {REQUEST_TIMEOUT_SECONDS}s.")
        except requests.exceptions.RequestException as exc:
            raise _Exit(f"Network error calling Applitools: {exc}")

        if response.status_code == 401:
            raise _Exit("Unauthorized (401). Check your Applitools API key in config.ini.")
        if response.status_code == 404:
            raise _Exit(f"Batch '{batch_id}' not found in Applitools.")
        if not response.ok:
            raise _Exit(
                f"Applitools returned HTTP {response.status_code}: {response.text[:300]}"
            )
        try:
            payload = response.json()
        except ValueError:
            raise _Exit("Applitools response was not valid JSON.")
        raw = list(_coerce_tests(payload))
        return raw, self._normalize(payload)

    @staticmethod
    def _normalize(payload: Any) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        for test in _coerce_tests(payload):
            status_raw = str(test.get("status", "")).strip()
            if status_raw.lower() not in KEPT_STATUSES:
                continue
            test_name = test.get("testName") or test.get("name") or ""
            test_id = _extract_test_id(test_name)
            if not test_id:
                continue
            rows.append({
                "testId": test_id,
                "testName": test_name,
                "status": status_raw.capitalize(),
                "zephyrUrl": f"{ZEPHYR_BASE_URL}{test_id}",
            })
        rows.sort(key=lambda r: r["testId"])
        return rows

    # -- Pharos side --------------------------------------------------------

    def _upload(self, batch_id: str, tests: list[dict[str, Any]]) -> int:
        url = f"{self._config.pharos_url}/api/applitools/upload-batch"
        body = {
            "batchId": batch_id,
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "tests": tests,
        }
        headers = {
            "X-Pharos-Helper-Token": self._config.pharos_upload_token,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        try:
            response = requests.post(
                url,
                json=body,
                headers=headers,
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
        except requests.exceptions.Timeout:
            raise _Exit(f"Upload to {url} timed out.")
        except requests.exceptions.RequestException as exc:
            raise _Exit(f"Network error uploading to Pharos: {exc}")

        if response.status_code == 401:
            raise _Exit(
                "Pharos rejected the upload token (401). "
                "Update pharos_upload_token in config.ini."
            )
        if response.status_code == 503:
            raise _Exit(
                "Pharos has uploads disabled — server admin needs to set "
                "APPLITOOLS_HELPER_TOKEN in Railway env vars."
            )
        if not response.ok:
            raise _Exit(
                f"Pharos returned HTTP {response.status_code}: {response.text[:300]}"
            )
        try:
            data = response.json()
        except ValueError:
            raise _Exit("Pharos response was not valid JSON.")
        return int(data.get("stored", len(tests)))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class _Exit(Exception):
    """Marker exception for fatal-but-expected errors with a user-readable message."""


def _coerce_tests(payload: Any) -> Iterable[dict[str, Any]]:
    """Pull the test list out of Applitools' batch payload, regardless of shape."""
    if isinstance(payload, dict):
        for key in TEST_CONTAINER_KEYS:
            value = payload.get(key)
            if isinstance(value, list):
                return value
        if "testName" in payload and "status" in payload:
            return [payload]
    if isinstance(payload, list):
        return payload
    return []


def _extract_test_id(test_name: str) -> str:
    matches = _TEST_ID_RE.findall(test_name or "")
    return matches[-1] if matches else ""


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def _read_batch_id_from_argv() -> str | None:
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    return args[0].strip() if args else None


def main() -> int:
    config = load_or_prompt_config()
    batch_id = _read_batch_id_from_argv()
    if not batch_id:
        batch_id = input("Applitools batch id: ").strip()
    if not batch_id:
        print("ERROR: no batch id supplied.")
        return 1
    return ApplitoolsFetcher(config).run(batch_id)


if __name__ == "__main__":
    code = main()
    # Pause the console window when launched via double-click so the user
    # can read the result before it disappears. ``sys.stdin.isatty()`` is
    # True for cmd-launched runs and double-clicked exes alike on Windows;
    # the input() prompt is the simplest cross-environment "press a key".
    if getattr(sys, "frozen", False):
        try:
            input("\nPress Enter to close...")
        except EOFError:
            pass
    sys.exit(code)
