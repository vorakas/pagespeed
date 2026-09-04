"""Persistence for the Test Case Database."""

from __future__ import annotations

import json
from typing import Any

from data_access.connection import ConnectionManager


class TestCaseDatabaseRepository:
    """Store manual test case change records, links, and attachments."""

    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm = connection_manager

    def _normalize_change(self, row: dict) -> dict:
        tags = row.get("tags") or "[]"
        if isinstance(tags, str):
            try:
                row["tags"] = json.loads(tags)
            except json.JSONDecodeError:
                row["tags"] = []
        row["associated_bugs"] = []
        row["associated_tasks"] = []
        return row

    def _load_links(self, change_ids: list[int]) -> dict[int, dict[str, list[dict]]]:
        if not change_ids:
            return {}

        ph = self._cm.placeholder()
        placeholders = ", ".join([ph] * len(change_ids))
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT id, change_id, link_type, label, url
                FROM test_case_change_links
                WHERE change_id IN ({placeholders})
                ORDER BY id
                """,
                tuple(change_ids),
            )
            rows = self._cm.rows_to_dicts(cursor)

        grouped = {
            change_id: {"associated_bugs": [], "associated_tasks": []}
            for change_id in change_ids
        }
        for row in rows:
            key = "associated_bugs" if row["link_type"] == "bug" else "associated_tasks"
            grouped[row["change_id"]][key].append(
                {"id": row["id"], "label": row["label"], "url": row["url"]}
            )
        return grouped

    def _attach_links(self, changes: list[dict]) -> list[dict]:
        grouped = self._load_links([int(change["id"]) for change in changes])
        for change in changes:
            link_set = grouped.get(change["id"], {})
            change["associated_bugs"] = link_set.get("associated_bugs", [])
            change["associated_tasks"] = link_set.get("associated_tasks", [])
        return changes

    def _replace_links(self, cursor: Any, change_id: int, data: dict) -> None:
        ph = self._cm.placeholder()
        cursor.execute(
            f"DELETE FROM test_case_change_links WHERE change_id = {ph}",
            (change_id,),
        )

        for link in data.get("associated_bugs", []):
            cursor.execute(
                f"""
                INSERT INTO test_case_change_links (change_id, link_type, label, url)
                VALUES ({ph}, {ph}, {ph}, {ph})
                """,
                (change_id, "bug", link["label"], link["url"]),
            )

        for link in data.get("associated_tasks", []):
            cursor.execute(
                f"""
                INSERT INTO test_case_change_links (change_id, link_type, label, url)
                VALUES ({ph}, {ph}, {ph}, {ph})
                """,
                (change_id, "task", link["label"], link["url"]),
            )

    def create_change(self, data: dict) -> int:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                INSERT INTO test_case_changes (
                    test_case_id, title, test_case_url, change_summary,
                    before_state, after_state, changed_by, change_date, status, tags
                ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph}, {ph})
                {self._cm.returning_id()}
                """,
                (
                    data["test_case_id"],
                    data["title"],
                    data["test_case_url"],
                    data["change_summary"],
                    data["before_state"],
                    data["after_state"],
                    data["changed_by"],
                    data["change_date"],
                    data["status"],
                    json.dumps(data["tags"]),
                ),
            )
            change_id = self._cm.last_insert_id(cursor)
            self._replace_links(cursor, change_id, data)
            return change_id

    def get_change(self, change_id: int) -> dict | None:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"SELECT * FROM test_case_changes WHERE id = {ph}",
                (change_id,),
            )
            rows = self._cm.rows_to_dicts(cursor)
        if not rows:
            return None
        return self._attach_links([self._normalize_change(rows[0])])[0]

    def update_change(self, change_id: int, data: dict) -> bool:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE test_case_changes
                SET test_case_id = {ph},
                    title = {ph},
                    test_case_url = {ph},
                    change_summary = {ph},
                    before_state = {ph},
                    after_state = {ph},
                    changed_by = {ph},
                    change_date = {ph},
                    status = {ph},
                    tags = {ph},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = {ph}
                """,
                (
                    data["test_case_id"],
                    data["title"],
                    data["test_case_url"],
                    data["change_summary"],
                    data["before_state"],
                    data["after_state"],
                    data["changed_by"],
                    data["change_date"],
                    data["status"],
                    json.dumps(data["tags"]),
                    change_id,
                ),
            )
            updated = cursor.rowcount > 0
            if updated:
                self._replace_links(cursor, change_id, data)
            return updated

    def archive_change(self, change_id: int) -> bool:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                UPDATE test_case_changes
                SET status = 'Archived',
                    archived_at = CURRENT_TIMESTAMP,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = {ph} AND archived_at IS NULL
                """,
                (change_id,),
            )
            return cursor.rowcount > 0

    def search_changes(
        self,
        query: str = "",
        test_case_id: str | None = None,
        status: str | None = None,
        tag: str | None = None,
        include_archived: bool = False,
    ) -> list[dict]:
        ph = self._cm.placeholder()
        clauses: list[str] = []
        params: list[Any] = []

        if not include_archived:
            clauses.append("c.archived_at IS NULL")
        if query:
            pattern = f"%{query.lower()}%"
            clauses.append(
                f"""
                (
                    LOWER(c.test_case_id) LIKE {ph}
                    OR LOWER(c.title) LIKE {ph}
                    OR LOWER(c.test_case_url) LIKE {ph}
                    OR LOWER(c.change_summary) LIKE {ph}
                    OR LOWER(c.before_state) LIKE {ph}
                    OR LOWER(c.after_state) LIKE {ph}
                    OR LOWER(c.changed_by) LIKE {ph}
                    OR LOWER(c.tags) LIKE {ph}
                    OR EXISTS (
                        SELECT 1
                        FROM test_case_change_links l
                        WHERE l.change_id = c.id
                            AND (LOWER(l.label) LIKE {ph} OR LOWER(l.url) LIKE {ph})
                    )
                )
                """
            )
            params.extend([pattern] * 10)
        if test_case_id:
            clauses.append(f"LOWER(c.test_case_id) = {ph}")
            params.append(test_case_id.lower())
        if status:
            clauses.append(f"c.status = {ph}")
            params.append(status)
        if tag:
            clauses.append(f"LOWER(c.tags) LIKE {ph}")
            params.append(f"%{tag.lower()}%")

        sql = """
            SELECT c.*
            FROM test_case_changes c
        """
        if clauses:
            sql += " WHERE " + " AND ".join(clauses)
        sql += " ORDER BY c.change_date DESC, c.updated_at DESC, c.id DESC"

        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(sql, tuple(params))
            changes = [self._normalize_change(row) for row in self._cm.rows_to_dicts(cursor)]
        return self._attach_links(changes)

    def list_change_attachments(self, change_id: int) -> list[dict]:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT id, change_id, filename, mime_type, file_size, created_at
                FROM test_case_change_attachments
                WHERE change_id = {ph}
                ORDER BY created_at ASC, id ASC
                """,
                (change_id,),
            )
            return self._cm.rows_to_dicts(cursor)

    def get_change_attachment(self, change_id: int, attachment_id: int) -> dict | None:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT id, change_id, filename, mime_type, file_size, file_bytes, created_at
                FROM test_case_change_attachments
                WHERE change_id = {ph} AND id = {ph}
                """,
                (change_id, attachment_id),
            )
            rows = self._cm.rows_to_dicts(cursor)
        return rows[0] if rows else None

    def create_change_attachment(
        self,
        change_id: int,
        filename: str,
        mime_type: str,
        file_size: int,
        file_bytes: bytes,
    ) -> int:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                INSERT INTO test_case_change_attachments (
                    change_id, filename, mime_type, file_size, file_bytes
                ) VALUES ({ph}, {ph}, {ph}, {ph}, {ph})
                {self._cm.returning_id()}
                """,
                (change_id, filename, mime_type, file_size, file_bytes),
            )
            return self._cm.last_insert_id(cursor)

    def delete_change_attachment(self, change_id: int, attachment_id: int) -> bool:
        ph = self._cm.placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                DELETE FROM test_case_change_attachments
                WHERE change_id = {ph} AND id = {ph}
                """,
                (change_id, attachment_id),
            )
            return cursor.rowcount > 0
