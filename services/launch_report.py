from __future__ import annotations

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

REPORTING_AREAS = [
    "Accessibility",
    "ATP",
    "Financial Calculator",
    "Cart",
    "Static Pages",
    "Cookie Consent",
    "My Account / Account Management",
    "Payment / Billing",
    "Database Integration and Optimization",
    "Dynamic Yield",
    "Emails",
    "Gift Card",
    "Header & Footer",
    "Homepage",
    "MAO New Order and Order Updates",
    "Order Confirmation",
    "PDP",
    "PLP",
    "Resubmit Utility",
    "SEO",
    "Session Management",
    "Shipping",
    "Stores",
    "System Support",
    "Tealium Integration",
    "Wish List",
    "Wunderkind",
    "WUP Dashboard",
]

COMPONENT_TO_REPORTING_AREA = {
    "AC-Accessibility": "Accessibility",
    "AC-ATP": "ATP",
    "AC-Avalara": "Financial Calculator",
    "AC-Cart": "Cart",
    "AC-Contact Us": "Static Pages",
    "AC-Cookie Consent": "Cookie Consent",
    "AC-Promotions": "Financial Calculator",
    "AC-Customer Creation": "My Account / Account Management",
    "AC-Cybersource": "Payment / Billing",
    "AC-DB Integration": "Database Integration and Optimization",
    "AC-Dynamic Yield": "Dynamic Yield",
    "AC-Emails": "Emails",
    "AC-Calculators": "Financial Calculator",
    "AC-Gift Card": "Gift Card",
    "AC-Header & Footer": "Header & Footer",
    "AC-Homepage": "Homepage",
    "AC-Log In & Create Account": "My Account / Account Management",
    "AC-MAO": "MAO New Order and Order Updates",
    "AC-Account": "My Account / Account Management",
    "AC-Order Confirmation": "Order Confirmation",
    "AC-Payment": "Payment / Billing",
    "AC-PDP": "PDP",
    "AC-PLA": "Dynamic Yield",
    "AC-PLP": "PLP",
    "AC-Resubmit Utility": "Resubmit Utility",
    "AC-SEO": "SEO",
    "AC-Session Management": "Session Management",
    "AC-Shipping": "Shipping",
    "AC-SKU on the Fly": "Cart",
    "AC-Static Pages": "Static Pages",
    "AC-Stores": "Stores",
    "AC-System Support": "System Support",
    "AC-Tealium": "Tealium Integration",
    "AC-Wish List": "Wish List",
    "AC-Wunderkind": "Wunderkind",
    "AC-WUP Dashboard": "WUP Dashboard",
}


def build_launch_report(
    tasks: Iterable[RawTask],
    *,
    generated_at: Optional[datetime] = None,
    qa_tc_summary: Optional[dict] = None,
) -> dict:
    rows = list(tasks)
    grouped, unassigned_diagnostics = _group_tasks_by_reporting_area(rows)
    generated = generated_at or datetime.now(timezone.utc)
    development_rows = [
        _development_row(name, grouped[SECTION_DEVELOPMENT].get(name, []))
        for name in REPORTING_AREAS
    ]
    e2e_rows = [
        _e2e_row(name, grouped[SECTION_E2E].get(name, []), (qa_tc_summary or {}).get(name))
        for name in REPORTING_AREAS
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


def _group_tasks_by_reporting_area(
    tasks: list[RawTask],
) -> tuple[dict[str, dict[str, list[RawTask]]], dict[str, dict]]:
    grouped: dict[str, dict[str, list[RawTask]]] = {
        SECTION_DEVELOPMENT: {area: [] for area in REPORTING_AREAS},
        SECTION_E2E: {area: [] for area in REPORTING_AREAS},
    }
    unassigned_diagnostics = {
        SECTION_DEVELOPMENT: _empty_diagnostics(),
        SECTION_E2E: _empty_diagnostics(),
    }

    for task in tasks:
        if _is_epic(task):
            continue
        section = _section_for_resource_queue(task)
        area = _reporting_area(task)
        if area:
            grouped[section][area].append(task)
        elif PHASE_LABEL in (task.labels or []):
            unassigned_diagnostics[section]["missingEpicLinkCount"] += 1

    return grouped, unassigned_diagnostics


def _development_row(report_grouping: str, tasks: list[RawTask]) -> dict:
    counted, excluded = _partition_counted(tasks)
    completed_hours = _hours(sum(_seconds(task.time_spent_seconds) for task in counted))
    remaining_hours = _hours(sum(_seconds(task.remaining_estimate_seconds) for task in counted))

    return {
        "reportGrouping": report_grouping,
        "epicKey": None,
        "phaseLabel": PHASE_LABEL,
        "completedHours": completed_hours,
        "remainingHours": remaining_hours,
        "progressPercent": _progress_percent(completed_hours, remaining_hours),
        "status": _status(completed_hours, remaining_hours),
        "issueKeys": _issue_keys(counted),
        "diagnostics": _diagnostics(counted, excluded),
    }


def _e2e_row(report_grouping: str, tasks: list[RawTask], qa_tc: Optional[dict] = None) -> dict:
    counted, excluded = _partition_counted(tasks)
    completed_hours = _hours(sum(_seconds(task.time_spent_seconds) for task in counted))
    remaining_hours = _hours(sum(_seconds(task.remaining_estimate_seconds) for task in counted))
    passed_tc = sum(1 for task in counted if _normalized_status(task) == "closed")
    failed_tc = sum(1 for task in counted if _normalized_status(task) == "failed qa")
    total_tc = None
    if qa_tc:
        passed_tc = int(qa_tc.get("passedTc") or 0)
        failed_tc = int(qa_tc.get("failedTc") or 0)
        total_tc = int(qa_tc.get("totalTc") or 0)

    return {
        "reportGrouping": report_grouping,
        "epicKey": None,
        "phaseLabel": PHASE_LABEL,
        "passedTc": passed_tc,
        "failedTc": failed_tc,
        "totalTc": total_tc,
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
        "totalTc": sum(row.get("totalTc") or 0 for row in rows),
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


def _section_for_resource_queue(task: RawTask) -> str:
    if (task.resource_queue or "").casefold() == "qa":
        return SECTION_E2E
    return SECTION_DEVELOPMENT


def _reporting_area(task: RawTask) -> Optional[str]:
    for component in task.components or []:
        if not component.startswith("AC-"):
            continue
        area = COMPONENT_TO_REPORTING_AREA.get(component)
        if area:
            return area
    return None


def _progress_percent(completed_hours: int, remaining_hours: int) -> int:
    total = completed_hours + remaining_hours
    if total == 0:
        return 0
    return round((completed_hours / total) * 100)


def _status(completed_hours: int, remaining_hours: int) -> str:
    if completed_hours > 0 and remaining_hours == 0:
        return "Complete"
    return "Pending"


def _is_epic(task: RawTask) -> bool:
    return bool(task.task_type and task.task_type.lower() == "epic")
