"""Persistent cache for Jira/Zephyr test case metadata."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from data_access.connection import ConnectionManager
from exceptions import DatabaseError


class QaTestCaseCacheRepository:
    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm = connection_manager

    def get_many(self, keys: list[str]) -> dict[str, dict[str, Any]]:
        clean_keys = sorted({key for key in keys if key})
        if not clean_keys:
            return {}
        ph = self._cm.placeholder()
        placeholders = ", ".join([ph] * len(clean_keys))
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    SELECT test_case_key, name, folder, status, priority, fetched_at
                    FROM qa_test_case_cache
                    WHERE test_case_key IN ({placeholders})
                    """,
                    tuple(clean_keys),
                )
                rows = self._cm.rows_to_dicts(cursor)
        except Exception as exc:
            raise DatabaseError(f"Failed to read QA test case cache: {exc}") from exc
        return {row["test_case_key"]: row for row in rows}

    def stale_or_missing_keys(self, keys: list[str], max_age_days: int = 30) -> list[str]:
        clean_keys = sorted({key for key in keys if key})
        cached = self.get_many(clean_keys)
        cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
        stale: list[str] = []
        for key in clean_keys:
            row = cached.get(key)
            if row is None:
                stale.append(key)
                continue
            fetched_at = _parse_cached_datetime(row.get("fetched_at"))
            if fetched_at is None or fetched_at < cutoff:
                stale.append(key)
        return stale

    def upsert_many(self, rows: list[dict[str, Any]]) -> int:
        clean_rows = [row for row in rows if row.get("testCaseKey")]
        if not clean_rows:
            return 0
        ph = self._cm.placeholder()
        fetched_at = datetime.now(timezone.utc).isoformat()
        statement = f"""
            INSERT INTO qa_test_case_cache
                (test_case_key, name, folder, status, priority, fetched_at)
            VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})
            ON CONFLICT (test_case_key) DO UPDATE SET
                name = EXCLUDED.name,
                folder = EXCLUDED.folder,
                status = EXCLUDED.status,
                priority = EXCLUDED.priority,
                fetched_at = EXCLUDED.fetched_at
        """
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                for row in clean_rows:
                    cursor.execute(
                        statement,
                        (
                            row.get("testCaseKey"),
                            row.get("name") or "",
                            row.get("folder") or "",
                            row.get("status") or "",
                            row.get("priority") or "",
                            fetched_at,
                        ),
                    )
        except Exception as exc:
            raise DatabaseError(f"Failed to upsert QA test case cache: {exc}") from exc
        return len(clean_rows)


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
