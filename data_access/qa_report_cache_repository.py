"""Persistent cache for full QA testing report snapshots."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json
from typing import Any

from data_access.connection import ConnectionManager
from exceptions import DatabaseError


class QaReportCacheRepository:
    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm = connection_manager

    def get(self, cache_key: str) -> dict[str, Any] | None:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    SELECT cache_key, range_start, range_end, task_window, report_json,
                           last_refreshed_at, refresh_started_at, refresh_finished_at,
                           refresh_status, refresh_error
                    FROM qa_report_cache
                    WHERE cache_key = {ph}
                    """,
                    (cache_key,),
                )
                row = self._cm.row_to_dict(cursor)
        except Exception as exc:
            raise DatabaseError(f"Failed to read QA report cache: {exc}") from exc
        return _decode_report_row(row)

    def get_latest_successful(self) -> dict[str, Any] | None:
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT cache_key, range_start, range_end, task_window, report_json,
                           last_refreshed_at, refresh_started_at, refresh_finished_at,
                           refresh_status, refresh_error
                    FROM qa_report_cache
                    WHERE report_json IS NOT NULL
                      AND last_refreshed_at IS NOT NULL
                    ORDER BY last_refreshed_at DESC
                    LIMIT 1
                    """
                )
                row = self._cm.row_to_dict(cursor)
        except Exception as exc:
            raise DatabaseError(f"Failed to read latest QA report cache: {exc}") from exc
        return _decode_report_row(row)

    def save_report(
        self,
        cache_key: str,
        range_start: str,
        range_end: str,
        task_window: str,
        report: dict[str, Any],
        refresh_metadata: dict[str, Any] | None = None,
    ) -> None:
        ph = self._cm.placeholder()
        now = datetime.now(timezone.utc).isoformat()
        payload = json.dumps(report)
        metadata_payload = _encode_refresh_metadata(refresh_metadata)
        statement = f"""
            INSERT INTO qa_report_cache (
                cache_key, range_start, range_end, task_window, report_json,
                last_refreshed_at, refresh_started_at, refresh_finished_at,
                refresh_status, refresh_error, updated_at
            )
            VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, NULL, {ph}, {ph}, {ph}, {ph})
            ON CONFLICT (cache_key) DO UPDATE SET
                range_start = EXCLUDED.range_start,
                range_end = EXCLUDED.range_end,
                task_window = EXCLUDED.task_window,
                report_json = EXCLUDED.report_json,
                last_refreshed_at = EXCLUDED.last_refreshed_at,
                refresh_started_at = NULL,
                refresh_finished_at = EXCLUDED.refresh_finished_at,
                refresh_status = EXCLUDED.refresh_status,
                refresh_error = EXCLUDED.refresh_error,
                updated_at = EXCLUDED.updated_at
        """
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    statement,
                    (
                        cache_key,
                        range_start,
                        range_end,
                        task_window,
                        payload,
                        now,
                        now,
                        "idle",
                        metadata_payload,
                        now,
                    ),
                )
        except Exception as exc:
            raise DatabaseError(f"Failed to save QA report cache: {exc}") from exc

    def try_start_refresh(
        self,
        cache_key: str,
        range_start: str,
        range_end: str,
        task_window: str,
        lock_timeout_minutes: int = 10,
    ) -> bool:
        row = self.get(cache_key)
        now_dt = datetime.now(timezone.utc)
        if row and row.get("refreshStatus") == "refreshing":
            started_at = _parse_cached_datetime(row.get("refreshStartedAt"))
            if started_at and started_at > now_dt - timedelta(minutes=lock_timeout_minutes):
                return False

        ph = self._cm.placeholder()
        now = now_dt.isoformat()
        statement = f"""
            INSERT INTO qa_report_cache (
                cache_key, range_start, range_end, task_window, report_json,
                refresh_started_at, refresh_status, refresh_error, updated_at
            )
            VALUES ({ph}, {ph}, {ph}, {ph}, NULL, {ph}, {ph}, NULL, {ph})
            ON CONFLICT (cache_key) DO UPDATE SET
                range_start = EXCLUDED.range_start,
                range_end = EXCLUDED.range_end,
                task_window = EXCLUDED.task_window,
                refresh_started_at = EXCLUDED.refresh_started_at,
                refresh_status = EXCLUDED.refresh_status,
                refresh_error = NULL,
                updated_at = EXCLUDED.updated_at
        """
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    statement,
                    (cache_key, range_start, range_end, task_window, now, "refreshing", now),
                )
        except Exception as exc:
            raise DatabaseError(f"Failed to start QA report refresh: {exc}") from exc
        return True

    def update_refresh_metadata(self, cache_key: str, metadata: dict[str, Any]) -> None:
        ph = self._cm.placeholder()
        now = datetime.now(timezone.utc).isoformat()
        payload = _encode_refresh_metadata(metadata)
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    UPDATE qa_report_cache
                    SET refresh_error = {ph},
                        updated_at = {ph}
                    WHERE cache_key = {ph}
                    """,
                    (payload, now, cache_key),
                )
        except Exception as exc:
            raise DatabaseError(f"Failed to update QA report refresh metadata: {exc}") from exc

    def mark_refresh_failed(self, cache_key: str, error: str) -> None:
        ph = self._cm.placeholder()
        now = datetime.now(timezone.utc).isoformat()
        metadata = _encode_refresh_metadata({
            "stage": "failed",
            "message": "Jira refresh failed",
            "error": error[:500],
        })
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    UPDATE qa_report_cache
                    SET refresh_status = {ph},
                        refresh_error = {ph},
                        refresh_finished_at = {ph},
                        refresh_started_at = NULL,
                        updated_at = {ph}
                    WHERE cache_key = {ph}
                    """,
                    ("failed", metadata, now, now, cache_key),
                )
        except Exception as exc:
            raise DatabaseError(f"Failed to mark QA report refresh failed: {exc}") from exc

    def clear_all(self) -> int:
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("DELETE FROM qa_report_cache")
                return cursor.rowcount if cursor.rowcount is not None else 0
        except Exception as exc:
            raise DatabaseError(f"Failed to clear QA report cache: {exc}") from exc


def _decode_report_row(row: dict[str, Any] | None) -> dict[str, Any] | None:
    if row is None:
        return None
    report_json = row.get("report_json")
    report = None
    if report_json:
        try:
            report = json.loads(report_json)
        except (TypeError, json.JSONDecodeError):
            report = None
    refresh_error = row.get("refresh_error")
    refresh_metadata = _decode_refresh_metadata(refresh_error)
    visible_error = refresh_metadata.get("error") if refresh_metadata else refresh_error
    decoded = {
        "cacheKey": row.get("cache_key"),
        "rangeStart": row.get("range_start"),
        "rangeEnd": row.get("range_end"),
        "taskWindow": row.get("task_window"),
        "report": report,
        "lastRefreshedAt": _to_iso(row.get("last_refreshed_at")),
        "refreshStartedAt": _to_iso(row.get("refresh_started_at")),
        "refreshFinishedAt": _to_iso(row.get("refresh_finished_at")),
        "refreshStatus": row.get("refresh_status") or "idle",
        "refreshError": visible_error,
    }
    if refresh_metadata:
        decoded["refreshMetadata"] = refresh_metadata
    return decoded


def _encode_refresh_metadata(metadata: dict[str, Any] | None) -> str | None:
    if not metadata:
        return None
    return json.dumps(metadata)


def _decode_refresh_metadata(value: Any) -> dict[str, Any] | None:
    if not value or not isinstance(value, str):
        return None
    try:
        parsed = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return None
    return parsed if isinstance(parsed, dict) else None


def _parse_cached_datetime(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        parsed = value
    else:
        try:
            parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _to_iso(value: Any) -> str | None:
    parsed = _parse_cached_datetime(value)
    if parsed is None:
        return None
    return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
