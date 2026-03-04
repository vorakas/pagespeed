"""Repository for schedule preset CRUD operations.

Encapsulates all SQL touching the ``schedule_presets`` table.  User-created
presets are stored here; built-in presets live in ``config.SCHEDULE_PRESETS``
and are merged at the service layer.
"""

from data_access.connection import ConnectionManager
from exceptions import DatabaseError


class PresetRepository:
    """Data-access object for the ``schedule_presets`` table.

    Single Responsibility: owns persistence for user-created schedule
    presets.  The service layer is responsible for merging these with
    built-in presets from configuration.

    Args:
        connection_manager: Shared connection manager injected at construction.
    """

    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm: ConnectionManager = connection_manager

    def get_all(self) -> list[dict]:
        """Return every user-created preset ordered by name."""
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM schedule_presets ORDER BY name")
            return self._cm._rows_to_dicts(cursor)

    def get_by_id(self, preset_id: int) -> dict | None:
        """Return a single preset, or ``None`` if it does not exist."""
        ph = self._cm._placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"SELECT * FROM schedule_presets WHERE id = {ph}",
                (preset_id,),
            )
            return self._cm._row_to_dict(cursor)

    def create(self, name: str, cron_expression: str) -> int | None:
        """Insert a new preset.

        Returns the new id, or ``None`` if the name already exists.
        """
        ph = self._cm._placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"INSERT INTO schedule_presets (name, cron_expression) "
                    f"VALUES ({ph}, {ph}){self._cm._returning_id()}",
                    (name, cron_expression),
                )
                return self._cm._last_insert_id(cursor)
        except Exception as exc:
            if self._cm._is_integrity_error(exc):
                return None
            raise DatabaseError(f"Failed to create preset: {exc}") from exc

    def delete(self, preset_id: int) -> bool:
        """Delete a preset by id.

        Returns ``True`` if the preset existed and was removed.
        """
        ph = self._cm._placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"DELETE FROM schedule_presets WHERE id = {ph}",
                    (preset_id,),
                )
                return cursor.rowcount > 0
        except Exception as exc:
            raise DatabaseError(
                f"Failed to delete preset {preset_id}: {exc}"
            ) from exc
