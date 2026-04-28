"""Fast scanner over the raw Jira + Asana task exports.

Walks ``raw/**/*.md`` and reads each file's YAML frontmatter only (stops
at the closing ``---``) so we avoid loading full bodies for thousands
of tickets. Yields normalized :class:`RawTask` records regardless of
whether the source is Jira or Asana.

Used by :class:`~services.migration_dashboard_service.MigrationDashboardService`
to compute production-failure lists, new-bug lists, and task-status
histograms for the Launch Command Center dashboard.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Dict, Iterable, Iterator, List, Optional

from .vault_parser import split_frontmatter
from .vault_reader import VaultReader


logger = logging.getLogger(__name__)


# Directories under raw/ to skip — attachments, sync state, etc.
_SKIP_DIR_NAMES = frozenset({"_attachments", "assets", "__pycache__"})

# Statuses that mean the ticket is done (for per-source resolved counts).
_RESOLVED_JIRA_STATUSES = frozenset({
    "closed", "resolved", "done", "completed", "passed", "cancelled",
})
_RESOLVED_ASANA_STATUSES = frozenset({"completed"})


@dataclass
class RawTask:
    """Normalized view over a single raw task file.

    ``source`` is ``jira`` or ``asana``. ``project`` is the top-level folder
    under ``raw/`` (e.g. ``ACE2E`` or ``LAMPSPLUS``). Not every field has a
    value on every row — tests that compare by field should tolerate None.
    """

    key: str
    source: str
    project: str
    rel_path: str
    summary: Optional[str] = None
    task_type: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee: Optional[str] = None
    created: Optional[str] = None
    updated: Optional[str] = None
    resolved: Optional[str] = None
    task_status: Optional[str] = None  # Asana workflow state
    uat_status: Optional[str] = None   # Asana UAT state
    completion: Optional[str] = None
    jira_url: Optional[str] = None
    asana_url: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "source": self.source,
            "project": self.project,
            "relPath": self.rel_path,
            "summary": self.summary,
            "type": self.task_type,
            "status": self.status,
            "priority": self.priority,
            "assignee": self.assignee,
            "created": self.created,
            "updated": self.updated,
            "resolved": self.resolved,
            "taskStatus": self.task_status,
            "uatStatus": self.uat_status,
            "completion": self.completion,
            "url": self.jira_url or self.asana_url,
        }

    @property
    def effective_status(self) -> str:
        """Return the most specific status available for this task."""
        return self.status or self.task_status or ""

    @property
    def is_resolved(self) -> bool:
        status = self.effective_status.lower()
        if self.source == "jira":
            return status in _RESOLVED_JIRA_STATUSES
        if self.source == "asana":
            return status in _RESOLVED_ASANA_STATUSES
        return False

    @property
    def is_production_failure(self) -> bool:
        """True if this task is in a 'UAT Failed - Production'-style state."""
        for candidate in (self.status, self.task_status, self.uat_status):
            if candidate and _matches_production_failure(candidate):
                return True
        return False

    @property
    def is_new_bug(self) -> bool:
        """True if this ticket was filed as a Bug (Jira or Asana type)."""
        return (self.task_type or "").lower() == "bug"

    @property
    def created_date(self) -> Optional[date]:
        return _parse_iso_date(self.created)


# ── Scanner ────────────────────────────────────────────────────────────


class RawTaskScanner:
    """Walks the raw/ tree and yields RawTask records.

    Construction-time ``vault_root`` is stored; ``iter_tasks`` re-walks on
    every call so callers control caching. The service layer wraps this
    with a TTL cache to avoid re-reading thousands of files per request.
    """

    def __init__(self, vault: VaultReader) -> None:
        self._vault = vault

    def iter_tasks(self) -> Iterator[RawTask]:
        raw_root = self._vault.root / "raw"
        if not raw_root.is_dir():
            return

        for path in _walk_markdown(raw_root):
            task = self._parse_task(path, raw_root)
            if task is not None:
                yield task

    def _parse_task(self, path: Path, raw_root: Path) -> Optional[RawTask]:
        try:
            with path.open("r", encoding="utf-8", errors="replace") as handle:
                head = _read_frontmatter_block(handle)
        except OSError as exc:
            logger.debug("Failed to open %s: %s", path, exc)
            return None

        if head is None:
            return None
        fm, _ = split_frontmatter(head)
        if not fm:
            return None

        rel_from_raw = path.relative_to(raw_root).as_posix()
        rel = path.relative_to(self._vault.root).as_posix()
        parts = rel_from_raw.split("/", 2)
        project = parts[0] if parts else ""
        source = "asana" if project == "asana" else "jira"
        if source == "asana" and len(parts) >= 2:
            project = parts[1]  # asana/LAMPSPLUS/... → LAMPSPLUS

        stem = path.stem
        key = _str(fm.get("key"))
        if not key:
            # Fall back to filename stem, which Jira/Asana exporters
            # typically prefix with the key.
            key = stem.split(" ", 1)[0]

        # Exporters split the title after " - " in the filename. Use that
        # as a summary fallback when the frontmatter doesn't carry one.
        summary = _str(fm.get("summary"))
        if not summary and " - " in stem:
            summary = stem.split(" - ", 1)[1].strip()

        return RawTask(
            key=key,
            source=source,
            project=project,
            rel_path=rel,
            summary=summary,
            task_type=_str(fm.get("type")),
            status=_str(fm.get("status")),
            priority=_str(fm.get("priority") or fm.get("task_priority")),
            assignee=_str(fm.get("assignee")),
            created=_str(fm.get("created")),
            updated=_str(fm.get("updated") or fm.get("modified")),
            resolved=_str(fm.get("resolved")),
            task_status=_str(fm.get("task_status")),
            uat_status=_str(fm.get("uat_status")),
            completion=_str(fm.get("completion")),
            jira_url=_str(fm.get("jira_url")),
            asana_url=_str(fm.get("asana_url")),
        )


# ── Aggregations ───────────────────────────────────────────────────────


def production_failures(tasks: Iterable[RawTask]) -> List[RawTask]:
    """Return tasks currently in a UAT-Failed-Production-style state."""
    return [t for t in tasks if t.is_production_failure and not t.is_resolved]


def new_bugs(tasks: Iterable[RawTask], *, window_days: int = 14, today: Optional[date] = None) -> List[RawTask]:
    """Return bugs filed within the last ``window_days`` that remain open."""
    cutoff = (today or date.today()) - timedelta(days=window_days)
    out: List[RawTask] = []
    for task in tasks:
        if not task.is_new_bug or task.is_resolved:
            continue
        created = task.created_date
        if created is None or created < cutoff:
            continue
        out.append(task)
    # Newest first
    out.sort(key=lambda t: t.created_date or date.min, reverse=True)
    return out


def status_histogram(tasks: Iterable[RawTask], *, project: Optional[str] = None) -> Dict[str, int]:
    """Count tasks per status, optionally filtered to one project."""
    counts: Dict[str, int] = {}
    for task in tasks:
        if project is not None and task.project != project:
            continue
        status = task.effective_status
        if not status:
            continue
        counts[status] = counts.get(status, 0) + 1
    return dict(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])))


def source_counts(tasks: Iterable[RawTask]) -> Dict[str, Dict[str, int]]:
    """Return ``{project: {total, resolved, active}}`` rollups."""
    buckets: Dict[str, Dict[str, int]] = {}
    for task in tasks:
        bucket = buckets.setdefault(task.project, {"total": 0, "resolved": 0, "active": 0})
        bucket["total"] += 1
        if task.is_resolved:
            bucket["resolved"] += 1
        else:
            bucket["active"] += 1
    return buckets


# ── File-walking helpers ───────────────────────────────────────────────


def _walk_markdown(root: Path) -> Iterator[Path]:
    """Yield every .md file under ``root`` that isn't in a skipped dir."""
    stack: List[Path] = [root]
    while stack:
        current = stack.pop()
        try:
            for entry in current.iterdir():
                name = entry.name
                if name.startswith(".") or name in _SKIP_DIR_NAMES:
                    continue
                if entry.is_dir():
                    stack.append(entry)
                elif entry.suffix.lower() == ".md":
                    yield entry
        except (PermissionError, OSError) as exc:
            logger.debug("Skipping %s: %s", current, exc)


def _read_frontmatter_block(handle) -> Optional[str]:
    """Read just the YAML frontmatter block from an already-open file.

    Returns the frontmatter with its delimiters re-joined (so split_frontmatter
    can parse it the same way it parses full file bodies), or None if the file
    doesn't start with ``---``.
    """
    first = handle.readline()
    if not first.startswith("---"):
        return None
    lines = [first]
    for _ in range(200):  # hard cap so a malformed file doesn't drain memory
        line = handle.readline()
        if not line:
            return None
        lines.append(line)
        if line.startswith("---"):
            lines.append("\n")
            return "".join(lines)
    return None


# ── Small utilities ────────────────────────────────────────────────────


_ISO_DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})")


def _parse_iso_date(value: Optional[str]) -> Optional[date]:
    if not value:
        return None
    match = _ISO_DATE_RE.match(value)
    if not match:
        return None
    try:
        return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
    except ValueError:
        return None


def _matches_production_failure(status: str) -> bool:
    lowered = status.lower()
    return "failed" in lowered and ("production" in lowered or "prod" in lowered)


def _str(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return str(value)
