"""Repository for CSV-driven Lighthouse run persistence."""

import json
from typing import Any

from data_access.connection import ConnectionManager
from exceptions import DatabaseError


class CsvLighthouseRepository:
    """Data-access object for CSV Lighthouse runs and items."""

    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm: ConnectionManager = connection_manager

    def create_run(
        self,
        label: str,
        strategy: str,
        site_keys: list[str],
        worker_count: int,
        target_budget_seconds: int | None,
        total_items: int,
    ) -> int:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    INSERT INTO csv_lighthouse_runs (
                        label, strategy, site_keys, worker_count,
                        target_budget_seconds, total_items
                    )
                    VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                    {self._cm.returning_id()}
                    """,
                    (
                        label,
                        strategy,
                        json.dumps(site_keys),
                        worker_count,
                        target_budget_seconds,
                        total_items,
                    ),
                )
                return self._cm.last_insert_id(cursor)
        except Exception as exc:
            raise DatabaseError(f"Failed to create CSV Lighthouse run: {exc}") from exc

    def create_items(self, run_id: int, items: list[dict]) -> list[int]:
        ph = self._cm.placeholder()
        item_ids: list[int] = []
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                for item in items:
                    cursor.execute(
                        f"""
                        INSERT INTO csv_lighthouse_items (
                            run_id, source_filename, group_key, site_key,
                            original_value, generated_url, strategy
                        )
                        VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                        {self._cm.returning_id()}
                        """,
                        (
                            run_id,
                            item["source_filename"],
                            item.get("group_key"),
                            item["site_key"],
                            item["original_value"],
                            item["generated_url"],
                            item["strategy"],
                        ),
                    )
                    item_ids.append(self._cm.last_insert_id(cursor))
            return item_ids
        except Exception as exc:
            raise DatabaseError(f"Failed to create CSV Lighthouse items: {exc}") from exc

    def list_runs(self, limit: int = 20) -> list[dict]:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT *
                FROM csv_lighthouse_runs
                ORDER BY created_at DESC, id DESC
                LIMIT {ph}
                """,
                (limit,),
            )
            return [self._normalize_run(row) for row in self._cm.rows_to_dicts(cursor)]

    def get_run_detail(self, run_id: int) -> dict:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT * FROM csv_lighthouse_runs WHERE id = {ph}", (run_id,))
            run = self._cm.row_to_dict(cursor)
            cursor.execute(
                f"""
                SELECT *
                FROM csv_lighthouse_items
                WHERE run_id = {ph}
                ORDER BY id
                """,
                (run_id,),
            )
            items = self._cm.rows_to_dicts(cursor)

        return {"run": self._normalize_run(run) if run else None, "items": items}

    def mark_run_running(self, run_id: int) -> None:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE csv_lighthouse_runs
                SET status = 'running',
                    started_at = COALESCE(started_at, CURRENT_TIMESTAMP),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = {ph}
                """,
                (run_id,),
            )

    def request_cancel(self, run_id: int) -> None:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE csv_lighthouse_runs
                SET cancel_requested = {ph}, updated_at = CURRENT_TIMESTAMP
                WHERE id = {ph}
                """,
                (self._true_value(), run_id),
            )

    def mark_item_running(self, item_id: int) -> None:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE csv_lighthouse_items
                SET status = 'running',
                    started_at = COALESCE(started_at, CURRENT_TIMESTAMP)
                WHERE id = {ph}
                """,
                (item_id,),
            )

    def mark_item_passed(self, item_id: int, metrics: dict) -> None:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    UPDATE csv_lighthouse_items
                    SET status = 'passed',
                        error_message = NULL,
                        fcp = {ph},
                        speed_index = {ph},
                        lcp = {ph},
                        tbt = {ph},
                        cls = {ph},
                        duration_ms = {ph},
                        completed_at = CURRENT_TIMESTAMP
                    WHERE id = {ph}
                    """,
                    (
                        metrics.get("fcp"),
                        metrics.get("speed_index"),
                        metrics.get("lcp"),
                        metrics.get("tbt"),
                        metrics.get("cls"),
                        metrics.get("duration_ms"),
                        item_id,
                    ),
                )
                run_id = self._item_run_id(cursor, item_id)
                if run_id is not None:
                    self._refresh_run_progress(cursor, run_id)
        except Exception as exc:
            raise DatabaseError(f"Failed to mark CSV Lighthouse item {item_id} passed: {exc}") from exc

    def mark_item_failed(self, item_id: int, error_message: str) -> None:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    UPDATE csv_lighthouse_items
                    SET status = 'failed',
                        error_message = {ph},
                        completed_at = CURRENT_TIMESTAMP
                    WHERE id = {ph}
                    """,
                    (error_message, item_id),
                )
                run_id = self._item_run_id(cursor, item_id)
                if run_id is not None:
                    self._refresh_run_progress(cursor, run_id)
        except Exception as exc:
            raise DatabaseError(f"Failed to mark CSV Lighthouse item {item_id} failed: {exc}") from exc

    def finish_run_if_complete(self, run_id: int) -> None:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                self._refresh_run_progress(cursor, run_id)
                cursor.execute(
                    f"""
                    SELECT total_items, completed_items, failed_items
                    FROM csv_lighthouse_runs
                    WHERE id = {ph}
                    """,
                    (run_id,),
                )
                run = self._cm.row_to_dict(cursor)
                if not run:
                    return
                terminal_items = int(run["completed_items"] or 0) + int(run["failed_items"] or 0)
                if terminal_items < int(run["total_items"] or 0):
                    return

                status = "completed_with_failures" if int(run["failed_items"] or 0) else "completed"
                cursor.execute(
                    f"""
                    UPDATE csv_lighthouse_runs
                    SET status = {ph},
                        finished_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = {ph}
                    """,
                    (status, run_id),
                )
        except Exception as exc:
            raise DatabaseError(f"Failed to finish CSV Lighthouse run {run_id}: {exc}") from exc

    def pending_items(self, run_id: int) -> list[dict]:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT *
                FROM csv_lighthouse_items
                WHERE run_id = {ph} AND status = 'pending'
                ORDER BY id
                """,
                (run_id,),
            )
            return self._cm.rows_to_dicts(cursor)

    def should_cancel(self, run_id: int) -> bool:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"SELECT cancel_requested FROM csv_lighthouse_runs WHERE id = {ph}",
                (run_id,),
            )
            row = self._cm.row_to_dict(cursor)
            return bool(row and row["cancel_requested"])

    def mark_run_cancelled(self, run_id: int) -> None:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE csv_lighthouse_runs
                SET status = 'cancelled',
                    finished_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = {ph}
                """,
                (run_id,),
            )

    def _refresh_run_progress(self, cursor: Any, run_id: int) -> None:
        ph = self._cm.placeholder()
        cursor.execute(
            f"""
            SELECT
                SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) AS completed_items,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_items,
                AVG(CASE WHEN status IN ('passed', 'failed') THEN duration_ms END) AS average_item_duration_ms
            FROM csv_lighthouse_items
            WHERE run_id = {ph}
            """,
            (run_id,),
        )
        progress = self._cm.row_to_dict(cursor) or {}
        cursor.execute(
            f"""
            UPDATE csv_lighthouse_runs
            SET completed_items = {ph},
                failed_items = {ph},
                average_item_duration_ms = {ph},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = {ph}
            """,
            (
                int(progress.get("completed_items") or 0),
                int(progress.get("failed_items") or 0),
                self._int_or_none(progress.get("average_item_duration_ms")),
                run_id,
            ),
        )

    def _item_run_id(self, cursor: Any, item_id: int) -> int | None:
        ph = self._cm.placeholder()
        cursor.execute(f"SELECT run_id FROM csv_lighthouse_items WHERE id = {ph}", (item_id,))
        row = self._cm.row_to_dict(cursor)
        return int(row["run_id"]) if row else None

    def _normalize_run(self, run: dict) -> dict:
        normalized = dict(run)
        normalized["site_keys"] = self._load_site_keys(normalized.get("site_keys"))
        normalized["cancel_requested"] = bool(normalized.get("cancel_requested"))
        return normalized

    @staticmethod
    def _load_site_keys(raw_value: Any) -> list[str]:
        if raw_value is None:
            return []
        if isinstance(raw_value, list):
            return raw_value
        try:
            value = json.loads(raw_value)
            return value if isinstance(value, list) else []
        except (TypeError, json.JSONDecodeError):
            return []

    @staticmethod
    def _int_or_none(raw_value: Any) -> int | None:
        if raw_value is None:
            return None
        return int(raw_value)

    def _true_value(self) -> bool | int:
        return True if self._cm.is_postgres else 1
