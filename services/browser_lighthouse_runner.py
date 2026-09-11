"""Browser-session Lighthouse runner for CSV Lighthouse samples."""
from __future__ import annotations

import json
import os
import socket
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
            profile_path = Path(profile_dir)
            helper_path = self._write_helper_script(profile_path)
            command = self._command(
                warmup_url,
                audit_url,
                strategy,
                self._allocate_debug_port(),
                profile_path,
                helper_path,
            )
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
        remote_port: int,
        profile_dir: Path,
        helper_path: Path,
    ) -> list[str]:
        return [
            "node",
            str(helper_path),
            "--chrome-bin",
            self.chrome_bin,
            "--lighthouse-bin",
            self.lighthouse_bin,
            "--warmup-url",
            warmup_url,
            "--audit-url",
            audit_url,
            "--strategy",
            "mobile" if strategy == "mobile" else "desktop",
            "--user-data-dir",
            str(profile_dir),
            "--remote-debugging-port",
            str(remote_port),
        ]

    @staticmethod
    def _allocate_debug_port() -> int:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("", 0))
            return sock.getsockname()[1]

    @staticmethod
    def _node_helper_script() -> str:
        return """#!/usr/bin/env node
const { spawn, spawnSync } = require("node:child_process");
const { get } = require("node:http");

function argValue(args, key) {
  const token = `--${key}=`;
  for (let i = 0; i < args.length; i++) {
    const value = args[i];
    if (value === `--${key}` && i + 1 < args.length) {
      return args[i + 1];
    }
    if (value.startsWith(token)) {
      return value.slice(token.length);
    }
  }
  return "";
}

function waitForDebugger(port, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      get({
        host: "127.0.0.1",
        port,
        path: "/json/version",
      }, (res) => {
        if (res.statusCode === 200) {
          resolve();
          return;
        }
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Timed out waiting for Chrome debugger"));
          return;
        }
        res.resume();
        setTimeout(attempt, 200);
      }).on("error", () => {
        if (Date.now() - start > timeoutMs) {
          reject(new Error("Timed out waiting for Chrome debugger"));
          return;
        }
        setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}

function closeIfNeeded(processHandle) {
  if (!processHandle || processHandle.killed) {
    return;
  }
  try {
    processHandle.kill("SIGTERM");
  } catch (_error) {
    try {
      processHandle.kill("SIGKILL");
    } catch (_ignoredError) {}
  }
}

async function main() {
  const args = process.argv.slice(2);
  const chromeBin = argValue(args, "chrome-bin");
  const lighthouseBin = argValue(args, "lighthouse-bin");
  const warmupUrl = argValue(args, "warmup-url");
  const auditUrl = argValue(args, "audit-url");
  const strategy = argValue(args, "strategy") === "mobile" ? "mobile" : "desktop";
  const profileDir = argValue(args, "user-data-dir");
  const remotePort = parseInt(argValue(args, "remote-debugging-port"), 10) || 0;

  if (!chromeBin || !lighthouseBin || !warmupUrl || !auditUrl || !profileDir || !remotePort) {
    throw new Error("Missing required arguments for helper");
  }

  const formFactor = strategy;
  const screenEmulation =
    strategy === "mobile" ? "--screenEmulation.mobile=true" : "--screenEmulation.disabled=true";

  const chromeFlags = [
    `--remote-debugging-port=${remotePort}`,
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    `--user-data-dir=${profileDir}`,
  ];

  const chromeProcess = spawn(chromeBin, chromeFlags, { stdio: "ignore" });

  try {
    await waitForDebugger(remotePort);

    await new Promise((resolve, reject) => {
      get(
        `http://127.0.0.1:${remotePort}/json/new?url=${encodeURIComponent(warmupUrl)}`,
        (res) => {
          if (res.statusCode !== 200) {
            reject(new Error("Failed to open warmup URL"));
            return;
          }
          res.resume();
          resolve();
        }
      ).on("error", reject);
    });
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const result = spawnSync(
      lighthouseBin,
      [
        auditUrl,
        "--output=json",
        "--quiet",
        "--disable-storage-reset",
        `--form-factor=${formFactor}`,
        screenEmulation,
        `--port=${remotePort}`,
      ],
      { encoding: "utf8" },
    );

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      process.stderr.write(result.stderr || "lighthouse command failed");
      process.exit(result.status || 1);
    }
    process.stdout.write(result.stdout || "");
  } finally {
    closeIfNeeded(chromeProcess);
  }
}

main().catch((error) => {
  process.stderr.write(String(error?.message || error));
  process.exit(1);
});
"""

    def _write_helper_script(self, profile_dir: Path) -> Path:
        helper_path = profile_dir / "browser-lighthouse-runner-helper.js"
        helper_path.write_text(self._node_helper_script())
        return helper_path

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
