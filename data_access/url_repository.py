"""Repository for URL CRUD operations.

Encapsulates all SQL touching the ``urls`` table.  Cascade-deletes
through ``test_results`` are handled here so route handlers never
contain raw SQL.
"""

from data_access.connection import ConnectionManager
from exceptions import DatabaseError


class UrlRepository:
    """Data-access object for the ``urls`` table.

    Args:
        connection_manager: Shared connection manager injected at construction.
    """

    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm: ConnectionManager = connection_manager

    def get_by_site(self, site_id: int) -> list[dict]:
        """Return all URLs belonging to *site_id*, ordered by URL."""
        ph = self._cm._placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"SELECT * FROM urls WHERE site_id = {ph} ORDER BY url",
                (site_id,),
            )
            return self._cm._rows_to_dicts(cursor)

    def get_all_with_sites(self) -> list[dict]:
        """Return every URL joined with its parent site name."""
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                SELECT u.id, u.url, s.name AS site_name, s.id AS site_id
                FROM urls u
                JOIN sites s ON u.site_id = s.id
                ORDER BY s.name, u.url
            """)
            return self._cm._rows_to_dicts(cursor)

    def create(self, site_id: int, url: str) -> int | None:
        """Insert a new URL.  Returns the new id, or ``None`` on duplicate."""
        ph = self._cm._placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"INSERT INTO urls (site_id, url) VALUES ({ph}, {ph})"
                    f"{self._cm._returning_id()}",
                    (site_id, url),
                )
                return self._cm._last_insert_id(cursor)
        except Exception as exc:
            if self._cm._is_integrity_error(exc):
                return None
            raise DatabaseError(f"Failed to create URL: {exc}") from exc

    def delete(self, url_id: int) -> bool:
        """Delete a URL and cascade-delete its test_results and trigger_urls.

        Returns ``True`` if the URL existed and was removed.
        """
        ph = self._cm._placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"DELETE FROM trigger_urls WHERE url_id = {ph}", (url_id,)
                )
                cursor.execute(
                    f"DELETE FROM test_results WHERE url_id = {ph}", (url_id,)
                )
                cursor.execute(
                    f"DELETE FROM urls WHERE id = {ph}", (url_id,)
                )
                return cursor.rowcount > 0
        except Exception as exc:
            raise DatabaseError(f"Failed to delete URL {url_id}: {exc}") from exc
