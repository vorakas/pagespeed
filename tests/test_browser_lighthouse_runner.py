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

    BrowserLighthouseRunner().run(
        "https://www.lampsplus.com/?sov=LP8675309",
        "https://www.lampsplus.com/",
        "mobile",
    )

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
