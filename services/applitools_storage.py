"""Storage facade for Applitools batch results uploaded by the helper.

Railway's egress cannot reach the Applitools Eyes API because it is not
on the corporate allowlist. QA runs a desktop helper from the corporate
network, the helper uploads normalized rows to Pharos, and the dashboard
reads them back while generating the regression spreadsheet.

Production storage is database-backed so uploads survive restarts,
redeploys, and future worker scaling. A small in-memory fallback remains
for tests and local construction where no repository is injected.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any

from data_access.applitools_batch_repository import ApplitoolsBatchRepository


_DEFAULT_TTL_SECONDS: int = 24 * 60 * 60


@dataclass(frozen=True)
class _StoredBatch:
    """Immutable record kept in the fallback cache, indexed by batch id."""

    tests: tuple[dict[str, Any], ...]
    fetched_at: str
    uploaded_at: float
    platform: str | None


class ApplitoolsBatchStore:
    """Storage service for helper-uploaded Applitools batches.

    Exposes only the operations the route needs. HTTP/auth/validation stay
    in the route layer; persistence details stay in the repository.
    """

    def __init__(
        self,
        repository: ApplitoolsBatchRepository | None = None,
        ttl_seconds: int = _DEFAULT_TTL_SECONDS,
    ) -> None:
        self._repository = repository
        self._ttl_seconds: int = max(1, ttl_seconds)
        self._lock: threading.Lock = threading.Lock()
        self._entries: dict[str, _StoredBatch] = {}

    def put(
        self,
        batch_id: str,
        tests: list[dict[str, Any]],
        fetched_at: str,
        platform: str | None = None,
    ) -> None:
        """Store the helper-fetched test rows for *batch_id*."""
        if self._repository is not None:
            self._repository.put(batch_id, tests, fetched_at, platform)
            return

        snapshot = tuple(dict(row) for row in tests)
        with self._lock:
            self._entries[batch_id] = _StoredBatch(
                tests=snapshot,
                fetched_at=fetched_at,
                uploaded_at=time.time(),
                platform=platform,
            )

    def get(self, batch_id: str) -> dict[str, Any] | None:
        """Return the stored payload for *batch_id*, or ``None`` if absent/expired."""
        if self._repository is not None:
            return self._repository.get(batch_id)

        now = time.time()
        with self._lock:
            self._evict_expired(now)
            entry = self._entries.get(batch_id)
            if entry is None:
                return None
            return {
                "batchId": batch_id,
                "fetchedAt": entry.fetched_at,
                "uploadedAt": entry.uploaded_at,
                "platform": entry.platform,
                "tests": [dict(row) for row in entry.tests],
            }

    def list_recent(self) -> list[dict[str, Any]]:
        """Return metadata for recent batches, newest first."""
        if self._repository is not None:
            return self._repository.list_recent()

        now = time.time()
        with self._lock:
            self._evict_expired(now)
            return sorted(
                (
                    {
                        "batchId": batch_id,
                        "fetchedAt": entry.fetched_at,
                        "uploadedAt": entry.uploaded_at,
                        "platform": entry.platform,
                        "testCount": len(entry.tests),
                    }
                    for batch_id, entry in self._entries.items()
                ),
                key=lambda r: r["uploadedAt"],
                reverse=True,
            )

    def _evict_expired(self, now: float) -> None:
        cutoff = now - self._ttl_seconds
        stale = [k for k, v in self._entries.items() if v.uploaded_at < cutoff]
        for key in stale:
            del self._entries[key]
