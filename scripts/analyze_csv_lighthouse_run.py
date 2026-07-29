#!/usr/bin/env python3
"""Diagnose a CSV Lighthouse run: verify cache-busting worked and measure throughput.

Fetches the run's CSV export from the API and reports the health signals that
tell you whether cache-busting is doing its job and where the wall-clock time
went. Use it after every run to confirm the tuning is working.

Usage:
    python scripts/analyze_csv_lighthouse_run.py <run_id>
    python scripts/analyze_csv_lighthouse_run.py 44 --base https://pagespeed-production.up.railway.app
"""

from __future__ import annotations

import argparse
import csv
import io
import statistics
import urllib.request
from datetime import datetime
from email.utils import parsedate_to_datetime

DEFAULT_BASE = "https://pagespeed-production.up.railway.app"


def fetch_export(base: str, run_id: int) -> list[dict]:
    url = f"{base.rstrip('/')}/api/csv-lighthouse/runs/{run_id}/export"
    with urllib.request.urlopen(url, timeout=60) as resp:
        text = resp.read().decode("utf-8")
    return list(csv.DictReader(io.StringIO(text)))


def _parse_time(value: str) -> datetime | None:
    if not value:
        return None
    try:
        return parsedate_to_datetime(value)
    except (TypeError, ValueError):
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None


def analyze(rows: list[dict]) -> None:
    samples = [r for r in rows if r.get("kind") == "sample"]
    passed = [r for r in samples if r.get("status") == "passed"]
    failed = [r for r in samples if r.get("status") != "passed"]
    fail_by_status: dict[str, int] = {}
    for r in failed:
        fail_by_status[r.get("status", "?")] = fail_by_status.get(r.get("status", "?"), 0) + 1

    # Cache-busting health: any repeated metric tuple within a URL is a cache dupe.
    by_url: dict[str, list[dict]] = {}
    for r in passed:
        by_url.setdefault(r["generated_url"], []).append(r)
    dup_urls = 0
    for group in by_url.values():
        tuples = {
            (r["fcp"], r["lcp"], r["speed_index"], r["tbt"], r["cls"]) for r in group
        }
        if len(tuples) < len(group):
            dup_urls += 1

    attempts = sum(int(r["attempts"] or 0) for r in passed)
    durations = sorted(float(r["duration_ms"] or 0) / 1000 for r in passed)

    times = sorted(t for t in (_parse_time(r["completed_at"]) for r in passed) if t)
    span_min = (times[-1] - times[0]).total_seconds() / 60 if len(times) > 1 else 0

    print(f"URLs (items):            {len(by_url)}")
    print(f"Passed samples:          {len(passed)}")
    breakdown = "  ".join(f"{k}={v}" for k, v in sorted(fail_by_status.items())) or "none"
    print(f"Failed attempts:         {len(failed)}   ({breakdown})")
    print(f"Cache-bust dupe URLs:    {dup_urls} / {len(by_url)}   "
          f"({'PASS' if dup_urls == 0 else 'WARN — caching not defeated'})")
    print(f"Attempts vs valid:       {attempts} vs {len(passed)}   "
          f"({'PASS' if attempts == len(passed) else 'WARN — wasted retries'})")
    if durations:
        print(f"PSI latency/call:        avg={statistics.mean(durations):.1f}s  "
              f"median={statistics.median(durations):.1f}s  "
              f"min={durations[0]:.1f}s  max={durations[-1]:.1f}s")
    if span_min:
        print(f"Wall-clock span:         {span_min:.1f} min")
        print(f"Throughput:              {len(passed) / span_min:.2f} samples/min")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("run_id", type=int)
    parser.add_argument("--base", default=DEFAULT_BASE)
    args = parser.parse_args()
    analyze(fetch_export(args.base, args.run_id))


if __name__ == "__main__":
    main()
