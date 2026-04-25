"""Full parser for ``status-YYYY-MM-DD.md`` daily status pages.

Produces a :class:`SnapshotPayload` matching the shape defined in
``handoff/design/snapshots.js``. The vault author maintains these files
in Obsidian; this parser turns the authored markdown into the exact JSON
shape the dashboard's history/diff surfaces consume.

Design notes
============
- We intentionally do *not* re-derive KPIs or counts from the raw task
  tree. The narrative fields (critical bugs, positives, status changes)
  are hand-curated in the status page — that is the source of truth.
  Re-running the raw scanner would erase that editorial voice.
- Section detection is heading-based; column order within tables can
  vary across vault authors, so we key on header text where possible.
- Regex-heavy on purpose: the vault mixes markdown tables with inline
  HTML ``<span>`` health pills. We strip those tags and work against the
  plaintext content.

Single Responsibility: turn one status markdown file into a dict.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .vault_parser import split_frontmatter


logger = logging.getLogger(__name__)


# ── Public dataclass ───────────────────────────────────────────────────


@dataclass
class SnapshotPayload:
    """Matches the snapshot shape in handoff/design/snapshots.js."""

    date: str
    overall: Optional[str]
    headline: Optional[str]
    kpis: Dict[str, Any] = field(default_factory=dict)
    source_coverage: List[Dict[str, Any]] = field(default_factory=list)
    area_statuses: Dict[str, str] = field(default_factory=dict)
    critical_bugs: List[Dict[str, Any]] = field(default_factory=list)
    prod_failures: List[Dict[str, Any]] = field(default_factory=list)
    open_blockers: List[Dict[str, Any]] = field(default_factory=list)
    new_items: List[Dict[str, Any]] = field(default_factory=list)
    status_changes: List[Dict[str, Any]] = field(default_factory=list)
    positives: List[Dict[str, Any]] = field(default_factory=list)
    area_health: List[Dict[str, Any]] = field(default_factory=list)
    retest: List[Dict[str, Any]] = field(default_factory=list)
    analytics_blockers: List[Dict[str, Any]] = field(default_factory=list)
    open_high_pri: List[Dict[str, Any]] = field(default_factory=list)
    mao: List[Dict[str, Any]] = field(default_factory=list)
    private_link_gaps: List[Dict[str, Any]] = field(default_factory=list)
    lpwe_unestimated: List[Dict[str, Any]] = field(default_factory=list)
    change_summary: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "overall": self.overall,
            "headline": self.headline,
            "kpis": dict(self.kpis),
            "sourceCoverage": list(self.source_coverage),
            "areaStatuses": dict(self.area_statuses),
            "criticalBugs": list(self.critical_bugs),
            "prodFailures": list(self.prod_failures),
            "openBlockers": list(self.open_blockers),
            "newItems": list(self.new_items),
            "statusChanges": list(self.status_changes),
            "positives": list(self.positives),
            "areaHealth": list(self.area_health),
            "retest": list(self.retest),
            "analyticsBlockers": list(self.analytics_blockers),
            "openHighPri": list(self.open_high_pri),
            "mao": list(self.mao),
            "privateLinkGaps": list(self.private_link_gaps),
            "lpweUnestimated": list(self.lpwe_unestimated),
            "changeSummary": dict(self.change_summary),
        }


# ── Parsing entrypoint ─────────────────────────────────────────────────


def parse_status_markdown(text: str, fallback_date: Optional[str] = None) -> SnapshotPayload:
    """Parse a full status-YYYY-MM-DD.md document into a SnapshotPayload."""
    frontmatter, body = split_frontmatter(text)

    date = _str(frontmatter.get("date")) or fallback_date or ""
    overall = _normalize_overall(
        _str(frontmatter.get("overall_health"))
        or _extract_health_chip_text(body)
    )

    headline = _extract_headline(body)
    source_coverage = _parse_source_coverage(body)
    combined_unique = _parse_combined_unique(body)
    area_statuses = _parse_area_statuses(body)
    critical_bugs = _parse_critical_bugs(body)
    prod_failures = _parse_prod_failures(body)
    open_blockers = _parse_open_blockers(body)
    new_items = _parse_new_items(body)
    status_changes = _parse_status_changes(body)
    positives = _parse_positives(body)
    area_health = _parse_area_health(body)
    retest = _parse_retest(body)
    analytics_blockers = _parse_analytics_blockers(body)
    open_high_pri = _parse_open_high_pri(body)
    order_int = _parse_order_integration(body)
    lpwe_unestimated = _parse_lpwe_unestimated(body)

    kpis = _derive_kpis(
        source_coverage=source_coverage,
        combined_unique=combined_unique,
        critical_bugs=critical_bugs,
        prod_failures=prod_failures,
        open_blockers=open_blockers,
        new_items=new_items,
    )

    change_summary = _derive_change_summary(
        new_items=new_items,
        positives=positives,
        status_changes=status_changes,
        prod_failures=prod_failures,
    )

    return SnapshotPayload(
        date=date,
        overall=overall,
        headline=headline,
        kpis=kpis,
        source_coverage=source_coverage,
        area_statuses=area_statuses,
        critical_bugs=critical_bugs,
        prod_failures=prod_failures,
        open_blockers=open_blockers,
        new_items=new_items,
        status_changes=status_changes,
        positives=positives,
        area_health=area_health,
        retest=retest,
        analytics_blockers=analytics_blockers,
        open_high_pri=open_high_pri,
        mao=order_int["mao"],
        private_link_gaps=order_int["privateLink"],
        lpwe_unestimated=lpwe_unestimated,
        change_summary=change_summary,
    )


def parse_status_file(path: Path) -> SnapshotPayload:
    """Read a status markdown file from disk and parse it."""
    text = path.read_text(encoding="utf-8", errors="replace")
    fallback = path.stem.replace("status-", "")
    return parse_status_markdown(text, fallback_date=fallback)


# ── Section parsers ────────────────────────────────────────────────────


_HTML_TAG_RE = re.compile(r"<[^>]+>")
# Use ``]]`` as a non-greedy terminator so titles containing ``[brackets]``
# (e.g. ``[[UTI-8454 - [Private Link] Pull AC…|UTI-8454]]``) parse correctly.
_WIKILINK_RE = re.compile(r"\[\[(.+?)\]\]")
_BOLD_RE = re.compile(r"\*\*([^*]+)\*\*")


def _strip_markup(text: str) -> str:
    text = _HTML_TAG_RE.sub("", text)
    text = _BOLD_RE.sub(r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    return text.strip()


def _wikilink_target(text: str) -> Tuple[str, str]:
    """Return (id, display) from a wikilink; falls back to plaintext.

    The vault uses ``[[<id> - <title>|<id>]]`` — the target is everything
    before the first ``|`` and we strip the filename portion after ``-``
    for readable titles.
    """
    m = _WIKILINK_RE.search(text)
    if not m:
        plain = _strip_markup(text)
        return plain, plain
    inner = m.group(1)
    # Strip backslash-escaped pipes (table-cell form) before partitioning.
    inner = inner.replace("\\|", "|")
    target, _, display = inner.partition("|")
    target = target.strip()
    display = (display or target).strip()
    # target like "LAMPSPLUS-1521 - Bug - Multishipping Errors" — keep only the id
    token = target.split(" - ", 1)[0].strip()
    if token.endswith(".md"):
        token = token[:-3]
    return token, display


def _resolve_wikilinks_for_prose(text: str) -> str:
    """Replace ``[[Stem|ID]]`` (and the table-cell form ``[[Stem\\|ID]]``)
    with the display portion (``ID``) for fields that get rendered as
    prose — e.g. the status-page headline paragraph that feeds the
    dashboard's Daily Status bullets. Without this, raw Obsidian markup
    leaks into the UI as ``[[904692 - Title\\|904692]]``.

    Substitutes every wikilink in the input. If a link has no display
    alias (``[[X - Y]]``), keep the leading ID token (everything before
    the first `` - `` separator) so the prose stays readable.
    """
    def _sub(match: "re.Match[str]") -> str:
        inner = match.group(1).replace("\\|", "|")
        target, _, display = inner.partition("|")
        if display.strip():
            return display.strip()
        token = target.split(" - ", 1)[0].strip()
        return token or target.strip()
    return _WIKILINK_RE.sub(_sub, text)


def _section_lines(body: str, heading_pattern: re.Pattern) -> List[str]:
    """Return lines of the first section whose heading matches; exclusive of heading."""
    lines = body.splitlines()
    out: List[str] = []
    in_section = False
    section_level = 0
    for line in lines:
        stripped = line.strip()
        if not in_section:
            m = heading_pattern.match(stripped)
            if m:
                in_section = True
                section_level = len(stripped) - len(stripped.lstrip("#"))
            continue
        if stripped.startswith("#"):
            # Stop at any same-or-higher-level heading
            new_level = len(stripped) - len(stripped.lstrip("#"))
            if new_level <= section_level:
                break
        out.append(line)
    return out


_PIPE_SENTINEL = "\x00ESCPIPE\x00"


def _split_table_row(line: str) -> List[str]:
    """Split a markdown-table row into cells, honoring escaped ``\\|``.

    Obsidian wikilinks inside table cells use ``\\|`` to escape the pipe
    so the display name part of ``[[target|display]]`` survives markdown
    table rendering. A naive ``str.split("|")`` would shred these.
    """
    inner = line.strip()
    if not inner.startswith("|"):
        return []
    inner = inner.strip("|")
    protected = inner.replace("\\|", _PIPE_SENTINEL)
    cells = [c.replace(_PIPE_SENTINEL, "|").strip() for c in protected.split("|")]
    return cells


def _iter_table_rows(lines: List[str]) -> List[List[str]]:
    """Yield list-of-cells for each data row in a markdown table.

    Separator rows (``|---|---|``) are detected and skipped along with
    the header row that precedes them.
    """
    rows: List[List[str]] = []
    seen_sep = False
    saw_header = False
    for line in lines:
        stripped = line.strip()
        if not stripped.startswith("|"):
            if stripped == "" and saw_header:
                continue
            if saw_header:
                break
            continue
        cells = _split_table_row(stripped)
        if not cells:
            continue
        if not saw_header:
            saw_header = True
            continue
        if not seen_sep:
            if all(set(c.replace(":", "").strip()) <= set("-") for c in cells if c):
                seen_sep = True
                continue
            # Some tables only have one header row; treat first real row as data.
            seen_sep = True
        rows.append(cells)
    return rows


# Headings used across daily status pages. Tolerant of wording drift.
_HEADING_SOURCE = re.compile(r"^#{2,}\s*Source Coverage\b", re.IGNORECASE)
_HEADING_AREA = re.compile(r"^#{2,}\s*Project Health by Area\b", re.IGNORECASE)
_HEADING_CRIT = re.compile(r"^#{2,}\s*Critical (Issues|Bugs)\b", re.IGNORECASE)
_HEADING_NEW = re.compile(r"^#{2,}\s*New Items\b", re.IGNORECASE)
_HEADING_CHANGE = re.compile(r"^#{2,}\s*Notable Status Changes\b", re.IGNORECASE)
_HEADING_POSITIVE = re.compile(r"^#{2,}\s*Positive Developments\b", re.IGNORECASE)
_HEADING_BLOCKED = re.compile(r"^#{2,}\s*Blocked Workstreams\b", re.IGNORECASE)
_SUBHEADING_CRIT_BUGS = re.compile(r"^#{3,}\s*.*Critical Bugs\b", re.IGNORECASE)
_SUBHEADING_PROD = re.compile(r"^#{3,}\s*.*Production Failures\b", re.IGNORECASE)
_SUBHEADING_RETEST = re.compile(r"^#{3,}\s*.*Awaiting Retest\b", re.IGNORECASE)
_SUBHEADING_ANALYTICS = re.compile(r"^#{3,}\s*.*Analytics Blocker", re.IGNORECASE)
_SUBHEADING_OPEN_HIGH = re.compile(r"^#{3,}\s*.*Open High-Priority", re.IGNORECASE)
_SUBHEADING_ORDER_INT = re.compile(r"^#{3,}\s*.*Order Integration", re.IGNORECASE)
_SUBHEADING_LPWE_UNEST = re.compile(r"^#{3,}\s*.*Unestimated", re.IGNORECASE)

_BOLD_LABEL_RE = re.compile(r"^\*\*([^*]+?):\*\*\s*$")


def _extract_headline(body: str) -> Optional[str]:
    """First paragraph after ``## Health`` heading."""
    lines = body.splitlines()
    in_section = False
    paragraph: List[str] = []
    for line in lines:
        if line.startswith("## Health"):
            in_section = True
            continue
        if not in_section:
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
    text = _strip_markup(" ".join(paragraph))
    text = _resolve_wikilinks_for_prose(text)
    return text or None


def _extract_health_chip_text(body: str) -> Optional[str]:
    """Find the health chip colour/label embedded in the ``## Health`` heading."""
    for line in body.splitlines():
        if line.startswith("## Health"):
            # e.g. ``## Health: <span style="background:#dc3545;...">AT RISK</span>``
            cleaned = _strip_markup(line)
            cleaned = cleaned.replace("Health:", "").strip()
            return cleaned or None
    return None


def _parse_source_coverage(body: str) -> List[Dict[str, Any]]:
    lines = _section_lines(body, _HEADING_SOURCE)
    rows = _iter_table_rows(lines)
    out: List[Dict[str, Any]] = []
    for cells in rows:
        if len(cells) < 4:
            continue
        source_label = _strip_markup(cells[0])
        if not source_label or source_label.lower().startswith("combined"):
            continue
        key = _extract_source_key(source_label)
        approx = "~" in (cells[1] + cells[2] + cells[3])
        total = _parse_int(cells[1])
        resolved = _parse_int(cells[2])
        active = _parse_int(cells[3])
        if total is None:
            continue
        entry: Dict[str, Any] = {
            "key": key,
            "total": total,
            "resolved": resolved or 0,
            "active": active or 0,
        }
        if approx:
            entry["approx"] = True
        out.append(entry)
    return out


_SOURCE_KEY_RE = re.compile(r"\b(ACE2E|ACEDS|ACAB|ACAQA|ACCMS|ACM|WPM|LAMPSPLUS|LPWE)\b", re.IGNORECASE)


def _extract_source_key(label: str) -> str:
    m = _SOURCE_KEY_RE.search(label)
    if m:
        return m.group(1).upper()
    # Fallback: last word, uppercased
    return label.split()[-1].upper()


def _parse_area_statuses(body: str) -> Dict[str, str]:
    lines = _section_lines(body, _HEADING_AREA)
    rows = _iter_table_rows(lines)
    out: Dict[str, str] = {}
    for cells in rows:
        if len(cells) < 3:
            continue
        # Workstream cell (index 1) contains wikilink; status cell is index 2.
        ws_cell = cells[1]
        status_cell = cells[2]
        ws_id, _ = _wikilink_target(ws_cell)
        if not ws_id.startswith("ws-"):
            continue
        status_text = _strip_markup(status_cell)
        status = _normalize_status(status_text)
        if status:
            out[ws_id] = status
    return out


def _parse_area_health(body: str) -> List[Dict[str, Any]]:
    """Extract the full ``Project Health by Area`` table.

    Returns ``[{area, ws, status, concern}]`` in source order. The Area
    column uses rowspan-like empty cells for consecutive workstreams in
    the same area — propagate the last non-empty area into subsequent
    rows. Workstream rows whose wikilink doesn't resolve to ``ws-*``
    are skipped so this table stays scoped to workstream health.
    """
    lines = _section_lines(body, _HEADING_AREA)
    out: List[Dict[str, Any]] = []
    last_area = ""
    for cells in _iter_table_rows(lines):
        if len(cells) < 4:
            continue
        area_raw = _strip_markup(cells[0])
        if area_raw:
            last_area = area_raw
        ws_id, _ = _wikilink_target(cells[1])
        if not ws_id.startswith("ws-"):
            continue
        status_text = _strip_markup(cells[2])
        status = _normalize_status(status_text) or ""
        concern = _strip_markup(cells[3])
        out.append({
            "area": last_area,
            "ws": ws_id,
            "status": status,
            "concern": concern,
        })
    return out


def _parse_critical_bugs(body: str) -> List[Dict[str, Any]]:
    """Find rows under '### Critical Bugs' subheading."""
    crit_lines = _section_lines(body, _HEADING_CRIT)
    # Walk sub-sub-headings inside the Critical Issues section.
    sub_lines = _subsection_lines(crit_lines, _SUBHEADING_CRIT_BUGS)
    out: List[Dict[str, Any]] = []
    for cells in _iter_table_rows(sub_lines):
        if len(cells) < 2:
            continue
        task_id, _ = _wikilink_target(cells[0])
        title = _strip_markup(cells[1])
        priority_raw = _strip_markup(cells[2]) if len(cells) > 2 else ""
        due = _strip_markup(cells[3]) if len(cells) > 3 else ""
        sev = _normalize_severity(priority_raw) or "critical"
        entry: Dict[str, Any] = {"id": task_id, "title": title, "sev": sev}
        if due:
            entry["due"] = due
        out.append(entry)
    return out


def _parse_prod_failures(body: str) -> List[Dict[str, Any]]:
    crit_lines = _section_lines(body, _HEADING_CRIT)
    sub_lines = _subsection_lines(crit_lines, _SUBHEADING_PROD)
    out: List[Dict[str, Any]] = []
    for cells in _iter_table_rows(sub_lines):
        if len(cells) < 4:
            continue
        task_id, _ = _wikilink_target(cells[0])
        title = _strip_markup(cells[1])
        who = _strip_markup(cells[2])
        status = _strip_markup(cells[3])
        entry: Dict[str, Any] = {
            "id": task_id,
            "title": title,
            "who": who,
            "status": status,
        }
        combined = (title + " " + status).lower()
        if "regression" in combined:
            entry["regression"] = True
        if "(blocker)" in status.lower() or "blocker" in status.lower():
            entry["tag"] = "Blocker"
        pct = _extract_percent(status) or _extract_percent(title)
        if pct:
            entry.setdefault("tag", pct)
        # Reassigned narrative is a common pattern in the who-cell.
        if "reassigned" in who.lower() or "→" in who:
            entry["tag"] = "reassigned"
        out.append(entry)
    return out


def _parse_open_blockers(body: str) -> List[Dict[str, Any]]:
    """Pull wiki-linked blockers listed under 'Blocked Workstreams'.

    Only non-resolved entries are returned; the frontend treats these as
    open blockers for the snapshot.
    """
    lines = _section_lines(body, _HEADING_BLOCKED)
    out: List[Dict[str, Any]] = []
    for cells in _iter_table_rows(lines):
        if len(cells) < 2:
            continue
        blocker_id, display = _wikilink_target(cells[0])
        priority = _strip_markup(cells[1])
        if "resolved" in priority.lower():
            continue
        sev = _normalize_severity(priority) or "high"
        entry: Dict[str, Any] = {
            "id": blocker_id,
            "title": display.replace(blocker_id, "").strip(" -") or blocker_id,
            "sev": sev,
        }
        if len(cells) > 2:
            note = _strip_markup(cells[2])
            if note:
                entry["note"] = note
        out.append(entry)
    return out


def _parse_new_items(body: str) -> List[Dict[str, Any]]:
    lines = _section_lines(body, _HEADING_NEW)
    out: List[Dict[str, Any]] = []
    for cells in _iter_table_rows(lines):
        if len(cells) < 2:
            continue
        item_id, _ = _wikilink_target(cells[0])
        title = _strip_markup(cells[1]) if len(cells) > 1 else ""
        type_ = _strip_markup(cells[2]) if len(cells) > 2 else ""
        who = _strip_markup(cells[4]) if len(cells) > 4 else ""
        entry: Dict[str, Any] = {"id": item_id, "title": title, "type": type_ or "bug"}
        if who:
            entry["who"] = who
        out.append(entry)
    return out


def _parse_status_changes(body: str) -> List[Dict[str, Any]]:
    lines = _section_lines(body, _HEADING_CHANGE)
    out: List[Dict[str, Any]] = []
    for cells in _iter_table_rows(lines):
        if len(cells) < 3:
            continue
        item_id, _ = _wikilink_target(cells[0])
        change = _strip_markup(cells[1])
        detail = _strip_markup(cells[2])
        out.append({"id": item_id, "change": change, "detail": detail})
    return out


def _parse_positives(body: str) -> List[Dict[str, Any]]:
    lines = _section_lines(body, _HEADING_POSITIVE)
    out: List[Dict[str, Any]] = []
    for cells in _iter_table_rows(lines):
        if len(cells) < 2:
            continue
        item_id, display = _wikilink_target(cells[0])
        detail = _strip_markup(cells[1])
        out.append({"id": item_id, "title": display, "detail": detail})
    return out


def _row_id_title(cell: str) -> Tuple[str, str]:
    """Extract (id, title) from a table cell, tolerating non-wikilink rows.

    Preferred path: a ``[[id - title|id]]`` wikilink. Fallback: plain
    text starting with a recognizable task identifier (``LAMPSPLUS-123``
    or a 3+ digit numeric Asana id); anything after the id becomes the
    title. This keeps rows like ``548034 (no raw file …)`` usable instead
    of collapsing the whole cell into the id field.
    """
    if _WIKILINK_RE.search(cell):
        return _wikilink_target(cell)
    plain = _strip_markup(cell)
    m = re.match(r"^([A-Z][A-Z0-9]*-\d+|\d{3,})\b", plain)
    if m:
        leading = m.group(1)
        rest = plain[len(leading):].strip(" -—(\"'")
        return leading, rest or leading
    return plain, plain


def _parse_retest(body: str) -> List[Dict[str, Any]]:
    """Rows under the ``Awaiting Retest`` sub-heading (Cybersource, etc.)."""
    crit_lines = _section_lines(body, _HEADING_CRIT)
    sub_lines = _subsection_lines(crit_lines, _SUBHEADING_RETEST)
    out: List[Dict[str, Any]] = []
    for cells in _iter_table_rows(sub_lines):
        if len(cells) < 2:
            continue
        task_id, _ = _row_id_title(cells[0])
        title = _strip_markup(cells[1])
        who = _strip_markup(cells[2]) if len(cells) > 2 else ""
        status = _strip_markup(cells[3]) if len(cells) > 3 else ""
        entry: Dict[str, Any] = {"id": task_id, "title": title}
        if who:
            entry["who"] = who
        if status:
            entry["status"] = status
        out.append(entry)
    return out


def _parse_analytics_blockers(body: str) -> List[Dict[str, Any]]:
    """Rows under ``Analytics Blocker(s)`` sub-heading."""
    crit_lines = _section_lines(body, _HEADING_CRIT)
    sub_lines = _subsection_lines(crit_lines, _SUBHEADING_ANALYTICS)
    out: List[Dict[str, Any]] = []
    for cells in _iter_table_rows(sub_lines):
        if len(cells) < 2:
            continue
        task_id, _ = _row_id_title(cells[0])
        title = _strip_markup(cells[1])
        who = _strip_markup(cells[2]) if len(cells) > 2 else ""
        priority = _strip_markup(cells[3]) if len(cells) > 3 else ""
        entry: Dict[str, Any] = {"id": task_id, "title": title}
        if who:
            entry["who"] = who
        if priority:
            entry["priority"] = priority
        out.append(entry)
    return out


def _parse_open_high_pri(body: str) -> List[Dict[str, Any]]:
    """Bold-labeled subsections under ``Open High-Priority Bugs``.

    Returns a list of ``{label, items: [{id, title, priority, status?}]}``
    preserving source order (PDP Issues → Cart / Checkout Issues → …).
    """
    crit_lines = _section_lines(body, _HEADING_CRIT)
    sub_lines = _subsection_lines(crit_lines, _SUBHEADING_OPEN_HIGH)
    groups = _parse_bold_subsections(sub_lines)
    out: List[Dict[str, Any]] = []
    for label, rows in groups:
        items: List[Dict[str, Any]] = []
        for cells in rows:
            if len(cells) < 2:
                continue
            task_id, _ = _row_id_title(cells[0])
            title = _strip_markup(cells[1])
            priority = _strip_markup(cells[2]) if len(cells) > 2 else ""
            status = _strip_markup(cells[3]) if len(cells) > 3 else ""
            entry: Dict[str, Any] = {"id": task_id, "title": title}
            if priority:
                entry["priority"] = priority
            if status:
                entry["status"] = status
            items.append(entry)
        if items:
            out.append({"label": label, "items": items})
    return out


def _parse_order_integration(body: str) -> Dict[str, List[Dict[str, Any]]]:
    """Bold-labeled subsections under ``Order Integration Bugs``.

    Splits into ``mao`` (MAO Interface table: id/title/status) and
    ``privateLink`` (Private Link Order History table: id/field).
    """
    crit_lines = _section_lines(body, _HEADING_CRIT)
    sub_lines = _subsection_lines(crit_lines, _SUBHEADING_ORDER_INT)
    groups = _parse_bold_subsections(sub_lines)
    mao: List[Dict[str, Any]] = []
    pl: List[Dict[str, Any]] = []
    for label, rows in groups:
        label_lower = label.lower()
        if label_lower.startswith("mao"):
            for cells in rows:
                if len(cells) < 2:
                    continue
                task_id, _ = _row_id_title(cells[0])
                title = _strip_markup(cells[1])
                status = _strip_markup(cells[2]) if len(cells) > 2 else ""
                entry: Dict[str, Any] = {"id": task_id, "title": title}
                if status:
                    entry["status"] = status
                    if "uat" in status.lower() and "stage" in status.lower():
                        entry["ok"] = True
                mao.append(entry)
        elif label_lower.startswith("private link"):
            for cells in rows:
                if len(cells) < 2:
                    continue
                task_id, _ = _row_id_title(cells[0])
                field = _strip_markup(cells[1])
                pl.append({"id": task_id, "field": field})
    return {"mao": mao, "privateLink": pl}


def _parse_lpwe_unestimated(body: str) -> List[Dict[str, Any]]:
    """Rows under ``Unestimated Critical LPWE Tasks``."""
    crit_lines = _section_lines(body, _HEADING_CRIT)
    sub_lines = _subsection_lines(crit_lines, _SUBHEADING_LPWE_UNEST)
    out: List[Dict[str, Any]] = []
    for cells in _iter_table_rows(sub_lines):
        if len(cells) < 2:
            continue
        task_id, _ = _row_id_title(cells[0])
        title = _strip_markup(cells[1])
        estimate = _strip_markup(cells[2]) if len(cells) > 2 else ""
        entry: Dict[str, Any] = {"id": task_id, "title": title}
        if estimate:
            entry["estimate"] = estimate
        out.append(entry)
    return out


def _subsection_lines(parent_lines: List[str], subheading_pattern: re.Pattern) -> List[str]:
    """Slice a section's lines by an inner subheading pattern."""
    out: List[str] = []
    in_section = False
    level = 0
    for line in parent_lines:
        stripped = line.strip()
        if not in_section:
            if subheading_pattern.match(stripped):
                in_section = True
                level = len(stripped) - len(stripped.lstrip("#"))
            continue
        if stripped.startswith("#"):
            new_level = len(stripped) - len(stripped.lstrip("#"))
            if new_level <= level:
                break
        out.append(line)
    return out


def _parse_bold_subsections(section_lines: List[str]) -> List[Tuple[str, List[List[str]]]]:
    """Split a section's lines by ``**Label:**`` markers into ordered groups.

    Used for sections like *Open High-Priority Bugs* that use bold inline
    labels (``**PDP Issues:**``, ``**Cart / Checkout Issues:**``) between
    inline tables instead of nested ``####`` sub-headings. Returns a list
    of ``(label, table_rows)`` tuples preserving source order.
    """
    groups: List[Tuple[str, List[str]]] = []
    current_label: Optional[str] = None
    current_lines: List[str] = []
    for line in section_lines:
        m = _BOLD_LABEL_RE.match(line.strip())
        if m:
            if current_label is not None:
                groups.append((current_label, current_lines))
            current_label = m.group(1).strip()
            current_lines = []
        elif current_label is not None:
            current_lines.append(line)
    if current_label is not None:
        groups.append((current_label, current_lines))
    return [(label, _iter_table_rows(lines)) for label, lines in groups]


# ── Derivations & normalization ────────────────────────────────────────


def _parse_combined_unique(body: str) -> Dict[str, Optional[int]]:
    """Pick up the ``Combined unique`` totals row from the source-coverage table.

    This row is authored by hand to reflect dedup across Jira and Asana,
    so it's the truthful ``combinedUnique`` figure rather than a naive sum.
    """
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        cells = _split_table_row(stripped)
        if len(cells) < 4:
            continue
        first = _strip_markup(cells[0]).lower()
        if "combined unique" not in first:
            continue
        return {
            "total": _parse_int(cells[1]),
            "resolved": _parse_int(cells[2]),
            "active": _parse_int(cells[3]),
        }
    return {"total": None, "resolved": None, "active": None}


def _derive_kpis(
    *,
    source_coverage: List[Dict[str, Any]],
    combined_unique: Dict[str, Optional[int]],
    critical_bugs: List[Dict[str, Any]],
    prod_failures: List[Dict[str, Any]],
    open_blockers: List[Dict[str, Any]],
    new_items: List[Dict[str, Any]],
) -> Dict[str, Any]:
    combined_total = combined_unique.get("total")
    combined_resolved = combined_unique.get("resolved")
    combined_active = combined_unique.get("active")
    if combined_total is None:
        combined_total = sum(s.get("total", 0) for s in source_coverage)
        combined_resolved = sum(s.get("resolved", 0) for s in source_coverage)
        combined_active = sum(s.get("active", 0) for s in source_coverage)
    pct = (
        round((combined_resolved / combined_total) * 100)
        if combined_total
        else 0
    )

    wpm_total = next(
        (s.get("total") for s in source_coverage if s.get("key") == "WPM"),
        None,
    )

    critical_blockers = sum(
        1
        for b in open_blockers
        if (b.get("sev") or "").lower() in {"critical", "blocker"}
    )

    return {
        "combinedUnique": combined_total,
        "combinedResolved": combined_resolved,
        "combinedActive": combined_active,
        "resolvedPct": pct,
        "productionFailures": len(prod_failures),
        "openBlockers": len(open_blockers),
        "criticalBlockers": critical_blockers,
        "newBugs24h": len(new_items),
        "criticalBugCount": len(critical_bugs),
        "wpm": wpm_total,
    }


def _derive_change_summary(
    *,
    new_items: List[Dict[str, Any]],
    positives: List[Dict[str, Any]],
    status_changes: List[Dict[str, Any]],
    prod_failures: List[Dict[str, Any]],
) -> Dict[str, int]:
    on_hold = sum(
        1 for c in status_changes if "on hold" in (c.get("change") or "").lower()
    )
    reassigned = sum(
        1 for c in status_changes if "reassign" in (c.get("change") or "").lower()
    )
    regressed = sum(1 for p in prod_failures if p.get("regression"))
    return {
        "new": len(new_items),
        "resolved": len(positives),
        "reassigned": reassigned,
        "regressed": regressed,
        "onHold": on_hold,
    }


_HEALTH_NORMALIZE: Dict[str, str] = {
    "at risk": "at-risk",
    "at-risk": "at-risk",
    "critical": "off-track",
    "blocked": "off-track",
    "off track": "off-track",
    "off-track": "off-track",
    "on track": "on-track",
    "on-track": "on-track",
    "progressing": "on-track",
    "near complete": "on-track",
    "near-complete": "on-track",
    "in progress": "at-risk",
    "in-progress": "at-risk",
}


def _normalize_overall(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    key = value.strip().lower()
    return _HEALTH_NORMALIZE.get(key, "at-risk" if "risk" in key else key)


_STATUS_NORMALIZE: Dict[str, str] = {
    "at risk": "at-risk",
    "at-risk": "at-risk",
    "blocked": "blocked",
    "critical": "blocked",
    "in progress": "in-progress",
    "in-progress": "in-progress",
    "progressing": "improving",
    "near complete": "near-complete",
    "near-complete": "near-complete",
    "groomed": "groomed",
    "improving": "improving",
}


def _normalize_status(value: str) -> Optional[str]:
    if not value:
        return None
    key = value.strip().lower()
    if key in _STATUS_NORMALIZE:
        return _STATUS_NORMALIZE[key]
    # Tolerate editorial variants
    for token, normalized in _STATUS_NORMALIZE.items():
        if token in key:
            return normalized
    return None


def _normalize_severity(value: str) -> Optional[str]:
    if not value:
        return None
    key = _strip_markup(value).lower()
    for tier in ("blocker", "critical", "high", "medium", "low"):
        if tier in key:
            return tier
    return None


_PERCENT_RE = re.compile(r"(\d{1,3})\s*%")


def _extract_percent(text: str) -> Optional[str]:
    m = _PERCENT_RE.search(text)
    return f"{m.group(1)}%" if m else None


def _parse_int(cell: str) -> Optional[int]:
    cell = _strip_markup(cell).replace("~", "").replace(",", "").strip()
    if not cell:
        return None
    try:
        return int(cell)
    except ValueError:
        return None


def _str(value: Any) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, str):
        return value.strip() or None
    return str(value)
