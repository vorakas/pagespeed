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
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple, TypeVar

from services.obsidian_sync.raw_scanner import (
    RawTask,
    RawTaskScanner,
    daily_activity,
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
from services.obsidian_sync.workstream_md_parser import parse_workstream_markdown


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

    def get_daily_activity(self, on_date: date) -> dict:
        """Return tickets created and resolved on ``on_date``.

        Sourced from per-ticket ``created`` / ``resolved`` ISO date strings
        in the raw frontmatter — so the result is always in sync with what
        Jira/Asana actually have, regardless of whether the orchestrator's
        daily status file populated its summary sections. Callers are
        expected to pass a ``date`` already resolved in the user's
        reporting timezone (typically Pacific) so the day boundary lines
        up with the wall clock.
        """
        cache_key = f"dailyActivity:{on_date.isoformat()}"
        return self._cached(cache_key, lambda: self._compute_daily_activity(on_date))

    def get_task_detail(self, rel_path: str) -> dict:
        """Return one raw ticket's full record — frontmatter + body markdown.

        Used by the per-project ticket drawer: clicking the key on a row
        expands inline detail instead of jumping to Jira. Reads through
        :class:`VaultReader.read_page` so path validation (no ``..``,
        within vault root, supported extension) is enforced consistently
        with every other vault read endpoint.

        Output shape mirrors what the frontend already expects from the
        task dicts in :meth:`get_project_tasks`, plus a ``body`` field
        carrying the markdown after the frontmatter so the drawer can
        render the description / acceptance criteria / etc.
        """
        page = self._vault.read_page(rel_path)
        fm = page.get("frontmatter") or {}
        body = page.get("body") or ""
        return {
            "relPath": page.get("path"),
            "name": page.get("name"),
            "frontmatter": fm,
            "body": body,
            "size": page.get("size"),
            "modified": page.get("modified"),
        }

    def get_project_tasks(self, project_key: str) -> dict:
        """Return all raw tickets for a single project plus a status histogram.

        Used by the per-project dashboard page. The ``project`` field on
        each ``RawTask`` matches its top-level folder under ``raw/``
        (e.g. ``ACE2E``, ``WPM``, ``LAMPSPLUS``); the ``asana`` source
        flattens its sub-projects up so e.g. ``raw/asana/LAMPSPLUS/...``
        becomes project=``LAMPSPLUS``.

        Output shape:
            {
              "project": "ACE2E",
              "total": 412,
              "active": 187,
              "resolved": 225,
              "statusCounts": [{"status": "Open", "count": 132}, ...],
              "tasks": [<all task dicts, newest-updated first>],
            }
        """
        cache_key = f"projectTasks:{project_key}"
        return self._cached(
            cache_key, lambda: self._compute_project_tasks(project_key)
        )

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
        return self._cached("raw_tasks", self._compute_raw_tasks)

    def _compute_raw_tasks(self) -> List[RawTask]:
        """Walk ``raw/`` and deduplicate by ticket key.

        The Jira sync currently writes a brand-new file when a ticket is
        renamed instead of replacing the old one (see
        ``session_state.md`` — "Sync script creates a new file on rename
        instead of updating the existing one"). So one ticket key can
        end up with multiple frontmatter files on disk, and every
        downstream caller — KPIs, daily activity, project pages, status
        histograms — would double-count.

        We keep one canonical record per key, picking the
        lexicographically-smallest ``rel_path``. That's stable across
        runs (no dependency on file mtime), tolerable when the duplicate
        files have the same ticket data (the common case for whitespace-
        only filename drift), and the user-visible effect is that
        ``ACE2E-329`` etc. now each appear exactly once.

        Records with no key (e.g. "Map of Content" docs) pass through
        untouched; deduping on an empty key would collapse them all.
        """
        by_key: Dict[str, RawTask] = {}
        no_key: List[RawTask] = []
        for task in self._scanner.iter_tasks():
            if not task.key:
                no_key.append(task)
                continue
            existing = by_key.get(task.key)
            if existing is None or task.rel_path < existing.rel_path:
                by_key[task.key] = task
        return list(by_key.values()) + no_key

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
        tasks = self._raw_tasks()
        by_key = {t.key: t for t in tasks}

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
            try:
                page = self._vault.read_page(f"wiki/{ws.id}.md")
                referenced = [
                    by_key[key]
                    for key in _extract_task_keys(page["body"])
                    if key in by_key
                ]
                if referenced:
                    _apply_live_workstream_counts(ws, referenced)
            except Exception:
                logger.exception("Failed to overlay live workstream summary for %s", ws.id)
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

    def _compute_daily_activity(self, on_date: date) -> dict:
        activity = daily_activity(self._raw_tasks(), on_date=on_date)
        return {
            "date": on_date.isoformat(),
            "createdCount": len(activity["created"]),
            "resolvedCount": len(activity["resolved"]),
            "created": [t.to_dict() for t in activity["created"]],
            "resolved": [t.to_dict() for t in activity["resolved"]],
        }

    def _compute_project_tasks(self, project_key: str) -> dict:
        # Filter raw tasks to this project. Pre-collect into a list since
        # we walk it twice (histogram + serialization) and the iterator
        # would be exhausted after the first pass.
        tasks = [t for t in self._raw_tasks() if t.project == project_key]
        # Newest-updated first; tickets without an `updated` date sink to
        # the bottom rather than crashing on None comparisons.
        tasks.sort(key=lambda t: (t.updated or "", t.key), reverse=True)

        hist = status_histogram(tasks)
        status_counts = [
            {
                "status": status,
                "count": count,
                "color": _STATUS_COLOR_MAP.get(status.lower(), "neutral"),
                "group": _STATUS_GROUP_MAP.get(status.lower(), "backlog"),
            }
            for status, count in hist.items()
        ]

        active = sum(1 for t in tasks if not t.is_resolved)
        resolved = len(tasks) - active

        return {
            "project": project_key,
            "total": len(tasks),
            "active": active,
            "resolved": resolved,
            "statusCounts": status_counts,
            "tasks": [t.to_dict() for t in tasks],
        }

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
        referenced_tasks: List[RawTask] = []
        relevant: List[RawTask] = []
        for key in referenced_keys:
            task = by_key.get(key)
            if task is None:
                continue
            referenced_tasks.append(task)
            if task.is_resolved:
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
        live_blockers = _live_blockers([t for t in referenced_tasks if not t.is_resolved], workstream_id)
        if referenced_tasks:
            _apply_live_workstream_counts(ws, referenced_tasks)

        markdown_payload: Optional[dict] = None
        raw_path = self._vault.root / rel
        try:
            raw_text = raw_path.read_text(encoding="utf-8", errors="replace") if raw_path.is_file() else ""
            if raw_text:
                markdown_payload = parse_workstream_markdown(raw_text, workstream_id)
                if referenced_tasks:
                    markdown_payload = _overlay_live_workstream_sections(markdown_payload, referenced_tasks)
        except Exception:
            logger.exception("Workstream markdown parse failed for %s", workstream_id)

        return {
            "workstream": ws.to_dict(),
            "blockers": live_blockers or [b.to_dict() for b in blockers],
            "criticalTasks": [t.to_dict() for t in relevant[:12]],
            "referencedKeyCount": len(referenced_keys),
            "markdown": markdown_payload,
        }

    # ── Helpers ──────────────────────────────────────────────────────

    def _status_file_mtime(self, date_str: str) -> Optional[str]:
        """Most recent mtime across the status doc and the raw sync trees.

        The dashboard's "last synced" should reflect when the vault last
        received data from upstream — that's the sync writes under raw/,
        not the human-authored status doc. We take the max of all signals
        so an edit to the status doc still counts.
        """
        candidates: List[float] = []
        for rel in (
            f"wiki/status-{date_str}.md",
            f"wiki/archive/status-{date_str}.md",
            "raw/asana",
            "raw/jira",
            ".last_sync",
        ):
            path = self._vault.root / rel
            if path.exists():
                try:
                    candidates.append(path.stat().st_mtime)
                except OSError:
                    continue
        if not candidates:
            return None
        return datetime.fromtimestamp(max(candidates), tz=timezone.utc).isoformat()

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


def _overlay_live_workstream_sections(markdown: dict, tasks: List[RawTask]) -> dict:
    """Refresh task-count panels from raw task frontmatter.

    The workstream markdown still owns membership and curated context (task
    links, key epic links, scope, dependencies, decisions). Operational panels
    track the latest Jira/Asana sync even when orchestration leaves their prose
    unchanged.
    """
    active_tasks = [t for t in tasks if not t.is_resolved]
    latest_update = _latest_task_update(tasks)
    if latest_update:
        markdown.setdefault("meta", {})["lastUpdate"] = latest_update
    markdown["progress"] = _live_progress(tasks)
    markdown["active"] = _live_active(active_tasks)
    devs = _live_devs(active_tasks)
    markdown["devs"] = devs
    markdown["devObservations"] = _live_dev_observations(devs, active_tasks)
    markdown["keyRisks"] = _live_key_risks(active_tasks)
    markdown["epics"] = _live_epics(markdown.get("epics") or [], tasks)
    markdown["burndown"] = _live_burndown(tasks)
    markdown["velocity"] = _live_velocity(tasks, active_tasks, markdown.get("velocity") or {})
    return markdown


def _live_progress(tasks: List[RawTask]) -> dict:
    resolved = sum(1 for t in tasks if t.is_resolved)
    total = len(tasks)
    active_counts: Counter[str] = Counter(_active_bucket(t) for t in tasks if not t.is_resolved)
    bucket_defs = [
        ("done", "Closed", resolved, "green"),
        ("blocked", "Blocked", active_counts["blocked"], "red"),
        ("inProgress", "In Progress", active_counts["inProgress"], "blue"),
        ("onHold", "On Hold", active_counts["onHold"], "amber"),
        ("approvedReview", "Approved CR", active_counts["approvedReview"], "blue"),
        ("codeReview", "Code Review", active_counts["codeReview"], "blue"),
        ("openUnassigned", "Open / Unassigned", active_counts["openUnassigned"], "neutral"),
        ("evaluating", "Evaluating", active_counts["evaluating"], "amber"),
        ("evaluated", "Evaluated", active_counts["evaluated"], "amber"),
    ]
    buckets = [
        {"kind": kind, "label": label, "count": count, "tone": tone}
        for kind, label, count, tone in bucket_defs
        if count > 0
    ]
    completion = f"{round((resolved / total) * 100)}% closed" if total else None
    return {"total": total, "completion": completion, "buckets": buckets}


def _live_active(tasks: List[RawTask]) -> dict:
    buckets: Dict[str, List[dict]] = {
        "blocked": [],
        "inProgress": [],
        "onHold": [],
        "approvedReview": [],
        "codeReview": [],
        "openUnassigned": [],
        "evaluating": [],
        "evaluated": [],
    }
    for task in sorted(tasks, key=lambda t: -_date_sort_key(t.updated)):
        bucket = _active_bucket(task)
        buckets[bucket].append({
            "id": task.key,
            "title": task.summary or "(no title)",
            "assignee": task.assignee,
            "note": _active_note(task),
            "overdue": task.is_production_failure,
            "isNew": _is_recent(task.created, days=7),
        })
    return buckets


def _live_devs(tasks: List[RawTask]) -> List[dict]:
    counts: Dict[str, Dict[str, int]] = defaultdict(lambda: {
        "inProgress": 0,
        "codeReview": 0,
        "pipeline": 0,
        "backlog": 0,
        "total": 0,
    })
    for task in tasks:
        name = task.assignee or "Unassigned"
        bucket = counts[name]
        bucket["total"] += 1
        dev_bucket = _dev_bucket(task)
        bucket[dev_bucket] += 1

    rows = []
    for name, row in counts.items():
        rows.append({
            "name": name,
            "inProgress": row["inProgress"],
            "codeReview": row["codeReview"],
            "pipeline": row["pipeline"],
            "backlog": row["backlog"],
            "total": row["total"],
            "unassigned": name == "Unassigned",
        })
    rows.sort(key=lambda r: (-r["total"], r["name"].lower()))
    return rows


def _live_dev_observations(devs: List[dict], active_tasks: List[RawTask]) -> List[str]:
    if not devs:
        return []

    observations: List[str] = []
    heaviest = devs[0]
    parts = [f"{heaviest['name']} carries the heaviest active load ({heaviest['total']} tasks)"]
    detail_parts = []
    if heaviest["inProgress"]:
        detail_parts.append(f"{heaviest['inProgress']} in progress")
    if heaviest["codeReview"]:
        detail_parts.append(f"{heaviest['codeReview']} in code review")
    if heaviest["pipeline"]:
        detail_parts.append(f"{heaviest['pipeline']} in QA/deployment")
    if heaviest["backlog"]:
        detail_parts.append(f"{heaviest['backlog']} in blocked/backlog states")
    if detail_parts:
        parts.append("including " + ", ".join(detail_parts))
    observations.append("; ".join(parts) + ".")

    unassigned = next((row for row in devs if row["unassigned"]), None)
    if unassigned and unassigned["total"]:
        observations.append(f"Unassigned work remains visible ({unassigned['total']} active tasks).")

    blocked_count = sum(1 for task in active_tasks if _active_bucket(task) == "blocked")
    if blocked_count:
        label = "task is" if blocked_count == 1 else "tasks are"
        observations.append(f"{blocked_count} active {label} currently blocked or failing.")

    return observations


def _live_key_risks(active_tasks: List[RawTask]) -> List[dict]:
    risks: List[dict] = []
    blocked = [
        task for task in active_tasks
        if _active_bucket(task) == "blocked" or task.is_production_failure
    ]
    blocked.sort(key=lambda t: (_severity_rank(_task_severity(t)), -_date_sort_key(t.updated), t.key))
    if blocked:
        risks.append({
            "tone": "red" if any(task.is_production_failure for task in blocked) else "amber",
            "text": _risk_sentence(
                f"{len(blocked)} active task{' is' if len(blocked) == 1 else 's are'} blocked or failing",
                blocked,
            ),
            "source": "live",
        })

    high_priority = [
        task for task in active_tasks
        if (task.priority or "").strip().lower() in {"blocker", "critical", "high"}
        and task not in blocked
    ]
    high_priority.sort(key=lambda t: (_severity_rank(_task_severity(t)), -_date_sort_key(t.updated), t.key))
    if high_priority:
        risks.append({
            "tone": "amber",
            "text": _risk_sentence(
                f"{len(high_priority)} high-priority active task{' needs' if len(high_priority) == 1 else 's need'} attention",
                high_priority,
            ),
            "source": "live",
        })

    unassigned = [task for task in active_tasks if not task.assignee]
    if unassigned:
        unassigned.sort(key=lambda t: -_date_sort_key(t.updated))
        risks.append({
            "tone": "amber",
            "text": _risk_sentence(
                f"{len(unassigned)} active task{' is' if len(unassigned) == 1 else 's are'} unassigned",
                unassigned,
            ),
            "source": "live",
        })

    stale = [
        task for task in active_tasks
        if _days_since(task.updated) is not None and (_days_since(task.updated) or 0) >= 21
    ]
    if stale:
        stale.sort(key=lambda t: _date_sort_key(t.updated))
        risks.append({
            "tone": "amber",
            "text": _risk_sentence(
                f"{len(stale)} active task{' has' if len(stale) == 1 else 's have'} not moved in 21+ days",
                stale,
            ),
            "source": "live",
        })

    if not risks:
        risks.append({
            "tone": "green",
            "text": "No live blocker, high-priority, unassigned, or stale-task risk detected from current raw task data.",
            "source": "live",
        })
    return risks[:4]


def _live_epics(epics: List[dict], tasks: List[RawTask]) -> List[dict]:
    by_key = {task.key: task for task in tasks}
    out = []
    for epic in epics:
        task = by_key.get(str(epic.get("id", "")))
        if task is None:
            out.append({**epic, "live": False})
            continue
        out.append({
            **epic,
            "title": task.summary or epic.get("title") or task.key,
            "status": _status_label(task),
            "assignee": task.assignee,
            "updated": task.updated[:10] if task.updated else None,
            "live": True,
        })
    return out


def _risk_sentence(prefix: str, tasks: List[RawTask]) -> str:
    examples = ", ".join(
        f"{task.key} ({_status_label(task)})"
        for task in tasks[:3]
    )
    suffix = f": {examples}" if examples else "."
    if examples and len(tasks) > 3:
        suffix += f", plus {len(tasks) - 3} more."
    elif examples:
        suffix += "."
    return prefix + suffix


def _days_since(value: Optional[str]) -> Optional[int]:
    parsed = _parse_date(value)
    if parsed is None:
        return None
    return (date.today() - parsed).days


def _live_blockers(tasks: List[RawTask], workstream_id: str) -> List[dict]:
    blockers = [
        task for task in tasks
        if _active_bucket(task) == "blocked" or task.is_production_failure
    ]
    blockers.sort(key=lambda t: (
        _severity_rank(_task_severity(t)),
        -_date_sort_key(t.updated),
        t.key,
    ))
    return [{
        "id": task.key,
        "name": task.summary or "(no title)",
        "status": _status_label(task),
        "severity": _task_severity(task),
        "affects": [workstream_id],
        "note": _active_note(task),
        "relPath": task.rel_path,
    } for task in blockers[:12]]


def _apply_live_workstream_counts(ws: Workstream, tasks: List[RawTask]) -> None:
    """Overlay summary counts from the same referenced raw tasks as detail."""
    active_tasks = [task for task in tasks if not task.is_resolved]
    active_counts: Counter[str] = Counter(_active_bucket(task) for task in active_tasks)

    ws.tasks = len(tasks)
    ws.closed = len(tasks) - len(active_tasks)
    ws.in_progress = active_counts["inProgress"]
    ws.blocked_count = active_counts["blocked"]
    ws.failed_qa = sum(1 for task in active_tasks if _is_failed_qa(task))


def _is_failed_qa(task: RawTask) -> bool:
    for candidate in (task.status, task.task_status, task.uat_status):
        if candidate and "failed qa" in candidate.lower():
            return True
    return False


def _live_burndown(tasks: List[RawTask]) -> List[dict]:
    monthly: Counter[Tuple[int, int]] = Counter()
    for task in tasks:
        completed_at = _completion_date(task)
        if completed_at:
            monthly[(completed_at.year, completed_at.month)] += 1
    if not monthly:
        return []

    # Only dated closures can be placed on the time axis. Undated closed
    # tasks still count as complete elsewhere, but including them here would
    # make the final remaining point disagree with the current active scope.
    total = sum(1 for task in tasks if not task.is_resolved) + sum(monthly.values())
    out = []
    cumulative = 0
    today = date.today()
    for year, month in sorted(monthly):
        closed = monthly[(year, month)]
        cumulative += closed
        month_date = date(year, month, 1)
        out.append({
            "month": month_date.strftime("%b %Y"),
            "closed": closed,
            "cum": cumulative,
            "remaining": max(total - cumulative, 0),
            "partial": year == today.year and month == today.month,
        })
    return out


def _live_velocity(tasks: List[RawTask], active_tasks: List[RawTask], previous: dict) -> dict:
    monthly: Counter[Tuple[int, int]] = Counter()
    for task in tasks:
        completed_at = _completion_date(task)
        if completed_at:
            monthly[(completed_at.year, completed_at.month)] += 1

    today = date.today()
    complete_months = sorted(
        ((year, month), count)
        for (year, month), count in monthly.items()
        if (year, month) < (today.year, today.month)
    )
    recent_complete = [count for _, count in complete_months[-3:]]
    q1avg = round(sum(recent_complete) / len(recent_complete), 1) if recent_complete else previous.get("q1avg")
    current_month_closed = monthly.get((today.year, today.month), 0)
    mar_rate = round(current_month_closed / max(today.day / 7, 1), 1) if current_month_closed else 0

    projection = previous.get("projection")
    projection_note = previous.get("projectionNote")
    rate_basis = q1avg if isinstance(q1avg, (int, float)) and q1avg > 0 else None
    if active_tasks and rate_basis:
        monthly_rate = rate_basis
        if monthly_rate > 0:
            months_remaining = max(1, round(len(active_tasks) / monthly_rate))
            projection = f"~{months_remaining} mo"
            projection_note = "at 3-month close rate"

    return {
        "q1avg": q1avg,
        "marRate": mar_rate,
        "remaining": len(active_tasks),
        "projection": projection,
        "projectionNote": projection_note,
    }


def _status_label(task: RawTask) -> str:
    return (task.effective_status or "Open").strip() or "Open"


def _active_bucket(task: RawTask) -> str:
    status = " ".join(
        value.lower()
        for value in (task.status, task.task_status, task.uat_status)
        if value
    )
    if task.is_production_failure or "blocked" in status or "failed" in status:
        return "blocked"
    if "on hold" in status:
        return "onHold"
    if "approved code review" in status or "approved cr" in status:
        return "approvedReview"
    if "code review" in status:
        return "codeReview"
    if "evaluating" in status:
        return "evaluating"
    if "evaluated" in status:
        return "evaluated"
    if "clarification" in status:
        return "openUnassigned"
    if "groomed" in status or "open" in status or "new" in status:
        return "openUnassigned"
    if "deployment" in status or "ppe" in status or "test" in status:
        return "inProgress"
    if "progress" in status:
        return "inProgress"
    if not task.assignee:
        return "openUnassigned"
    return "openUnassigned"


def _dev_bucket(task: RawTask) -> str:
    active_bucket = _active_bucket(task)
    if active_bucket == "codeReview" or active_bucket == "approvedReview":
        return "codeReview"
    if active_bucket == "inProgress":
        status = " ".join(
            value.lower()
            for value in (task.status, task.task_status, task.uat_status)
            if value
        )
        return "pipeline" if "deployment" in status or "ppe" in status or "test" in status else "inProgress"
    return "backlog"


def _active_note(task: RawTask) -> Optional[str]:
    parts = []
    status = _status_label(task)
    if status:
        parts.append(status)
    if task.updated:
        parts.append(f"updated {task.updated[:10]}")
    return " · ".join(parts) if parts else None


def _task_severity(task: RawTask) -> str:
    priority = (task.priority or "").strip().lower()
    if priority in {"blocker", "critical", "high", "medium", "low"}:
        return "critical" if priority == "blocker" else priority
    if task.is_production_failure:
        return "critical"
    return "high" if _active_bucket(task) == "blocked" else "medium"


def _severity_rank(severity: str) -> int:
    return {"critical": 0, "high": 1, "medium": 2, "low": 3}.get(severity, 9)


def _latest_task_update(tasks: List[RawTask]) -> Optional[str]:
    candidates = [task.updated for task in tasks if task.updated]
    if not candidates:
        return None
    latest = max(candidates, key=_date_sort_key)
    return latest[:10]


def _completion_date(task: RawTask) -> Optional[date]:
    resolved_at = _parse_date(task.resolved)
    if resolved_at:
        return resolved_at
    if task.is_resolved:
        return _parse_date(task.updated)
    return None


def _is_recent(value: Optional[str], days: int) -> bool:
    parsed = _parse_date(value)
    if parsed is None:
        return False
    return (date.today() - parsed).days <= days


def _parse_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return datetime.strptime(value[:10], "%Y-%m-%d").date()
        except ValueError:
            return None


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
