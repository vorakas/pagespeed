"""Repository for scheduled trigger CRUD operations.

Encapsulates all SQL touching the ``scheduled_triggers`` and
``trigger_urls`` tables.  Follows the same Repository pattern as
SiteRepository and UrlRepository.
"""

from datetime import datetime
from typing import Any

from data_access.connection import ConnectionManager
from exceptions import DatabaseError


class TriggerRepository:
    """Data-access object for the ``scheduled_triggers`` table.

    Single Responsibility: owns all persistence logic for triggers and
    their URL associations.  Business rules (validation, scheduler sync)
    belong in ``TriggerService``.

    Args:
        connection_manager: Shared connection manager injected at construction.
    """

    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm: ConnectionManager = connection_manager

    # ------------------------------------------------------------------
    # Read operations
    # ------------------------------------------------------------------

    def get_all(self) -> list[dict]:
        """Return all triggers ordered by name, each with a ``url_ids`` list."""
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM scheduled_triggers ORDER BY name"
            )
            triggers = self._cm.rows_to_dicts(cursor)
            return self._attach_url_ids(cursor, triggers)

    def get_by_id(self, trigger_id: int) -> dict | None:
        """Return a single trigger with its ``url_ids``, or ``None``."""
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"SELECT * FROM scheduled_triggers WHERE id = {ph}",
                (trigger_id,),
            )
            trigger = self._cm.row_to_dict(cursor)
            if trigger is None:
                return None

            trigger['url_ids'] = self._fetch_url_ids(cursor, trigger_id)
            return trigger

    def get_all_enabled(self) -> list[dict]:
        """Return only enabled triggers, each with a ``url_ids`` list.

        Used by ``TriggerService.sync_all_jobs()`` on application startup
        to restore APScheduler jobs for active triggers.
        """
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM scheduled_triggers WHERE enabled = 1 ORDER BY name"
            )
            triggers = self._cm.rows_to_dicts(cursor)
            return self._attach_url_ids(cursor, triggers)

    def get_url_ids(self, trigger_id: int) -> list[int]:
        """Return the list of url_id integers associated with a trigger."""
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"SELECT url_id FROM trigger_urls WHERE trigger_id = {ph} ORDER BY url_id",
                (trigger_id,),
            )
            return [row[0] for row in cursor.fetchall()]

    # ------------------------------------------------------------------
    # Write operations
    # ------------------------------------------------------------------

    def create(
        self,
        name: str,
        schedule_type: str,
        schedule_value: str,
        strategy: str,
        url_ids: list[int],
    ) -> int | None:
        """Insert a new trigger with its URL associations.

        Returns the new trigger id, or ``None`` on duplicate name.
        """
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"INSERT INTO scheduled_triggers "
                    f"(name, schedule_type, schedule_value, strategy) "
                    f"VALUES ({ph}, {ph}, {ph}, {ph})"
                    f"{self._cm.returning_id()}",
                    (name, schedule_type, schedule_value, strategy),
                )
                trigger_id = self._cm.last_insert_id(cursor)
                self._sync_url_ids(cursor, trigger_id, url_ids)
                return trigger_id
        except Exception as exc:
            if self._cm.is_integrity_error(exc):
                return None
            raise DatabaseError(f"Failed to create trigger: {exc}") from exc

    def update(
        self,
        trigger_id: int,
        name: str,
        schedule_type: str,
        schedule_value: str,
        strategy: str,
        url_ids: list[int],
    ) -> bool:
        """Update an existing trigger and replace its URL associations.

        Returns ``True`` if the trigger was found and updated.
        """
        ph = self._cm.placeholder()
        now = datetime.utcnow().isoformat()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"UPDATE scheduled_triggers "
                    f"SET name = {ph}, schedule_type = {ph}, "
                    f"schedule_value = {ph}, strategy = {ph}, updated_at = {ph} "
                    f"WHERE id = {ph}",
                    (name, schedule_type, schedule_value, strategy, now, trigger_id),
                )
                if cursor.rowcount == 0:
                    return False
                self._sync_url_ids(cursor, trigger_id, url_ids)
                return True
        except Exception as exc:
            if self._cm.is_integrity_error(exc):
                return False
            raise DatabaseError(f"Failed to update trigger {trigger_id}: {exc}") from exc

    def delete(self, trigger_id: int) -> bool:
        """Delete a trigger and its URL associations.

        Returns ``True`` if the trigger existed and was removed.
        """
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"DELETE FROM trigger_urls WHERE trigger_id = {ph}",
                    (trigger_id,),
                )
                cursor.execute(
                    f"DELETE FROM scheduled_triggers WHERE id = {ph}",
                    (trigger_id,),
                )
                return cursor.rowcount > 0
        except Exception as exc:
            raise DatabaseError(f"Failed to delete trigger {trigger_id}: {exc}") from exc

    def set_enabled(self, trigger_id: int, enabled: bool) -> bool:
        """Toggle the enabled flag on a trigger.

        Returns ``True`` if the trigger was found and updated.
        """
        ph = self._cm.placeholder()
        now = datetime.utcnow().isoformat()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"UPDATE scheduled_triggers "
                    f"SET enabled = {ph}, updated_at = {ph} "
                    f"WHERE id = {ph}",
                    (1 if enabled else 0, now, trigger_id),
                )
                return cursor.rowcount > 0
        except Exception as exc:
            raise DatabaseError(
                f"Failed to toggle trigger {trigger_id}: {exc}"
            ) from exc

    def set_last_run(self, trigger_id: int, status: str) -> bool:
        """Record when a trigger last executed and its outcome.

        *status* should be ``'success'``, ``'partial'``, or ``'failed'``.
        Returns ``True`` if the trigger was found and updated.
        """
        ph = self._cm.placeholder()
        now = datetime.utcnow().isoformat()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"UPDATE scheduled_triggers "
                    f"SET last_run_at = {ph}, last_run_status = {ph} "
                    f"WHERE id = {ph}",
                    (now, status, trigger_id),
                )
                return cursor.rowcount > 0
        except Exception as exc:
            raise DatabaseError(
                f"Failed to update last run for trigger {trigger_id}: {exc}"
            ) from exc

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _attach_url_ids(self, cursor: Any, triggers: list[dict]) -> list[dict]:
        """Attach URL id lists to already-fetched trigger rows in one query."""
        if not triggers:
            return triggers
        trigger_ids = [trigger["id"] for trigger in triggers]
        url_ids_by_trigger = self._fetch_url_ids_for_triggers(cursor, trigger_ids)
        for trigger in triggers:
            trigger["url_ids"] = url_ids_by_trigger.get(trigger["id"], [])
        return triggers

    def _fetch_url_ids(self, cursor: Any, trigger_id: int) -> list[int]:
        """Return url_id list for a trigger using an existing cursor."""
        ph = self._cm.placeholder()
        cursor.execute(
            f"SELECT url_id FROM trigger_urls "
            f"WHERE trigger_id = {ph} ORDER BY url_id",
            (trigger_id,),
        )
        return [row[0] for row in cursor.fetchall()]

    def _fetch_url_ids_for_triggers(
        self, cursor: Any, trigger_ids: list[int],
    ) -> dict[int, list[int]]:
        """Return trigger_id -> url_ids for multiple triggers."""
        if not trigger_ids:
            return {}
        ph = self._cm.placeholder()
        placeholders = ", ".join([ph] * len(trigger_ids))
        cursor.execute(
            f"""
            SELECT trigger_id, url_id
            FROM trigger_urls
            WHERE trigger_id IN ({placeholders})
            ORDER BY trigger_id, url_id
            """,
            tuple(trigger_ids),
        )
        grouped: dict[int, list[int]] = {trigger_id: [] for trigger_id in trigger_ids}
        for trigger_id, url_id in cursor.fetchall():
            grouped.setdefault(trigger_id, []).append(url_id)
        return grouped

    def _sync_url_ids(
        self, cursor: Any, trigger_id: int, url_ids: list[int],
    ) -> None:
        """Replace all URL associations for a trigger (delete + re-insert).

        Uses a simple delete-all/insert-all strategy which is efficient
        for the small cardinality of trigger→URL relationships.
        """
        ph = self._cm.placeholder()
        cursor.execute(
            f"DELETE FROM trigger_urls WHERE trigger_id = {ph}",
            (trigger_id,),
        )
        for url_id in url_ids:
            cursor.execute(
                f"INSERT INTO trigger_urls (trigger_id, url_id) "
                f"VALUES ({ph}, {ph})",
                (trigger_id, url_id),
            )
