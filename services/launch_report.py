from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from math import ceil
from typing import Iterable, Optional

from services.obsidian_sync.raw_scanner import RawTask


PHASE_LABEL = "AC-P1"
SECTION_DEVELOPMENT = "lampsPlusDevelopment"
SECTION_E2E = "e2eTesting"

DIAGNOSTIC_KEYS = (
    "countedIssueCount",
    "excludedIssueCount",
    "missingEpicLinkCount",
    "unresolvedEpicNameCount",
    "missingPhaseLabelCount",
    "missingEstimateCount",
)
MAX_PARENT_DEPTH = 20

DEVELOPMENT_GROUPINGS = [
    "AC Implementation - App Builder Integration",
    "AC Implementation - Commerce Implementation",
    "AC Implementation - Edge Delivery System (EDS) Implementation",
    "AC Implementation - Misc",
    "AC Implementation - ROUND 1 E2E Bugs",
    "AC Implementation - Supporting Environment Setup",
    "AC Implementation - Tealium Integration (Phase 1)",
    "LP Implementation - Attribute Data Cleanup",
    "LP Implementation - Bloomreach - Post MVP - Misc",
    "LP Implementation - Dynamic Yield - Evaluators",
    "LP Implementation - Misc",
    "LP Implementation - Taxonomy - Batch B",
    "WUP - Azure Private Linking - Default",
    "WUP - Azure Private Linking - Ingestion",
    "WUP - Azure Private Linking - Product Data",
    "WUP - Azure Private Linking - Profile Data",
    "WUP - Azure Private Linking - Relationships",
    "WUP - Dashboard - Infrastructure",
    "WUP - Dashboard - Monitoring API Microservices",
    "WUP - Dashboard - Monitoring Near Real Time Data Syncing",
    "WUP - Dashboard - Monitoring Private Link",
    "WUP - Lighting Collections",
    "WUP - Near Real Time Data Syncing",
    "WUP - SSIS Optimization Effort for DBCLUST2",
    "WUP - SSIS Optimization Effort for DBTEST",
]

E2E_GROUPINGS = [
    "AC E2E - Account Management",
    "AC E2E - ATP",
    "AC E2E - Billing",
    "AC E2E - Card Reader",
    "AC E2E - Cart Overview",
    "AC E2E - Catalog Opt Out",
    "AC E2E - Cookie Consent",
    "AC E2E - Dynamic Yield",
    "AC E2E - Easy Post Email Templates",
    "AC E2E - Employee Tools",
    "AC E2E - Exploratory Testing",
    "AC E2E - Financial Calculators",
    "AC E2E - Gift Card",
    "AC E2E - Header & Footer",
    "AC E2E - Homepage & Navigation",
    "AC E2E - Incentivized Email",
    "AC E2E - Inventory",
    "AC E2E - Load Rules for PDP & PLA Product Panel",
    "AC E2E - MAO New Order & Order Update",
    "AC E2E - Marketing Parameters",
    "AC E2E - Order Confirmation",
    "AC E2E - Other Pages",
    "AC E2E - PDP",
    "AC E2E - Pixels",
    "AC E2E - PLP",
    "AC E2E - Resubmit Utility",
    "AC E2E - Shipping",
    "AC E2E - Stores",
    "AC E2E - Turn To",
    "AC E2E - Data Syncing",
    "AC E2E - User Session Management",
    "AC E2E - Wish List",
]
REPORT_GROUPINGS = frozenset(DEVELOPMENT_GROUPINGS + E2E_GROUPINGS)


def build_launch_report(
    tasks: Iterable[RawTask],
    *,
    generated_at: Optional[datetime] = None,
) -> dict:
    rows = list(tasks)
    by_key = {task.key: task for task in rows if task.key}
    grouped, epic_keys, unassigned_diagnostics = _group_tasks_by_report_grouping(rows, by_key)
    generated = generated_at or datetime.now(timezone.utc)
    development_rows = [
        _development_row(name, grouped.get(name, []), epic_keys.get(name))
        for name in DEVELOPMENT_GROUPINGS
    ]
    e2e_rows = [
        _e2e_row(name, grouped.get(name, []), epic_keys.get(name))
        for name in E2E_GROUPINGS
    ]

    return {
        "phase": PHASE_LABEL,
        "generatedAt": generated.isoformat(),
        SECTION_DEVELOPMENT: {
            "rows": development_rows,
            "totals": _totals(development_rows),
            "diagnostics": _section_diagnostics(
                development_rows,
                unassigned_diagnostics[SECTION_DEVELOPMENT],
            ),
        },
        SECTION_E2E: {
            "rows": e2e_rows,
            "totals": _totals(e2e_rows),
            "diagnostics": _section_diagnostics(
                e2e_rows,
                unassigned_diagnostics[SECTION_E2E],
            ),
        },
    }


def _group_tasks_by_report_grouping(
    tasks: list[RawTask],
    by_key: dict[str, RawTask],
) -> tuple[dict[str, list[RawTask]], dict[str, str], dict[str, dict]]:
    grouped: dict[str, list[RawTask]] = defaultdict(list)
    epic_keys: dict[str, str] = {}
    unassigned_diagnostics = {
        SECTION_DEVELOPMENT: _empty_diagnostics(),
        SECTION_E2E: _empty_diagnostics(),
    }

    for task in tasks:
        grouping, epic_key, diagnostic_key = _report_grouping(task, by_key)
        if grouping in REPORT_GROUPINGS:
            grouped[grouping].append(task)
            if epic_key:
                epic_keys.setdefault(grouping, epic_key)
        elif not _is_epic(task) and diagnostic_key:
            section = _section_for_task(task)
            unassigned_diagnostics[section][diagnostic_key] += 1

    return grouped, epic_keys, unassigned_diagnostics


def _report_grouping(
    task: RawTask,
    by_key: dict[str, RawTask],
    visited: Optional[set[str]] = None,
    depth: int = 0,
) -> tuple[Optional[str], Optional[str], Optional[str]]:
    visited = visited or set()
    task_key = task.key or ""
    if task_key:
        if task_key in visited:
            return None, None, "missingEpicLinkCount"
        visited.add(task_key)
    if depth > MAX_PARENT_DEPTH:
        return None, None, "missingEpicLinkCount"

    if _is_epic(task):
        return task.summary, task.key, None
    if task.epic_link:
        if task.epic_link in REPORT_GROUPINGS:
            return task.epic_link, None, None
        epic = by_key.get(task.epic_link)
        if epic and epic.summary:
            return epic.summary, epic.key, None
        return None, None, "unresolvedEpicNameCount"
    if task.parent_key:
        parent = by_key.get(task.parent_key)
        if parent:
            parent_grouping, parent_epic_key, parent_diagnostic = _report_grouping(
                parent,
                by_key,
                visited,
                depth + 1,
            )
            if parent_grouping:
                return parent_grouping, parent_epic_key, None
            if parent_diagnostic:
                return None, None, parent_diagnostic
        return None, None, "missingEpicLinkCount"
    return None, None, "missingEpicLinkCount"


def _development_row(report_grouping: str, tasks: list[RawTask], epic_key: Optional[str]) -> dict:
    counted, excluded = _partition_counted(tasks)
    completed_hours = _hours(sum(_seconds(task.time_spent_seconds) for task in counted))
    remaining_hours = _hours(sum(_seconds(task.remaining_estimate_seconds) for task in counted))

    return {
        "reportGrouping": report_grouping,
        "epicKey": epic_key,
        "phaseLabel": PHASE_LABEL,
        "completedHours": completed_hours,
        "remainingHours": remaining_hours,
        "progressPercent": _progress_percent(completed_hours, remaining_hours),
        "status": _status(completed_hours, remaining_hours),
        "issueKeys": _issue_keys(counted),
        "diagnostics": _diagnostics(counted, excluded),
    }


def _e2e_row(report_grouping: str, tasks: list[RawTask], epic_key: Optional[str]) -> dict:
    counted, excluded = _partition_counted(tasks)
    completed_hours = _hours(sum(_seconds(task.time_spent_seconds) for task in counted))
    remaining_hours = _hours(sum(_seconds(task.remaining_estimate_seconds) for task in counted))

    return {
        "reportGrouping": report_grouping,
        "epicKey": epic_key,
        "phaseLabel": PHASE_LABEL,
        "passedTc": sum(1 for task in counted if _normalized_status(task) == "closed"),
        "failedTc": sum(1 for task in counted if _normalized_status(task) == "failed qa"),
        "cnxOk": None,
        "doneCount": None,
        "completedHours": completed_hours,
        "remainingHours": remaining_hours,
        "progressPercent": _progress_percent(completed_hours, remaining_hours),
        "issueKeys": _issue_keys(counted),
        "diagnostics": _diagnostics(counted, excluded),
    }


def _partition_counted(tasks: list[RawTask]) -> tuple[list[RawTask], list[RawTask]]:
    issue_tasks = [task for task in tasks if not _is_epic(task)]
    counted = [task for task in issue_tasks if PHASE_LABEL in (task.labels or [])]
    excluded = [task for task in issue_tasks if PHASE_LABEL not in (task.labels or [])]
    return counted, excluded


def _diagnostics(counted: list[RawTask], excluded: list[RawTask]) -> dict:
    excluded_keys = _issue_keys(excluded)
    diagnostics = _empty_diagnostics()
    diagnostics.update({
        "countedIssueCount": len(_issue_keys(counted)),
        "missingPhaseLabelCount": len(excluded_keys),
        "excludedIssueCount": len(excluded_keys),
        "missingEstimateCount": sum(1 for task in counted if _missing_estimate(task)),
        "excludedIssueKeys": excluded_keys,
    })
    return diagnostics


def _section_diagnostics(rows: list[dict], unassigned: dict) -> dict:
    diagnostics = _empty_diagnostics()
    for key in DIAGNOSTIC_KEYS:
        diagnostics[key] = unassigned.get(key, 0) + sum(row["diagnostics"][key] for row in rows)
    return diagnostics


def _totals(rows: list[dict]) -> dict:
    return {
        "rowCount": len(rows),
        "completedHours": sum(row["completedHours"] for row in rows),
        "remainingHours": sum(row["remainingHours"] for row in rows),
        "passedTc": sum(row.get("passedTc") or 0 for row in rows),
        "failedTc": sum(row.get("failedTc") or 0 for row in rows),
    }


def _issue_keys(tasks: list[RawTask]) -> list[str]:
    return sorted(task.key for task in tasks if task.key)


def _hours(seconds: int) -> int:
    return ceil(seconds / 3600) if seconds else 0


def _seconds(value: Optional[int]) -> int:
    return value or 0


def _empty_diagnostics() -> dict:
    return {key: 0 for key in DIAGNOSTIC_KEYS}


def _missing_estimate(task: RawTask) -> bool:
    return task.time_spent_seconds is None and task.remaining_estimate_seconds is None


def _normalized_status(task: RawTask) -> str:
    return (task.status or "").casefold()


def _section_for_task(task: RawTask) -> str:
    project = (task.project or "").upper()
    key = (task.key or "").upper()
    epic_link = (task.epic_link or "").upper()
    parent_key = (task.parent_key or "").upper()
    if project == "ACE2E" or key.startswith("ACE2E-") or epic_link.startswith("ACE2E-") or parent_key.startswith("ACE2E-"):
        return SECTION_E2E
    return SECTION_DEVELOPMENT


def _progress_percent(completed_hours: int, remaining_hours: int) -> Optional[int]:
    total = completed_hours + remaining_hours
    if total == 0:
        return None
    return round((completed_hours / total) * 100)


def _status(completed_hours: int, remaining_hours: int) -> str:
    if completed_hours == 0 and remaining_hours == 0:
        return "Not Started"
    if remaining_hours == 0:
        return "Done"
    if completed_hours == 0:
        return "Not Started"
    return "In Progress"


def _is_epic(task: RawTask) -> bool:
    return bool(task.task_type and task.task_type.lower() == "epic")
