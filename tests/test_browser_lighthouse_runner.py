import json
import subprocess
import threading
from pathlib import Path

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


def _extract_flag_value(command: list[str], flag: str) -> str:
    if flag not in command:
        return ""
    idx = command.index(flag)
    return command[idx + 1] if idx + 1 < len(command) else ""


def test_runner_invokes_lighthouse_with_warmup_script_and_extracts_metrics(monkeypatch):
    calls = []

    def fake_run(command, capture_output, text, timeout, check):
        calls.append(command)
        return subprocess.CompletedProcess(command, 0, stdout=json.dumps(_build_fake_report()), stderr="")

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
    assert command[0] == "node"
    helper_path = Path(command[1])
    assert helper_path.name == "browser-lighthouse-runner-helper.js"
    assert _extract_flag_value(command, "--chrome-bin") == "/usr/bin/chromium"
    assert _extract_flag_value(command, "--lighthouse-bin") == "lighthouse"
    assert _extract_flag_value(command, "--warmup-url") == "https://www.lampsplus.com/?sov=AC3624360"
    assert _extract_flag_value(command, "--audit-url") == "https://www.lampsplus.com/p/brass-lamp/"
    assert _extract_flag_value(command, "--strategy") == "desktop"
    assert _extract_flag_value(command, "--remote-debugging-port").isdigit()
    assert _extract_flag_value(command, "--user-data-dir")

    # Ensure command contract forbids unsupported direct warmup/legacy form-factor args
    assert "--chrome-flags" not in command
    assert not any(arg.startswith("--warmupUrl") for arg in command)
    assert not any(arg.startswith("--formFactor=") for arg in command)
    assert not any(arg.startswith("--formFactor") for arg in command)

    assert result["performance_score"] == 91
    assert result["fcp"] == 1234
    assert result["lcp"] == 2345
    assert result["cls"] == 0.02
    assert result["tbt"] == 123
    assert result["speed_index"] == 3456
    assert result["raw_data"] == _build_fake_report()


def test_runner_uses_mobile_settings(monkeypatch):
    commands = []

    def fake_run(command, capture_output, text, timeout, check):
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

    assert _extract_flag_value(commands[0], "--strategy") == "mobile"
    user_data_dir = _extract_flag_value(commands[0], "--user-data-dir")
    remote_port = _extract_flag_value(commands[0], "--remote-debugging-port")
    assert remote_port.isdigit()
    assert "csv-lighthouse-" in user_data_dir


def test_runner_uses_fresh_profile_per_sample(monkeypatch):
    commands = []

    def fake_run(command, capture_output, text, timeout, check):
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

    profile_dirs = [_extract_flag_value(command, "--user-data-dir") for command in commands]
    assert len(profile_dirs) == 2
    assert profile_dirs[0] != profile_dirs[1]


def test_runner_raises_clear_error_when_lighthouse_missing(monkeypatch):
    def fake_run(*args, **kwargs):
        raise FileNotFoundError("lighthouse")

    monkeypatch.setattr(subprocess, "run", fake_run)

    with pytest.raises(PageSpeedError, match="Browser Lighthouse executable not found"):
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
