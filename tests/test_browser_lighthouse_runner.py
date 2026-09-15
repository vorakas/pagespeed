import json
from pathlib import Path
import subprocess
import threading

import pytest

from exceptions import PageSpeedError
from services.browser_lighthouse_runner import BrowserLighthouseRunner


def _build_fake_report() -> dict:
    return {
        "categories": {"performance": {"score": 0.91}},
        "audits": {
            "first-contentful-paint": {"numericValue": 1234},
            "largest-contentful-paint": {"numericValue": 2345},
            "cumulative-layout-shift": {"numericValue": 0.02},
            "total-blocking-time": {"numericValue": 123},
            "speed-index": {"numericValue": 3456},
        },
    }


def _build_wrapped_report(mode_evidence: dict | None = None) -> dict:
    return {
        "report": _build_fake_report(),
        "modeEvidence": mode_evidence
        or {
            "expectedMode": "adobe_commerce",
            "detectedMode": "adobe_commerce",
            "evidence": "forceNew=true; forceOld=absent",
        },
    }


def _helper_payload(command: list[str]) -> dict:
    assert len(command) == 3
    assert command[1].endswith("browser_lighthouse_runner_helper.mjs")
    command_text = " ".join(command)
    assert "--warmupUrl" not in command_text
    assert "--precomputed-lantern-data-path" not in command_text
    return json.loads(command[2])


def test_runner_invokes_programmatic_helper_and_extracts_metrics(monkeypatch):
    calls = []
    envs = []

    def fake_run(command, capture_output, text, timeout, check, env=None):
        calls.append(command)
        envs.append(env)
        return subprocess.CompletedProcess(
            command,
            0,
            stdout=json.dumps(_build_wrapped_report()),
            stderr="",
        )

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
        cookies={"forceNew": "true"},
        clear_cookies=("forceOld",),
    )

    command = calls[0]
    assert command[0] == "node"
    payload = _helper_payload(command)
    assert payload["warmupUrl"] == "https://www.lampsplus.com/?sov=AC3624360"
    assert payload["auditUrl"] == "https://www.lampsplus.com/p/brass-lamp/"
    assert payload["strategy"] == "desktop"
    assert payload["formFactor"] == "desktop"
    assert payload["cookies"] == {"forceNew": "true"}
    assert payload["clearCookies"] == ["forceOld"]
    assert payload["lighthouseBin"] == "lighthouse"
    assert payload["chromeBin"] == "/usr/bin/chromium"
    assert "csv-lighthouse-" in payload["profileDir"]
    assert envs[0]["LIGHTHOUSE_BIN"] == "lighthouse"
    assert envs[0]["CHROME_BIN"] == "/usr/bin/chromium"

    assert result["performance_score"] == 91
    assert result["fcp"] == 1234
    assert result["lcp"] == 2345
    assert result["cls"] == 0.02
    assert result["tbt"] == 123
    assert result["speed_index"] == 3456
    assert result["raw_data"] == _build_fake_report()
    assert result["expected_mode"] == "adobe_commerce"
    assert result["detected_mode"] == "adobe_commerce"
    assert result["mode_evidence"] == "forceNew=true; forceOld=absent"


def test_helper_sets_mode_cookies_without_navigating_to_warmup_url():
    helper_source = Path("services/browser_lighthouse_runner_helper.mjs").read_text()

    assert "page.goto(warmupUrl" not in helper_source
    assert "page.setCookie(...cookieMutations)" in helper_source
    assert "modeEvidenceFromCookies" in helper_source
    assert "disableStorageReset: true" in helper_source


def test_runner_uses_mobile_settings(monkeypatch):
    commands = []

    def fake_run(command, capture_output, text, timeout, check, env=None):
        commands.append(command)
        return subprocess.CompletedProcess(
            command,
            0,
            stdout=json.dumps(
                {
                    "categories": {"performance": {"score": 0.5}},
                    "audits": {
                        "first-contentful-paint": {"numericValue": 1},
                        "largest-contentful-paint": {"numericValue": 2},
                        "cumulative-layout-shift": {"numericValue": 0},
                        "total-blocking-time": {"numericValue": 3},
                        "speed-index": {"numericValue": 4},
                    },
                }
            ),
            stderr="",
        )

    monkeypatch.setattr(subprocess, "run", fake_run)

    BrowserLighthouseRunner().run(
        "https://www.lampsplus.com/?sov=LP8675309",
        "https://www.lampsplus.com/",
        "mobile",
    )

    payload = _helper_payload(commands[0])
    assert payload["strategy"] == "mobile"
    assert payload["formFactor"] == "mobile"
    assert "csv-lighthouse-" in payload["profileDir"]


def test_runner_uses_env_configured_binaries(monkeypatch):
    commands = []
    envs = []
    monkeypatch.setenv("LIGHTHOUSE_BIN", "/opt/bin/lighthouse")
    monkeypatch.setenv("CHROME_BIN", "/usr/bin/chromium-browser")

    def fake_run(command, capture_output, text, timeout, check, env=None):
        commands.append(command)
        envs.append(env)
        return subprocess.CompletedProcess(
            command,
            0,
            stdout=json.dumps(
                {
                    "categories": {"performance": {"score": 1}},
                    "audits": {
                        "first-contentful-paint": {"numericValue": 1},
                        "largest-contentful-paint": {"numericValue": 2},
                        "cumulative-layout-shift": {"numericValue": 0},
                        "total-blocking-time": {"numericValue": 3},
                        "speed-index": {"numericValue": 4},
                    },
                }
            ),
            stderr="",
        )

    monkeypatch.setattr(subprocess, "run", fake_run)

    BrowserLighthouseRunner().run(
        "https://www.lampsplus.com/?sov=LP8675309",
        "https://www.lampsplus.com/",
        "desktop",
    )

    assert commands[0][0] == "node"
    payload = _helper_payload(commands[0])
    assert payload["lighthouseBin"] == "/opt/bin/lighthouse"
    assert payload["chromeBin"] == "/usr/bin/chromium-browser"
    assert envs[0]["CHROME_BIN"] == "/usr/bin/chromium-browser"
    assert envs[0]["LIGHTHOUSE_BIN"] == "/opt/bin/lighthouse"


def test_runner_uses_fresh_profile_per_sample(monkeypatch):
    commands = []

    def fake_run(command, capture_output, text, timeout, check, env=None):
        commands.append(command)
        return subprocess.CompletedProcess(
            command,
            0,
            stdout=json.dumps(_build_fake_report()),
            stderr="",
        )

    monkeypatch.setattr(subprocess, "run", fake_run)

    runner = BrowserLighthouseRunner()
    runner.run(
        "https://www.lampsplus.com/?sov=AC3624360",
        "https://www.lampsplus.com/p/brass-lamp/",
        "desktop",
    )
    runner.run(
        "https://www.lampsplus.com/?sov=LP8675309",
        "https://www.lampsplus.com/",
        "desktop",
    )

    profile_dirs = [_helper_payload(command)["profileDir"] for command in commands]
    assert len(profile_dirs) == 2
    assert profile_dirs[0] != profile_dirs[1]


def test_runner_raises_clear_error_when_lighthouse_binary_missing(monkeypatch):
    def fake_run(command, capture_output, text, timeout, check, env=None):
        return subprocess.CompletedProcess(
            command,
            1,
            stdout="",
            stderr=(
                "Lighthouse executable not found: missing-lighthouse. "
                "Install Lighthouse or set LIGHTHOUSE_BIN."
            ),
        )

    monkeypatch.setattr(subprocess, "run", fake_run)

    with pytest.raises(PageSpeedError) as exc_info:
        BrowserLighthouseRunner(lighthouse_bin="missing-lighthouse").run(
            "https://www.lampsplus.com/?sov=LP8675309",
            "https://www.lampsplus.com/",
            "desktop",
        )
    assert exc_info.value.message == (
        "Lighthouse executable not found: missing-lighthouse. "
        "Install Lighthouse or set LIGHTHOUSE_BIN."
    )


def test_runner_raises_clear_error_when_chrome_binary_missing(monkeypatch):
    def fake_run(command, capture_output, text, timeout, check, env=None):
        return subprocess.CompletedProcess(
            command,
            1,
            stdout="",
            stderr=(
                "Chrome executable not found: missing-chrome. "
                "Install Chromium/Chrome or set CHROME_BIN."
            ),
        )

    monkeypatch.setattr(subprocess, "run", fake_run)

    with pytest.raises(PageSpeedError) as exc_info:
        BrowserLighthouseRunner(chrome_bin="missing-chrome").run(
            "https://www.lampsplus.com/?sov=LP8675309",
            "https://www.lampsplus.com/",
            "desktop",
        )
    assert exc_info.value.message == (
        "Chrome executable not found: missing-chrome. "
        "Install Chromium/Chrome or set CHROME_BIN."
    )


def test_runner_raises_clear_error_when_node_binary_missing(monkeypatch):
    def fake_run(command, capture_output, text, timeout, check, env=None):
        raise FileNotFoundError(2, "No such file or directory", "missing-node")

    monkeypatch.setattr(subprocess, "run", fake_run)

    with pytest.raises(PageSpeedError) as exc_info:
        BrowserLighthouseRunner(node_bin="missing-node").run(
            "https://www.lampsplus.com/?sov=LP8675309",
            "https://www.lampsplus.com/",
            "desktop",
        )
    assert exc_info.value.message == (
        "Node.js executable not found: missing-node. Install Node.js or set NODE_BIN."
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
