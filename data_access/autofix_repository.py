"""Persistence for ingested Autofix reports and their suggested fixes.

Two tables back this repository:

* ``autofix_report`` — one row per Azure DevOps build that produced an
  ``autofix-report.json`` artifact.
* ``autofix_fix``    — one row per suggested fix, PK ``(build_id, fix_id)``.

Re-ingesting a build UPSERTs content fields while preserving the human
triage columns (``status``/``outcome``/``actual_fix_code``/``note``).
"""

from __future__ import annotations

from typing import Any

from data_access.connection import ConnectionManager

_REPORT_COLUMNS = (
    "build_id", "pipeline_id", "pipeline_name", "branch", "build_number",
    "build_url", "commit_sha", "generated_utc", "fetched_at",
    "failures_count", "groups_count", "fixes_count",
)

# Content columns written on every fix upsert. The triage columns
# (status, outcome, actual_fix_code, note, updated_at) are deliberately
# excluded so human feedback survives a re-ingest.
_FIX_CONTENT_COLUMNS = (
    "build_id", "fix_id", "signature", "test_name", "category",
    "exception_type", "confidence", "diagnosis", "reasoning", "file_path",
    "start_line", "end_line", "fix_type", "old_code", "new_code", "description",
)

_PATCHABLE_COLUMNS = ("status", "outcome", "actual_fix_code", "note")


class AutofixRepository:
    """CRUD for the ``autofix_report`` and ``autofix_fix`` tables."""

    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm = connection_manager

    def upsert_report(self, report: dict[str, Any], fixes: list[dict[str, Any]]) -> None:
        """Insert or update one build's report and its fixes in a single transaction.

        All-or-nothing: the report row and every fix row commit together, or
        (on any failure) the whole batch rolls back via the connection
        context manager. Existing fix triage columns are preserved.
        """
        ph = self._cm.placeholder()
        excluded = "EXCLUDED" if self._cm.is_postgres else "excluded"

        report_cols = ", ".join(_REPORT_COLUMNS)
        report_values = ", ".join([ph] * len(_REPORT_COLUMNS))
        report_updates = ", ".join(
            f"{col} = {excluded}.{col}" for col in _REPORT_COLUMNS if col != "build_id"
        )
        report_sql = (
            f"INSERT INTO autofix_report ({report_cols}) VALUES ({report_values}) "
            f"ON CONFLICT (build_id) DO UPDATE SET {report_updates}"
        )

        fix_cols = ", ".join(_FIX_CONTENT_COLUMNS)
        fix_values = ", ".join([ph] * len(_FIX_CONTENT_COLUMNS))
        fix_updates = ", ".join(
            f"{col} = {excluded}.{col}"
            for col in _FIX_CONTENT_COLUMNS
            if col not in ("build_id", "fix_id")
        )
        fix_sql = (
            f"INSERT INTO autofix_fix ({fix_cols}) VALUES ({fix_values}) "
            f"ON CONFLICT (build_id, fix_id) DO UPDATE SET {fix_updates}"
        )

        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(report_sql, tuple(report.get(c) for c in _REPORT_COLUMNS))
            for fix in fixes:
                cursor.execute(fix_sql, tuple(fix.get(c) for c in _FIX_CONTENT_COLUMNS))

    def get_builds(self) -> list[dict[str, Any]]:
        """Return all build reports, newest first, with status rollup counts."""
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT r.build_id, r.pipeline_id, r.pipeline_name, r.branch,
                       r.build_number, r.build_url, r.commit_sha, r.generated_utc,
                       r.fetched_at, r.failures_count, r.groups_count, r.fixes_count,
                       SUM(CASE WHEN f.status = 'todo' THEN 1 ELSE 0 END) AS todo_count,
                       SUM(CASE WHEN f.status = 'applied' THEN 1 ELSE 0 END) AS applied_count,
                       SUM(CASE WHEN f.status = 'dismissed' THEN 1 ELSE 0 END) AS dismissed_count
                FROM autofix_report r
                LEFT JOIN autofix_fix f ON f.build_id = r.build_id
                GROUP BY r.build_id, r.pipeline_id, r.pipeline_name, r.branch,
                         r.build_number, r.build_url, r.commit_sha, r.generated_utc,
                         r.fetched_at, r.failures_count, r.groups_count, r.fixes_count
                ORDER BY r.fetched_at DESC
                """
            )
            rows = self._cm.rows_to_dicts(cursor)
        for row in rows:
            for key in ("todo_count", "applied_count", "dismissed_count"):
                row[key] = int(row.get(key) or 0)
        return rows

    def get_fixes(self, build_id: str) -> list[dict[str, Any]]:
        """Return all fixes for one build, ordered by file then start line."""
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT build_id, fix_id, signature, test_name, category,
                       exception_type, confidence, diagnosis, reasoning, file_path,
                       start_line, end_line, fix_type, old_code, new_code, description,
                       status, outcome, actual_fix_code, note, updated_at
                FROM autofix_fix
                WHERE build_id = {ph}
                ORDER BY file_path, start_line, fix_id
                """,
                (build_id,),
            )
            return self._cm.rows_to_dicts(cursor)

    def patch_fix(
        self,
        build_id: str,
        fix_id: str,
        *,
        status: str | None = None,
        outcome: str | None = None,
        actual_fix_code: str | None = None,
        note: str | None = None,
    ) -> bool:
        """Update triage fields on one fix. Returns ``True`` if a row changed."""
        provided = {
            "status": status,
            "outcome": outcome,
            "actual_fix_code": actual_fix_code,
            "note": note,
        }
        set_columns = [col for col in _PATCHABLE_COLUMNS if provided[col] is not None]
        if not set_columns:
            return False

        ph = self._cm.placeholder()
        set_clause = ", ".join(f"{col} = {ph}" for col in set_columns)
        set_clause += ", updated_at = CURRENT_TIMESTAMP"
        values = [provided[col] for col in set_columns]
        values.extend([build_id, fix_id])

        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"UPDATE autofix_fix SET {set_clause} "
                f"WHERE build_id = {ph} AND fix_id = {ph}",
                tuple(values),
            )
            return cursor.rowcount > 0
