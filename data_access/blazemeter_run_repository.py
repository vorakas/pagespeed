"""Repository for persisted BlazeMeter run history.

Unlike the in-memory queue (which resets on process restart), this
repository persists every terminated run so QA can browse past tests
and pull their reports long after the app has restarted.

Rows are written once per master transition to a terminal state and
upserted by ``master_id`` to survive duplicate writes from reruns of
the poll loop.
"""

from __future__ import annotations

from typing import Any, Optional

from data_access.connection import ConnectionManager


class BlazemeterRunRepository:
    """Persistence for terminated BlazeMeter runs.

    Single Responsibility: owns the ``blazemeter_runs`` table.  Business
    rules (deciding when a run is terminal, what status to persist) live
    in the queue service.
    """

    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm: ConnectionManager = connection_manager

    # ------------------------------------------------------------------
    # Writes
    # ------------------------------------------------------------------

    def record_run(
        self,
        master_id: int,
        test_id: int,
        test_name: str,
        project_id: Optional[int],
        project_name: Optional[str],
        status: str,
        last_status: Optional[str],
        error: Optional[str],
        started_at: Optional[float],
        ended_at: Optional[float],
    ) -> None:
        """Upsert a terminated run.  Idempotent by ``master_id``."""
        ph = self._cm._placeholder()
        started_iso = _epoch_to_iso(started_at)
        ended_iso = _epoch_to_iso(ended_at)

        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            if self._cm._is_postgres:
                cursor.execute(
                    f"""
                    INSERT INTO blazemeter_runs (
                        master_id, test_id, test_name, project_id, project_name,
                        status, last_status, error, started_at, ended_at
                    ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                    ON CONFLICT (master_id) DO UPDATE SET
                        status = EXCLUDED.status,
                        last_status = EXCLUDED.last_status,
                        error = EXCLUDED.error,
                        started_at = EXCLUDED.started_at,
                        ended_at = EXCLUDED.ended_at
                    """,
                    (
                        master_id, test_id, test_name, project_id, project_name,
                        status, last_status, error, started_iso, ended_iso,
                    ),
                )
            else:
                cursor.execute(
                    f"""
                    INSERT INTO blazemeter_runs (
                        master_id, test_id, test_name, project_id, project_name,
                        status, last_status, error, started_at, ended_at
                    ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                    ON CONFLICT(master_id) DO UPDATE SET
                        status = excluded.status,
                        last_status = excluded.last_status,
                        error = excluded.error,
                        started_at = excluded.started_at,
                        ended_at = excluded.ended_at
                    """,
                    (
                        master_id, test_id, test_name, project_id, project_name,
                        status, last_status, error, started_iso, ended_iso,
                    ),
                )

    # ------------------------------------------------------------------
    # Reads
    # ------------------------------------------------------------------

    def list_recent(self, limit: int = 50, offset: int = 0) -> list[dict]:
        """Return runs ordered by ended_at DESC (newest first)."""
        ph = self._cm._placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT master_id, test_id, test_name, project_id, project_name,
                       status, last_status, error, started_at, ended_at, created_at
                FROM blazemeter_runs
                ORDER BY COALESCE(ended_at, created_at) DESC, id DESC
                LIMIT {ph} OFFSET {ph}
                """,
                (int(limit), int(offset)),
            )
            rows = self._cm._rows_to_dicts(cursor)
            return [_row_to_dict(r) for r in rows]

    def count(self) -> int:
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) AS c FROM blazemeter_runs")
            row = cursor.fetchone()
            if row is None:
                return 0
            # Works for both dict-like and tuple rows.
            try:
                return int(row["c"])
            except (KeyError, TypeError):
                return int(row[0])


def _epoch_to_iso(epoch: Optional[float]) -> Optional[str]:
    if not epoch:
        return None
    from datetime import datetime, timezone
    return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat()


def _row_to_dict(row: dict[str, Any]) -> dict:
    """Project a DB row to the JSON shape the frontend expects."""
    return {
        "masterId": row.get("master_id"),
        "testId": row.get("test_id"),
        "testName": row.get("test_name"),
        "projectId": row.get("project_id"),
        "projectName": row.get("project_name"),
        "status": row.get("status"),
        "lastStatus": row.get("last_status"),
        "error": row.get("error"),
        "startedAt": _iso_to_epoch(row.get("started_at")),
        "endedAt": _iso_to_epoch(row.get("ended_at")),
        "createdAt": _iso_to_epoch(row.get("created_at")),
    }


def _iso_to_epoch(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    # `psycopg` returns datetime objects; SQLite returns ISO strings.
    try:
        from datetime import datetime, timezone
        if hasattr(value, "timestamp"):
            dt = value
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt.timestamp()
        s = str(value)
        # SQLite may return "YYYY-MM-DD HH:MM:SS" — make it ISO-parseable.
        if "T" not in s and " " in s:
            s = s.replace(" ", "T")
        if "+" not in s and "Z" not in s:
            s += "+00:00"
        return datetime.fromisoformat(s).timestamp()
    except Exception:  # noqa: BLE001
        return None
