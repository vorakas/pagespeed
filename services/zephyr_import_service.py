"""Transform Zephyr Scale change history into Test Case Database records."""

from __future__ import annotations

import html
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from html.parser import HTMLParser
from typing import Any

from data_access.test_case_database_repository import TestCaseDatabaseRepository
from services.zephyr_history_client import ZephyrHistoryClient

IMPORT_STATUS = "Imported"
IMPORT_TAG = "zephyr-import"

_STEP_FIELD_RE = re.compile(r'^TEST_SCRIPT\.STEP\.(?P<kind>[A-Z_]+) \{"step":(?P<step>\d+)\}$')
_HTML_TAG_RE = re.compile(r"<[^>]+>")
_PLACEHOLDER_ONLY_RE = re.compile(r"^(\{[^{}]*\})*$")

_STEP_KIND_LABELS = {
    "DESCRIPTION": "Description",
    "EXPECTED_RESULT": "Expected Result",
    "TEST_DATA": "Test Data",
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
    if not ordered:
        return ""
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


def _decoded(value: Any) -> str:
    return html.unescape("" if value is None else str(value))


def _visible_text(value: Any) -> str:
    """Tag-stripped, entity-decoded text with whitespace and word-joiners removed."""
    without_tags = _HTML_TAG_RE.sub("", "" if value is None else str(value))
    decoded = html.unescape(without_tags)
    return re.sub(r"[\s\u2060\u200b]+", "", decoded)


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


class _ZephyrHtmlToRichText(HTMLParser):
    """Flatten Zephyr's HTML field values into the app's rich-text markup."""

    _BOLD_TAGS = {"strong", "b"}
    _ITALIC_TAGS = {"em", "i"}
    _HEADING_TAGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
    _BLOCK_TAGS = {"div", "blockquote", "tr", "dt", "dd"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._out: list[str] = []
        self._list_stack: list[dict[str, Any]] = []
        self._inline_stack: list[dict[str, Any]] = []
        self._in_pre = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("ol", "ul"):
            self._list_stack.append({"tag": tag, "count": 0})
        elif tag == "li":
            self._newline()
            if self._list_stack and self._list_stack[-1]["tag"] == "ol":
                self._list_stack[-1]["count"] += 1
                self._out.append(f"{self._list_stack[-1]['count']}. ")
            else:
                self._out.append("- ")
        elif tag == "p":
            self._blankline()
        elif tag == "br":
            self._newline()
        elif tag == "pre":
            self._in_pre = True
            self._newline()
        elif tag in self._HEADING_TAGS:
            self._newline()
            self._push_inline("**", "**")
        elif tag in self._BLOCK_TAGS:
            self._newline()
        elif tag in self._BOLD_TAGS:
            self._push_inline("**", "**")
        elif tag in self._ITALIC_TAGS:
            self._push_inline("*", "*")
        elif tag == "u":
            self._push_inline("<u>", "</u>")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("ol", "ul"):
            if self._list_stack:
                self._list_stack.pop()
            self._newline()
        elif tag in ("li", "p"):
            self._newline()
        elif tag == "pre":
            self._in_pre = False
            self._newline()
        elif tag in self._HEADING_TAGS:
            self._pop_inline()
            self._newline()
        elif tag in self._BLOCK_TAGS:
            self._newline()
        elif tag in ("td", "th"):
            if self._out and not self._out[-1].endswith(("\n", " ")):
                self._out.append(" ")
        elif tag in self._BOLD_TAGS or tag in self._ITALIC_TAGS or tag == "u":
            self._pop_inline()

    def handle_data(self, data: str) -> None:
        cleaned = re.sub(r"[\u2060\u200b]", "", data)
        if self._in_pre:
            self._out.append(cleaned)
            return
        collapsed = re.sub(r"\s+", " ", cleaned)
        if not collapsed:
            return
        if collapsed == " " and (not self._out or self._out[-1].endswith("\n")):
            return
        if any(marker["open"] in ("**", "*") for marker in self._inline_stack):
            collapsed = collapsed.replace("*", "")
            if not collapsed:
                return
        self._reopen_suspended()
        if collapsed.strip():
            for marker in self._inline_stack:
                marker["has_content"] = True
        self._out.append(collapsed)

    def _push_inline(self, open_marker: str, close_marker: str) -> None:
        if open_marker == "**" and any(
            marker["open"] == "**" for marker in self._inline_stack
        ):
            open_marker = close_marker = ""
        self._inline_stack.append(
            {
                "open": open_marker,
                "close": close_marker,
                "suspended": False,
                "has_content": False,
                "open_index": len(self._out),
            }
        )
        self._out.append(open_marker)

    def _pop_inline(self) -> None:
        if not self._inline_stack:
            return
        marker = self._inline_stack.pop()
        if marker["suspended"]:
            return
        if marker["has_content"]:
            self._out.append(marker["close"])
        else:
            self._drop_opener(marker)

    def _reopen_suspended(self) -> None:
        for marker in self._inline_stack:
            if marker["suspended"]:
                marker["open_index"] = len(self._out)
                marker["suspended"] = False
                marker["has_content"] = False
                self._out.append(marker["open"])

    def _drop_opener(self, marker: dict[str, Any]) -> None:
        index = marker["open_index"]
        if index < len(self._out) and self._out[index] == marker["open"]:
            del self._out[index]

    def _newline(self) -> None:
        if not self._out or self._out[-1].endswith("\n"):
            return
        for marker in reversed(self._inline_stack):
            if marker["suspended"]:
                continue
            if marker["has_content"]:
                self._out.append(marker["close"])
            else:
                self._drop_opener(marker)
            marker["suspended"] = True
        self._out.append("\n")

    def _blankline(self) -> None:
        self._newline()
        self._out.append("\n")

    def text(self) -> str:
        lines = [line.rstrip() for line in "".join(self._out).split("\n")]
        result: list[str] = []
        for line in lines:
            if not line and result and not result[-1]:
                continue
            result.append(line)
        while result and not result[0]:
            result.pop(0)
        while result and not result[-1]:
            result.pop()
        return "\n".join(result)


def html_to_rich_text(value: Any) -> str:
    """Convert a Zephyr HTML field value to the frontend's rich-text markup."""
    parser = _ZephyrHtmlToRichText()
    parser.feed("" if value is None else str(value))
    parser.close()
    return parser.text()


def _compose_sections(surviving: list[dict[str, Any]]) -> tuple[str, str]:
    before_parts: list[str] = []
    after_parts: list[str] = []
    for item in surviving:
        heading = f"**{prettify_field_name(str(item.get('fieldName') or ''))}**"
        before_parts.append(f"{heading}\n{html_to_rich_text(item.get('originalValue')) or '—'}")
        after_parts.append(f"{heading}\n{html_to_rich_text(item.get('newValue')) or '—'}")
    return "\n\n".join(before_parts), "\n\n".join(after_parts)


def transform_entry(
    entry: dict[str, Any],
    test_case_key: str,
    test_case_name: str,
    jira_base_url: str,
) -> dict[str, Any] | None:
    """One Zephyr history entry (one save) -> one change record, or None if pure noise."""
    try:
        history_id = int(entry.get("id"))
    except (TypeError, ValueError):
        return None

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
        "zephyr_history_id": history_id,
    }

    if str(entry.get("type") or "").upper() == "CREATE":
        return {**base_record, "change_summary": "Test case created", "before_state": "", "after_state": ""}

    surviving: list[dict[str, Any]] = []
    added_steps: list[int] = []
    removed_steps: list[int] = []
    items = entry.get("changeHistoryItems")
    if not isinstance(items, list):
        items = []
    for item in items:
        if not isinstance(item, dict):
            continue
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


class ZephyrImportService:
    """Import Zephyr Scale change history into the Test Case Database."""

    def __init__(
        self,
        jira_pat: str,
        repository: TestCaseDatabaseRepository,
        client: ZephyrHistoryClient | None = None,
        jira_base_url: str = "https://lampstrack.lampsplus.com",
        max_workers: int = 8,
    ) -> None:
        self.jira_pat = jira_pat
        self.jira_base_url = jira_base_url.rstrip("/")
        self._repository = repository
        self._client = client or ZephyrHistoryClient(jira_pat, jira_base_url)
        self._max_workers = max_workers

    def run_import(self, project_id: int, folder: str) -> dict[str, Any]:
        if not self.jira_pat:
            raise ValueError("JIRA_PAT is not configured")

        test_cases = self._client.search_test_cases(project_id, folder)
        failures: list[dict[str, str]] = []
        histories: dict[str, tuple[str, list[dict[str, Any]]]] = {}

        with ThreadPoolExecutor(max_workers=self._max_workers) as executor:
            futures = {
                executor.submit(self._fetch_case_history, str(case.get("key") or "")): case
                for case in test_cases
                if case.get("key")
            }
            for future in as_completed(futures):
                case = futures[future]
                key = str(case.get("key") or "")
                try:
                    histories[key] = (str(case.get("name") or key), future.result())
                except Exception as exc:  # noqa: BLE001 - collected into the run summary
                    failures.append({"key": key, "error": str(exc)})

        records: list[dict[str, Any]] = []
        skipped_empty = 0
        seen_entry_ids: set[int] = set()
        for key, (name, entries) in histories.items():
            for entry in entries:
                entry_id = entry.get("id")
                if entry_id in seen_entry_ids:
                    continue
                if entry_id is not None:
                    seen_entry_ids.add(entry_id)
                record = transform_entry(entry, key, name, self.jira_base_url)
                if record is None:
                    skipped_empty += 1
                    continue
                records.append(record)

        existing_ids = self._repository.existing_zephyr_history_ids(
            [record["zephyr_history_id"] for record in records if record["zephyr_history_id"] is not None]
        )
        created = 0
        skipped_existing = 0
        for record in records:
            if record["zephyr_history_id"] in existing_ids:
                skipped_existing += 1
                continue
            self._repository.create_change(record)
            created += 1

        return {
            "testCases": len(test_cases),
            "recordsCreated": created,
            "skippedExisting": skipped_existing,
            "skippedEmpty": skipped_empty,
            "failures": failures,
        }

    def _fetch_case_history(self, test_case_key: str) -> list[dict[str, Any]]:
        """History entries across every version of one test case, merged by entry id."""
        entries: list[dict[str, Any]] = []
        seen_ids: set[int] = set()
        for version_id in self._client.version_ids(test_case_key):
            for entry in self._client.fetch_history(version_id):
                entry_id = entry.get("id")
                if entry_id in seen_ids:
                    continue
                if entry_id is not None:
                    seen_ids.add(entry_id)
                entries.append(entry)
        return entries
