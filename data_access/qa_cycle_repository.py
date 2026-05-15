"""Persistent QA cycle and execution item snapshots."""

from __future__ import annotations

import json
from typing import Any

from data_access.connection import ConnectionManager
from exceptions import DatabaseError


class QaCycleRepository:
    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm = connection_manager

    def get_summaries(self, cycle_keys: list[str]) -> dict[str, dict[str, Any]]:
        keys = sorted({key for key in cycle_keys if key})
        if not keys:
            return {}
        ph = self._cm.placeholder()
        placeholders = ", ".join([ph] * len(keys))
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    SELECT cycle_key, name, folder, section, status, project_key,
                           created_on, updated_on, test_case_count, synced_at
                    FROM qa_test_cycles
                    WHERE cycle_key IN ({placeholders})
                    """,
                    tuple(keys),
                )
                rows = self._cm.rows_to_dicts(cursor)
        except Exception as exc:
            raise DatabaseError(f"Failed to read QA cycle summaries: {exc}") from exc
        return {row["cycle_key"]: row for row in rows}

    def upsert_cycle_detail(self, detail: dict[str, Any]) -> None:
        cycle_key = str(detail.get("key") or "")
        if not cycle_key:
            return
        ph = self._cm.placeholder()
        folder = _folder_name(detail)
        section = _top_section(folder)
        items = detail.get("items") or []
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    INSERT INTO qa_test_cycles (
                        cycle_key, name, folder, section, status, project_key,
                        created_on, updated_on, test_case_count, raw_json, synced_at
                    )
                    VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, CURRENT_TIMESTAMP)
                    ON CONFLICT (cycle_key) DO UPDATE SET
                        name = EXCLUDED.name,
                        folder = EXCLUDED.folder,
                        section = EXCLUDED.section,
                        status = EXCLUDED.status,
                        project_key = EXCLUDED.project_key,
                        created_on = EXCLUDED.created_on,
                        updated_on = EXCLUDED.updated_on,
                        test_case_count = EXCLUDED.test_case_count,
                        raw_json = EXCLUDED.raw_json,
                        synced_at = CURRENT_TIMESTAMP
                    """,
                    (
                        cycle_key,
                        detail.get("name") or "",
                        folder,
                        section,
                        _status_name(detail.get("status")),
                        detail.get("projectKey") or "",
                        detail.get("createdOn"),
                        detail.get("updatedOn"),
                        detail.get("testCaseCount") or len(items),
                        json.dumps(detail),
                    ),
                )
                cursor.execute(f"DELETE FROM qa_test_cycle_items WHERE cycle_key = {ph}", (cycle_key,))
                for item in items:
                    cursor.execute(
                        f"""
                        INSERT INTO qa_test_cycle_items (
                            cycle_key, test_case_key, item_id, status, assigned_to, executed_by, user_key,
                            execution_date, actual_start_date, actual_end_date,
                            planned_start_date, planned_end_date, raw_json, synced_at
                        )
                        VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, CURRENT_TIMESTAMP)
                        """,
                        (
                            cycle_key,
                            item.get("testCaseKey") or "",
                            str(item.get("id") or ""),
                            _status_name(item.get("status")),
                            _display_name(item.get("assignedTo")),
                            _display_name(item.get("executedBy")),
                            item.get("userKey") or "",
                            item.get("executionDate"),
                            item.get("actualStartDate"),
                            item.get("actualEndDate"),
                            item.get("plannedStartDate"),
                            item.get("plannedEndDate"),
                            json.dumps(item),
                        ),
                    )
        except Exception as exc:
            raise DatabaseError(f"Failed to upsert QA cycle detail {cycle_key}: {exc}") from exc

    def get_cycle_details(self, cycle_keys: list[str]) -> list[dict[str, Any]]:
        keys = sorted({key for key in cycle_keys if key})
        if not keys:
            return []
        summaries = self.get_summaries(keys)
        ph = self._cm.placeholder()
        placeholders = ", ".join([ph] * len(keys))
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    SELECT cycle_key, test_case_key, item_id, status, assigned_to, executed_by, user_key,
                           execution_date, actual_start_date, actual_end_date,
                           planned_start_date, planned_end_date
                    FROM qa_test_cycle_items
                    WHERE cycle_key IN ({placeholders})
                    ORDER BY cycle_key, test_case_key
                    """,
                    tuple(keys),
                )
                rows = self._cm.rows_to_dicts(cursor)
        except Exception as exc:
            raise DatabaseError(f"Failed to read QA cycle details: {exc}") from exc

        items_by_cycle: dict[str, list[dict[str, Any]]] = {key: [] for key in keys}
        for row in rows:
            items_by_cycle.setdefault(row["cycle_key"], []).append(_item_from_row(row))

        details: list[dict[str, Any]] = []
        for key in keys:
            summary = summaries.get(key)
            if not summary:
                continue
            details.append({
                "key": summary["cycle_key"],
                "name": summary.get("name") or "",
                "folder": summary.get("folder") or "",
                "status": summary.get("status") or "",
                "projectKey": summary.get("project_key") or "",
                "createdOn": summary.get("created_on"),
                "updatedOn": summary.get("updated_on"),
                "testCaseCount": summary.get("test_case_count") or len(items_by_cycle.get(key, [])),
                "items": items_by_cycle.get(key, []),
            })
        return details


def _item_from_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row.get("item_id"),
        "testCaseKey": row.get("test_case_key"),
        "status": row.get("status"),
        "assignedTo": row.get("assigned_to"),
        "executedBy": row.get("executed_by"),
        "userKey": row.get("user_key"),
        "executionDate": row.get("execution_date"),
        "actualStartDate": row.get("actual_start_date"),
        "actualEndDate": row.get("actual_end_date"),
        "plannedStartDate": row.get("planned_start_date"),
        "plannedEndDate": row.get("planned_end_date"),
    }


def _folder_name(cycle: dict[str, Any]) -> str:
    folder = cycle.get("folder")
    if isinstance(folder, dict):
        return str(folder.get("name") or "")
    return str(folder or "")


def _top_section(folder: str) -> str:
    prefix = "/Adobe Commerce E2E Master Test Cycles"
    if not folder.startswith(prefix):
        return "Other"
    rest = folder[len(prefix) :].strip("/")
    return rest.split("/")[0].strip() if rest else "Root"


def _status_name(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("name") or "Unknown")
    return str(value or "Unknown")


def _display_name(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("displayName") or value.get("name") or value.get("key") or "")
    return str(value or "")
