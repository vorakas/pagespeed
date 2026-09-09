"""Transform Zephyr Scale change history into Test Case Database records."""

from __future__ import annotations

import html
import re
from typing import Any

IMPORT_STATUS = "Imported"
IMPORT_TAG = "zephyr-import"

_STEP_FIELD_RE = re.compile(r'^TEST_SCRIPT\.STEP\.(?P<kind>[A-Z_]+) \{"step":(?P<step>\d+)\}$')
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_PLACEHOLDER_ONLY_RE = re.compile(r"^(\{[^{}]*\})*$")

_STEP_KIND_LABELS = {
    "DESCRIPTION": "Description",
    "EXPECTED_RESULT": "Expected Result",
    "TEST_DATA": "Test Data",
    "ADDED": "Added",
    "REMOVED": "Removed",
}


def prettify_field_name(field_name: str) -> str:
    """Human heading for a Zephyr history fieldName."""
    match = _STEP_FIELD_RE.match(field_name)
    if match:
        kind = _STEP_KIND_LABELS.get(match.group("kind"), match.group("kind").replace("_", " ").title())
        return f"Step {match.group('step')} — {kind}"
    if re.fullmatch(r"[A-Z_]+", field_name):
        return field_name.replace("_", " ").title()
    return field_name


def format_step_ranges(steps: list[int]) -> str:
    """Compress step numbers: [1,2,3,5] -> '1-3, 5'."""
    ordered = sorted(set(steps))
    ranges: list[str] = []
    start = previous = ordered[0]
    for step in ordered[1:]:
        if step == previous + 1:
            previous = step
            continue
        ranges.append(f"{start}-{previous}" if start != previous else str(start))
        start = previous = step
    ranges.append(f"{start}-{previous}" if start != previous else str(start))
    return ", ".join(ranges)


def _decoded(value: str | None) -> str:
    return html.unescape(value or "")


def _visible_text(value: str | None) -> str:
    """Tag-stripped, entity-decoded text with whitespace and word-joiners removed."""
    without_tags = _HTML_TAG_RE.sub("", value or "")
    decoded = html.unescape(without_tags)
    return re.sub(r"[\s⁠​]+", "", decoded)


def _is_noise(field_name: str, original: str | None, new: str | None) -> bool:
    if _decoded(original) == _decoded(new):
        return True
    match = _STEP_FIELD_RE.match(field_name)
    if match and match.group("kind") == "TEST_DATA":
        original_text = _visible_text(original)
        new_text = _visible_text(new)
        if _PLACEHOLDER_ONLY_RE.fullmatch(original_text) and _PLACEHOLDER_ONLY_RE.fullmatch(new_text):
            return True
    return False


def _step_marker(field_name: str) -> tuple[str, int] | None:
    """Return ('ADDED'|'REMOVED', step) for add/remove marker items, else None."""
    match = _STEP_FIELD_RE.match(field_name)
    if match and match.group("kind") in {"ADDED", "REMOVED"}:
        return match.group("kind"), int(match.group("step"))
    return None


def _steps_phrase(verb: str, steps: list[int]) -> str:
    noun = "step" if len(set(steps)) == 1 else "steps"
    return f"{verb} {noun} {format_step_ranges(steps)}"


def _compose_summary(
    surviving: list[dict[str, Any]],
    added_steps: list[int],
    removed_steps: list[int],
) -> str:
    parts: list[str] = []
    seen_fields: set[str] = set()
    updated_steps: list[int] = []
    for item in surviving:
        field_name = str(item.get("fieldName") or "")
        match = _STEP_FIELD_RE.match(field_name)
        if match:
            updated_steps.append(int(match.group("step")))
            continue
        if field_name in seen_fields:
            continue
        seen_fields.add(field_name)
        if field_name == "FOLDER":
            parts.append("Moved folder")
        else:
            parts.append(f"Updated {prettify_field_name(field_name)}")
    if updated_steps:
        parts.append(_steps_phrase("updated", updated_steps))
    if added_steps:
        parts.append(_steps_phrase("added", added_steps))
    if removed_steps:
        parts.append(_steps_phrase("removed", removed_steps))
    summary = "; ".join(parts)
    return summary[0].upper() + summary[1:] if summary else summary


def _compose_sections(surviving: list[dict[str, Any]]) -> tuple[str, str]:
    before_parts: list[str] = []
    after_parts: list[str] = []
    for item in surviving:
        heading = f"<h4>{prettify_field_name(str(item.get('fieldName') or ''))}</h4>"
        before_parts.append(heading + (item.get("originalValue") or "<p>—</p>"))
        after_parts.append(heading + (item.get("newValue") or "<p>—</p>"))
    return "".join(before_parts), "".join(after_parts)


def transform_entry(
    entry: dict[str, Any],
    test_case_key: str,
    test_case_name: str,
    jira_base_url: str,
) -> dict[str, Any] | None:
    """One Zephyr history entry (one save) -> one change record, or None if pure noise."""
    base_record = {
        "test_case_id": test_case_key,
        "title": test_case_name,
        "test_case_url": f"{jira_base_url.rstrip('/')}/secure/Tests.jspa#/testCase/{test_case_key}",
        "changed_by": str(entry.get("userKey") or ""),
        "change_date": str(entry.get("historyDate") or ""),
        "status": IMPORT_STATUS,
        "tags": [IMPORT_TAG],
        "associated_bugs": [],
        "associated_tasks": [],
        "zephyr_history_id": entry.get("id"),
    }

    if str(entry.get("type") or "").upper() == "CREATE":
        return {**base_record, "change_summary": "Test case created", "before_state": "", "after_state": ""}

    surviving: list[dict[str, Any]] = []
    added_steps: list[int] = []
    removed_steps: list[int] = []
    for item in entry.get("changeHistoryItems") or []:
        field_name = str(item.get("fieldName") or "")
        marker = _step_marker(field_name)
        if marker:
            (added_steps if marker[0] == "ADDED" else removed_steps).append(marker[1])
            continue
        if _is_noise(field_name, item.get("originalValue"), item.get("newValue")):
            continue
        surviving.append(item)

    if not surviving and not added_steps and not removed_steps:
        return None

    before_state, after_state = _compose_sections(surviving)
    return {
        **base_record,
        "change_summary": _compose_summary(surviving, added_steps, removed_steps),
        "before_state": before_state,
        "after_state": after_state,
    }
