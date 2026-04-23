"""Rich parser for ``wiki/ws-*.md`` workstream pages.

Produces the payload consumed by the handoff Workstream detail page
(see ``handoff/design/workstream-md.jsx``). The vault author maintains
these files in Obsidian; we turn each file into a structured dict with:

- ``meta`` frontmatter + title/lastUpdate
- ``overviewParagraph`` — first paragraph after ``## Overview``
- ``scope`` — bullets under ``### Scope``
- ``epics`` — bullets under ``### Key Epics``
- ``progress`` — counts from the ``## Progress`` table
- ``active`` — rows under ``## Active Items`` grouped by bucket
- ``keyRisks`` — bullets under ``### Key Risks``
- ``burndown`` — ``## Estimated Completion`` table rows
- ``velocity`` — velocity sentences under the burndown table
- ``devs`` — ``## Developer Workload`` table
- ``devObservations`` — bullets under ``**Observations:**``
- ``recentActivity`` — ``## Recent Activity`` table
- ``activitySummary`` — the ``**Summary:**`` sentence
- ``decisions`` — ``## Decisions`` table
- ``decisionContext`` — the trailing ``**Key context:**`` paragraph

This is intentionally tolerant — unknown sections are skipped rather
than raising so one oddly-formatted workstream page doesn't break the
whole dashboard. The result schema is the subset required to render
the detail page; additional sections (asana-jira, cross-refs) can be
added later without breaking callers.
"""

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from .status_parser import _split_table_row, _strip_markup, _wikilink_target
from .vault_parser import split_frontmatter


logger = logging.getLogger(__name__)


# ── Public entrypoint ─────────────────────────────────────────────────


def parse_workstream_markdown(text: str, ws_id: str) -> Dict[str, Any]:
    """Parse a workstream markdown file into the rich detail payload."""
    frontmatter, body = split_frontmatter(text)
    sections = _split_sections(body)

    title = _extract_first_h1(body) or ws_id
    if title.lower().startswith("workstream:"):
        title = title.split(":", 1)[1].strip()

    sources = _extract_sources(body)
    overview = _section_paragraph(sections.get("overview", []))
    scope = _parse_bullets(sections.get("scope", []))
    epics = _parse_epic_bullets(sections.get("key epics", []))
    progress = _parse_progress_table(sections.get("progress", []))
    active = _parse_active_items(sections.get("active items", []))
    key_risks = _parse_key_risks(sections.get("active items", []))
    burndown, velocity = _parse_burndown(sections.get("estimated completion", []))
    devs, dev_observations = _parse_devs(sections.get("developer workload", []))
    recent_activity, activity_summary = _parse_recent_activity(
        sections.get("recent activity", [])
    )
    decisions, decision_context = _parse_decisions(sections.get("decisions", []))
    cross_refs = _parse_cross_refs(sections.get("cross-references", []))
    team_leads = _parse_team(sections.get("team", []))
    cross_deps, internal_chains, critical_blocker = _parse_dependencies_and_blockers(
        sections.get("dependencies & blockers", [])
    )
    asana_jira, asana_jira_notes = _parse_asana_jira(
        sections.get("asana ↔ jira cross-references", [])
    )
    asana_coverage = _parse_asana_coverage(sections.get("asana coverage", []))

    return {
        "meta": {
            "type": frontmatter.get("type") or "workstream",
            "status": frontmatter.get("status"),
            "taskCount": _int_or_none(frontmatter.get("task_count")),
            "blockedCount": _int_or_none(frontmatter.get("blocked_count")) or 0,
            "title": title,
            "lastUpdate": _extract_last_update(body),
        },
        "sources": sources,
        "overviewParagraph": overview,
        "scope": scope,
        "epics": epics,
        "progress": progress,
        "active": active,
        "keyRisks": key_risks,
        "burndown": burndown,
        "velocity": velocity,
        "devs": devs,
        "devObservations": dev_observations,
        "recentActivity": recent_activity,
        "activitySummary": activity_summary,
        "decisions": decisions,
        "decisionContext": decision_context,
        "crossRefs": cross_refs,
        "team": {"leads": team_leads},
        "crossDeps": cross_deps,
        "internalChains": internal_chains,
        "criticalBlocker": critical_blocker,
        "asanaJira": asana_jira,
        "asanaJiraNotes": asana_jira_notes,
        "asanaCoverage": asana_coverage,
    }


def parse_workstream_file(path: Path) -> Optional[Dict[str, Any]]:
    if not path.is_file():
        return None
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return None
    return parse_workstream_markdown(text, path.stem)


# ── Section splitting ─────────────────────────────────────────────────


def _split_sections(body: str) -> Dict[str, List[str]]:
    """Return a dict of heading → list of body lines, split on level-2 (``##``).

    Level-3 subheadings stay inside their parent level-2 bucket so parsers
    that care about them (active items, key risks, scope) can walk them
    themselves. Keys are normalized to lowercase with count suffixes
    stripped (``Blocked (1)`` → ``blocked``).
    """
    sections: Dict[str, List[str]] = {}
    current: Optional[str] = None
    for line in body.splitlines():
        stripped = line.strip()
        # Match level-2 only: starts with ##, next char is space, not another #
        if stripped.startswith("## ") and not stripped.startswith("### "):
            heading = _strip_markup(stripped.lstrip("#")).strip(": ").lower()
            heading = re.sub(r"\s*\(.*?\)\s*$", "", heading).strip()
            sections[heading] = []
            current = heading
            continue
        if current is not None:
            sections[current].append(line)

    # Level-3 subheadings inside Overview get exposed as first-class keys
    # for convenience (``scope``, ``key epics``, ``key risks``).
    for parent_key, parent_lines in list(sections.items()):
        for sub_key, sub_lines in _extract_subsections(parent_lines).items():
            sections.setdefault(sub_key, sub_lines)
    return sections


def _extract_subsections(lines: List[str]) -> Dict[str, List[str]]:
    """Split a level-2 section's lines on its level-3 subheadings."""
    out: Dict[str, List[str]] = {}
    current: Optional[str] = None
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("### "):
            heading = _strip_markup(stripped.lstrip("#")).strip(": ").lower()
            heading = re.sub(r"\s*\(.*?\)\s*$", "", heading).strip()
            out[heading] = []
            current = heading
            continue
        if current is not None:
            out[current].append(line)
    return out


def _extract_first_h1(body: str) -> Optional[str]:
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return None


_LAST_UPDATE_RE = re.compile(r"Progress \(as of (\d{4}-\d{2}-\d{2})\)", re.IGNORECASE)


def _extract_last_update(body: str) -> Optional[str]:
    m = _LAST_UPDATE_RE.search(body)
    return m.group(1) if m else None


# ── Overview + scope + epics ──────────────────────────────────────────


def _section_paragraph(lines: List[str]) -> str:
    """First non-empty paragraph that isn't a heading/list."""
    paragraph: List[str] = []
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if paragraph:
                break
            continue
        if stripped.startswith(("#", "|", "-", "*", ">")):
            if paragraph:
                break
            continue
        paragraph.append(stripped)
    return _strip_markup(" ".join(paragraph))


_BULLET_PREFIX_RE = re.compile(r"^[-*]\s+")


def _strip_bullet_prefix(line: str) -> str:
    """Remove the leading ``- `` or ``* `` marker only — preserves inline ``**``."""
    return _BULLET_PREFIX_RE.sub("", line.strip(), count=1)


def _parse_bullets(lines: List[str]) -> List[Dict[str, str]]:
    """Parse ``- **Label** — note`` style bullets into {label, note}."""
    out: List[Dict[str, str]] = []
    for line in lines:
        stripped = line.strip()
        if not stripped.startswith(("-", "*")):
            continue
        text = _strip_bullet_prefix(stripped)
        label, note = _split_dash(text)
        out.append({"label": _strip_markup(label), "note": _strip_markup(note)})
    return out


def _parse_epic_bullets(lines: List[str]) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    for line in lines:
        stripped = line.strip()
        if not stripped.startswith(("-", "*")):
            continue
        text = _strip_bullet_prefix(stripped)
        wid, display = _wikilink_target(text)
        if not wid:
            continue
        # Title text after wikilink separator
        _, sep, after = text.partition("—")
        title = _strip_markup(after) if sep else display
        out.append({"id": wid, "title": title or display})
    return out


def _split_dash(text: str) -> (tuple[str, str]):  # type: ignore[valid-type]
    for sep in ("—", " - ", "–"):
        if sep in text:
            left, _, right = text.partition(sep)
            return left.strip(), right.strip()
    return text.strip(), ""


# ── Sources blockquote (above Overview) ───────────────────────────────


_SOURCE_TOKEN_RE = re.compile(r"\*\*([A-Z][A-Z0-9]*)\*\*\s*(?:\(([^)]+)\))?")


def _extract_sources(body: str) -> List[Dict[str, Any]]:
    """Pull ``> Jira Projects: **DBADMIN** (459 issues), **WPM** (WUP epics), ...`` tokens.

    The parenthetical can be either a count (``459 issues``, ``15``) or a
    free-form note (``WUP epics``); we split on the first numeric leading
    token to decide which.
    """
    out: List[Dict[str, Any]] = []
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped.startswith("> "):
            continue
        if "Jira Projects" not in stripped and "Source" not in stripped:
            continue
        for key, parens in _SOURCE_TOKEN_RE.findall(stripped):
            entry: Dict[str, Any] = {"key": key, "kind": "jira", "name": key}
            parens = (parens or "").strip()
            if parens:
                m = re.match(r"^(\d+)\s*(.*)$", parens)
                if m:
                    entry["issues"] = int(m.group(1))
                    trailing = m.group(2).strip()
                    # "459 issues" → drop the word; "17 WUP epics" → keep "WUP epics"
                    if trailing and trailing.lower() not in {"issue", "issues"}:
                        entry["note"] = trailing
                else:
                    entry["note"] = parens
            out.append(entry)
    return out


# ── Progress table ────────────────────────────────────────────────────

_TONE_HINTS: Dict[str, str] = {
    "closed": "green",
    "done": "green",
    "passed": "green",
    "resolved": "green",
    "in progress": "blue",
    "qa on ppe": "blue",
    "deployment": "cyan",
    "stakeholder test": "cyan",
    "code review": "violet",
    "approved code review": "slate",
    "approved cr": "slate",
    "evaluating": "amber",
    "on hold": "amber",
    "groomed": "neutral",
    "evaluated": "neutral",
    "open": "neutral",
    "blocked": "red",
    "failed qa": "red",
}


def _parse_progress_table(lines: List[str]) -> Dict[str, Any]:
    """Extract progress buckets (label, count, tone) from a two-column table.

    Honours the markdown ``| Status | Count |`` table. The final row whose
    first cell says "**Total**" is consumed into ``total``. A following
    ``**Completion rate:** ...`` line provides the ``completion`` string.
    """
    buckets: List[Dict[str, Any]] = []
    total: Optional[int] = None
    completion: Optional[str] = None

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("**Completion"):
            completion = _strip_markup(stripped).replace("Completion rate:", "").strip()
            continue
        if not stripped.startswith("|"):
            continue
        cells = _split_table_row(stripped)
        if len(cells) < 2:
            continue
        label = _strip_markup(cells[0]).strip()
        if not label or label.lower() == "status" or label.startswith("-"):
            continue
        count = _parse_count(cells[1])
        if count is None:
            continue
        if label.lower() == "total":
            total = count
            continue
        tone = _tone_for(label)
        buckets.append({"label": label, "count": count, "tone": tone, "kind": _kind_for(tone)})

    return {
        "total": total,
        "completion": completion,
        "buckets": buckets,
    }


def _tone_for(label: str) -> str:
    key = label.lower()
    for token, tone in _TONE_HINTS.items():
        if token in key:
            return tone
    return "neutral"


def _kind_for(tone: str) -> str:
    if tone == "green":
        return "closed"
    if tone in {"blue", "cyan"}:
        return "pipeline" if tone == "cyan" else "active"
    if tone == "violet" or tone == "slate":
        return "review"
    if tone == "red":
        return "blocked"
    return "backlog"


# ── Active items (8 buckets) ──────────────────────────────────────────


_ACTIVE_BUCKETS: List[tuple[str, str]] = [
    ("blocked", "blocked"),
    ("in progress", "inProgress"),
    ("on hold", "onHold"),
    ("approved code review", "approvedReview"),
    ("code review", "codeReview"),
    ("open / unassigned", "openUnassigned"),
    ("evaluating", "evaluating"),
    ("evaluated", "evaluated"),
]


def _parse_active_items(lines: List[str]) -> Dict[str, List[Dict[str, Any]]]:
    """Walk `### <Bucket>` subheadings under `## Active Items`."""
    out: Dict[str, List[Dict[str, Any]]] = {key: [] for _, key in _ACTIVE_BUCKETS}
    current_key: Optional[str] = None

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("###"):
            heading = _strip_markup(stripped.lstrip("#")).strip(": ").lower()
            heading = re.sub(r"\s*\(.*?\)\s*$", "", heading).strip()
            current_key = None
            for alias, key in _ACTIVE_BUCKETS:
                if alias in heading:
                    current_key = key
                    break
            continue
        if current_key is None:
            continue
        if not stripped.startswith(("-", "*")):
            continue
        text = _strip_bullet_prefix(stripped)
        wid, display = _wikilink_target(text)
        # Title after " — "; assignee in parens at the end
        _, _, rest = text.partition("]]")
        rest = rest.strip(" —-")
        title, note = _split_dash(rest)
        assignee, note_text = _extract_parens(note or title)
        item: Dict[str, Any] = {
            "id": wid or display,
            "title": _strip_markup(title) or display,
            "assignee": assignee,
        }
        if note_text:
            item["note"] = note_text
            if "overdue" in note_text.lower():
                item["overdue"] = True
            if "moved" in note_text.lower() or "new" in note_text.lower():
                item["isNew"] = True
        out[current_key].append(item)
    return out


_PARENS_RE = re.compile(r"\(([^()]+)\)")


def _extract_parens(text: str) -> (tuple[Optional[str], Optional[str]]):  # type: ignore[valid-type]
    """Return (assignee, remaining-note) extracted from parenthesised suffix.

    The vault puts the assignee first in the parens; anything separated
    by ``,`` or ``;`` after the first segment is a note.
    """
    if not text:
        return None, None
    m = _PARENS_RE.search(text)
    if not m:
        return None, _strip_markup(text) or None
    inside = m.group(1)
    parts = re.split(r"[,;]\s*", inside, maxsplit=1)
    assignee = _strip_markup(parts[0]).strip()
    note = _strip_markup(parts[1]) if len(parts) > 1 else None
    if "unassigned" in assignee.lower():
        return None, note or assignee
    return assignee or None, note


# ── Key risks ─────────────────────────────────────────────────────────


def _parse_key_risks(lines: List[str]) -> List[Dict[str, str]]:
    """Risks are the bullets under `### Key Risks` inside `## Active Items`."""
    out: List[Dict[str, str]] = []
    in_risks = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("###"):
            in_risks = "key risks" in _strip_markup(stripped).lower()
            continue
        if not in_risks:
            continue
        if not stripped.startswith(("-", "*")):
            continue
        text = _strip_markup(_strip_bullet_prefix(stripped))
        tone = "red" if any(kw in text.lower() for kw in ("blocked", "overdue", "3 months")) else "amber"
        out.append({"tone": tone, "text": text})
    return out


# ── Burndown + velocity ───────────────────────────────────────────────


def _parse_burndown(lines: List[str]) -> (tuple[List[Dict[str, Any]], Dict[str, Any]]):  # type: ignore[valid-type]
    points: List[Dict[str, Any]] = []
    velocity_lines: List[str] = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("|"):
            cells = _split_table_row(stripped)
            if len(cells) < 3:
                continue
            month = _strip_markup(cells[0])
            if not month or month.lower() == "month" or month.startswith("-"):
                continue
            closed = _parse_count(cells[1])
            cum = _parse_count(cells[2])
            if closed is None or cum is None:
                continue
            partial = "partial" in month.lower()
            points.append({"month": _clean_month(month), "closed": closed, "cum": cum, "partial": partial})
        elif stripped:
            velocity_lines.append(stripped)

    velocity = _extract_velocity(velocity_lines)
    return points, velocity


_CLEAN_MONTH_RE = re.compile(r"\s*\(partial\)\s*", re.IGNORECASE)


def _clean_month(value: str) -> str:
    return _CLEAN_MONTH_RE.sub("", value).strip()


_VELOCITY_AVG_RE = re.compile(r"~?(\d+(?:\.\d+)?)\s*tasks?/week\s*\((?:Q1[^)]*)\)", re.IGNORECASE)
_VELOCITY_MAR_RE = re.compile(r"~?(\d+(?:\.\d+)?)\s*tasks?/week\s*\(March[^)]*\)", re.IGNORECASE)
_REMAINING_RE = re.compile(r"~?(\d+)\s+active tasks", re.IGNORECASE)
_PROJECTION_RE = re.compile(r"\*\*(mid[^*]+)\*\*", re.IGNORECASE)


def _extract_velocity(texts: List[str]) -> Dict[str, Any]:
    joined = " ".join(texts)
    q1 = _float_match(_VELOCITY_AVG_RE, joined)
    mar = _int_match(_VELOCITY_MAR_RE, joined)
    remaining = _int_match(_REMAINING_RE, joined)
    projection_match = _PROJECTION_RE.search(joined)
    projection = projection_match.group(1).strip() if projection_match else None
    # Parenthesised note after the bold range
    projection_note: Optional[str] = None
    if projection:
        after = joined.split(projection, 1)
        if len(after) > 1:
            m = re.search(r"\*\(([^*]+)\)\*", after[1])
            if m:
                projection_note = m.group(1).strip()
    return {
        "q1avg": q1,
        "marRate": mar,
        "remaining": remaining,
        "projection": projection,
        "projectionNote": projection_note,
    }


# ── Developer workload ────────────────────────────────────────────────


def _parse_devs(lines: List[str]) -> (tuple[List[Dict[str, Any]], List[str]]):  # type: ignore[valid-type]
    devs: List[Dict[str, Any]] = []
    observations: List[str] = []
    in_obs = False

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("**Observations"):
            in_obs = True
            continue
        if in_obs and stripped.startswith(("-", "*")):
            observations.append(_strip_markup(_strip_bullet_prefix(stripped)))
            continue
        if not stripped.startswith("|"):
            continue
        cells = _split_table_row(stripped)
        if len(cells) < 6:
            continue
        name = _strip_markup(cells[0])
        if not name or name.lower() == "developer" or name.startswith("-"):
            continue
        is_unassigned = "unassigned" in name.lower()
        devs.append(
            {
                "name": name.strip("*_ "),
                "inProgress": _parse_count(cells[1]) or 0,
                "codeReview": _parse_count(cells[2]) or 0,
                "pipeline": _parse_count(cells[3]) or 0,
                "backlog": _parse_count(cells[4]) or 0,
                "total": _parse_count(cells[5]) or 0,
                "unassigned": is_unassigned,
            }
        )

    return devs, observations


# ── Recent activity ───────────────────────────────────────────────────


def _parse_recent_activity(lines: List[str]) -> (tuple[List[Dict[str, Any]], Optional[str]]):  # type: ignore[valid-type]
    rows: List[Dict[str, Any]] = []
    summary: Optional[str] = None

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("**Summary"):
            summary = _strip_markup(stripped).replace("Summary:", "").strip()
            continue
        if not stripped.startswith("|"):
            continue
        cells = _split_table_row(stripped)
        if len(cells) < 4:
            continue
        first = _strip_markup(cells[0])
        if not first or first.lower() == "task" or first.startswith("-"):
            continue
        task_id, title = _wikilink_id_and_title(cells[0])
        status = _strip_markup(cells[1])
        assignee = _strip_markup(cells[2])
        updated = _strip_markup(cells[3])
        rows.append(
            {
                "id": task_id,
                "title": title,
                "status": status,
                "tone": _tone_for(status),
                "assignee": assignee,
                "updated": updated.replace("**", ""),
                "highlight": "**" in cells[3],
            }
        )
    return rows, summary


# ── Wikilink helpers ─────────────────────────────────────────────────


# Non-greedy to stop at the first ``]]`` — ``[^\]]+`` breaks on nested
# single brackets (e.g. ``[Private Link]`` inside a title segment).
_WIKILINK_FULL_RE = re.compile(r"\[\[(.+?)\]\]")


def _wikilink_id_and_title(text: str) -> (tuple[str, str]):  # type: ignore[valid-type]
    """Return ``(id, title)`` from a ``[[ID - Long Title|Display]]`` wikilink.

    ``_wikilink_target`` is designed for compact link rendering (it returns
    ``display`` which is typically the bare ID), but recent-activity rows
    want the human-readable title from the target side. Splitting the
    target on the first ``" - "`` yields the id prefix and the rest of
    the title. Falls back to the display text or stripped plaintext.
    """
    m = _WIKILINK_FULL_RE.search(text)
    if not m:
        plain = _strip_markup(text)
        return plain, plain
    inner = m.group(1)
    target, _, display = inner.partition("|")
    target = target.strip()
    display = (display or target).strip()
    wid, sep, rest = target.partition(" - ")
    if sep:
        title = rest.strip()
        # A trailing ``.md`` is leftover from filename-style links.
        if title.endswith(".md"):
            title = title[:-3]
        return wid.strip(), _strip_markup(title) or display
    return target, display


# ── Dependencies & Blockers ──────────────────────────────────────────


def _parse_dependencies_and_blockers(
    lines: List[str],
) -> (tuple[List[Dict[str, Any]], List[Dict[str, Any]], Optional[Dict[str, str]]]):  # type: ignore[valid-type]
    """Split the ``## Dependencies & Blockers`` section into three payloads.

    - Cross-project table (``### Active Cross-Project Dependencies``) —
      columns: This Task | Relationship | External Task | External Workstream.
    - Internal chains table (``### Active Internal Chains``) —
      columns: Blocked Task | Blocked By | Status of Blocker.
    - Trailing ``**Critical:** [[blocker-data-syncing]] — note`` line
      captured as ``criticalBlocker`` metadata.
    """
    cross: List[Dict[str, Any]] = []
    chains: List[Dict[str, Any]] = []
    critical: Optional[Dict[str, str]] = None

    sub: Optional[str] = None
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("###"):
            heading = _strip_markup(stripped.lstrip("#")).strip(": ").lower()
            if "cross-project" in heading:
                sub = "cross"
            elif "internal" in heading:
                sub = "chains"
            else:
                sub = None
            continue
        if stripped.startswith("**Critical"):
            # `**Critical:** [[blocker-…]] — data syncing scope at risk...`
            m = re.search(r"\*\*Critical:\*\*\s*(.*)", stripped)
            if m:
                rest = m.group(1)
                bid, _ = _wikilink_id_and_title(rest)
                left, sep, note = rest.partition("—")
                if not sep:
                    left, sep, note = rest.partition(" - ")
                title_text = _strip_markup(note).strip()
                critical = {
                    "id": bid,
                    "title": title_text or _strip_markup(left).strip() or bid,
                    "note": title_text or _strip_markup(rest),
                }
            continue
        if not stripped.startswith("|") or sub is None:
            continue
        cells = _split_table_row(stripped)
        if len(cells) < 3:
            continue
        first = _strip_markup(cells[0])
        if not first or first.startswith("-") or first.lower() in {"this task", "blocked task"}:
            continue
        if sub == "cross" and len(cells) >= 4:
            from_id, from_title = _wikilink_id_and_title(cells[0])
            from_status = _parenthetical(cells[0])
            relation = _strip_markup(cells[1])
            to_id, to_title = _wikilink_id_and_title(cells[2])
            area_raw = _strip_markup(cells[3])
            area = _first_wikilink_id(cells[3]) or area_raw
            cross.append(
                {
                    "from": from_id,
                    "fromTitle": from_title,
                    "fromStatus": from_status,
                    "relation": relation,
                    "to": to_id,
                    "toTitle": to_title,
                    "area": area,
                }
            )
        elif sub == "chains" and len(cells) >= 3:
            blocked_id, blocked_title = _wikilink_id_and_title(cells[0])
            blocker_id, blocker_title = _wikilink_id_and_title(cells[1])
            blocker_status_raw = _strip_markup(cells[2])
            resolved = ("✅" in blocker_status_raw) or ("✓" in blocker_status_raw)
            blocker_status = (
                blocker_status_raw.replace("✅", "").replace("✓", "").strip(" —-")
                or blocker_status_raw
            )
            chains.append(
                {
                    "blocked": blocked_id,
                    "blockedTitle": blocked_title,
                    "blockedBy": blocker_id,
                    "blockerTitle": blocker_title,
                    "blockerStatus": blocker_status,
                    "resolved": resolved,
                }
            )

    return cross, chains, critical


_PARENTHETICAL_RE = re.compile(r"\(([^()]+)\)")


def _parenthetical(text: str) -> Optional[str]:
    """Return the first parenthesised fragment (e.g. ``(QA on PPE)``)."""
    m = _PARENTHETICAL_RE.search(text)
    return _strip_markup(m.group(1)).strip() if m else None


def _first_wikilink_id(text: str) -> Optional[str]:
    wid, _ = _wikilink_id_and_title(text)
    return wid if wid and wid.startswith("ws-") else None


# ── Asana ↔ Jira cross-references ─────────────────────────────────────


def _parse_asana_jira(
    lines: List[str],
) -> (tuple[List[Dict[str, Any]], List[Dict[str, str]]]):  # type: ignore[valid-type]
    """Parse the Asana ↔ Jira cross-reference table + its trailing notes."""
    rows: List[Dict[str, Any]] = []
    notes: List[Dict[str, str]] = []

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("**"):
            note = _strip_markup(stripped)
            if not note:
                continue
            tone = "red" if ("misalignment" in note.lower() or "⚠️" in stripped) else "amber"
            # Only surface the two summary notes from the MD; footnotes
            # (``★ Same Asana task``) stay inline with the row.
            if "misalignment" in note.lower() or "not in the WPM" in note or "not in export" in note.lower():
                notes.append({"tone": tone, "text": note})
            continue
        if not stripped.startswith("|"):
            continue
        cells = _split_table_row(stripped)
        if len(cells) < 6:
            continue
        first = _strip_markup(cells[0])
        if not first or first.startswith("-") or first.lower() in {"asana task", "asana"}:
            continue
        asana_id, asana_link_title = _wikilink_id_and_title(cells[0])
        description = _strip_markup(cells[1]) or asana_link_title
        jira_id, _ = _wikilink_id_and_title(cells[2])
        if jira_id.lower() in {"", "—", "-"}:
            jira_id = None
        asana_status = _strip_markup(cells[3]) or None
        jira_status = _strip_markup(cells[4]) or None
        aligned_raw = _strip_markup(cells[5]).lower()
        aligned = "unknown"
        if "no jira link" in aligned_raw:
            aligned = "no-link"
        elif "no" in aligned_raw or "misaligned" in aligned_raw or "⚠️ no" in aligned_raw:
            aligned = "no"
        elif "yes" in aligned_raw or "✓" in aligned_raw:
            aligned = "yes"
        rows.append(
            {
                "asana": asana_id,
                "asanaTitle": description,
                "jira": jira_id,
                "asanaStatus": asana_status,
                "jiraStatus": jira_status,
                "aligned": aligned,
            }
        )

    return rows, notes


# ── Asana Coverage ───────────────────────────────────────────────────


_LPWE_COUNT_RE = re.compile(r"\*\*LPWE[^*]*\*\*\s*[:—-]?\s*(\d+)\s*tasks?", re.IGNORECASE)
_LAMPS_IMPL_RE = re.compile(r"\*\*LAMPSPLUS Implementation:\*\*\s*~?(\d+)\s*tasks?", re.IGNORECASE)
_LAMPS_ACTION_RE = re.compile(r"\*\*LAMPSPLUS Action Items:\*\*\s*(\d+)\s*open", re.IGNORECASE)


def _parse_asana_coverage(lines: List[str]) -> Optional[Dict[str, Any]]:
    """Summarise the ``## Asana Coverage`` section into three cards.

    Returns None when the section is missing so the UI can skip the
    panel entirely rather than render empty scaffolding.
    """
    if not lines:
        return None

    joined = "\n".join(lines)

    impl_count: Optional[int] = None
    impl_note = ""
    action_count: Optional[int] = None
    action_note = ""
    action_tasks: List[str] = []
    lpwe_count: Optional[int] = None
    lpwe_note = ""

    m = _LAMPS_IMPL_RE.search(joined)
    if m:
        impl_count = int(m.group(1))
        # Note is the content immediately after "(LAMPSPLUS Implementation: …)"
        impl_note = _trail_after(joined, m.end())

    m = _LAMPS_ACTION_RE.search(joined)
    if m:
        action_count = int(m.group(1))
        action_note = _trail_after(joined, m.end())

    m = _LPWE_COUNT_RE.search(joined)
    if m:
        lpwe_count = int(m.group(1))
        lpwe_note = _trail_after(joined, m.end())

    # Collect sub-bullets under Key Tasks / Action Items
    in_key_tasks = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith("###"):
            heading = _strip_markup(stripped.lstrip("#")).strip(": ").lower()
            in_key_tasks = "key tasks" in heading
            continue
        if in_key_tasks and stripped.startswith(("-", "*")):
            text = _strip_bullet_prefix(stripped)
            # Collapse any [[target|display]] to the display text so the
            # UI renders a readable label instead of wikilink markup.
            text = _WIKILINK_FULL_RE.sub(
                lambda m: (m.group(1).split("|", 1)[-1]).strip(), text
            )
            text = _strip_markup(text)
            if text:
                action_tasks.append(text)

    if impl_count is None and action_count is None and lpwe_count is None:
        return None

    return {
        "implementation": {"count": impl_count or 0, "note": impl_note.strip(" .")},
        "actionItems": {
            "count": action_count or 0,
            "note": action_note.strip(" ."),
            "tasks": action_tasks,
        },
        "lpwe": {"count": lpwe_count or 0, "note": lpwe_note.strip(" .")},
    }


def _trail_after(text: str, start: int) -> str:
    """Return the first line of text starting at ``start``, stripped."""
    tail = text[start:]
    first_line = tail.split("\n", 1)[0]
    return _strip_markup(first_line)


# ── Decisions ─────────────────────────────────────────────────────────


def _parse_decisions(lines: List[str]) -> (tuple[List[Dict[str, str]], Optional[str]]):  # type: ignore[valid-type]
    rows: List[Dict[str, str]] = []
    context: Optional[str] = None

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("**Key context"):
            context = _strip_markup(stripped).replace("Key context:", "").strip()
            continue
        if not stripped.startswith("|"):
            continue
        cells = _split_table_row(stripped)
        if len(cells) < 4:
            continue
        date = _strip_markup(cells[0])
        if not date or date.lower() == "date" or date.startswith("-"):
            continue
        decision_id, decision_text = _wikilink_target(cells[1])
        rows.append(
            {
                "date": date,
                "id": decision_id,
                "decision": _strip_markup(cells[1]).split(":", 1)[-1].strip() or decision_text,
                "status": _strip_markup(cells[2]),
                "impact": _strip_markup(cells[3]),
            }
        )
    return rows, context


# ── Cross-refs ────────────────────────────────────────────────────────


def _parse_cross_refs(lines: List[str]) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    for line in lines:
        stripped = line.strip()
        if not stripped.startswith("|"):
            continue
        cells = _split_table_row(stripped)
        if len(cells) < 2:
            continue
        area = _strip_markup(cells[0])
        if not area or area.lower() == "area" or area.startswith("-"):
            continue
        # Second cell may have multiple wikilinks separated by `,`
        targets = re.findall(r"ws-[a-z0-9-]+", cells[1])
        for ws in targets:
            out.append({"area": area, "ws": ws})
        if not targets:
            out.append({"area": area, "ws": _strip_markup(cells[1])})
    return out


# ── Team ──────────────────────────────────────────────────────────────


def _parse_team(lines: List[str]) -> List[str]:
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        m = re.search(r"Key assignees?:\s*(.+)", stripped, re.IGNORECASE)
        if m:
            return [n.strip() for n in m.group(1).split(",") if n.strip()]
    return []


# ── Scalar helpers ────────────────────────────────────────────────────


def _parse_count(cell: str) -> Optional[int]:
    cell = _strip_markup(cell).replace(",", "").strip("* ")
    if not cell:
        return None
    m = re.search(r"(\d+)", cell)
    if not m:
        return None
    try:
        return int(m.group(1))
    except ValueError:
        return None


def _int_or_none(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, int):
        return value
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def _float_match(pattern: re.Pattern, text: str) -> Optional[float]:
    m = pattern.search(text)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def _int_match(pattern: re.Pattern, text: str) -> Optional[int]:
    m = pattern.search(text)
    if not m:
        return None
    try:
        return int(float(m.group(1)))
    except ValueError:
        return None
