from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from math import ceil
from typing import Iterable, Optional

from services.obsidian_sync.raw_scanner import RawTask


PHASE_LABEL = "AC-P1"

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


def build_launch_report(
    tasks: Iterable[RawTask],
    *,
    generated_at: Optional[datetime] = None,
) -> dict:
    rows = list(tasks)
    by_key = {task.key: task for task in rows if task.key}
    grouped = _group_tasks_by_report_grouping(rows, by_key)
    generated = generated_at or datetime.now(timezone.utc)
    development_rows = [_development_row(name, grouped.get(name, [])) for name in DEVELOPMENT_GROUPINGS]
    e2e_rows = [_e2e_row(name, grouped.get(name, [])) for name in E2E_GROUPINGS]

    return {
        "phase": PHASE_LABEL,
        "generatedAt": generated.isoformat(),
        "lampsPlusDevelopment": {
            "rows": development_rows,
            "totals": _totals(development_rows),
            "diagnostics": _section_diagnostics(development_rows),
        },
        "e2eTesting": {
            "rows": e2e_rows,
            "totals": _totals(e2e_rows),
            "diagnostics": _section_diagnostics(e2e_rows),
        },
    }


def _group_tasks_by_report_grouping(
    tasks: list[RawTask],
    by_key: dict[str, RawTask],
) -> dict[str, list[RawTask]]:
    grouped: dict[str, list[RawTask]] = defaultdict(list)
    for task in tasks:
        grouping = _report_grouping(task, by_key)
        if grouping:
            grouped[grouping].append(task)
    return grouped


def _report_grouping(task: RawTask, by_key: dict[str, RawTask]) -> Optional[str]:
    if _is_epic(task):
        return task.summary
    if task.epic_link:
        epic = by_key.get(task.epic_link)
        return epic.summary if epic and epic.summary else task.epic_link
    return None


def _development_row(report_grouping: str, tasks: list[RawTask]) -> dict:
    counted, excluded = _partition_counted(tasks)
    completed_hours = _hours(sum(_seconds(task.time_spent_seconds) for task in counted))
    remaining_hours = _hours(sum(_seconds(task.remaining_estimate_seconds) for task in counted))

    return {
        "reportGrouping": report_grouping,
        "completedHours": completed_hours,
        "remainingHours": remaining_hours,
        "progressPercent": _progress_percent(completed_hours, remaining_hours),
        "status": _status(completed_hours, remaining_hours),
        "issueKeys": _issue_keys(counted),
        "diagnostics": _diagnostics(excluded),
    }


def _e2e_row(report_grouping: str, tasks: list[RawTask]) -> dict:
    counted, excluded = _partition_counted(tasks)
    completed_hours = _hours(sum(_seconds(task.time_spent_seconds) for task in counted))
    remaining_hours = _hours(sum(_seconds(task.remaining_estimate_seconds) for task in counted))

    return {
        "reportGrouping": report_grouping,
        "passedTc": sum(1 for task in counted if task.status == "Closed"),
        "failedTc": sum(1 for task in counted if task.status == "Failed QA"),
        "cnxOk": None,
        "doneCount": None,
        "completedHours": completed_hours,
        "remainingHours": remaining_hours,
        "progressPercent": _progress_percent(completed_hours, remaining_hours),
        "issueKeys": _issue_keys(counted),
        "diagnostics": _diagnostics(excluded),
    }


def _partition_counted(tasks: list[RawTask]) -> tuple[list[RawTask], list[RawTask]]:
    issue_tasks = [task for task in tasks if not _is_epic(task)]
    counted = [task for task in issue_tasks if PHASE_LABEL in (task.labels or [])]
    excluded = [task for task in issue_tasks if PHASE_LABEL not in (task.labels or [])]
    return counted, excluded


def _diagnostics(excluded: list[RawTask]) -> dict:
    excluded_keys = _issue_keys(excluded)
    return {
        "missingPhaseLabelCount": len(excluded_keys),
        "excludedIssueCount": len(excluded_keys),
        "excludedIssueKeys": excluded_keys,
    }


def _section_diagnostics(rows: list[dict]) -> dict:
    return {
        "missingPhaseLabelCount": sum(row["diagnostics"]["missingPhaseLabelCount"] for row in rows),
        "excludedIssueCount": sum(row["diagnostics"]["excludedIssueCount"] for row in rows),
    }


def _totals(rows: list[dict]) -> dict:
    return {
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
