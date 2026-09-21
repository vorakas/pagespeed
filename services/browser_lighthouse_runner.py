"""Browser-session Lighthouse runner for CSV Lighthouse samples."""
from __future__ import annotations

import json
import os
import subprocess
import tempfile
import threading
from pathlib import Path
from typing import Any, Mapping, Sequence

from config import PAGESPEED_TIMEOUT_SECONDS
from exceptions import PageSpeedError


class BrowserLighthouseRunner:
    def __init__(
        self,
        lighthouse_bin: str | None = None,
        chrome_bin: str | None = None,
        node_bin: str | None = None,
        helper_path: Path | None = None,
        timeout_seconds: int = PAGESPEED_TIMEOUT_SECONDS,
    ) -> None:
        self.lighthouse_bin = lighthouse_bin or os.getenv("LIGHTHOUSE_BIN", "lighthouse")
        self.chrome_bin = chrome_bin or os.getenv("CHROME_BIN", "chromium")
        self.node_bin = node_bin or os.getenv("NODE_BIN", "node")
        self.helper_path = helper_path or Path(__file__).with_name(
            "browser_lighthouse_runner_helper.mjs"
        )
        self.timeout_seconds = timeout_seconds

    def run(
        self,
        warmup_url: str,
        audit_url: str,
        strategy: str,
        cookies: Mapping[str, str] | None = None,
        clear_cookies: Sequence[str] | None = None,
        cancel_event: threading.Event | None = None,
    ) -> dict[str, Any]:
        if cancel_event is not None and cancel_event.is_set():
            raise PageSpeedError("CSV Lighthouse sample cancelled before Lighthouse started")

        with tempfile.TemporaryDirectory(prefix="csv-lighthouse-") as profile_dir:
            command = self._command(
                warmup_url,
                audit_url,
                strategy,
                Path(profile_dir),
                cookies=cookies,
                clear_cookies=clear_cookies,
            )
            try:
                completed = subprocess.run(
                    command,
                    capture_output=True,
                    text=True,
                    timeout=self.timeout_seconds,
                    check=False,
                    env={
                        **os.environ,
                        "CHROME_BIN": self.chrome_bin,
                        "LIGHTHOUSE_BIN": self.lighthouse_bin,
                    },
                )
            except FileNotFoundError as exc:
                missing_binary = exc.filename or self.node_bin
                raise PageSpeedError(
                    "Node.js executable not found: "
                    f"{missing_binary}. Install Node.js or set NODE_BIN."
                ) from exc
            except subprocess.TimeoutExpired as exc:
                raise PageSpeedError(
                    f"Lighthouse timed out after {self.timeout_seconds}s for {audit_url}"
                ) from exc

        if completed.returncode != 0:
            stderr = (completed.stderr or "").strip()
            if (
                "Lighthouse executable not found" in stderr
                or "Chrome executable not found" in stderr
                or "Unable to load Lighthouse runtime package" in stderr
                or "Unable to load puppeteer-core package" in stderr
            ):
                raise PageSpeedError(stderr)
            raise PageSpeedError(
                f"Lighthouse failed for {audit_url}: {stderr or 'no stderr output'}"
            )

        try:
            payload = json.loads(completed.stdout)
        except json.JSONDecodeError as exc:
            raise PageSpeedError(f"Lighthouse returned invalid JSON for {audit_url}") from exc

        report, mode_evidence, cls_probe = self._unwrap_helper_payload(payload)
        metrics = self._extract_metrics(report)
        if cls_probe:
            metrics["cls_diagnostics"]["live_probe"] = {
                "cls": cls_probe.get("cls"),
                "shift_count": cls_probe.get("shiftCount"),
                "largest_shift_score": cls_probe.get("largestShift"),
                "largest_shift_node": cls_probe.get("largestShiftNode"),
                "observation_ms": cls_probe.get("observationMs"),
                "scroll_steps": cls_probe.get("scrollSteps"),
                "scroll_pause_ms": cls_probe.get("scrollPauseMs"),
                "page": cls_probe.get("page"),
                "error": cls_probe.get("error"),
            }
        if mode_evidence:
            metrics["expected_mode"] = mode_evidence.get("expectedMode")
            metrics["detected_mode"] = mode_evidence.get("detectedMode")
            metrics["mode_evidence"] = mode_evidence.get("evidence")
        return metrics

    @staticmethod
    def _unwrap_helper_payload(
        payload: dict[str, Any],
    ) -> tuple[dict[str, Any], dict[str, Any] | None, dict[str, Any] | None]:
        report = payload.get("report")
        if isinstance(report, dict):
            mode_evidence = payload.get("modeEvidence")
            cls_probe = payload.get("clsProbe")
            return (
                report,
                mode_evidence if isinstance(mode_evidence, dict) else None,
                cls_probe if isinstance(cls_probe, dict) else None,
            )
        return payload, None, None

    def _command(
        self,
        warmup_url: str,
        audit_url: str,
        strategy: str,
        profile_dir: Path,
        cookies: Mapping[str, str] | None = None,
        clear_cookies: Sequence[str] | None = None,
    ) -> list[str]:
        form_factor = "mobile" if strategy == "mobile" else "desktop"
        payload = {
            "warmupUrl": warmup_url,
            "auditUrl": audit_url,
            "strategy": strategy,
            "formFactor": form_factor,
            "profileDir": str(profile_dir),
            "lighthouseBin": self.lighthouse_bin,
            "chromeBin": self.chrome_bin,
            "cookies": dict(cookies or {}),
            "clearCookies": list(clear_cookies or ()),
        }
        return [
            self.node_bin,
            str(self.helper_path),
            json.dumps(payload),
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

        def cls_diagnostics() -> dict[str, Any]:
            layout_shift_items = (
                ((audits.get("layout-shifts") or {}).get("details") or {}).get("items") or []
            )
            scored_items = [
                item for item in layout_shift_items
                if isinstance(item, dict) and isinstance(item.get("score"), (int, float))
            ]
            largest_shift = max(scored_items, key=lambda item: item["score"], default=None)
            largest_node = ((largest_shift or {}).get("node") or {}).get("snippet")
            return {
                "observed_shift_count": len(layout_shift_items),
                "largest_shift_score": (largest_shift or {}).get("score"),
                "largest_shift_node": largest_node,
                "lighthouse": lighthouse_diagnostics(),
            }

        def audit_metric(audit_id: str) -> object:
            return (audits.get(audit_id) or {}).get("numericValue")

        def lcp_element() -> str | None:
            items = (
                ((audits.get("largest-contentful-paint-element") or {}).get("details") or {})
                .get("items")
                or []
            )
            if not items:
                return None
            node = (items[0] or {}).get("node") or {}
            snippet = node.get("snippet")
            return snippet if isinstance(snippet, str) else None

        def lighthouse_diagnostics() -> dict[str, Any]:
            network_items = (
                ((audits.get("network-requests") or {}).get("details") or {}).get("items")
                or []
            )
            return {
                "requested_url": report.get("requestedUrl"),
                "final_url": report.get("finalUrl"),
                "final_displayed_url": report.get("finalDisplayedUrl"),
                "fetch_time": report.get("fetchTime"),
                "lighthouse_version": report.get("lighthouseVersion"),
                "user_agent": report.get("userAgent"),
                "environment_user_agent": (report.get("environment") or {}).get("networkUserAgent"),
                "throttling_method": (report.get("configSettings") or {}).get("throttlingMethod"),
                "server_response_time": audit_metric("server-response-time"),
                "total_byte_weight": audit_metric("total-byte-weight"),
                "network_request_count": len(network_items),
                "lcp_element": lcp_element(),
            }

        return {
            "performance_score": round(performance * 100),
            "fcp": metric("first-contentful-paint"),
            "lcp": metric("largest-contentful-paint"),
            "cls": metric("cumulative-layout-shift"),
            "cls_diagnostics": cls_diagnostics(),
            "tbt": metric("total-blocking-time"),
            "speed_index": metric("speed-index"),
            "raw_data": report,
        }
