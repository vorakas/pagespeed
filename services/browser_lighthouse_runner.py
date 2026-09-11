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
        if cancel_event is not None and cancel_event.is_set():
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
                missing_binary = exc.filename or self.lighthouse_bin
                raise PageSpeedError(
                    f"Browser Lighthouse executable not found: {missing_binary}"
                ) from exc
            except subprocess.TimeoutExpired as exc:
                raise PageSpeedError(
                    f"Lighthouse timed out after {self.timeout_seconds}s for {audit_url}"
                ) from exc

        if completed.returncode != 0:
            stderr = (completed.stderr or "").strip()
            if "Lighthouse executable not found" in stderr:
                raise PageSpeedError(stderr)
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
            f"--browser-executable-path={self.chrome_bin}",
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
            "--screenEmulation.disabled=true"
            if form_factor == "desktop"
            else "--screenEmulation.mobile=true",
            f"--precomputed-lantern-data-path={profile_dir / 'unused-lantern.json'}",
            f"--warmupUrl={warmup_url}",
        ]

    @staticmethod
    def _extract_metrics(report: dict[str, Any]) -> dict[str, Any]:
        audits = report.get("audits") or {}
        performance = ((report.get("categories") or {}).get("performance") or {}).get("score")
        if performance is None:
            raise PageSpeedError("Lighthouse report missing performance score")

        def metric(audit_id: str) -> object:
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
