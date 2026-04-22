"""Persistence for daily migration status snapshots.

Single Responsibility: store and retrieve ``SnapshotPayload`` rows.
The payload is kept as JSON so the on-disk shape is identical to the
API response shape — the frontend never has to reconstruct sub-lists.

Encapsulation note: the payload JSON is an internal representation
choice, not part of the public contract. Callers always receive and
pass ``SnapshotRecord`` objects.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any, List, Optional

from .connection import ConnectionManager


@dataclass(frozen=True)
class SnapshotRecord:
    """One stored daily snapshot."""

    date: str
    overall: Optional[str]
    headline: Optional[str]
    payload: dict
    source_path: Optional[str]
    ingested_at: Optional[str]

    def to_dict(self) -> dict:
        return {
            "date": self.date,
            "overall": self.overall,
            "headline": self.headline,
            "payload": self.payload,
            "sourcePath": self.source_path,
            "ingestedAt": self.ingested_at,
        }


class SnapshotRepository:
    """CRUD for ``migration_snapshots``."""

    def __init__(self, connection_manager: ConnectionManager) -> None:
        self._cm = connection_manager

    # ── Upsert ───────────────────────────────────────────────────────

    def upsert(self, record: SnapshotRecord) -> SnapshotRecord:
        """Insert or update one snapshot keyed by date."""
        payload_json = json.dumps(record.payload, ensure_ascii=False)
        ph = self._cm._placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            # Try update first
            cursor.execute(
                f"""
                UPDATE migration_snapshots
                SET overall = {ph},
                    headline = {ph},
                    payload = {ph},
                    source_path = {ph},
                    ingested_at = CURRENT_TIMESTAMP
                WHERE snapshot_date = {ph}
                """,
                (record.overall, record.headline, payload_json, record.source_path, record.date),
            )
            if cursor.rowcount == 0:
                cursor.execute(
                    f"""
                    INSERT INTO migration_snapshots
                        (snapshot_date, overall, headline, payload, source_path)
                    VALUES ({ph}, {ph}, {ph}, {ph}, {ph})
                    """,
                    (record.date, record.overall, record.headline, payload_json, record.source_path),
                )
        return record

    # ── Reads ────────────────────────────────────────────────────────

    def list_all(self) -> List[SnapshotRecord]:
        """All snapshots, oldest → newest (matches handoff ordering)."""
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT snapshot_date, overall, headline, payload,
                       source_path, ingested_at
                FROM migration_snapshots
                ORDER BY snapshot_date ASC
                """
            )
            rows = self._cm._rows_to_dicts(cursor)
        return [self._row_to_record(row) for row in rows]

    def latest(self) -> Optional[SnapshotRecord]:
        records = self.list_all()
        return records[-1] if records else None

    def previous(self) -> Optional[SnapshotRecord]:
        records = self.list_all()
        return records[-2] if len(records) >= 2 else None

    def get_by_date(self, date: str) -> Optional[SnapshotRecord]:
        ph = self._cm._placeholder()
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                f"""
                SELECT snapshot_date, overall, headline, payload,
                       source_path, ingested_at
                FROM migration_snapshots
                WHERE snapshot_date = {ph}
                """,
                (date,),
            )
            row = self._cm._row_to_dict(cursor)
        return self._row_to_record(row) if row else None

    # ── Private ──────────────────────────────────────────────────────

    def _row_to_record(self, row: dict) -> SnapshotRecord:
        payload_raw = row.get("payload")
        payload = (
            json.loads(payload_raw)
            if isinstance(payload_raw, str)
            else (payload_raw or {})
        )
        ingested_at = row.get("ingested_at")
        if isinstance(ingested_at, datetime):
            ingested_at = ingested_at.isoformat()
        snapshot_date = row.get("snapshot_date")
        if isinstance(snapshot_date, datetime):
            snapshot_date = snapshot_date.date().isoformat()
        elif hasattr(snapshot_date, "isoformat"):
            snapshot_date = snapshot_date.isoformat()
        return SnapshotRecord(
            date=str(snapshot_date),
            overall=row.get("overall"),
            headline=row.get("headline"),
            payload=payload,
            source_path=row.get("source_path"),
            ingested_at=ingested_at,
        )
