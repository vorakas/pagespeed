# CSV Lighthouse Browser Session Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace CSV Lighthouse's Google PageSpeed API execution with a fresh browser-session Lighthouse runner that warms up Adobe Commerce or LampsPlus mode before every URL sample.

**Architecture:** Add a small target-mode module and a browser Lighthouse runner, then inject the runner into `CsvLighthouseService`. CSV upload/edit/save/run storage stays unchanged; only generated target URLs and per-sample execution change.

**Tech Stack:** Python 3.11, Flask service/repository architecture, pytest, Docker, Chromium, Node.js Lighthouse CLI, React 19/TypeScript UI labels.

**Spec:** `docs/superpowers/specs/2026-09-11-csv-lighthouse-browser-session-runner-design.md`

## Global Constraints

- Run CSV Lighthouse audits with a fresh browser profile/session per URL sample.
- Use the same browser-session Lighthouse runner for both Adobe Commerce and LampsPlus.
- Adobe Commerce warmup URL is exactly `https://www.lampsplus.com/?sov=AC3624360`.
- LampsPlus warmup URL is exactly `https://www.lampsplus.com/?sov=LP8675309`.
- Generated audit URLs must be normal `https://www.lampsplus.com/...` URLs and must not append `sov` to deep URLs.
- Keep existing CSV upload, edit, save, run, cancel, poll, result grouping, and export behavior.
- Preserve existing CSV result fields and average-row behavior.
- Do not change regular monitored URL testing on the main Test URLs table.
- Do not change Dashboard or Metrics consumers.
- Do not bridge CSV Lighthouse results into standard `test_results`.
- No schema change is required for the first implementation.
- Keep internal `mcprod` compatibility key for Adobe Commerce unless a later migration is explicitly requested.

---

## File Structure

- Create `services/csv_lighthouse_target_modes.py`: single source of truth for target keys, labels, warmup URLs, and audit URL base host.
- Create `services/browser_lighthouse_runner.py`: process runner for Chromium/Lighthouse CLI; exposes one typed method for CSV Lighthouse samples.
- Modify `services/testdata_registry.py`: use `www.lampsplus.com` as the base URL for both existing CSV Lighthouse target keys.
- Modify `services/testdata_url_service.py`: keep URL-listing behavior consistent with the registry base host.
- Modify `services/csv_lighthouse_service.py`: inject runner, replace `PageSpeedClient.test_url` calls in sample execution, keep aggregation/status/cancellation flow.
- Modify `app.py`: instantiate `BrowserLighthouseRunner` and pass it to `CsvLighthouseService`.
- Modify `services/__init__.py`: export new runner/target-mode symbols only if existing export style expects it.
- Modify `Dockerfile`: install runtime Node.js/npm, Chromium, and Lighthouse CLI in the final Python image.
- Modify `frontend/src/components/test-urls/CsvLighthousePanel.tsx`: remove `mcprod` short label from user-facing target copy.
- Modify `frontend/src/types/index.ts`: keep compatibility union unless UI type labels require no change.
- Add tests in `tests/test_csv_lighthouse_target_modes.py`.
- Add tests in `tests/test_browser_lighthouse_runner.py`.
- Extend `tests/test_csv_lighthouse_service.py`.
- Extend existing frontend CSV Lighthouse component tests if label assertions fail.

---

### Task 1: Target Modes And URL Generation

**Files:**
- Create: `services/csv_lighthouse_target_modes.py`
- Modify: `services/testdata_registry.py`
- Modify: `services/testdata_url_service.py`
- Test: `tests/test_csv_lighthouse_target_modes.py`
- Test: extend `tests/test_csv_lighthouse_service.py` only if it already asserts generated `mcprod` host URLs

**Interfaces:**
- Produces:
  - `CSV_LIGHTHOUSE_TARGET_MODES: dict[str, CsvLighthouseTargetMode]`
  - `CsvLighthouseTargetMode` dataclass with fields `key: str`, `label: str`, `warmup_url: str`, `base_url: str`
  - `get_csv_lighthouse_target_mode(site_key: str) -> CsvLighthouseTargetMode`
  - `csv_lighthouse_site_keys() -> set[str]`
- Consumes:
  - Existing `site_key` values `mcprod` and `www`
  - Existing `open_url(group, site_key, value)` behavior

- [ ] **Step 1: Write target mode tests**

Create `tests/test_csv_lighthouse_target_modes.py`:

```python
import pytest

from exceptions import ValidationError
from services.csv_lighthouse_target_modes import (
    csv_lighthouse_site_keys,
    get_csv_lighthouse_target_mode,
)
from services.testdata_registry import GROUPS, open_url


def test_target_modes_keep_compatibility_keys_and_warmups():
    adobe = get_csv_lighthouse_target_mode("mcprod")
    lampsplus = get_csv_lighthouse_target_mode("www")

    assert csv_lighthouse_site_keys() == {"mcprod", "www"}
    assert adobe.label == "Adobe Commerce"
    assert adobe.warmup_url == "https://www.lampsplus.com/?sov=AC3624360"
    assert adobe.base_url == "https://www.lampsplus.com"
    assert lampsplus.label == "LampsPlus"
    assert lampsplus.warmup_url == "https://www.lampsplus.com/?sov=LP8675309"
    assert lampsplus.base_url == "https://www.lampsplus.com"


def test_unknown_target_mode_raises_validation_error():
    with pytest.raises(ValidationError, match="Unknown CSV Lighthouse target"):
        get_csv_lighthouse_target_mode("staging")


def test_adobe_and_lampsplus_generate_normal_www_audit_urls():
    pdp_group = GROUPS["PDP"]

    adobe_url = open_url(pdp_group, "mcprod", "brass-lamp/")
    lampsplus_url = open_url(pdp_group, "www", "brass-lamp/")

    assert adobe_url == "https://www.lampsplus.com/p/brass-lamp/"
    assert lampsplus_url == "https://www.lampsplus.com/p/brass-lamp/"
    assert "sov=" not in adobe_url
    assert "mcprod" not in adobe_url


def test_search_to_pdp_uses_www_for_both_targets():
    group = GROUPS["SearchToPDP"]

    assert open_url(group, "mcprod", "12345") == (
        "https://www.lampsplus.com/s/s_12345/?s=1"
    )
    assert open_url(group, "www", "12345") == (
        "https://www.lampsplus.com/s/s_12345/?s=1"
    )
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pytest tests/test_csv_lighthouse_target_modes.py -v
```

Expected: fails because `services.csv_lighthouse_target_modes` does not exist and `mcprod` still maps to `https://mcprod.lampsplus.com`.

- [ ] **Step 3: Add target mode module**

Create `services/csv_lighthouse_target_modes.py`:

```python
"""Target mode definitions for CSV Lighthouse browser-session runs."""
from __future__ import annotations

from dataclasses import dataclass

from exceptions import ValidationError


WWW_BASE_URL = "https://www.lampsplus.com"


@dataclass(frozen=True)
class CsvLighthouseTargetMode:
    key: str
    label: str
    warmup_url: str
    base_url: str = WWW_BASE_URL


CSV_LIGHTHOUSE_TARGET_MODES: dict[str, CsvLighthouseTargetMode] = {
    "mcprod": CsvLighthouseTargetMode(
        key="mcprod",
        label="Adobe Commerce",
        warmup_url=f"{WWW_BASE_URL}/?sov=AC3624360",
    ),
    "www": CsvLighthouseTargetMode(
        key="www",
        label="LampsPlus",
        warmup_url=f"{WWW_BASE_URL}/?sov=LP8675309",
    ),
}


def get_csv_lighthouse_target_mode(site_key: str) -> CsvLighthouseTargetMode:
    try:
        return CSV_LIGHTHOUSE_TARGET_MODES[site_key]
    except KeyError as exc:
        raise ValidationError(f"Unknown CSV Lighthouse target: {site_key}") from exc


def csv_lighthouse_site_keys() -> set[str]:
    return set(CSV_LIGHTHOUSE_TARGET_MODES)
```

- [ ] **Step 4: Update registry base host**

In `services/testdata_registry.py`, import `WWW_BASE_URL` and change the `SITES` mapping:

```python
from services.csv_lighthouse_target_modes import WWW_BASE_URL

SITES = {
    "mcprod": WWW_BASE_URL,
    "www": WWW_BASE_URL,
}
```

Keep group path templates unchanged.

- [ ] **Step 5: Update URL service target validation if needed**

In `services/testdata_url_service.py`, continue using `SITES` and `open_url()`. If it has local labels or assumptions about `mcprod.lampsplus.com`, replace only user-facing text with "Adobe Commerce"; keep `site_key` values unchanged.

- [ ] **Step 6: Run target mode tests**

Run:

```bash
pytest tests/test_csv_lighthouse_target_modes.py -v
```

Expected: all tests pass.

- [ ] **Step 7: Run existing CSV service tests**

Run:

```bash
pytest tests/test_csv_lighthouse_service.py -v
```

Expected: tests pass or fail only on old `mcprod` host expectations. Update expected generated URLs to `https://www.lampsplus.com/...` and rerun until passing.

- [ ] **Step 8: Commit**

```bash
git add services/csv_lighthouse_target_modes.py services/testdata_registry.py services/testdata_url_service.py tests/test_csv_lighthouse_target_modes.py tests/test_csv_lighthouse_service.py
git commit -m "Add CSV Lighthouse target mode warmups"
```

---

### Task 2: Browser Lighthouse Runner

**Files:**
- Create: `services/browser_lighthouse_runner.py`
- Test: `tests/test_browser_lighthouse_runner.py`

**Interfaces:**
- Consumes:
  - `warmup_url: str`
  - `audit_url: str`
  - `strategy: str`
  - optional `cancel_event: threading.Event | None`
- Produces:
  - `BrowserLighthouseRunner.run(warmup_url: str, audit_url: str, strategy: str, cancel_event: threading.Event | None = None) -> dict`
  - Return dict keys: `performance_score`, `fcp`, `lcp`, `cls`, `tbt`, `speed_index`, `raw_data`

- [ ] **Step 1: Write runner unit tests with fake subprocess**

Create `tests/test_browser_lighthouse_runner.py`:

```python
import json
import subprocess
import threading

import pytest

from exceptions import PageSpeedError
from services.browser_lighthouse_runner import BrowserLighthouseRunner


def test_runner_invokes_lighthouse_with_warmup_script_and_extracts_metrics(monkeypatch):
    calls = []
    report = {
        "categories": {"performance": {"score": 0.91}},
        "audits": {
            "first-contentful-paint": {"numericValue": 1234},
            "largest-contentful-paint": {"numericValue": 2345},
            "cumulative-layout-shift": {"numericValue": 0.02},
            "total-blocking-time": {"numericValue": 123},
            "speed-index": {"numericValue": 3456},
        },
    }

    def fake_run(command, capture_output, text, timeout, check):
        calls.append(command)
        return subprocess.CompletedProcess(command, 0, stdout=json.dumps(report), stderr="")

    monkeypatch.setattr(subprocess, "run", fake_run)

    runner = BrowserLighthouseRunner(
        lighthouse_bin="lighthouse",
        chrome_bin="/usr/bin/chromium",
        timeout_seconds=30,
    )
    result = runner.run(
        warmup_url="https://www.lampsplus.com/?sov=AC3624360",
        audit_url="https://www.lampsplus.com/p/brass-lamp/",
        strategy="desktop",
    )

    command = calls[0]
    assert command[0] == "lighthouse"
    assert command[1] == "https://www.lampsplus.com/p/brass-lamp/"
    assert "--output=json" in command
    assert "--chrome-flags" in command
    assert any("disable-storage-reset" in value for value in command)
    assert any("formFactor=desktop" in value for value in command)
    assert any("screenEmulation.disabled=true" in value for value in command)
    assert any("warmupUrl=https://www.lampsplus.com/?sov=AC3624360" in value for value in command)
    assert result["performance_score"] == 91
    assert result["fcp"] == 1234
    assert result["lcp"] == 2345
    assert result["cls"] == 0.02
    assert result["tbt"] == 123
    assert result["speed_index"] == 3456
    assert result["raw_data"] == report


def test_runner_uses_mobile_settings(monkeypatch):
    commands = []

    def fake_run(command, capture_output, text, timeout, check):
        commands.append(command)
        return subprocess.CompletedProcess(
            command,
            0,
            stdout=json.dumps({
                "categories": {"performance": {"score": 0.5}},
                "audits": {
                    "first-contentful-paint": {"numericValue": 1},
                    "largest-contentful-paint": {"numericValue": 2},
                    "cumulative-layout-shift": {"numericValue": 0},
                    "total-blocking-time": {"numericValue": 3},
                    "speed-index": {"numericValue": 4},
                },
            }),
            stderr="",
        )

    monkeypatch.setattr(subprocess, "run", fake_run)

    BrowserLighthouseRunner().run("https://www.lampsplus.com/?sov=LP8675309", "https://www.lampsplus.com/", "mobile")

    assert any("formFactor=mobile" in value for value in commands[0])


def test_runner_raises_clear_error_when_lighthouse_missing(monkeypatch):
    def fake_run(*args, **kwargs):
        raise FileNotFoundError("lighthouse")

    monkeypatch.setattr(subprocess, "run", fake_run)

    with pytest.raises(PageSpeedError, match="Lighthouse executable not found"):
        BrowserLighthouseRunner(lighthouse_bin="missing-lighthouse").run(
            "https://www.lampsplus.com/?sov=LP8675309",
            "https://www.lampsplus.com/",
            "desktop",
        )


def test_runner_skips_subprocess_when_cancelled():
    cancel_event = threading.Event()
    cancel_event.set()

    with pytest.raises(PageSpeedError, match="cancelled before Lighthouse started"):
        BrowserLighthouseRunner().run(
            "https://www.lampsplus.com/?sov=LP8675309",
            "https://www.lampsplus.com/",
            "desktop",
            cancel_event=cancel_event,
        )
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
pytest tests/test_browser_lighthouse_runner.py -v
```

Expected: fails because `services.browser_lighthouse_runner` does not exist.

- [ ] **Step 3: Implement runner**

Create `services/browser_lighthouse_runner.py`:

```python
"""Browser-session Lighthouse runner for CSV Lighthouse samples."""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import threading
from pathlib import Path
from typing import Any

from config import PAGESPEED_TIMEOUT_SECONDS
from exceptions import PageSpeedError


class BrowserLighthouseRunner:
    def __init__(
        self,
        lighthouse_bin: str | None = None,
        chrome_bin: str | None = None,
        timeout_seconds: int = PAGESPEED_TIMEOUT_SECONDS,
    ) -> None:
        self.lighthouse_bin = lighthouse_bin or os.getenv("LIGHTHOUSE_BIN", "lighthouse")
        self.chrome_bin = chrome_bin or os.getenv("CHROME_BIN", "chromium")
        self.timeout_seconds = timeout_seconds

    def run(
        self,
        warmup_url: str,
        audit_url: str,
        strategy: str,
        cancel_event: threading.Event | None = None,
    ) -> dict[str, Any]:
        if cancel_event and cancel_event.is_set():
            raise PageSpeedError("CSV Lighthouse sample cancelled before Lighthouse started")

        with tempfile.TemporaryDirectory(prefix="csv-lighthouse-") as profile_dir:
            command = self._command(warmup_url, audit_url, strategy, Path(profile_dir))
            try:
                completed = subprocess.run(
                    command,
                    capture_output=True,
                    text=True,
                    timeout=self.timeout_seconds,
                    check=False,
                )
            except FileNotFoundError as exc:
                raise PageSpeedError(
                    f"Lighthouse executable not found: {self.lighthouse_bin}"
                ) from exc
            except subprocess.TimeoutExpired as exc:
                raise PageSpeedError(
                    f"Lighthouse timed out after {self.timeout_seconds}s for {audit_url}"
                ) from exc

        if completed.returncode != 0:
            stderr = (completed.stderr or "").strip()
            raise PageSpeedError(
                f"Lighthouse failed for {audit_url}: {stderr or 'no stderr output'}"
            )

        try:
            report = json.loads(completed.stdout)
        except json.JSONDecodeError as exc:
            raise PageSpeedError(f"Lighthouse returned invalid JSON for {audit_url}") from exc

        return self._extract_metrics(report)

    def _command(
        self,
        warmup_url: str,
        audit_url: str,
        strategy: str,
        profile_dir: Path,
    ) -> list[str]:
        form_factor = "mobile" if strategy == "mobile" else "desktop"
        chrome_flags = " ".join([
            "--headless=new",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            f"--user-data-dir={profile_dir}",
        ])
        return [
            self.lighthouse_bin,
            audit_url,
            "--output=json",
            "--quiet",
            "--chrome-flags",
            chrome_flags,
            "--disable-storage-reset",
            "--extra-headers",
            "{}",
            "--preset=desktop" if form_factor == "desktop" else "--preset=perf",
            f"--form-factor={form_factor}",
            "--screenEmulation.disabled=true" if form_factor == "desktop" else "--screenEmulation.mobile=true",
            f"--precomputed-lantern-data-path={profile_dir / 'unused-lantern.json'}",
            f"--warmupUrl={warmup_url}",
        ]

    def _extract_metrics(self, report: dict[str, Any]) -> dict[str, Any]:
        audits = report.get("audits") or {}
        performance = ((report.get("categories") or {}).get("performance") or {}).get("score")
        if performance is None:
            raise PageSpeedError("Lighthouse report missing performance score")

        def metric(audit_id: str) -> float:
            value = (audits.get(audit_id) or {}).get("numericValue")
            if value is None:
                raise PageSpeedError(f"Lighthouse report missing metric: {audit_id}")
            return value

        return {
            "performance_score": round(performance * 100),
            "fcp": metric("first-contentful-paint"),
            "lcp": metric("largest-contentful-paint"),
            "cls": metric("cumulative-layout-shift"),
            "tbt": metric("total-blocking-time"),
            "speed_index": metric("speed-index"),
            "raw_data": report,
        }
```

Important implementation note: if Lighthouse CLI does not support `--warmupUrl`, replace the command construction with a small Node script in this same task that launches Chrome, performs warmup navigation, then invokes Lighthouse programmatically against the same port/profile. Keep the public Python `BrowserLighthouseRunner.run()` interface unchanged and update tests to assert the Python command calls that script with `warmup_url` and `audit_url`.

- [ ] **Step 4: Run runner tests**

Run:

```bash
pytest tests/test_browser_lighthouse_runner.py -v
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add services/browser_lighthouse_runner.py tests/test_browser_lighthouse_runner.py
git commit -m "Add browser Lighthouse runner"
```

---

### Task 3: Wire Browser Runner Into CSV Lighthouse Service

**Files:**
- Modify: `services/csv_lighthouse_service.py`
- Modify: `app.py`
- Modify: `services/__init__.py` if needed
- Test: extend `tests/test_csv_lighthouse_service.py`

**Interfaces:**
- Consumes:
  - `BrowserLighthouseRunner.run(warmup_url, audit_url, strategy, cancel_event=None) -> dict`
  - `get_csv_lighthouse_target_mode(site_key).warmup_url`
- Produces:
  - `CsvLighthouseService(repository, lighthouse_runner)` constructor
  - `_attempt_sample(item: dict, cancel_event: threading.Event | None = None) -> dict`

- [ ] **Step 1: Write service test with fake runner**

In `tests/test_csv_lighthouse_service.py`, add or adapt a fake runner:

```python
class FakeBrowserLighthouseRunner:
    def __init__(self):
        self.calls = []

    def run(self, warmup_url, audit_url, strategy, cancel_event=None):
        self.calls.append({
            "warmup_url": warmup_url,
            "audit_url": audit_url,
            "strategy": strategy,
            "cancelled": cancel_event.is_set() if cancel_event else False,
        })
        return {
            "performance_score": 88,
            "fcp": 1000,
            "lcp": 2000,
            "cls": 0.01,
            "tbt": 50,
            "speed_index": 1500,
            "raw_data": {"source": "fake-browser-lighthouse"},
        }
```

Add a focused test:

```python
def test_attempt_sample_uses_target_warmup_and_generated_audit_url(tmp_path):
    repo = make_csv_lighthouse_repository(tmp_path)
    runner = FakeBrowserLighthouseRunner()
    service = CsvLighthouseService(repo, runner)

    result = service._attempt_sample({
        "site_key": "mcprod",
        "generated_url": "https://www.lampsplus.com/p/brass-lamp/",
        "strategy": "desktop",
    })

    assert runner.calls == [{
        "warmup_url": "https://www.lampsplus.com/?sov=AC3624360",
        "audit_url": "https://www.lampsplus.com/p/brass-lamp/",
        "strategy": "desktop",
        "cancelled": False,
    }]
    assert result["performance_score"] == 88
    assert result["raw_data"] == {"source": "fake-browser-lighthouse"}
```

If the existing tests use a constructor helper, update that helper to pass `FakeBrowserLighthouseRunner()` instead of `PageSpeedClient`.

- [ ] **Step 2: Run service test to verify failure**

Run:

```bash
pytest tests/test_csv_lighthouse_service.py -v
```

Expected: fails because `CsvLighthouseService` still expects `pagespeed_client` and `_attempt_sample` calls `test_url()`.

- [ ] **Step 3: Update service constructor**

In `services/csv_lighthouse_service.py`, replace the PageSpeed import/use with the runner:

```python
from services.browser_lighthouse_runner import BrowserLighthouseRunner
from services.csv_lighthouse_target_modes import get_csv_lighthouse_target_mode
```

Change constructor:

```python
class CsvLighthouseService:
    def __init__(
        self,
        repository: CsvLighthouseRepository,
        lighthouse_runner: BrowserLighthouseRunner,
    ) -> None:
        self.repository = repository
        self.lighthouse_runner = lighthouse_runner
        self._cancel_events: dict[int, threading.Event] = {}
        self._cancel_events_lock = threading.Lock()
```

Remove `self.pagespeed_client`.

- [ ] **Step 4: Replace sample execution**

Change `_attempt_sample` so it selects warmup by target key and calls the runner with the unmodified generated audit URL:

```python
def _attempt_sample(self, item: dict, cancel_event: threading.Event | None = None):
    target_mode = get_csv_lighthouse_target_mode(item["site_key"])
    last_exception = None
    for attempt in range(CSV_LIGHTHOUSE_MAX_ATTEMPTS_PER_SAMPLE):
        try:
            started = time.perf_counter()
            result = self.lighthouse_runner.run(
                warmup_url=target_mode.warmup_url,
                audit_url=item["generated_url"],
                strategy=item["strategy"],
                cancel_event=cancel_event,
            )
            duration_ms = int((time.perf_counter() - started) * 1000)
            return {
                "status": "passed",
                "metrics": result,
                "duration_ms": duration_ms,
                "attempts": attempt + 1,
            }
        except Exception as exc:
            last_exception = exc
            if cancel_event and cancel_event.is_set():
                break
            time.sleep(CSV_LIGHTHOUSE_SAMPLE_COOLDOWN_SECONDS)
    return {
        "status": "failed",
        "error_message": str(last_exception) if last_exception else "Unknown Lighthouse failure",
        "attempts": CSV_LIGHTHOUSE_MAX_ATTEMPTS_PER_SAMPLE,
    }
```

Preserve existing return-shape names if current `_run_pending_items` expects different keys. The key requirement is: no `_cache_busted_url()` and no `PageSpeedClient.test_url()` remain in the CSV Lighthouse sample path.

- [ ] **Step 5: Thread cancel event into sample execution**

In `_run_pending_items`, where `_attempt_sample(item)` is called, pass the current run's `cancel_event`:

```python
sample_result = self._attempt_sample(item, cancel_event=cancel_event)
```

If `_attempt_sample` is called inside a nested worker function, thread the parameter through that worker and keep current cancellation checks.

- [ ] **Step 6: Wire app injection**

In `app.py`, import and instantiate:

```python
from services.browser_lighthouse_runner import BrowserLighthouseRunner
```

Near existing service setup:

```python
browser_lighthouse_runner = BrowserLighthouseRunner()
csv_lighthouse_service = CsvLighthouseService(csv_lighthouse_repo, browser_lighthouse_runner)
```

Leave `PageSpeedClient` in place for standard Test URLs.

- [ ] **Step 7: Export new runner if service exports are maintained**

In `services/__init__.py`, add:

```python
from services.browser_lighthouse_runner import BrowserLighthouseRunner
```

and include `"BrowserLighthouseRunner"` in `__all__` if `__all__` exists.

- [ ] **Step 8: Run service tests**

Run:

```bash
pytest tests/test_csv_lighthouse_service.py tests/test_csv_lighthouse_target_modes.py tests/test_browser_lighthouse_runner.py -v
```

Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add services/csv_lighthouse_service.py app.py services/__init__.py tests/test_csv_lighthouse_service.py
git commit -m "Use browser sessions for CSV Lighthouse samples"
```

---

### Task 4: Runtime Dependencies And Clear Startup Failure

**Files:**
- Modify: `Dockerfile`
- Modify: `services/browser_lighthouse_runner.py`
- Test: extend `tests/test_browser_lighthouse_runner.py`

**Interfaces:**
- Consumes:
  - `LIGHTHOUSE_BIN` env var
  - `CHROME_BIN` env var
- Produces:
  - Railway image with Chromium, Node.js/npm, and Lighthouse CLI available in final runtime stage.

- [ ] **Step 1: Add command-building/runtime tests**

Extend `tests/test_browser_lighthouse_runner.py`:

```python
def test_runner_uses_env_configured_binaries(monkeypatch):
    commands = []
    monkeypatch.setenv("LIGHTHOUSE_BIN", "/opt/bin/lighthouse")
    monkeypatch.setenv("CHROME_BIN", "/usr/bin/chromium-browser")

    def fake_run(command, capture_output, text, timeout, check):
        commands.append(command)
        return subprocess.CompletedProcess(
            command,
            0,
            stdout=json.dumps({
                "categories": {"performance": {"score": 1}},
                "audits": {
                    "first-contentful-paint": {"numericValue": 1},
                    "largest-contentful-paint": {"numericValue": 2},
                    "cumulative-layout-shift": {"numericValue": 0},
                    "total-blocking-time": {"numericValue": 3},
                    "speed-index": {"numericValue": 4},
                },
            }),
            stderr="",
        )

    monkeypatch.setattr(subprocess, "run", fake_run)

    BrowserLighthouseRunner().run(
        "https://www.lampsplus.com/?sov=LP8675309",
        "https://www.lampsplus.com/",
        "desktop",
    )

    assert commands[0][0] == "/opt/bin/lighthouse"
    assert any("/usr/bin/chromium-browser" in value for value in commands[0])
```

- [ ] **Step 2: Run runner tests**

Run:

```bash
pytest tests/test_browser_lighthouse_runner.py -v
```

Expected: pass after Task 2 implementation; fail if command does not include configured Chrome binary.

- [ ] **Step 3: Ensure Chrome binary flag is explicit**

In `services/browser_lighthouse_runner.py`, include the Chrome binary in flags:

```python
chrome_flags = " ".join([
    f"--browser-executable-path={self.chrome_bin}",
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    f"--user-data-dir={profile_dir}",
])
```

If Lighthouse CLI requires browser path through a different flag in verified local testing, use the supported flag but keep the test assertion that configured `CHROME_BIN` reaches the subprocess command.

- [ ] **Step 4: Update Dockerfile runtime stage**

In `Dockerfile`, final stage currently installs only minimal packages. Change the final runtime `apt-get install` to include Chromium, Node.js, and npm:

```dockerfile
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    chromium \
    nodejs \
    npm \
    && npm install -g lighthouse \
    && rm -rf /var/lib/apt/lists/*

ENV CHROME_BIN=/usr/bin/chromium
ENV LIGHTHOUSE_BIN=/usr/local/bin/lighthouse
```

Keep frontend build stage unchanged.

- [ ] **Step 5: Run runner tests**

Run:

```bash
pytest tests/test_browser_lighthouse_runner.py -v
```

Expected: all pass.

- [ ] **Step 6: Build Docker image locally if Docker is available**

Run:

```bash
docker build -t pagespeed-monitor-csv-lighthouse-browser .
```

Expected: image builds and `npm install -g lighthouse` succeeds. If Docker is unavailable locally, record that in the task report and rely on Railway build logs during deployment.

- [ ] **Step 7: Commit**

```bash
git add Dockerfile services/browser_lighthouse_runner.py tests/test_browser_lighthouse_runner.py
git commit -m "Install browser Lighthouse runtime"
```

---

### Task 5: UI Labels And API Compatibility

**Files:**
- Modify: `frontend/src/components/test-urls/CsvLighthousePanel.tsx`
- Test: frontend CSV Lighthouse component tests if they assert labels

**Interfaces:**
- Consumes:
  - Existing `CsvLighthouseSiteKey = "www" | "mcprod"` type.
- Produces:
  - User-facing target labels: "Adobe Commerce" and "LampsPlus".
  - No visible `mcprod` host wording in target picker.

- [ ] **Step 1: Search current label assertions**

Run:

```bash
rg -n "mcprod|Adobe Commerce|LampsPlus" frontend/src/components/test-urls tests frontend/src -g "!frontend/dist/**" -g "!node_modules/**"
```

Expected: `CsvLighthousePanel.tsx` has target options with `shortLabel: "mcprod"`.

- [ ] **Step 2: Update target copy**

In `frontend/src/components/test-urls/CsvLighthousePanel.tsx`, change:

```ts
const TARGET_OPTIONS = [
  { key: "mcprod", label: "Adobe Commerce", shortLabel: "mcprod" },
  { key: "www", label: "LampsPlus", shortLabel: "www" },
] as const
```

to:

```ts
const TARGET_OPTIONS = [
  { key: "mcprod", label: "Adobe Commerce", shortLabel: "Adobe" },
  { key: "www", label: "LampsPlus", shortLabel: "LP" },
] as const
```

Do not rename the `key` values.

- [ ] **Step 3: Update tests if needed**

If any frontend test expects `mcprod` label text, update it to expect `Adobe` or `Adobe Commerce` while keeping fixture `site_key: "mcprod"`.

- [ ] **Step 4: Run focused frontend tests**

Run:

```bash
cd frontend && npm test -- --run csv-lighthouse
```

Expected: CSV Lighthouse component tests pass. If the project has no `npm test` script for this pattern, run the existing frontend test command from `frontend/package.json`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/test-urls/CsvLighthousePanel.tsx frontend/src/components/test-urls
git commit -m "Update CSV Lighthouse target labels"
```

---

### Task 6: End-To-End Verification And Documentation Update

**Files:**
- Modify: `docs/test-urls-tab-analysis-2026-09-11.md`
- Optionally modify: `AGENTS.md` only if project context should document the new runner after implementation

**Interfaces:**
- Consumes:
  - Completed Tasks 1-5.
- Produces:
  - Verified build/test chain.
  - Updated analysis note reflecting the final browser-session runner behavior.

- [ ] **Step 1: Update analysis note**

In `docs/test-urls-tab-analysis-2026-09-11.md`, update the CSV Lighthouse section to say:

```markdown
CSV Lighthouse execution now uses a browser-session Lighthouse runner for both Adobe Commerce and LampsPlus targets. Each URL sample creates a fresh browser profile, opens the target warmup URL, then audits the generated normal `www.lampsplus.com` URL in that same session.
```

Add the exact warmup URLs:

```markdown
- Adobe Commerce: `https://www.lampsplus.com/?sov=AC3624360`
- LampsPlus: `https://www.lampsplus.com/?sov=LP8675309`
```

- [ ] **Step 2: Run backend focused tests**

Run:

```bash
pytest tests/test_csv_lighthouse_target_modes.py tests/test_browser_lighthouse_runner.py tests/test_csv_lighthouse_service.py tests/test_csv_lighthouse_repository.py tests/test_csv_lighthouse_api.py -v
```

Expected: all pass.

- [ ] **Step 3: Run frontend build**

Run:

```bash
cd frontend && npm run build
```

Expected: Vite build completes.

- [ ] **Step 4: Run app smoke if runtime dependencies are present**

If local Chromium/Lighthouse runtime is installed, run the smallest manual CSV Lighthouse smoke:

1. Start backend/frontend local dev stack using existing project workflow.
2. Open `/test`.
3. Upload a one-row CSV.
4. Select Adobe Commerce and LampsPlus.
5. Save CSVs.
6. Run Lighthouse.
7. Confirm run detail shows each target with a normal `www.lampsplus.com` generated URL and metrics.

Record if this was skipped because local browser runtime is unavailable.

- [ ] **Step 5: Commit docs/verification update**

```bash
git add docs/test-urls-tab-analysis-2026-09-11.md AGENTS.md
git commit -m "Document CSV Lighthouse browser session behavior"
```

If `AGENTS.md` was not changed, omit it from `git add`.

---

## Final Verification

Run the full focused verification chain before reporting completion:

```bash
pytest tests/test_csv_lighthouse_target_modes.py tests/test_browser_lighthouse_runner.py tests/test_csv_lighthouse_service.py tests/test_csv_lighthouse_repository.py tests/test_csv_lighthouse_api.py -v
cd frontend && npm run build
```

If Docker is available:

```bash
docker build -t pagespeed-monitor-csv-lighthouse-browser .
```

If deploying after implementation, follow the repo's Railway manual deploy flow from `AGENTS.md` and smoke `/test` in production.

## Self-Review Checklist

- Spec coverage: Tasks cover target modes, URL generation, fresh browser runner, service injection, Docker runtime, frontend labels, docs, and verification.
- Placeholder scan: each task has concrete files, test commands, and code snippets.
- Type consistency: runner interface is `run(warmup_url, audit_url, strategy, cancel_event=None) -> dict`; service consumes that same signature.
- Scope control: standard monitored URL tests, Dashboard, Metrics, and `test_results` are untouched.
