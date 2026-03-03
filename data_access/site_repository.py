"""Repository for site CRUD operations.

Encapsulates all SQL touching the ``sites`` table.  Cascade-deletes
through ``urls`` and ``test_results`` are handled here so route handlers
never contain raw SQL.
"""

from data_access.connection import ConnectionManager
from exceptions import DatabaseError


class SiteRepository:
    """Data-access object for the ``sites`` table.

    Args:
        connection_manager: Shared connection manager injected at construction.
    """

    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm: ConnectionManager = connection_manager

    def get_all(self) -> list[dict]:
        """Return every site ordered by name."""
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM sites ORDER BY name")
            return self._cm._rows_to_dicts(cursor)

    def get_by_id(self, site_id: int) -> dict | None:
        """Return a single site, or ``None`` if it does not exist."""
        ph = self._cm._placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT * FROM sites WHERE id = {ph}", (site_id,))
            return self._cm._row_to_dict(cursor)

    def create(self, name: str) -> int | None:
        """Insert a new site.  Returns the new id, or ``None`` on duplicate name."""
        ph = self._cm._placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"INSERT INTO sites (name) VALUES ({ph}){self._cm._returning_id()}",
                    (name,),
                )
                return self._cm._last_insert_id(cursor)
        except Exception as exc:
            if self._cm._is_integrity_error(exc):
                return None
            raise DatabaseError(f"Failed to create site: {exc}") from exc

    def update(self, site_id: int, name: str) -> bool:
        """Rename a site.  Returns ``True`` if the row was found and updated."""
        ph = self._cm._placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"UPDATE sites SET name = {ph} WHERE id = {ph}",
                    (name, site_id),
                )
                return cursor.rowcount > 0
        except Exception as exc:
            raise DatabaseError(f"Failed to update site {site_id}: {exc}") from exc

    def delete(self, site_id: int) -> bool:
        """Delete a site, cascading through its urls and test_results.

        Returns ``True`` if the site existed and was removed.
        """
        ph = self._cm._placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()

                # Collect child url ids
                cursor.execute(
                    f"SELECT id FROM urls WHERE site_id = {ph}", (site_id,)
                )
                url_ids = [row[0] for row in cursor.fetchall()]

                # Cascade: test_results -> urls -> site
                for url_id in url_ids:
                    cursor.execute(
                        f"DELETE FROM test_results WHERE url_id = {ph}", (url_id,)
                    )
                cursor.execute(
                    f"DELETE FROM urls WHERE site_id = {ph}", (site_id,)
                )
                cursor.execute(
                    f"DELETE FROM sites WHERE id = {ph}", (site_id,)
                )
                return cursor.rowcount > 0
        except Exception as exc:
            raise DatabaseError(f"Failed to delete site {site_id}: {exc}") from exc
