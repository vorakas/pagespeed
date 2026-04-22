"""Orchestrate daily status-snapshot ingestion and diffing.

Single Responsibility: bridge the markdown parser and the repository,
expose diff helpers for the History page and "What Changed Today"
panel. This mirrors the ``diffSnapshots`` implementation in
``handoff/design/snapshots.js``.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from data_access import SnapshotRecord, SnapshotRepository
from services.obsidian_sync.status_parser import parse_status_file
from services.obsidian_sync.vault_reader import VaultReader


logger = logging.getLogger(__name__)


class SnapshotService:
    """High-level API over stored migration snapshots."""

    def __init__(
        self,
        repository: SnapshotRepository,
        vault_reader: VaultReader,
    ) -> None:
        self._repo = repository
        self._vault = vault_reader

    # ── Ingestion ────────────────────────────────────────────────────

    def ingest_vault(self) -> List[str]:
        """Re-ingest every ``status-*.md`` file on disk.

        Returns the list of snapshot dates that were upserted.
        Covers both ``wiki/`` (current) and ``wiki/archive/`` (history).
        """
        paths = self._collect_status_files()
        ingested: List[str] = []
        for path in paths:
            record = self._ingest_path(path)
            if record is not None:
                ingested.append(record.date)
        return ingested

    def ingest_path(self, path: Path) -> Optional[SnapshotRecord]:
        """Public wrapper for single-file ingestion (used by CLI)."""
        return self._ingest_path(path)

    def _ingest_path(self, path: Path) -> Optional[SnapshotRecord]:
        try:
            payload_obj = parse_status_file(path)
        except OSError as exc:
            logger.warning("Cannot read status file %s: %s", path, exc)
            return None

        if not payload_obj.date:
            logger.warning("Skipping %s — no date could be resolved", path)
            return None

        rel_path: Optional[str] = None
        try:
            rel_path = path.relative_to(self._vault.root).as_posix()
        except ValueError:
            rel_path = str(path)

        record = SnapshotRecord(
            date=payload_obj.date,
            overall=payload_obj.overall,
            headline=payload_obj.headline,
            payload=payload_obj.to_dict(),
            source_path=rel_path,
            ingested_at=None,
        )
        return self._repo.upsert(record)

    def _collect_status_files(self) -> List[Path]:
        out: List[Path] = []
        wiki = self._vault.root / "wiki"
        if wiki.is_dir():
            out.extend(sorted(wiki.glob("status-*.md")))
        archive = wiki / "archive"
        if archive.is_dir():
            out.extend(sorted(archive.glob("status-*.md")))
        return out

    # ── Reads ────────────────────────────────────────────────────────

    def list_snapshots(self) -> List[dict]:
        return [_payload_with_meta(r) for r in self._repo.list_all()]

    def latest(self) -> Optional[dict]:
        record = self._repo.latest()
        return _payload_with_meta(record) if record else None

    def previous(self) -> Optional[dict]:
        record = self._repo.previous()
        return _payload_with_meta(record) if record else None

    def get(self, date: str) -> Optional[dict]:
        record = self._repo.get_by_date(date)
        return _payload_with_meta(record) if record else None

    def diff_latest(self) -> Optional[dict]:
        records = self._repo.list_all()
        if len(records) < 2:
            return None
        return diff_snapshots(records[-2].payload, records[-1].payload)

    def diff_series(self) -> List[dict]:
        """Compute diff objects for every consecutive pair, newest first."""
        records = self._repo.list_all()
        out: List[dict] = []
        for i in range(len(records) - 1, 0, -1):
            prev = records[i - 1].payload
            curr = records[i].payload
            diff = diff_snapshots(prev, curr)
            out.append(
                {
                    "from": prev.get("date"),
                    "to": curr.get("date"),
                    "currentPayload": curr,
                    "previousPayload": prev,
                    "diff": diff,
                }
            )
        return out


# ── diff — mirrors handoff/design/snapshots.js:diffSnapshots ──────────


def diff_snapshots(prev: dict, curr: dict) -> dict:
    """Return a structured change report between two snapshot payloads.

    Mirrors the semantics of ``window.diffSnapshots`` from the design
    fixture so the frontend can render "What Changed Today" with the
    same shape it does against the in-memory mock.
    """
    out: Dict[str, Any] = {
        "from": prev.get("date"),
        "to": curr.get("date"),
        "kpis": {},
        "sources": [],
        "areaStatuses": [],
        "criticalBugs": {"added": [], "removed": []},
        "prodFailures": {"added": [], "removed": [], "reassigned": [], "regressed": []},
        "openBlockers": {"added": [], "removed": []},
        "newItems": {"added": [], "removed": []},
    }

    prev_kpis = prev.get("kpis") or {}
    curr_kpis = curr.get("kpis") or {}
    for key, curr_val in curr_kpis.items():
        prev_val = prev_kpis.get(key)
        if isinstance(prev_val, (int, float)) and isinstance(curr_val, (int, float)):
            out["kpis"][key] = {
                "prev": prev_val,
                "curr": curr_val,
                "delta": curr_val - prev_val,
            }
        else:
            out["kpis"][key] = {"prev": prev_val, "curr": curr_val, "delta": None}

    prev_sources = {s.get("key"): s for s in (prev.get("sourceCoverage") or [])}
    for src in curr.get("sourceCoverage") or []:
        p = prev_sources.get(src.get("key"))
        out["sources"].append(
            {
                "key": src.get("key"),
                "total": _field_delta(p, src, "total"),
                "resolved": _field_delta(p, src, "resolved"),
                "active": _field_delta(p, src, "active"),
            }
        )

    prev_areas = prev.get("areaStatuses") or {}
    for ws, curr_status in (curr.get("areaStatuses") or {}).items():
        prev_status = prev_areas.get(ws)
        if prev_status and curr_status and prev_status != curr_status:
            out["areaStatuses"].append(
                {"ws": ws, "from": prev_status, "to": curr_status}
            )

    _set_diff(out["criticalBugs"], prev.get("criticalBugs"), curr.get("criticalBugs"))
    _set_diff(out["openBlockers"], prev.get("openBlockers"), curr.get("openBlockers"))
    _set_diff(out["newItems"], prev.get("newItems"), curr.get("newItems"))

    prev_pf = {p.get("id"): p for p in (prev.get("prodFailures") or [])}
    curr_pf = {p.get("id"): p for p in (curr.get("prodFailures") or [])}
    for pid, p in curr_pf.items():
        if pid not in prev_pf:
            out["prodFailures"]["added"].append(p)
            continue
        prior = prev_pf[pid]
        if p.get("tag") == "reassigned" or (
            prior.get("who") and p.get("who") and prior.get("who") != p.get("who")
        ):
            out["prodFailures"]["reassigned"].append({**p, "from": prior.get("who")})
        if p.get("regression"):
            out["prodFailures"]["regressed"].append(p)
    for pid, p in prev_pf.items():
        if pid not in curr_pf:
            out["prodFailures"]["removed"].append(p)

    return out


def _field_delta(prev: Optional[dict], curr: dict, key: str) -> dict:
    p = (prev or {}).get(key)
    c = curr.get(key)
    if isinstance(p, (int, float)) and isinstance(c, (int, float)):
        return {"prev": p, "curr": c, "delta": c - p}
    return {"prev": p, "curr": c, "delta": None}


def _set_diff(bucket: Dict[str, list], prev_list, curr_list) -> None:
    prev_by_id = {(i.get("id") if isinstance(i, dict) else None): i for i in (prev_list or [])}
    curr_by_id = {(i.get("id") if isinstance(i, dict) else None): i for i in (curr_list or [])}
    for iid, item in curr_by_id.items():
        if iid not in prev_by_id:
            bucket["added"].append(item)
    for iid, item in prev_by_id.items():
        if iid not in curr_by_id:
            bucket["removed"].append(item)


def _payload_with_meta(record: SnapshotRecord) -> dict:
    """Return the stored payload with metadata fields present."""
    payload = dict(record.payload or {})
    payload.setdefault("date", record.date)
    payload.setdefault("overall", record.overall)
    payload.setdefault("headline", record.headline)
    payload["sourcePath"] = record.source_path
    payload["ingestedAt"] = record.ingested_at
    return payload
