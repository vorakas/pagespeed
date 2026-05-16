"""QA testing report service for Jira/Zephyr Scale data."""

from __future__ import annotations

from copy import deepcopy
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from enum import Enum
import re
import threading
from typing import Any
from zoneinfo import ZoneInfo

import requests

from data_access.jira_user_cache_repository import JiraUserCacheRepository
from data_access.qa_cycle_repository import QaCycleRepository
from data_access.qa_report_cache_repository import QaReportCacheRepository
from data_access.qa_test_case_cache_repository import QaTestCaseCacheRepository


ADOBE_MASTER_FOLDER = "/Adobe Commerce E2E Master Test Cycles"
ROUND_CYCLE_RE = re.compile(r"\bRound\s+\d+\s*$", re.IGNORECASE)
EPIC_LINK_JQL = (
    '"Epic Link" in ('
    "ACE2E-375,ACE2E-339,ACE2E-325,ACE2E-323,ACE2E-53,ACE2E-52,ACE2E-51,"
    "ACE2E-50,ACE2E-49,ACE2E-48,ACE2E-47,ACE2E-46,ACE2E-45,ACE2E-44,"
    "ACE2E-43,ACE2E-41,ACE2E-40,ACE2E-39,ACE2E-38,ACE2E-37,ACE2E-36,"
    "ACE2E-35,ACE2E-34,ACE2E-33,ACE2E-32,ACE2E-31,ACE2E-30,ACE2E-29,"
    "ACE2E-28,ACE2E-27,ACE2E-26,ACE2E-25,ACE2E-24"
    ") AND issuetype != Epic"
)
CACHE_TTL_SECONDS = 15 * 60
JIRA_TIMEZONE = ZoneInfo("America/Los_Angeles")


class TaskWindow(str, Enum):
    RANGE = "range"
    SINCE_YESTERDAY = "sinceYesterday"


def parse_jira_datetime(value: str | None) -> datetime | None:
    if not value:
        return None
    normalized = value.strip()
    if normalized.endswith("Z"):
        normalized = f"{normalized[:-1]}+00:00"
    if re.search(r"[+-]\d{4}$", normalized):
        normalized = f"{normalized[:-5]}{normalized[-5:-2]}:{normalized[-2:]}"
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def to_iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def is_round_cycle(name: str | None) -> bool:
    return bool(name and ROUND_CYCLE_RE.search(name.strip()))


def folder_name(cycle: dict[str, Any]) -> str:
    folder = cycle.get("folder")
    if isinstance(folder, dict):
        return str(folder.get("name") or "")
    return str(folder or "")


def is_adobe_master_cycle(cycle: dict[str, Any]) -> bool:
    return folder_name(cycle).startswith(ADOBE_MASTER_FOLDER)


def top_section(folder: str) -> str:
    if not folder.startswith(ADOBE_MASTER_FOLDER):
        return "Other"
    rest = folder[len(ADOBE_MASTER_FOLDER) :].strip("/")
    return rest.split("/")[0].strip() if rest else "Root"


def status_name(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("name") or "Unknown")
    return str(value or "Unknown")


def execution_datetime(item: dict[str, Any]) -> datetime | None:
    for key in ("executionDate", "actualEndDate", "actualStartDate"):
        parsed = parse_jira_datetime(item.get(key))
        if parsed is not None:
            return parsed
    return None


def is_in_range(value: datetime | None, start: datetime, end: datetime) -> bool:
    return value is not None and start <= value <= end


def build_cycle_report(
    cycle: dict[str, Any],
    test_case_names: dict[str, str],
    start: datetime,
    end: datetime,
) -> dict[str, Any]:
    items = cycle.get("items") or []
    status_counts: Counter[str] = Counter()
    range_status_counts: Counter[str] = Counter()
    test_cases: list[dict[str, Any]] = []

    for item in items:
        test_case_key = str(item.get("testCaseKey") or item.get("key") or "")
        status = status_name(item.get("status"))
        executed_at = execution_datetime(item)
        in_range = is_in_range(executed_at, start, end)
        status_counts[status] += 1
        if in_range:
            range_status_counts[status] += 1
        test_cases.append(
            {
                "id": item.get("id"),
                "key": test_case_key,
                "name": test_case_names.get(test_case_key, ""),
                "status": status,
                "assignedTo": display_name(item.get("assignedTo")),
                "executedBy": display_name(item.get("executedBy")),
                "executedAt": to_iso(executed_at),
                "plannedStartDate": to_iso(parse_jira_datetime(item.get("plannedStartDate"))),
                "plannedEndDate": to_iso(parse_jira_datetime(item.get("plannedEndDate"))),
                "inRange": in_range,
            }
        )

    total = len(test_cases)
    executed_total = sum(count for status, count in status_counts.items() if status != "Not Executed")
    executed_in_range = sum(range_status_counts.values())
    folder = folder_name(cycle)
    return {
        "key": cycle.get("key"),
        "name": cycle.get("name"),
        "folder": folder,
        "section": top_section(folder),
        "status": status_name(cycle.get("status")),
        "totalCases": total,
        "executedCases": executed_total,
        "executedInRange": executed_in_range,
        "progressPercent": round((executed_total / total) * 100) if total else 0,
        "rangeProgressPercent": round((executed_in_range / total) * 100) if total else 0,
        "statusCounts": dict(status_counts),
        "rangeStatusCounts": dict(range_status_counts),
        "testCases": test_cases,
        "updatedOn": to_iso(parse_jira_datetime(cycle.get("updatedOn"))),
    }


def build_daily_burndown(
    cycles: list[dict[str, Any]],
    start: datetime,
    end: datetime,
) -> list[dict[str, Any]]:
    total_cases = sum(int(cycle.get("totalCases") or 0) for cycle in cycles)
    executed_days: Counter[str] = Counter()
    for cycle in cycles:
        for test_case in cycle.get("testCases", []):
            executed_at = parse_jira_datetime(test_case.get("executedAt"))
            if is_in_range(executed_at, start, end):
                executed_days[executed_at.date().isoformat()] += 1

    points: list[dict[str, Any]] = []
    cursor = start.date()
    last = end.date()
    cumulative = 0
    while cursor <= last:
        cumulative += executed_days[cursor.isoformat()]
        points.append(
            {
                "date": cursor.isoformat(),
                "executed": cumulative,
                "remaining": max(total_cases - cumulative, 0),
            }
        )
        cursor += timedelta(days=1)
    return points


def display_name(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("displayName") or value.get("name") or value.get("key") or "")
    return str(value or "")


def extract_status_changes(
    issue: dict[str, Any],
    start: datetime,
    end: datetime,
) -> list[dict[str, Any]]:
    fields = issue.get("fields") or {}
    changes: list[dict[str, Any]] = []
    for history in (issue.get("changelog") or {}).get("histories") or []:
        changed_at = parse_jira_datetime(history.get("created"))
        if not is_in_range(changed_at, start, end):
            continue
        for item in history.get("items") or []:
            if str(item.get("field") or "").lower() != "status":
                continue
            changes.append(
                {
                    "key": issue.get("key"),
                    "summary": fields.get("summary") or "",
                    "issueType": (fields.get("issuetype") or {}).get("name") or "",
                    "currentStatus": (fields.get("status") or {}).get("name") or "",
                    "assignee": display_name(fields.get("assignee")),
                    "fromStatus": item.get("fromString") or "",
                    "toStatus": item.get("toString") or "",
                    "changedAt": to_iso(changed_at),
                    "changedBy": display_name(history.get("author")),
                }
            )
    return changes


def collapse_latest_status_changes(changes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    latest_by_key: dict[str, dict[str, Any]] = {}
    for change in changes:
        key = str(change.get("key") or "")
        if not key:
            continue
        current = latest_by_key.get(key)
        if current is None or str(change.get("changedAt") or "") > str(current.get("changedAt") or ""):
            latest_by_key[key] = change
    return sorted(latest_by_key.values(), key=lambda change: change.get("changedAt") or "", reverse=True)


def build_status_change_jql(
    start: datetime,
    end: datetime,
    task_window: TaskWindow = TaskWindow.RANGE,
    now: datetime | None = None,
) -> str:
    date_format = "%Y/%m/%d %H:%M"
    if task_window == TaskWindow.SINCE_YESTERDAY:
        return f"{EPIC_LINK_JQL} AND status changed AFTER startOfDay(-1) ORDER BY updated DESC"
    return (
        f"{EPIC_LINK_JQL} AND status changed AFTER "
        f'"{start.astimezone(JIRA_TIMEZONE).strftime(date_format)}" '
        f'AND status changed BEFORE "{end.astimezone(JIRA_TIMEZONE).strftime(date_format)}" '
        "ORDER BY updated DESC"
    )


def task_window_bounds(
    start: datetime,
    end: datetime,
    task_window: TaskWindow,
    now: datetime | None = None,
) -> tuple[datetime, datetime]:
    if task_window != TaskWindow.SINCE_YESTERDAY:
        return start, end
    local_now = (now or datetime.now(timezone.utc)).astimezone(JIRA_TIMEZONE)
    local_start = (local_now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return local_start.astimezone(timezone.utc), end


class QaTestingReportService:
    def __init__(
        self,
        jira_pat: str,
        jira_base_url: str = "https://lampstrack.lampsplus.com",
        project_key: str = "TC",
        test_case_cache_repo: QaTestCaseCacheRepository | None = None,
        user_cache_repo: JiraUserCacheRepository | None = None,
        report_cache_repo: QaReportCacheRepository | None = None,
        cycle_repo: QaCycleRepository | None = None,
    ) -> None:
        self.jira_pat = jira_pat
        self.jira_base_url = jira_base_url.rstrip("/")
        self.project_key = project_key
        self.test_case_cache_repo = test_case_cache_repo
        self.user_cache_repo = user_cache_repo
        self.report_cache_repo = report_cache_repo
        self.cycle_repo = cycle_repo
        self.cache_ttl_seconds = CACHE_TTL_SECONDS
        self._report_cache: dict[str, tuple[datetime, dict[str, Any]]] = {}
        self._refresh_lock = threading.Lock()
        self._refreshing_test_case_keys: set[str] = set()
        self._refreshing_user_keys: set[str] = set()
        self._last_name_cache = {"hitCount": 0, "missCount": 0, "refreshQueued": 0}
        self._last_user_cache = {"hitCount": 0, "missCount": 0, "refreshQueued": 0}

    def build_report(
        self,
        start: datetime,
        end: datetime,
        force_refresh: bool = False,
        task_window: TaskWindow = TaskWindow.SINCE_YESTERDAY,
    ) -> dict[str, Any]:
        if not self.jira_pat:
            raise ValueError("JIRA_PAT is not configured")
        if end < start:
            raise ValueError("end must be after start")

        cache_key = self._cache_key(start, end, task_window)
        if self.report_cache_repo is not None:
            return self._build_report_with_persistent_cache(
                cache_key,
                start,
                end,
                force_refresh,
                task_window,
            )

        cached = self._report_cache.get(cache_key)
        now = datetime.now(timezone.utc)
        if not force_refresh and cached is not None:
            refreshed_at, cached_report = cached
            age = (now - refreshed_at).total_seconds()
            if age <= self.cache_ttl_seconds:
                report = deepcopy(cached_report)
                report["cache"] = {
                    "hit": True,
                    "key": cache_key,
                    "lastRefreshedAt": to_iso(refreshed_at),
                    "ttlSeconds": self.cache_ttl_seconds,
                }
                return report

        report = self._build_report_uncached(start, end, task_window)
        self._report_cache[cache_key] = (now, deepcopy(report))
        report["cache"] = {
            "hit": False,
            "key": cache_key,
            "lastRefreshedAt": to_iso(now),
            "ttlSeconds": self.cache_ttl_seconds,
            "stale": False,
            "refreshInProgress": False,
            "shared": False,
        }
        return report

    def _build_report_uncached(
        self,
        start: datetime,
        end: datetime,
        task_window: TaskWindow,
    ) -> dict[str, Any]:
        self._last_name_cache = {"hitCount": 0, "missCount": 0, "refreshQueued": 0}
        self._last_user_cache = {"hitCount": 0, "missCount": 0, "refreshQueued": 0}
        cycles = self._fetch_round_cycle_reports(start, end)
        task_changes = self._fetch_task_status_changes(start, end, task_window)
        summary = self._summarize(cycles, task_changes)
        report = {
            "range": {"start": to_iso(start), "end": to_iso(end)},
            "summary": summary,
            "cycles": cycles,
            "burndown": build_daily_burndown(cycles, start, end),
            "taskMovement": {
                "jql": build_status_change_jql(start, end, task_window=task_window),
                "totalChanges": len(task_changes),
                "changes": task_changes,
            },
            "nameCache": self._last_name_cache,
            "userCache": self._last_user_cache,
        }
        return report

    def _build_report_with_persistent_cache(
        self,
        cache_key: str,
        start: datetime,
        end: datetime,
        force_refresh: bool,
        task_window: TaskWindow,
    ) -> dict[str, Any]:
        cached = self.report_cache_repo.get(cache_key)
        now = datetime.now(timezone.utc)
        cached_report = deepcopy(cached.get("report")) if cached and cached.get("report") else None
        last_refreshed_at = parse_jira_datetime(cached.get("lastRefreshedAt")) if cached else None
        is_fresh = (
            cached_report is not None
            and last_refreshed_at is not None
            and (now - last_refreshed_at).total_seconds() <= self.cache_ttl_seconds
        )

        cached_has_name_misses = (
            cached_report is not None
            and self._report_has_name_cache_misses(cached_report)
        )

        if cached_report is not None and is_fresh and not force_refresh and not cached_has_name_misses:
            return self._attach_cache_metadata(
                cached_report,
                cache_key,
                cached,
                hit=True,
                stale=False,
                refresh_in_progress=False,
            )

        if cached_report is not None and not force_refresh and not cached_has_name_misses:
            started = self._try_start_persistent_refresh(cache_key, start, end, task_window)
            if started:
                self._start_report_refresh_thread(cache_key, start, end, task_window)
            return self._attach_cache_metadata(
                cached_report,
                cache_key,
                self.report_cache_repo.get(cache_key) or cached,
                hit=True,
                stale=True,
                refresh_in_progress=started or (cached.get("refreshStatus") == "refreshing"),
            )

        started = self._try_start_persistent_refresh(cache_key, start, end, task_window)
        if not started:
            if cached_report is not None:
                return self._attach_cache_metadata(
                    cached_report,
                    cache_key,
                    self.report_cache_repo.get(cache_key) or cached,
                    hit=True,
                    stale=True,
                    refresh_in_progress=True,
                )
            return self._attach_cache_metadata(
                self._empty_report(start, end, task_window),
                cache_key,
                self.report_cache_repo.get(cache_key) or {},
                hit=False,
                stale=True,
                refresh_in_progress=True,
            )

        try:
            report = self._build_report_uncached(start, end, task_window)
            self._save_persistent_report(cache_key, start, end, task_window, report)
            return self._attach_cache_metadata(
                report,
                cache_key,
                self.report_cache_repo.get(cache_key) or {},
                hit=False,
                stale=False,
                refresh_in_progress=False,
            )
        except Exception as exc:
            self.report_cache_repo.mark_refresh_failed(cache_key, str(exc))
            raise

    def _try_start_persistent_refresh(
        self,
        cache_key: str,
        start: datetime,
        end: datetime,
        task_window: TaskWindow,
    ) -> bool:
        return self.report_cache_repo.try_start_refresh(
            cache_key,
            to_iso(start) or "",
            to_iso(end) or "",
            task_window.value,
        )

    def _save_persistent_report(
        self,
        cache_key: str,
        start: datetime,
        end: datetime,
        task_window: TaskWindow,
        report: dict[str, Any],
    ) -> None:
        self.report_cache_repo.save_report(
            cache_key,
            to_iso(start) or "",
            to_iso(end) or "",
            task_window.value,
            report,
        )

    def _report_has_name_cache_misses(self, report: dict[str, Any]) -> bool:
        for cache_key in ("nameCache", "userCache"):
            cache_info = report.get(cache_key) or {}
            if int(cache_info.get("missCount") or 0) > 0:
                return True
        return False

    def _start_report_refresh_thread(
        self,
        cache_key: str,
        start: datetime,
        end: datetime,
        task_window: TaskWindow,
    ) -> None:
        thread = threading.Thread(
            target=self._refresh_report_cache,
            args=(cache_key, start, end, task_window),
            daemon=True,
            name="qa-report-cache-refresh",
        )
        thread.start()

    def _refresh_report_cache(
        self,
        cache_key: str,
        start: datetime,
        end: datetime,
        task_window: TaskWindow,
    ) -> None:
        try:
            report = self._build_report_uncached(start, end, task_window)
            self._save_persistent_report(cache_key, start, end, task_window, report)
        except Exception as exc:
            self.report_cache_repo.mark_refresh_failed(cache_key, str(exc))

    def _attach_cache_metadata(
        self,
        report: dict[str, Any],
        cache_key: str,
        cached: dict[str, Any],
        hit: bool,
        stale: bool,
        refresh_in_progress: bool,
    ) -> dict[str, Any]:
        report["cache"] = {
            "hit": hit,
            "key": cache_key,
            "lastRefreshedAt": cached.get("lastRefreshedAt"),
            "ttlSeconds": self.cache_ttl_seconds,
            "stale": stale,
            "refreshInProgress": refresh_in_progress,
            "refreshStartedAt": cached.get("refreshStartedAt"),
            "refreshStatus": cached.get("refreshStatus") or "idle",
            "refreshError": cached.get("refreshError"),
            "shared": True,
        }
        return report

    def _empty_report(self, start: datetime, end: datetime, task_window: TaskWindow) -> dict[str, Any]:
        return {
            "range": {"start": to_iso(start), "end": to_iso(end)},
            "summary": {
                "cycleCount": 0,
                "totalCases": 0,
                "executedCases": 0,
                "executedInRange": 0,
                "remainingCases": 0,
                "progressPercent": 0,
                "rangeProgressPercent": 0,
                "statusCounts": {},
                "rangeStatusCounts": {},
                "taskStatusChanges": 0,
            },
            "cycles": [],
            "burndown": [],
            "taskMovement": {
                "jql": build_status_change_jql(start, end, task_window=task_window),
                "totalChanges": 0,
                "changes": [],
            },
            "nameCache": {"hitCount": 0, "missCount": 0, "refreshQueued": 0},
            "userCache": {"hitCount": 0, "missCount": 0, "refreshQueued": 0},
        }

    def _cache_key(self, start: datetime, end: datetime, task_window: TaskWindow) -> str:
        start_key = self._cache_bucket(start).strftime("%Y-%m-%dT%H:%MZ")
        end_key = self._cache_bucket(end).strftime("%Y-%m-%dT%H:%MZ")
        return f"{start_key}|{end_key}|tasks:{task_window.value}"

    def _cache_bucket(self, value: datetime) -> datetime:
        utc_value = value.astimezone(timezone.utc)
        minute = (utc_value.minute // 15) * 15
        return utc_value.replace(minute=minute, second=0, microsecond=0)

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.jira_pat}", "Accept": "application/json"}

    def _get_json(self, path: str, params: dict[str, Any] | None = None) -> Any:
        response = requests.get(
            f"{self.jira_base_url}{path}",
            params=params,
            headers=self._headers(),
            timeout=180,
        )
        response.raise_for_status()
        return response.json()

    def _fetch_round_cycle_reports(self, start: datetime, end: datetime) -> list[dict[str, Any]]:
        data = self._get_json(
            "/rest/atm/1.0/testrun/search",
            {
                "query": f'projectKey = "{self.project_key}" AND folder = "{ADOBE_MASTER_FOLDER}"',
                "maxResults": 50,
            },
        )
        cycles = data if isinstance(data, list) else data.get("values") or data.get("results") or data.get("items") or []
        matching = [
            cycle
            for cycle in cycles
            if is_adobe_master_cycle(cycle) and is_round_cycle(str(cycle.get("name") or ""))
        ]
        if self.cycle_repo is not None:
            return self._fetch_round_cycle_reports_from_cycle_cache(matching, start, end)

        return self._build_reports_from_cycle_details(
            self._fetch_cycle_details(matching),
            start,
            end,
        )

    def _fetch_round_cycle_reports_from_cycle_cache(
        self,
        matching: list[dict[str, Any]],
        start: datetime,
        end: datetime,
    ) -> list[dict[str, Any]]:
        cycle_keys = [str(cycle.get("key") or "") for cycle in matching if cycle.get("key")]
        stored = self.cycle_repo.get_summaries(cycle_keys)
        changed = []
        for cycle in matching:
            key = str(cycle.get("key") or "")
            if not key:
                continue
            stored_cycle = stored.get(key)
            if not stored_cycle or str(stored_cycle.get("updated_on") or "") != str(cycle.get("updatedOn") or ""):
                changed.append(cycle)
        changed_details = self._fetch_cycle_details(changed)
        for detail in changed_details:
            self.cycle_repo.upsert_cycle_detail(detail)
        details = self.cycle_repo.get_cycle_details(cycle_keys)
        return self._build_reports_from_cycle_details(details, start, end)

    def _fetch_cycle_details(self, cycles: list[dict[str, Any]]) -> list[dict[str, Any]]:
        details: list[dict[str, Any]] = []
        if not cycles:
            return details
        with ThreadPoolExecutor(max_workers=6) as executor:
            futures = {
                executor.submit(self._get_json, f"/rest/atm/1.0/testrun/{cycle.get('key')}"): cycle
                for cycle in cycles
            }
            for future in as_completed(futures):
                detail = future.result()
                cycle = futures[future]
                for field in ("key", "name", "folder", "status", "projectKey", "createdOn", "updatedOn", "testCaseCount"):
                    if not detail.get(field) and cycle.get(field):
                        detail[field] = cycle.get(field)
                details.append(detail)
        return details

    def _build_reports_from_cycle_details(
        self,
        details: list[dict[str, Any]],
        start: datetime,
        end: datetime,
    ) -> list[dict[str, Any]]:
        reports: list[dict[str, Any]] = []
        test_case_keys = sorted({
            str(item.get("testCaseKey") or "")
            for detail in details
            for item in (detail.get("items") or [])
            if item.get("testCaseKey")
        })
        test_case_names = self._cached_test_case_names(test_case_keys)
        user_names = self._cached_user_names(self._user_keys_from_cycle_details(details))
        for detail in details:
            report = build_cycle_report(detail, test_case_names, start, end)
            self._apply_user_names(report, user_names)
            reports.append(report)
        return sorted(reports, key=lambda cycle: (cycle["section"], cycle["name"] or ""))

    def _cached_test_case_names(self, keys: list[str]) -> dict[str, str]:
        if self.test_case_cache_repo is None:
            self._last_name_cache = {
                "hitCount": 0,
                "missCount": len(keys),
                "refreshQueued": 0,
            }
            return {}

        cached = self.test_case_cache_repo.get_many(keys)
        stale_keys = self.test_case_cache_repo.stale_or_missing_keys(keys, max_age_days=30)
        queued = self._queue_test_case_name_refresh(stale_keys)
        self._last_name_cache = {
            "hitCount": len(cached),
            "missCount": len(stale_keys),
            "refreshQueued": queued,
        }
        return {
            key: str(row.get("name") or "")
            for key, row in cached.items()
        }

    def _queue_test_case_name_refresh(self, keys: list[str]) -> int:
        if self.test_case_cache_repo is None:
            return 0
        with self._refresh_lock:
            to_refresh = [
                key for key in sorted({key for key in keys if key})
                if key not in self._refreshing_test_case_keys
            ]
            self._refreshing_test_case_keys.update(to_refresh)
        if not to_refresh:
            return 0
        thread = threading.Thread(
            target=self._refresh_test_case_names,
            args=(to_refresh,),
            daemon=True,
            name="qa-test-case-cache-refresh",
        )
        thread.start()
        return len(to_refresh)

    def _refresh_test_case_names(self, keys: list[str]) -> None:
        rows: list[dict[str, Any]] = []
        try:
            for key in keys:
                try:
                    test_case = self._get_json(f"/rest/atm/1.0/testcase/{key}")
                except requests.RequestException:
                    continue
                rows.append({
                    "testCaseKey": key,
                    "name": str(test_case.get("name") or test_case.get("title") or ""),
                    "folder": folder_name(test_case),
                    "status": status_name(test_case.get("status")),
                    "priority": status_name(test_case.get("priority")),
                })
                if len(rows) >= 10:
                    self.test_case_cache_repo.upsert_many(rows)
                    rows = []
            if rows:
                self.test_case_cache_repo.upsert_many(rows)
        finally:
            with self._refresh_lock:
                for key in keys:
                    self._refreshing_test_case_keys.discard(key)

    def _user_keys_from_cycle_details(self, details: list[dict[str, Any]]) -> list[str]:
        keys: set[str] = set()
        for detail in details:
            for item in detail.get("items") or []:
                for field in ("assignedTo", "executedBy"):
                    raw = display_name(item.get(field))
                    if raw.startswith("JIRAUSER"):
                        keys.add(raw)
        return sorted(keys)

    def _cached_user_names(self, keys: list[str]) -> dict[str, str]:
        if self.user_cache_repo is None:
            self._last_user_cache = {"hitCount": 0, "missCount": len(keys), "refreshQueued": 0}
            return {}
        cached = self.user_cache_repo.get_many(keys)
        stale_keys = self.user_cache_repo.stale_or_missing_keys(keys, max_age_days=180)
        queued = self._queue_user_refresh(stale_keys)
        self._last_user_cache = {
            "hitCount": len(cached),
            "missCount": len(stale_keys),
            "refreshQueued": queued,
        }
        return {key: str(row.get("display_name") or "") for key, row in cached.items()}

    def _queue_user_refresh(self, keys: list[str]) -> int:
        if self.user_cache_repo is None:
            return 0
        with self._refresh_lock:
            to_refresh = [
                key for key in sorted({key for key in keys if key})
                if key not in self._refreshing_user_keys
            ]
            self._refreshing_user_keys.update(to_refresh)
        if not to_refresh:
            return 0
        thread = threading.Thread(
            target=self._refresh_user_names,
            args=(to_refresh,),
            daemon=True,
            name="jira-user-cache-refresh",
        )
        thread.start()
        return len(to_refresh)

    def _refresh_user_names(self, keys: list[str]) -> None:
        rows: list[dict[str, Any]] = []
        try:
            for key in keys:
                try:
                    user = self._get_json("/rest/api/2/user", {"key": key})
                except requests.RequestException:
                    continue
                rows.append({
                    "userKey": key,
                    "displayName": user.get("displayName") or user.get("name") or key,
                })
                if len(rows) >= 20:
                    self.user_cache_repo.upsert_many(rows)
                    rows = []
            if rows:
                self.user_cache_repo.upsert_many(rows)
        finally:
            with self._refresh_lock:
                for key in keys:
                    self._refreshing_user_keys.discard(key)

    def _apply_user_names(self, cycle_report: dict[str, Any], user_names: dict[str, str]) -> None:
        for test_case in cycle_report.get("testCases") or []:
            for field in ("assignedTo", "executedBy"):
                raw = str(test_case.get(field) or "")
                if raw in user_names and user_names[raw]:
                    test_case[field] = user_names[raw]

    def _fill_test_case_names(self, names: dict[str, str], keys: list[str]) -> None:
        for key in keys:
            if not key or key in names:
                continue
            try:
                test_case = self._get_json(f"/rest/atm/1.0/testcase/{key}")
            except requests.RequestException:
                names[key] = ""
                continue
            names[key] = str(test_case.get("name") or test_case.get("title") or "")

    def _fetch_task_status_changes(
        self,
        start: datetime,
        end: datetime,
        task_window: TaskWindow = TaskWindow.SINCE_YESTERDAY,
    ) -> list[dict[str, Any]]:
        task_start, task_end = task_window_bounds(start, end, task_window)
        data = self._get_json(
            "/rest/api/2/search",
            {
                "jql": build_status_change_jql(start, end, task_window=task_window),
                "fields": "summary,issuetype,status,assignee,updated",
                "expand": "changelog",
                "maxResults": 100,
            },
        )
        issues = data.get("issues") or []
        changes: list[dict[str, Any]] = []
        for issue in issues:
            changes.extend(extract_status_changes(issue, task_start, task_end))
        return collapse_latest_status_changes(changes)

    def _summarize(self, cycles: list[dict[str, Any]], task_changes: list[dict[str, Any]]) -> dict[str, Any]:
        total_cases = sum(cycle["totalCases"] for cycle in cycles)
        executed_cases = sum(cycle["executedCases"] for cycle in cycles)
        executed_in_range = sum(cycle["executedInRange"] for cycle in cycles)
        status_counts: Counter[str] = Counter()
        range_status_counts: Counter[str] = Counter()
        for cycle in cycles:
            status_counts.update(cycle.get("statusCounts") or {})
            range_status_counts.update(cycle.get("rangeStatusCounts") or {})
        return {
            "cycleCount": len(cycles),
            "totalCases": total_cases,
            "executedCases": executed_cases,
            "executedInRange": executed_in_range,
            "remainingCases": max(total_cases - executed_cases, 0),
            "progressPercent": round((executed_cases / total_cases) * 100) if total_cases else 0,
            "rangeProgressPercent": round((executed_in_range / total_cases) * 100) if total_cases else 0,
            "statusCounts": dict(status_counts),
            "rangeStatusCounts": dict(range_status_counts),
            "taskStatusChanges": len(task_changes),
        }
