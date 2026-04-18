"""Repository for BlazeMeter preset CRUD operations.

Encapsulates all SQL touching the ``blazemeter_presets`` and
``blazemeter_preset_tests`` tables.  Follows the same Repository pattern
as ``TriggerRepository`` — parent row + ordered child rows, loaded
together so consumers never see an inconsistent snapshot.
"""

from __future__ import annotations

from typing import Any, Iterable

from data_access.connection import ConnectionManager
from exceptions import DatabaseError, ValidationError


class BlazemeterPresetRepository:
    """Data-access object for BlazeMeter presets.

    A preset bundles a named group of BlazeMeter tests (ordered) so that
    QA can enqueue an entire regression set with one click rather than
    queueing tests individually.

    Single Responsibility: owns all persistence logic for presets.
    Business rules (validation, enqueueing into the queue service) belong
    one layer up in the route handler or a future preset service.

    Args:
        connection_manager: Shared connection manager injected at construction.
    """

    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm: ConnectionManager = connection_manager

    # ------------------------------------------------------------------
    # Read operations
    # ------------------------------------------------------------------

    def get_all(self) -> list[dict]:
        """Return every preset ordered by name, each with a ``tests`` list."""
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM blazemeter_presets ORDER BY name"
            )
            presets = self._cm._rows_to_dicts(cursor)
            for preset in presets:
                preset["tests"] = self._fetch_tests(cursor, preset["id"])
            return presets

    def get_by_id(self, preset_id: int) -> dict | None:
        """Return a single preset with its ``tests``, or ``None``."""
        ph = self._cm._placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"SELECT * FROM blazemeter_presets WHERE id = {ph}",
                (preset_id,),
            )
            preset = self._cm._row_to_dict(cursor)
            if preset is None:
                return None
            preset["tests"] = self._fetch_tests(cursor, preset_id)
            return preset

    # ------------------------------------------------------------------
    # Write operations
    # ------------------------------------------------------------------

    def create(
        self,
        name: str,
        tests: list[dict],
        project_id: int | None = None,
        project_name: str | None = None,
    ) -> dict:
        """Insert a new preset plus its child tests in one transaction."""
        ph = self._cm._placeholder()
        returning = self._cm._returning_id()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"INSERT INTO blazemeter_presets (name, project_id, project_name) "
                    f"VALUES ({ph}, {ph}, {ph}){returning}",
                    (name, project_id, project_name),
                )
                preset_id = self._cm._last_insert_id(cursor)
                self._insert_tests(cursor, preset_id, tests)
        except Exception as exc:
            if self._cm._is_integrity_error(exc):
                raise ValidationError(f"A preset named '{name}' already exists") from exc
            raise DatabaseError(f"Failed to create preset: {exc}") from exc
        return self.get_by_id(preset_id)  # type: ignore[return-value]

    def update(
        self,
        preset_id: int,
        name: str,
        tests: list[dict],
        project_id: int | None = None,
        project_name: str | None = None,
    ) -> dict | None:
        """Replace a preset's name + test list atomically."""
        ph = self._cm._placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"UPDATE blazemeter_presets SET name = {ph}, project_id = {ph}, "
                    f"project_name = {ph}, updated_at = CURRENT_TIMESTAMP WHERE id = {ph}",
                    (name, project_id, project_name, preset_id),
                )
                if cursor.rowcount == 0:
                    return None
                cursor.execute(
                    f"DELETE FROM blazemeter_preset_tests WHERE preset_id = {ph}",
                    (preset_id,),
                )
                self._insert_tests(cursor, preset_id, tests)
        except Exception as exc:
            if self._cm._is_integrity_error(exc):
                raise ValidationError(f"A preset named '{name}' already exists") from exc
            raise DatabaseError(f"Failed to update preset: {exc}") from exc
        return self.get_by_id(preset_id)

    def delete(self, preset_id: int) -> bool:
        """Delete a preset (cascade removes its test rows)."""
        ph = self._cm._placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            # SQLite doesn't enforce ON DELETE CASCADE by default; delete
            # child rows explicitly to keep both engines consistent.
            cursor.execute(
                f"DELETE FROM blazemeter_preset_tests WHERE preset_id = {ph}",
                (preset_id,),
            )
            cursor.execute(
                f"DELETE FROM blazemeter_presets WHERE id = {ph}",
                (preset_id,),
            )
            return cursor.rowcount > 0

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _fetch_tests(self, cursor: Any, preset_id: int) -> list[dict]:
        ph = self._cm._placeholder()
        cursor.execute(
            f"SELECT test_id, test_name, project_id, project_name, position "
            f"FROM blazemeter_preset_tests "
            f"WHERE preset_id = {ph} ORDER BY position, id",
            (preset_id,),
        )
        return self._cm._rows_to_dicts(cursor)

    def _insert_tests(
        self,
        cursor: Any,
        preset_id: int,
        tests: Iterable[dict],
    ) -> None:
        ph = self._cm._placeholder()
        for position, test in enumerate(tests):
            test_id = test.get("test_id") if isinstance(test, dict) else None
            test_name = test.get("test_name") if isinstance(test, dict) else None
            if test_id is None or not test_name:
                raise ValidationError(
                    "Each preset test requires test_id and test_name"
                )
            project_id = test.get("project_id") if isinstance(test, dict) else None
            project_name = test.get("project_name") if isinstance(test, dict) else None
            cursor.execute(
                f"INSERT INTO blazemeter_preset_tests "
                f"(preset_id, test_id, test_name, project_id, project_name, position) "
                f"VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph})",
                (
                    preset_id,
                    int(test_id),
                    str(test_name),
                    int(project_id) if project_id else None,
                    str(project_name) if project_name else None,
                    position,
                ),
            )
