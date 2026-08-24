"""Repository for Knowledge Ledger domains and entries."""

from typing import Any

from data_access.connection import ConnectionManager
from exceptions import DatabaseError


class KnowledgeRepository:
    """Data-access object for Knowledge Ledger tables."""

    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm: ConnectionManager = connection_manager

    def list_domains(self, include_archived: bool = False) -> list[dict]:
        """Return knowledge domains ordered by name."""
        sql = "SELECT * FROM knowledge_domains"
        params: list[Any] = []
        if not include_archived:
            sql += " WHERE archived_at IS NULL"
        sql += " ORDER BY name"

        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return self._cm.rows_to_dicts(cursor)

    def get_domain(self, domain_id: int) -> dict | None:
        """Return a domain by id."""
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(f"SELECT * FROM knowledge_domains WHERE id = {ph}", (domain_id,))
            rows = self._cm.rows_to_dicts(cursor)
            return rows[0] if rows else None

    def create_domain(self, name: str, description: str = "") -> int | None:
        """Create a domain. Returns ``None`` when the name already exists."""
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    INSERT INTO knowledge_domains (name, description)
                    VALUES ({ph}, {ph}){self._cm.returning_id()}
                    """,
                    (name, description),
                )
                return self._cm.last_insert_id(cursor)
        except Exception as exc:
            if self._cm.is_integrity_error(exc):
                return None
            raise DatabaseError(f"Failed to create knowledge domain: {exc}") from exc

    def update_domain(self, domain_id: int, name: str, description: str) -> bool:
        """Update a domain name and description."""
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute(
                    f"""
                    UPDATE knowledge_domains
                    SET name = {ph}, description = {ph}, updated_at = CURRENT_TIMESTAMP
                    WHERE id = {ph}
                    """,
                    (name, description, domain_id),
                )
                return cursor.rowcount > 0
        except Exception as exc:
            if self._cm.is_integrity_error(exc):
                return False
            raise DatabaseError(f"Failed to update knowledge domain: {exc}") from exc

    def archive_domain(self, domain_id: int) -> bool:
        """Mark a domain archived."""
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE knowledge_domains
                SET archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                WHERE id = {ph}
                """,
                (domain_id,),
            )
            return cursor.rowcount > 0

    def get_entry(self, entry_id: int) -> dict | None:
        """Return an entry by id."""
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT e.*, d.name AS domain_name
                FROM knowledge_entries e
                JOIN knowledge_domains d ON d.id = e.domain_id
                WHERE e.id = {ph}
                """,
                (entry_id,),
            )
            rows = self._cm.rows_to_dicts(cursor)
            return rows[0] if rows else None

    def create_entry(self, data: dict) -> int:
        """Create a knowledge entry."""
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                INSERT INTO knowledge_entries (
                    domain_id, entry_type, status, title, details, source, tags
                )
                VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}){self._cm.returning_id()}
                """,
                (
                    data["domain_id"],
                    data["entry_type"],
                    data.get("status", "Active"),
                    data["title"],
                    data["details"],
                    data.get("source", ""),
                    data.get("tags", ""),
                ),
            )
            return self._cm.last_insert_id(cursor)

    def update_entry(self, entry_id: int, data: dict) -> bool:
        """Update a knowledge entry."""
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE knowledge_entries
                SET domain_id = {ph},
                    entry_type = {ph},
                    status = {ph},
                    title = {ph},
                    details = {ph},
                    source = {ph},
                    tags = {ph},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = {ph}
                """,
                (
                    data["domain_id"],
                    data["entry_type"],
                    data.get("status", "Active"),
                    data["title"],
                    data["details"],
                    data.get("source", ""),
                    data.get("tags", ""),
                    entry_id,
                ),
            )
            return cursor.rowcount > 0

    def archive_entry(self, entry_id: int) -> bool:
        """Mark an entry archived."""
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE knowledge_entries
                SET status = 'Archived', updated_at = CURRENT_TIMESTAMP
                WHERE id = {ph}
                """,
                (entry_id,),
            )
            return cursor.rowcount > 0

    def search_entries(
        self,
        query: str = "",
        domain_id: int | None = None,
        entry_type: str | None = None,
        status: str | None = None,
        tag: str | None = None,
        include_archived: bool = False,
    ) -> list[dict]:
        """Search knowledge entries with optional filters."""
        ph = self._cm.placeholder()
        sql = """
            SELECT e.*, d.name AS domain_name
            FROM knowledge_entries e
            JOIN knowledge_domains d ON d.id = e.domain_id
        """
        clauses: list[str] = []
        params: list[Any] = []

        if not include_archived:
            clauses.append("e.status <> 'Archived'")
            clauses.append("d.archived_at IS NULL")
        if query:
            pattern = f"%{query}%"
            clauses.append(
                f"(e.title LIKE {ph} OR e.details LIKE {ph} OR e.source LIKE {ph} OR e.tags LIKE {ph})"
            )
            params.extend([pattern, pattern, pattern, pattern])
        if domain_id is not None:
            clauses.append(f"e.domain_id = {ph}")
            params.append(domain_id)
        if entry_type:
            clauses.append(f"e.entry_type = {ph}")
            params.append(entry_type)
        if status:
            clauses.append(f"e.status = {ph}")
            params.append(status)
        if tag:
            clauses.append(f"e.tags LIKE {ph}")
            params.append(f"%{tag}%")

        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY e.updated_at DESC, e.id DESC"

        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, params)
            return self._cm.rows_to_dicts(cursor)
