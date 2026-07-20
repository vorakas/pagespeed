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
        samples_per_url: int = 1,
    ) -> int:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    INSERT INTO csv_lighthouse_runs (
                        label, strategy, site_keys, worker_count,
                        target_budget_seconds, total_items, samples_per_url
                    )
                    VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                    {self._cm.returning_id()}
                    """,
                    (
                        label,
                        strategy,
                        json.dumps(site_keys),
                        worker_count,
                        target_budget_seconds,
                        total_items,
                        samples_per_url,
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
                if not self._run_exists(cursor, run_id):
                    raise DatabaseError(f"CSV Lighthouse run {run_id} does not exist")
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
        except DatabaseError:
            raise
        except Exception as exc:
            raise DatabaseError(f"Failed to create CSV Lighthouse items: {exc}") from exc

    def create_sample(
        self,
        run_id: int,
        item_id: int,
        sample_index: int,
        status: str,
        metrics: dict | None,
        attempts: int,
        duration_ms: int | None,
        error_message: str | None,
    ) -> int:
        ph = self._cm.placeholder()
        metrics = metrics or {}
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    INSERT INTO csv_lighthouse_samples (
                        run_id, item_id, sample_index, status,
                        fcp, speed_index, lcp, tbt, cls, performance,
                        attempts, duration_ms, error_message
                    )
                    VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                    {self._cm.returning_id()}
                    """,
                    (
                        run_id,
                        item_id,
                        sample_index,
                        status,
                        metrics.get("fcp"),
                        metrics.get("speed_index"),
                        metrics.get("lcp"),
                        metrics.get("tbt"),
                        metrics.get("cls"),
                        metrics.get("performance"),
                        attempts,
                        duration_ms,
                        error_message,
                    ),
                )
                sample_id = self._cm.last_insert_id(cursor)
                cursor.execute(
                    f"""
                    UPDATE csv_lighthouse_runs
                    SET updated_at = CURRENT_TIMESTAMP
                    WHERE id = {ph}
                    """,
                    (run_id,),
                )
                return sample_id
        except Exception as exc:
            raise DatabaseError(f"Failed to create CSV Lighthouse sample: {exc}") from exc

    def list_samples(self, run_id: int) -> list[dict]:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT *
                FROM csv_lighthouse_samples
                WHERE run_id = {ph}
                ORDER BY item_id, sample_index
                """,
                (run_id,),
            )
            return self._cm.rows_to_dicts(cursor)

    def create_file(
        self,
        run_id: int,
        filename: str,
        group_key: str,
        csv_text: str,
        row_count: int,
    ) -> int:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                if not self._run_exists(cursor, run_id):
                    raise DatabaseError(f"CSV Lighthouse run {run_id} does not exist")
                cursor.execute(
                    f"""
                    INSERT INTO csv_lighthouse_files (
                        run_id, filename, group_key, csv_text, row_count
                    )
                    VALUES ({ph}, {ph}, {ph}, {ph}, {ph})
                    {self._cm.returning_id()}
                    """,
                    (run_id, filename, group_key, csv_text, row_count),
                )
                return self._cm.last_insert_id(cursor)
        except DatabaseError:
            raise
        except Exception as exc:
            raise DatabaseError(f"Failed to create CSV Lighthouse file: {exc}") from exc

    def list_files(self, run_id: int) -> list[dict]:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT *
                FROM csv_lighthouse_files
                WHERE run_id = {ph}
                ORDER BY filename, id
                """,
                (run_id,),
            )
            return self._cm.rows_to_dicts(cursor)

    def get_file(self, file_id: int) -> dict | None:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT * FROM csv_lighthouse_files WHERE id = {ph}", (file_id,))
            return self._cm.row_to_dict(cursor)

    def update_file(self, file_id: int, csv_text: str, row_count: int) -> None:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                conn.cursor().execute(
                    f"""
                    UPDATE csv_lighthouse_files
                    SET csv_text = {ph},
                        row_count = {ph},
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = {ph}
                    """,
                    (csv_text, row_count, file_id),
                )
        except Exception as exc:
            raise DatabaseError(f"Failed to update CSV Lighthouse file {file_id}: {exc}") from exc

    def delete_file(self, file_id: int) -> None:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                conn.cursor().execute(
                    f"DELETE FROM csv_lighthouse_files WHERE id = {ph}",
                    (file_id,),
                )
        except Exception as exc:
            raise DatabaseError(f"Failed to delete CSV Lighthouse file {file_id}: {exc}") from exc

    def delete_run(self, run_id: int) -> None:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"DELETE FROM csv_lighthouse_items WHERE run_id = {ph}", (run_id,)
                )
                cursor.execute(
                    f"DELETE FROM csv_lighthouse_files WHERE run_id = {ph}", (run_id,)
                )
                cursor.execute(
                    f"DELETE FROM csv_lighthouse_runs WHERE id = {ph}", (run_id,)
                )
        except Exception as exc:
            raise DatabaseError(f"Failed to delete CSV Lighthouse run {run_id}: {exc}") from exc

    def list_library(self) -> list[dict]:
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM csv_lighthouse_library ORDER BY filename"
            )
            return self._cm.rows_to_dicts(cursor)

    def upsert_library_file(
        self, filename: str, group_key: str, csv_text: str, row_count: int
    ) -> None:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                conn.cursor().execute(
                    f"""
                    INSERT INTO csv_lighthouse_library (
                        filename, group_key, csv_text, row_count
                    )
                    VALUES ({ph}, {ph}, {ph}, {ph})
                    ON CONFLICT(filename) DO UPDATE SET
                        group_key = excluded.group_key,
                        csv_text = excluded.csv_text,
                        row_count = excluded.row_count,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (filename, group_key, csv_text, row_count),
                )
        except Exception as exc:
            raise DatabaseError(
                f"Failed to save CSV library file {filename}: {exc}"
            ) from exc

    def delete_library_file(self, filename: str) -> None:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                conn.cursor().execute(
                    f"DELETE FROM csv_lighthouse_library WHERE filename = {ph}",
                    (filename,),
                )
        except Exception as exc:
            raise DatabaseError(
                f"Failed to delete CSV library file {filename}: {exc}"
            ) from exc

    def replace_pending_items(self, run_id: int, items: list[dict]) -> list[int]:
        ph = self._cm.placeholder()
        item_ids: list[int] = []
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                if not self._run_exists(cursor, run_id):
                    raise DatabaseError(f"CSV Lighthouse run {run_id} does not exist")
                cursor.execute(
                    f"DELETE FROM csv_lighthouse_items WHERE run_id = {ph} AND status = 'pending'",
                    (run_id,),
                )
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
                cursor.execute(
                    f"""
                    UPDATE csv_lighthouse_runs
                    SET total_items = {ph},
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = {ph}
                    """,
                    (len(item_ids), run_id),
                )
                self._refresh_run_progress(cursor, run_id)
            return item_ids
        except DatabaseError:
            raise
        except Exception as exc:
            raise DatabaseError(
                f"Failed to replace pending CSV Lighthouse items for run {run_id}: {exc}"
            ) from exc

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

    def run_is_editable(self, run_id: int) -> bool:
        detail = self.get_run_detail(run_id)
        run = detail["run"]
        return bool(run and run["status"] == "pending")

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

    def mark_item_running(self, item_id: int) -> bool:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE csv_lighthouse_items
                SET status = 'running',
                    started_at = COALESCE(started_at, CURRENT_TIMESTAMP)
                WHERE id = {ph} AND status = 'pending'
                """,
                (item_id,),
            )
            claimed = cursor.rowcount > 0
            if claimed:
                run_id = self._item_run_id(cursor, item_id)
                if run_id is not None:
                    self._touch_run(cursor, run_id)
            return claimed

    def mark_item_passed(self, item_id: int, metrics: dict) -> bool:
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
                        performance = {ph},
                        attempts = {ph},
                        duration_ms = {ph},
                        completed_at = CURRENT_TIMESTAMP
                    WHERE id = {ph} AND status = 'running'
                    """,
                    (
                        metrics.get("fcp"),
                        metrics.get("speed_index"),
                        metrics.get("lcp"),
                        metrics.get("tbt"),
                        metrics.get("cls"),
                        metrics.get("performance"),
                        metrics.get("attempts", 1),
                        metrics.get("duration_ms"),
                        item_id,
                    ),
                )
                if cursor.rowcount == 0:
                    return False
                run_id = self._item_run_id(cursor, item_id)
                if run_id is not None:
                    self._refresh_run_progress(cursor, run_id)
                return True
        except Exception as exc:
            raise DatabaseError(f"Failed to mark CSV Lighthouse item {item_id} passed: {exc}") from exc

    def mark_item_failed(self, item_id: int, error_message: str, attempts: int = 1) -> bool:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    UPDATE csv_lighthouse_items
                    SET status = 'failed',
                        error_message = {ph},
                        attempts = {ph},
                        completed_at = CURRENT_TIMESTAMP
                    WHERE id = {ph} AND status = 'running'
                    """,
                    (error_message, attempts, item_id),
                )
                if cursor.rowcount == 0:
                    return False
                run_id = self._item_run_id(cursor, item_id)
                if run_id is not None:
                    self._refresh_run_progress(cursor, run_id)
                return True
        except Exception as exc:
            raise DatabaseError(f"Failed to mark CSV Lighthouse item {item_id} failed: {exc}") from exc

    def mark_pending_items_cancelled(self, run_id: int) -> int:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    UPDATE csv_lighthouse_items
                    SET status = 'cancelled',
                        error_message = 'Cancelled',
                        completed_at = CURRENT_TIMESTAMP
                    WHERE run_id = {ph} AND status = 'pending'
                    """,
                    (run_id,),
                )
                cancelled_items = cursor.rowcount
                self._refresh_run_progress(cursor, run_id)
                return cancelled_items
        except Exception as exc:
            raise DatabaseError(f"Failed to cancel pending CSV Lighthouse items for run {run_id}: {exc}") from exc

    def mark_run_failed(self, run_id: int, error_message: str) -> None:
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
                    WHERE run_id = {ph} AND status IN ('pending', 'running')
                    """,
                    (error_message, run_id),
                )
                self._refresh_run_progress(cursor, run_id)
                cursor.execute(
                    f"""
                    UPDATE csv_lighthouse_runs
                    SET status = 'failed',
                        error_message = {ph},
                        finished_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = {ph} AND status != 'cancelled'
                    """,
                    (error_message, run_id),
                )
        except Exception as exc:
            raise DatabaseError(f"Failed to mark CSV Lighthouse run {run_id} failed: {exc}") from exc

    def finish_run_if_complete(self, run_id: int) -> None:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                self._refresh_run_progress(cursor, run_id)
                cursor.execute(
                    f"""
                    SELECT
                        total_items,
                        completed_items,
                        failed_items,
                        cancelled_items,
                        status,
                        cancel_requested
                    FROM csv_lighthouse_runs
                    WHERE id = {ph}
                    """,
                    (run_id,),
                )
                run = self._cm.row_to_dict(cursor)
                if not run:
                    return
                if run["status"] == "cancelled":
                    return
                terminal_items = (
                    int(run["completed_items"] or 0)
                    + int(run["failed_items"] or 0)
                    + int(run["cancelled_items"] or 0)
                )
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

    def recover_interrupted_runs(self, error_message: str, stale_seconds: int) -> int:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                if self._cm.is_postgres:
                    cursor.execute(
                        f"""
                        SELECT id
                        FROM csv_lighthouse_runs
                        WHERE status IN ('pending', 'running')
                          AND updated_at < CURRENT_TIMESTAMP - ({ph} * INTERVAL '1 second')
                        """,
                        (stale_seconds,),
                    )
                else:
                    cursor.execute(
                        f"""
                        SELECT id
                        FROM csv_lighthouse_runs
                        WHERE status IN ('pending', 'running')
                          AND updated_at < datetime('now', {ph})
                        """,
                        (f"-{stale_seconds} seconds",),
                    )
                run_ids = [int(row["id"]) for row in self._cm.rows_to_dicts(cursor)]
                for run_id in run_ids:
                    cursor.execute(
                        f"""
                        UPDATE csv_lighthouse_items
                        SET status = 'failed',
                            error_message = {ph},
                            completed_at = CURRENT_TIMESTAMP
                        WHERE run_id = {ph} AND status IN ('pending', 'running')
                        """,
                        (error_message, run_id),
                    )
                    self._refresh_run_progress(cursor, run_id)
                    cursor.execute(
                        f"""
                        UPDATE csv_lighthouse_runs
                        SET status = 'interrupted',
                            error_message = {ph},
                            finished_at = CURRENT_TIMESTAMP,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = {ph}
                        """,
                        (error_message, run_id),
                    )
                return len(run_ids)
        except Exception as exc:
            raise DatabaseError(f"Failed to recover interrupted CSV Lighthouse runs: {exc}") from exc

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
                SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled_items,
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
                cancelled_items = {ph},
                average_item_duration_ms = {ph},
                updated_at = CURRENT_TIMESTAMP
            WHERE id = {ph}
            """,
            (
                int(progress.get("completed_items") or 0),
                int(progress.get("failed_items") or 0),
                int(progress.get("cancelled_items") or 0),
                self._int_or_none(progress.get("average_item_duration_ms")),
                run_id,
            ),
        )

    def _item_run_id(self, cursor: Any, item_id: int) -> int | None:
        ph = self._cm.placeholder()
        cursor.execute(f"SELECT run_id FROM csv_lighthouse_items WHERE id = {ph}", (item_id,))
        row = self._cm.row_to_dict(cursor)
        return int(row["run_id"]) if row else None

    def _touch_run(self, cursor: Any, run_id: int) -> None:
        ph = self._cm.placeholder()
        cursor.execute(
            f"""
            UPDATE csv_lighthouse_runs
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = {ph}
            """,
            (run_id,),
        )

    def _run_exists(self, cursor: Any, run_id: int) -> bool:
        ph = self._cm.placeholder()
        cursor.execute(f"SELECT 1 FROM csv_lighthouse_runs WHERE id = {ph}", (run_id,))
        return self._cm.row_to_dict(cursor) is not None

    def _normalize_run(self, run: dict) -> dict:
        normalized = dict(run)
        normalized["site_keys"] = self._load_site_keys(normalized.get("site_keys"))
        normalized["cancel_requested"] = bool(normalized.get("cancel_requested"))
        normalized["cancelled_items"] = int(normalized.get("cancelled_items") or 0)
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
