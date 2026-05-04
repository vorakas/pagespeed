"""Persistence for helper-uploaded Applitools batch results.

The desktop helper fetches Applitools data from the corporate network and
uploads the normalized rows to Pharos. This repository stores those rows
durably so restarts, redeploys, and future worker scaling do not lose an
upload before QA exports the spreadsheet.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

from data_access.connection import ConnectionManager


class ApplitoolsBatchRepository:
    """CRUD for the ``applitools_batches`` table."""

    def __init__(self, connection_manager: ConnectionManager, ttl_seconds: int) -> None:
        self._cm = connection_manager
        self._ttl_seconds = max(1, ttl_seconds)

    def put(
        self,
        batch_id: str,
        tests: list[dict[str, Any]],
        fetched_at: str,
        platform: str | None = None,
    ) -> None:
        """Store or replace one helper upload."""
        ph = self._cm.placeholder()
        tests_json = json.dumps(tests, ensure_ascii=False)
        uploaded_at = datetime.utcnow().replace(microsecond=0)
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            if self._cm.is_postgres:
                cursor.execute(
                    f"""
                    INSERT INTO applitools_batches
                        (batch_id, tests_json, fetched_at, platform, uploaded_at)
                    VALUES ({ph}, {ph}, {ph}, {ph}, {ph})
                    ON CONFLICT (batch_id) DO UPDATE SET
                        tests_json = EXCLUDED.tests_json,
                        fetched_at = EXCLUDED.fetched_at,
                        platform = EXCLUDED.platform,
                        uploaded_at = EXCLUDED.uploaded_at
                    """,
                    (batch_id, tests_json, fetched_at, platform, uploaded_at),
                )
            else:
                cursor.execute(
                    f"""
                    INSERT INTO applitools_batches
                        (batch_id, tests_json, fetched_at, platform, uploaded_at)
                    VALUES ({ph}, {ph}, {ph}, {ph}, {ph})
                    ON CONFLICT(batch_id) DO UPDATE SET
                        tests_json = excluded.tests_json,
                        fetched_at = excluded.fetched_at,
                        platform = excluded.platform,
                        uploaded_at = excluded.uploaded_at
                    """,
                    (batch_id, tests_json, fetched_at, platform, uploaded_at),
                )

    def get(self, batch_id: str) -> dict[str, Any] | None:
        """Return a stored batch payload, or ``None`` if absent/expired."""
        self.evict_expired()
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT batch_id, tests_json, fetched_at, platform, uploaded_at
                FROM applitools_batches
                WHERE batch_id = {ph}
                """,
                (batch_id,),
            )
            row = self._cm.row_to_dict(cursor)
        if row is None:
            return None
        return _row_to_payload(row, include_tests=True)

    def list_recent(self) -> list[dict[str, Any]]:
        """Return metadata for recent batches, newest first."""
        self.evict_expired()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT batch_id, tests_json, fetched_at, platform, uploaded_at
                FROM applitools_batches
                ORDER BY uploaded_at DESC
                """
            )
            rows = self._cm.rows_to_dicts(cursor)
        return [_row_to_payload(row, include_tests=False) for row in rows]

    def evict_expired(self) -> None:
        """Delete rows older than the configured TTL."""
        cutoff = datetime.utcnow().replace(microsecond=0) - timedelta(seconds=self._ttl_seconds)
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"DELETE FROM applitools_batches WHERE uploaded_at < {ph}",
                (cutoff,),
            )


def _row_to_payload(row: dict[str, Any], *, include_tests: bool) -> dict[str, Any]:
    tests = _decode_tests(row.get("tests_json"))
    payload = {
        "batchId": row.get("batch_id"),
        "fetchedAt": row.get("fetched_at"),
        "uploadedAt": _to_epoch(row.get("uploaded_at")) or 0.0,
        "platform": row.get("platform"),
    }
    if include_tests:
        payload["tests"] = tests
    else:
        payload["testCount"] = len(tests)
    return payload


def _decode_tests(value: Any) -> list[dict[str, Any]]:
    if isinstance(value, str):
        try:
            decoded = json.loads(value)
            return decoded if isinstance(decoded, list) else []
        except json.JSONDecodeError:
            return []
    return value if isinstance(value, list) else []


def _to_epoch(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if hasattr(value, "timestamp"):
        dt = value
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.timestamp()
    try:
        text = str(value)
        if "T" not in text and " " in text:
            text = text.replace(" ", "T")
        if "+" not in text and "Z" not in text:
            text += "+00:00"
        return datetime.fromisoformat(text.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None
