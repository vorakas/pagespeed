"""Domain parsers for the migration wiki.

Layered on top of :class:`~services.obsidian_sync.vault_reader.VaultReader`.
Each parser knows how to read a specific wiki page type into a typed
dataclass that matches the data contract the dashboard API exposes.

The parsers deliberately do not "invent" data. When a field isn't present
on disk (e.g. a blocker's severity, a workstream's functional area),
the parser returns None and lets callers decide whether to enrich
from a separate config.
"""

from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .vault_reader import VaultPathError, VaultReader


logger = logging.getLogger(__name__)


# ── Frontmatter ────────────────────────────────────────────────────────

_FRONTMATTER_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.DOTALL)
_YAML_KEY_RE = re.compile(r"^([A-Za-z0-9_]+):\s*(.*)$")
_WIKILINK_RE = re.compile(r"\[\[([^\]]+)\]\]")


def split_frontmatter(text: str) -> Tuple[Dict[str, Any], str]:
    """Split YAML-ish frontmatter from the markdown body.

    Supports scalar values (quoted or bare), JSON-style lists, booleans,
    null, integers, and floats. Unparseable values are kept as raw strings
    so nothing is silently lost.
    """
    match = _FRONTMATTER_RE.match(text)
    if not match:
        return {}, text

    frontmatter: Dict[str, Any] = {}
    for line in match.group(1).splitlines():
        line = line.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        m = _YAML_KEY_RE.match(line)
        if not m:
            continue
        key, value = m.group(1), m.group(2).strip()
        frontmatter[key] = _coerce_value(value)
    return frontmatter, text[match.end():]


def _coerce_value(raw: str) -> Any:
    if raw == "":
        return ""
    # JSON-like values (lists, objects, booleans, null, numbers)
    if raw[0] in "[{" or raw in {"true", "false", "null"}:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            pass
    # bare integer
    if re.fullmatch(r"-?\d+", raw):
        try:
            return int(raw)
        except ValueError:
            pass
    # quoted string
    if len(raw) >= 2 and raw[0] == raw[-1] and raw[0] in "\"'":
        return raw[1:-1]
    return raw


# ── Dataclasses (match the fixtures in api.js) ─────────────────────────


@dataclass
class Workstream:
    id: str
    name: str
    area: Optional[str]
    status: Optional[str]
    tasks: int = 0
    closed: int = 0
    failed_qa: int = 0
    in_progress: int = 0
    blocked_count: int = 0
    epics: List[str] = field(default_factory=list)
    blockers: List[str] = field(default_factory=list)
    note: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "area": self.area,
            "status": self.status,
            "tasks": self.tasks,
            "closed": self.closed,
            "failedQa": self.failed_qa,
            "inProgress": self.in_progress,
            "blockedCount": self.blocked_count,
            "epics": list(self.epics),
            "blockers": list(self.blockers),
            "note": self.note,
        }


@dataclass
class Blocker:
    id: str
    name: str
    status: str
    affects: List[str]
    severity: Optional[str] = None
    note: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status,
            "severity": self.severity,
            "affects": list(self.affects),
            "note": self.note,
        }


@dataclass
class Team:
    id: str
    name: str
    project: Optional[str] = None
    lead: Optional[str] = None
    qa_lead: Optional[str] = None
    dev_count: Optional[int] = None
    qa_count: Optional[int] = None
    note: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "project": self.project,
            "lead": self.lead,
            "qaLead": self.qa_lead,
            "devCount": self.dev_count,
            "qaCount": self.qa_count,
            "note": self.note,
        }


@dataclass
class Source:
    key: str
    kind: str  # 'jira' | 'asana'
    name: str
    total: int
    resolved: int = 0
    active: int = 0
    pct: int = 0

    def to_dict(self) -> dict:
        return {
            "key": self.key,
            "kind": self.kind,
            "name": self.name,
            "total": self.total,
            "resolved": self.resolved,
            "active": self.active,
            "pct": self.pct,
        }


@dataclass
class StatusSnapshot:
    """One `status-YYYY-MM-DD.md` entry — daily project health record."""

    date: str  # ISO YYYY-MM-DD
    overall_health: Optional[str]
    headline: Optional[str]
    reasons: List[str] = field(default_factory=list)
    workstream_statuses: Dict[str, str] = field(default_factory=dict)
    area_for_workstream: Dict[str, str] = field(default_factory=dict)
    notes_for_workstream: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "overallHealth": self.overall_health,
            "headline": self.headline,
            "reasons": list(self.reasons),
            "workstreamStatuses": dict(self.workstream_statuses),
            "areaForWorkstream": dict(self.area_for_workstream),
            "notesForWorkstream": dict(self.notes_for_workstream),
        }


# ── Parsers ────────────────────────────────────────────────────────────


def _list_wiki_files(vault: VaultReader, prefix: str) -> List[Path]:
    """List top-level wiki/*.md files whose stem starts with ``prefix``.

    Intentionally excludes the ``archive/`` subfolder so archival status
    pages don't leak into current queries.
    """
    wiki_dir = vault.root / "wiki"
    if not wiki_dir.is_dir():
        return []
    return sorted(
        p
        for p in wiki_dir.glob(f"{prefix}*.md")
        if p.is_file()
    )


def _extract_first_heading(body: str) -> Optional[str]:
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return None


def _extract_wikilink_targets(values: Any) -> List[str]:
    """Normalize frontmatter list values that are wikilinks.

    Accepts: ``["[[ws-pdp]]", "[[ws-cart|Cart]]"]`` → ``["ws-pdp", "ws-cart"]``.
    Accepts bare IDs or plain strings — returns them unchanged.
    """
    if values is None:
        return []
    if not isinstance(values, list):
        values = [values]
    out: List[str] = []
    for v in values:
        if not isinstance(v, str):
            continue
        m = _WIKILINK_RE.search(v)
        if m:
            target = m.group(1)
            # strip display text after `|`
            target = target.split("|", 1)[0].strip()
            # strip .md suffix if present
            if target.endswith(".md"):
                target = target[:-3]
            out.append(target)
        else:
            out.append(v)
    return out


def _infer_severity_from_body(body: str) -> Optional[str]:
    """Pick severity from a blocker body by searching for keywords.

    Returns one of ``critical | high | medium | low`` or None.
    """
    lowered = body.lower()
    for keyword in ("critical", "high", "medium", "low"):
        # Look only in the first ~600 chars — avoids matching phrases like
        # "a high volume of tasks" deep in the note.
        if keyword in lowered[:600]:
            return keyword
    return None


def parse_workstream_page(vault: VaultReader, rel_path: str) -> Optional[Workstream]:
    """Parse a ``wiki/ws-*.md`` file into a :class:`Workstream`."""
    try:
        page = vault.read_page(rel_path)
    except (VaultPathError, FileNotFoundError):
        return None

    fm = page["frontmatter"]
    body = page["body"]
    ws_id = Path(rel_path).stem
    heading = _extract_first_heading(body) or ws_id
    # Heading pattern "Workstream: <Name>" → strip prefix.
    if heading.lower().startswith("workstream:"):
        heading = heading.split(":", 1)[1].strip()

    return Workstream(
        id=ws_id,
        name=heading,
        area=fm.get("area") if isinstance(fm.get("area"), str) else None,
        status=_str_or_none(fm.get("status")),
        tasks=_int_or_zero(fm.get("task_count")),
        closed=_int_or_zero(fm.get("closed_count")),
        failed_qa=_int_or_zero(fm.get("failed_qa_count")),
        in_progress=_int_or_zero(fm.get("in_progress_count")),
        blocked_count=_int_or_zero(fm.get("blocked_count")),
        epics=_extract_wikilink_targets(fm.get("epics")),
        blockers=[],  # populated later via reverse lookup on blockers.affects
        note=None,
    )


def parse_blocker_page(vault: VaultReader, rel_path: str) -> Optional[Blocker]:
    try:
        page = vault.read_page(rel_path)
    except (VaultPathError, FileNotFoundError):
        return None

    fm = page["frontmatter"]
    body = page["body"]
    blocker_id = Path(rel_path).stem
    heading = _extract_first_heading(body) or blocker_id
    severity = _str_or_none(fm.get("severity")) or _infer_severity_from_body(body)

    # First non-empty paragraph after the heading serves as the note.
    note: Optional[str] = None
    for para in body.split("\n\n"):
        text = para.strip()
        if not text or text.startswith("#"):
            continue
        note = text.splitlines()[0].strip()
        break

    return Blocker(
        id=blocker_id,
        name=heading,
        status=_str_or_none(fm.get("status")) or "open",
        affects=_extract_wikilink_targets(fm.get("affects")),
        severity=severity,
        note=note,
    )


def parse_team_page(vault: VaultReader, rel_path: str) -> Optional[Team]:
    try:
        page = vault.read_page(rel_path)
    except (VaultPathError, FileNotFoundError):
        return None

    fm = page["frontmatter"]
    body = page["body"]
    team_id = Path(rel_path).stem
    heading = _extract_first_heading(body) or team_id
    if heading.lower().startswith("team:"):
        heading = heading.split(":", 1)[1].strip()

    lead, qa_lead = _extract_team_leads(body)
    dev_count = _count_table_rows(body, "## Developers") or _count_table_rows(body, "## Active Developers")
    qa_count = _count_table_rows(body, "## QA Team") or _count_table_rows(body, "## QA Engineers")

    return Team(
        id=team_id,
        name=heading,
        project=_str_or_none(fm.get("project")),
        lead=lead,
        qa_lead=qa_lead,
        dev_count=dev_count,
        qa_count=qa_count,
        note=None,
    )


def parse_source_page(vault: VaultReader, rel_path: str) -> Optional[Source]:
    try:
        page = vault.read_page(rel_path)
    except (VaultPathError, FileNotFoundError):
        return None

    fm = page["frontmatter"]
    source_id = Path(rel_path).stem  # e.g. "source-jira-ace2e"
    parts = source_id.split("-")
    kind = parts[1] if len(parts) >= 3 else "unknown"
    key = parts[-1].upper() if len(parts) >= 3 else source_id

    heading = _extract_first_heading(page["body"]) or key
    total = _int_or_zero(fm.get("total_issues") or fm.get("task_count"))

    return Source(
        key=key,
        kind=kind,
        name=heading,
        total=total,
        resolved=0,
        active=total,
        pct=0,
    )


def parse_status_page(vault: VaultReader, rel_path: str) -> Optional[StatusSnapshot]:
    """Parse a ``status-YYYY-MM-DD.md`` page (current or archived)."""
    try:
        page = vault.read_page(rel_path)
    except (VaultPathError, FileNotFoundError):
        return None

    fm = page["frontmatter"]
    body = page["body"]
    date = _str_or_none(fm.get("date")) or Path(rel_path).stem.replace("status-", "")

    headline = _extract_status_headline(body)
    area_map, status_map, notes_map = _extract_area_workstream_table(body)

    return StatusSnapshot(
        date=date,
        overall_health=_str_or_none(fm.get("overall_health")),
        headline=headline,
        reasons=[],  # populated by caller from multiple sources if desired
        workstream_statuses=status_map,
        area_for_workstream=area_map,
        notes_for_workstream=notes_map,
    )


# ── List helpers ───────────────────────────────────────────────────────


def list_workstreams(vault: VaultReader) -> List[Workstream]:
    out: List[Workstream] = []
    for path in _list_wiki_files(vault, "ws-"):
        rel = path.relative_to(vault.root).as_posix()
        ws = parse_workstream_page(vault, rel)
        if ws is not None:
            out.append(ws)
    return out


def list_blockers(vault: VaultReader) -> List[Blocker]:
    out: List[Blocker] = []
    for path in _list_wiki_files(vault, "blocker-"):
        rel = path.relative_to(vault.root).as_posix()
        blocker = parse_blocker_page(vault, rel)
        if blocker is not None:
            out.append(blocker)
    return out


def list_teams(vault: VaultReader) -> List[Team]:
    out: List[Team] = []
    for path in _list_wiki_files(vault, "team-"):
        rel = path.relative_to(vault.root).as_posix()
        team = parse_team_page(vault, rel)
        if team is not None:
            out.append(team)
    return out


def list_sources(vault: VaultReader) -> List[Source]:
    out: List[Source] = []
    for path in _list_wiki_files(vault, "source-"):
        rel = path.relative_to(vault.root).as_posix()
        source = parse_source_page(vault, rel)
        if source is not None:
            out.append(source)
    return out


def latest_status_snapshot(vault: VaultReader) -> Optional[StatusSnapshot]:
    """Return the most recent wiki/status-*.md (non-archive)."""
    statuses = _list_wiki_files(vault, "status-")
    if not statuses:
        return None
    latest = statuses[-1]  # sorted lexicographically — YYYY-MM-DD orders correctly
    rel = latest.relative_to(vault.root).as_posix()
    return parse_status_page(vault, rel)


def archived_status_snapshots(vault: VaultReader, limit: int = 7) -> List[StatusSnapshot]:
    """Return the N most recent archived status pages, oldest first."""
    archive_dir = vault.root / "wiki" / "archive"
    if not archive_dir.is_dir():
        return []
    files = sorted(p for p in archive_dir.glob("status-*.md") if p.is_file())
    selected = files[-limit:]
    out: List[StatusSnapshot] = []
    for path in selected:
        rel = path.relative_to(vault.root).as_posix()
        snap = parse_status_page(vault, rel)
        if snap is not None:
            out.append(snap)
    return out


# ── Body-parsing helpers ───────────────────────────────────────────────


def _extract_status_headline(body: str) -> Optional[str]:
    """Return the first paragraph after the Health heading, plaintext."""
    lines = body.splitlines()
    in_body = False
    paragraph: List[str] = []
    for line in lines:
        if line.startswith("## Health"):
            in_body = True
            continue
        if not in_body:
            continue
        if line.startswith("#"):
            break
        if line.strip() == "":
            if paragraph:
                break
            continue
        paragraph.append(line)
    if not paragraph:
        return None
    text = " ".join(paragraph)
    # Strip inline HTML spans sometimes present in status pages.
    text = re.sub(r"<[^>]+>", "", text).strip()
    return text or None


_AREA_ROW_RE = re.compile(
    r"^\|\s*(?P<area>.*?)\s*\|\s*(?P<ws>.*?)\s*\|\s*(?P<status>.*?)\s*\|\s*(?P<note>.*?)\s*\|\s*$"
)


def _extract_area_workstream_table(body: str) -> Tuple[Dict[str, str], Dict[str, str], Dict[str, str]]:
    """Parse the ``## Project Health by Area`` table.

    The table has sparse area cells (area appears in the first row of a group
    then is empty for subsequent rows). We carry the last-seen area forward.

    Returns three dicts keyed by workstream id:
      - ws_id → area (e.g. "ws-pdp" → "Storefront")
      - ws_id → status (plaintext status chip content, e.g. "At Risk")
      - ws_id → note / key concern paragraph
    """
    area_map: Dict[str, str] = {}
    status_map: Dict[str, str] = {}
    notes_map: Dict[str, str] = {}

    in_table = False
    seen_separator = False
    current_area: Optional[str] = None

    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("## Project Health by Area"):
            in_table = True
            seen_separator = False
            continue
        if not in_table:
            continue
        if stripped.startswith("##"):
            break
        if not stripped.startswith("|"):
            if stripped == "":
                continue
            break

        match = _AREA_ROW_RE.match(stripped)
        if not match:
            continue
        cells = match.groupdict()
        if set(cells["area"].replace("|", "").strip()) <= set("- "):
            seen_separator = True
            continue
        if not seen_separator:
            continue  # header row

        area_text = _strip_markdown(cells["area"]).strip("*")
        if area_text:
            current_area = area_text

        ws_cell = cells["ws"]
        ws_id_match = _WIKILINK_RE.search(ws_cell)
        if not ws_id_match:
            continue
        ws_id = ws_id_match.group(1).split("|", 1)[0].strip()
        if ws_id.endswith(".md"):
            ws_id = ws_id[:-3]

        status_text = _strip_markdown(cells["status"]).strip()
        note_text = _strip_markdown(cells["note"]).strip()

        if current_area:
            area_map[ws_id] = current_area
        if status_text:
            status_map[ws_id] = status_text
        if note_text:
            notes_map[ws_id] = note_text

    return area_map, status_map, notes_map


def _strip_markdown(text: str) -> str:
    """Remove HTML tags, bold/italic markers, and normalize whitespace."""
    text = re.sub(r"<[^>]+>", "", text)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    return text.strip()


def _extract_team_leads(body: str) -> Tuple[Optional[str], Optional[str]]:
    """Pull 'Project Lead' and 'QA Lead' names from the Leadership section."""
    lead: Optional[str] = None
    qa_lead: Optional[str] = None
    in_section = False
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("## Leadership"):
            in_section = True
            continue
        if not in_section:
            continue
        if stripped.startswith("##"):
            break
        if not stripped.startswith("|"):
            continue
        cells = [c.strip() for c in stripped.strip("|").split("|")]
        if len(cells) < 2:
            continue
        label = cells[0].lower()
        # Table may be (Name | Role | Notes) or (Role | Name | Notes).
        candidate_name = cells[1] if "lead" in label or "owner" in label or "pm" in label else cells[0]
        if ("qa lead" in label) or ("qa" in label and "lead" in label):
            qa_lead = qa_lead or _plain_name(cells[1] if cells[0].lower().startswith("qa") else cells[0])
        elif "lead" in label or "pm" in label:
            lead = lead or _plain_name(candidate_name)
    return lead, qa_lead


def _count_table_rows(body: str, heading: str) -> Optional[int]:
    """Count data rows under a given markdown heading."""
    lines = body.splitlines()
    try:
        start = next(i for i, line in enumerate(lines) if line.strip() == heading)
    except StopIteration:
        return None
    count = 0
    seen_separator = False
    for line in lines[start + 1:]:
        stripped = line.strip()
        if stripped.startswith("##"):
            break
        if not stripped.startswith("|"):
            if stripped == "" and count > 0:
                continue
            continue
        inner = stripped.strip("|")
        if set(inner.replace("|", "").strip()) <= set("- :"):
            seen_separator = True
            continue
        if not seen_separator:
            continue  # header row
        count += 1
    return count if count > 0 else None


def _plain_name(raw: str) -> Optional[str]:
    text = _strip_markdown(raw)
    # Strip wikilinks: [[ACE2E-1|label]] → label, else stem
    m = _WIKILINK_RE.search(text)
    if m:
        label = m.group(1).split("|", 1)[-1]
        text = text.replace(m.group(0), label)
    text = text.strip()
    return text or None


def _int_or_zero(value: Any) -> int:
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    if isinstance(value, str):
        try:
            return int(value.strip().replace(",", ""))
        except ValueError:
            return 0
    return 0


def _str_or_none(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        text = value.strip()
        return text or None
    return str(value)
