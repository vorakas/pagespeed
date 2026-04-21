"""Assemble the Launch Command Center dashboard response payloads.

Single Responsibility: take the raw parsers (`vault_parser`, `raw_scanner`)
and compose them into the exact JSON shapes the Launch Command Center
React page expects. Each public method maps 1:1 to one dashboard API
endpoint.

Caching: vault reads are cheap; the full raw-task scan is the expensive
step (~6k files, ~3s). Everything is cached in-process with a short TTL
so a dashboard render doesn't re-read the disk on every polling tick.
"""

from __future__ import annotations

import logging
import re
import threading
import time
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple, TypeVar

from services.obsidian_sync.raw_scanner import (
    RawTask,
    RawTaskScanner,
    new_bugs,
    production_failures,
    source_counts,
    status_histogram,
)
from services.obsidian_sync.vault_parser import (
    Blocker,
    Source,
    StatusSnapshot,
    Team,
    Workstream,
    archived_status_snapshots,
    latest_status_snapshot,
    list_blockers,
    list_sources,
    list_teams,
    list_workstreams,
    parse_workstream_page,
)
from services.obsidian_sync.vault_reader import VaultReader


logger = logging.getLogger(__name__)

T = TypeVar("T")


# Jira projects whose status histogram drives the ACE2E status strip.
_ACE2E_PROJECT_KEY = "ACE2E"

# Colors the frontend expects in the task-status strip — same mapping as
# the design fixture. Unknown statuses fall back to "neutral".
_STATUS_COLOR_MAP: Dict[str, str] = {
    "closed": "green",
    "resolved": "green",
    "done": "green",
    "passed": "green",
    "completed": "green",
    "failed qa": "red",
    "uat failed - production": "red",
    "blocker": "red",
    "in progress": "blue",
    "qa on ppe in progress": "blue",
    "qa on ppe": "blue",
    "deployment - ppe": "blue",
    "on hold": "amber",
    "clarification needed": "amber",
    "evaluated": "amber",
    "evaluating": "amber",
    "new": "neutral",
    "open": "neutral",
    "groomed": "neutral",
    "cancelled": "neutral",
}

# Status buckets normalized to the fixture's coarse grouping (done / in
# progress / blocked / backlog). Used by get_task_status_roundup.
_STATUS_GROUP_MAP: Dict[str, str] = {
    "closed": "done",
    "resolved": "done",
    "done": "done",
    "passed": "done",
    "completed": "done",
    "in progress": "inProgress",
    "qa on ppe in progress": "inProgress",
    "deployment - ppe": "inProgress",
    "failed qa": "blocked",
    "uat failed - production": "blocked",
    "blocker": "blocked",
    "on hold": "blocked",
    "cancelled": "backlog",
}


@dataclass
class _CacheEntry:
    stored_at: float
    value: Any


class MigrationDashboardService:
    """Orchestrates vault parsers into dashboard response payloads.

    Args:
        vault_root: Absolute path to the Obsidian vault root (the directory
            that contains ``wiki/`` and ``raw/``).
        cache_ttl_seconds: How long computed payloads are cached before a
            new vault read is triggered. 120s is a good default for a
            dashboard that polls every 30s.
    """

    def __init__(
        self,
        vault_root: str | Path,
        cache_ttl_seconds: int = 120,
    ) -> None:
        self._vault: VaultReader = VaultReader(str(vault_root))
        self._scanner: RawTaskScanner = RawTaskScanner(self._vault)
        self._cache_ttl: int = cache_ttl_seconds
        self._cache: Dict[str, _CacheEntry] = {}
        self._lock: threading.RLock = threading.RLock()

    # ── Top-level queries ────────────────────────────────────────────

    @property
    def vault_root(self) -> Path:
        return self._vault.root

    def is_available(self) -> bool:
        return self._vault.exists() and (self._vault.root / "wiki").is_dir()

    def invalidate_cache(self) -> None:
        """Drop all cached payloads. Call after a sync finishes."""
        with self._lock:
            self._cache.clear()

    def get_health(self) -> dict:
        return self._cached("health", self._compute_health)

    def get_kpis(self) -> dict:
        return self._cached("kpis", self._compute_kpis)

    def get_sources(self) -> List[dict]:
        return self._cached("sources", self._compute_sources)

    def get_workstreams(self) -> List[dict]:
        return self._cached("workstreams", self._compute_workstreams)

    def get_blockers(self) -> List[dict]:
        return self._cached("blockers", self._compute_blockers)

    def get_production_failures(self) -> List[dict]:
        return self._cached("prodFailures", self._compute_production_failures)

    def get_new_bugs(self, window_days: int = 7) -> List[dict]:
        return self._cached(f"newBugs:{window_days}", lambda: self._compute_new_bugs(window_days))

    def get_task_status(self) -> List[dict]:
        return self._cached("taskStatus", self._compute_task_status)

    def get_trend(self) -> List[dict]:
        return self._cached("trend", self._compute_trend)

    def get_teams(self) -> List[dict]:
        return self._cached("teams", self._compute_teams)

    def get_workstream_detail(self, workstream_id: str) -> Optional[dict]:
        key = f"ws:{workstream_id}"
        return self._cached(key, lambda: self._compute_workstream_detail(workstream_id))

    # ── Cache machinery ──────────────────────────────────────────────

    def _cached(self, key: str, factory: Callable[[], T]) -> T:
        now = time.time()
        with self._lock:
            entry = self._cache.get(key)
            if entry is not None and now - entry.stored_at < self._cache_ttl:
                return entry.value
        # Compute outside the lock so a long scan doesn't block other
        # endpoints.
        value = factory()
        with self._lock:
            self._cache[key] = _CacheEntry(stored_at=time.time(), value=value)
        return value

    def _raw_tasks(self) -> List[RawTask]:
        return self._cached("raw_tasks", lambda: list(self._scanner.iter_tasks()))

    def _latest_status(self) -> Optional[StatusSnapshot]:
        return self._cached("latest_status", lambda: latest_status_snapshot(self._vault))

    def _archived_statuses(self) -> List[StatusSnapshot]:
        return self._cached("archived_statuses", lambda: archived_status_snapshots(self._vault, limit=7))

    # ── Computations ─────────────────────────────────────────────────

    def _compute_health(self) -> dict:
        snap = self._latest_status()
        if snap is None:
            return {
                "overall": None,
                "launchWindow": None,
                "lastSynced": None,
                "headline": None,
                "reasons": [],
            }

        start, end = _extract_launch_window(snap.headline or "")
        reasons = _extract_reasons_from_headline(snap.headline or "")

        return {
            "overall": _normalize_health(snap.overall_health),
            "launchWindow": {"start": start, "end": end} if start else None,
            "lastSynced": self._status_file_mtime(snap.date),
            "headline": snap.headline,
            "reasons": reasons,
        }

    def _compute_kpis(self) -> dict:
        tasks = self._raw_tasks()
        counts = source_counts(tasks)
        total = sum(c["total"] for c in counts.values())
        resolved = sum(c["resolved"] for c in counts.values())
        active = sum(c["active"] for c in counts.values())
        pct = round((resolved / total) * 100) if total else 0

        prod = production_failures(tasks)
        today = date.today()
        bugs_24h = new_bugs(tasks, window_days=1, today=today)

        blockers = list_blockers(self._vault)
        open_blockers = [b for b in blockers if (b.status or "").lower() == "open"]
        critical_blockers = [b for b in open_blockers if (b.severity or "").lower() == "critical"]

        ace2e = [t for t in tasks if t.project == _ACE2E_PROJECT_KEY]
        non_cancelled = [t for t in ace2e if (t.effective_status or "").lower() != "cancelled"]
        unassigned = [t for t in non_cancelled if not t.assignee or t.assignee.lower() == "unassigned"]
        unassigned_rate = round((len(unassigned) / len(non_cancelled)) * 100) if non_cancelled else 0

        failed_qa = sum(1 for t in ace2e if (t.status or "").lower() == "failed qa")

        return {
            "combinedUnique": total,
            "combinedResolved": resolved,
            "combinedActive": active,
            "resolvedPct": pct,
            "productionFailures": len(prod),
            "openBlockers": len(open_blockers),
            "criticalBlockers": len(critical_blockers),
            "newBugs24h": len(bugs_24h),
            "unassignedRate": unassigned_rate,
            "failedQa": failed_qa,
        }

    def _compute_sources(self) -> List[dict]:
        tasks = self._raw_tasks()
        live_counts = source_counts(tasks)
        sources: List[Source] = list_sources(self._vault)

        out: List[dict] = []
        for src in sources:
            live = live_counts.get(src.key)
            if live:
                src.total = live["total"]
                src.resolved = live["resolved"]
                src.active = live["active"]
                src.pct = round((live["resolved"] / live["total"]) * 100) if live["total"] else 0
            out.append(src.to_dict())

        # Add any projects discovered in raw/ that don't have a source-*.md page
        seen = {s["key"] for s in out}
        for project, rollup in live_counts.items():
            if project in seen:
                continue
            out.append({
                "key": project,
                "kind": "asana" if project in {"LAMPSPLUS", "LPWE"} else "jira",
                "name": project,
                "total": rollup["total"],
                "resolved": rollup["resolved"],
                "active": rollup["active"],
                "pct": round((rollup["resolved"] / rollup["total"]) * 100) if rollup["total"] else 0,
            })
        return sorted(out, key=lambda r: -r["total"])

    def _compute_workstreams(self) -> List[dict]:
        streams = list_workstreams(self._vault)
        blockers = list_blockers(self._vault)

        # Reverse-lookup: blocker-id → list of workstreams it affects
        blockers_by_ws: Dict[str, List[str]] = {}
        for b in blockers:
            for ws in b.affects:
                blockers_by_ws.setdefault(ws, []).append(b.id)

        snap = self._latest_status()
        area_map = snap.area_for_workstream if snap else {}
        status_overlay = snap.workstream_statuses if snap else {}
        notes_overlay = snap.notes_for_workstream if snap else {}

        out: List[dict] = []
        for ws in streams:
            ws.blockers = list(blockers_by_ws.get(ws.id, []))
            if ws.area is None and ws.id in area_map:
                ws.area = area_map[ws.id]
            # Prefer the status chip on the most recent status page when
            # available (it reflects the latest editorial read; frontmatter
            # sometimes lags a ingest cycle).
            if ws.id in status_overlay:
                ws.status = _normalize_health(status_overlay[ws.id])
            if ws.id in notes_overlay:
                ws.note = notes_overlay[ws.id]
            out.append(ws.to_dict())
        return out

    def _compute_blockers(self) -> List[dict]:
        return [b.to_dict() for b in list_blockers(self._vault)]

    def _compute_production_failures(self) -> List[dict]:
        return [t.to_dict() for t in production_failures(self._raw_tasks())]

    def _compute_new_bugs(self, window_days: int) -> List[dict]:
        return [t.to_dict() for t in new_bugs(self._raw_tasks(), window_days=window_days)]

    def _compute_task_status(self) -> List[dict]:
        hist = status_histogram(self._raw_tasks(), project=_ACE2E_PROJECT_KEY)
        return [
            {
                "status": status,
                "count": count,
                "color": _STATUS_COLOR_MAP.get(status.lower(), "neutral"),
                "group": _STATUS_GROUP_MAP.get(status.lower(), "backlog"),
            }
            for status, count in hist.items()
        ]

    def _compute_trend(self) -> List[dict]:
        snapshots = self._archived_statuses()
        current = self._latest_status()
        if current is not None:
            # de-dupe in case the latest is also archived
            if not any(s.date == current.date for s in snapshots):
                snapshots = [*snapshots, current]

        out: List[dict] = []
        for snap in snapshots:
            rel = f"wiki/archive/status-{snap.date}.md"
            body = self._read_status_body(rel) or self._read_status_body(f"wiki/status-{snap.date}.md")
            totals = _extract_combined_totals(body or "")
            out.append({
                "date": snap.date,
                "overallHealth": _normalize_health(snap.overall_health),
                "resolved": totals.get("resolved"),
                "active": totals.get("active"),
                "total": totals.get("total"),
            })
        return out

    def _compute_teams(self) -> List[dict]:
        teams: List[Team] = list_teams(self._vault)
        tasks = self._raw_tasks()

        out: List[dict] = []
        for team in teams:
            project_tasks = [t for t in tasks if t.project == (team.project or "").upper()]
            payload = team.to_dict()
            if project_tasks:
                total = len(project_tasks)
                assigned = sum(
                    1 for t in project_tasks
                    if t.assignee and t.assignee.lower() != "unassigned"
                )
                payload.update({
                    "totalTasks": total,
                    "assignedTasks": assigned,
                    "unassignedRate": round(((total - assigned) / total) * 100) if total else 0,
                })
            out.append(payload)
        return out

    def _compute_workstream_detail(self, workstream_id: str) -> Optional[dict]:
        rel = f"wiki/{workstream_id}.md"
        ws = parse_workstream_page(self._vault, rel)
        if ws is None:
            return None

        # Pull task keys directly from the workstream body's wikilinks —
        # this is what the LLM curator put there as the "tasks belonging to
        # this workstream". Keeps the detail faithful to the wiki instead of
        # guessing based on project prefixes.
        page = self._vault.read_page(rel)
        referenced_keys = _extract_task_keys(page["body"])

        tasks = self._raw_tasks()
        by_key = {t.key: t for t in tasks}
        relevant: List[RawTask] = []
        for key in referenced_keys:
            task = by_key.get(key)
            if task is None or task.is_resolved:
                continue
            relevant.append(task)

        # Rank: production failures first, then by priority, then by recency.
        priority_weight = {"blocker": 0, "critical": 1, "high": 2, "medium": 3, "low": 4}
        relevant.sort(key=lambda t: (
            0 if t.is_production_failure else 1,
            priority_weight.get((t.priority or "").lower(), 9),
            -_date_sort_key(t.updated),
        ))

        blockers = [b for b in list_blockers(self._vault) if workstream_id in b.affects]

        return {
            "workstream": ws.to_dict(),
            "blockers": [b.to_dict() for b in blockers],
            "criticalTasks": [t.to_dict() for t in relevant[:12]],
            "referencedKeyCount": len(referenced_keys),
        }

    # ── Helpers ──────────────────────────────────────────────────────

    def _status_file_mtime(self, date_str: str) -> Optional[str]:
        for rel in (f"wiki/status-{date_str}.md", f"wiki/archive/status-{date_str}.md"):
            path = self._vault.root / rel
            if path.is_file():
                return datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc).isoformat()
        return None

    def _read_status_body(self, rel_path: str) -> Optional[str]:
        path = self._vault.root / rel_path
        if not path.is_file():
            return None
        try:
            return path.read_text(encoding="utf-8", errors="replace")
        except OSError:
            return None


# ── Free helpers ──────────────────────────────────────────────────────


_LAUNCH_WINDOW_RE = re.compile(
    r"Launch window is\s+\*?\*?([A-Za-z]{3,9}\s+\d{1,2})[–—-](\d{1,2}),\s*(\d{4})",
    re.IGNORECASE,
)


def _extract_launch_window(headline: str) -> Tuple[Optional[str], Optional[str]]:
    """Pull ISO launch-window dates from a status-page headline."""
    match = _LAUNCH_WINDOW_RE.search(headline)
    if not match:
        return None, None
    try:
        start = datetime.strptime(f"{match.group(1)} {match.group(3)}", "%b %d %Y").date()
    except ValueError:
        try:
            start = datetime.strptime(f"{match.group(1)} {match.group(3)}", "%B %d %Y").date()
        except ValueError:
            return None, None
    try:
        # End date shares month/year with start.
        end = start.replace(day=int(match.group(2)))
    except ValueError:
        return start.isoformat(), None
    return start.isoformat(), end.isoformat()


def _extract_reasons_from_headline(headline: str) -> List[str]:
    """Split a status-page headline paragraph into discrete bullet-style reasons."""
    if not headline:
        return []
    # Status-page headlines are prose. Split on sentence-ending punctuation.
    sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\[])", headline)
    reasons: List[str] = []
    for sentence in sentences:
        text = sentence.strip()
        if not text:
            continue
        # Drop the launch-window sentence — we surface it separately.
        if "launch window" in text.lower():
            continue
        reasons.append(text)
    return reasons[:6]  # cap so the UI doesn't get a wall of text


_SOURCE_TOTAL_RE = re.compile(
    r"\|\s*\*\*Combined unique\*\*\s*\|\s*\*\*~?([\d,]+)\*\*\s*\|\s*\*\*~?([\d,]+)\*\*\s*\|\s*\*\*~?([\d,]+)\*\*",
    re.IGNORECASE,
)


def _extract_combined_totals(body: str) -> Dict[str, Optional[int]]:
    """Pull total/resolved/active from a status page's Source Coverage table."""
    match = _SOURCE_TOTAL_RE.search(body)
    if not match:
        return {"total": None, "resolved": None, "active": None}
    return {
        "total": int(match.group(1).replace(",", "")),
        "resolved": int(match.group(2).replace(",", "")),
        "active": int(match.group(3).replace(",", "")),
    }


_HEALTH_NORMAL_MAP: Dict[str, str] = {
    "at risk": "at-risk",
    "at-risk": "at-risk",
    "blocked": "blocked",
    "critical": "at-risk",
    "in progress": "in-progress",
    "in-progress": "in-progress",
    "near complete": "near-complete",
    "near-complete": "near-complete",
    "progressing": "in-progress",
    "improving": "improving",
    "groomed": "groomed",
    "not started": "groomed",
    "not-started": "groomed",
    "complete": "near-complete",
}


def _normalize_health(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return _HEALTH_NORMAL_MAP.get(value.strip().lower(), value.strip().lower())


_TASK_KEY_RE = re.compile(r"\[\[([A-Z][A-Z0-9]+-\d+|\d{5,})")


def _extract_task_keys(body: str) -> List[str]:
    """Pull unique task IDs from a workstream body's wikilinks.

    Accepts two shapes the vault uses:
    - Project keys: ``[[ACE2E-242 - Title|ACE2E-242]]``
    - Legacy numeric IDs (WPM tracker): ``[[873346 - Title|873346]]``
    """
    seen: Dict[str, None] = {}
    for match in _TASK_KEY_RE.finditer(body):
        seen.setdefault(match.group(1), None)
    return list(seen.keys())


def _date_sort_key(value: Optional[str]) -> int:
    """Turn an ISO-ish date/datetime into a sortable integer; None → 0."""
    if not value:
        return 0
    try:
        return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp())
    except ValueError:
        try:
            return int(datetime.strptime(value[:10], "%Y-%m-%d").timestamp())
        except ValueError:
            return 0
