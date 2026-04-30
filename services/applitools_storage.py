"""In-memory cache for Applitools batch results uploaded by the helper.

Railway's egress can't reach the Applitools Eyes API (corporate IP
allowlist), so the dashboard cannot call Applitools directly. Instead,
QA runs a small standalone helper on their own machine — which is on
the corporate network where Applitools *is* reachable — and the helper
POSTs its results to the dashboard. The browser then reads the results
back via :class:`ApplitoolsBatchStore` when generating the regression
spreadsheet.

The cache lives in process memory: batches are short-lived (uploaded,
read, exported in the same QA session, often within minutes) and small
(a few KB each), so durability across redeploys is not worth the
schema migration cost. Old entries are evicted by TTL on every read,
keeping the dictionary bounded without needing a separate sweep job.

This class follows the Single-Responsibility Principle: storage only —
no HTTP, no auth, no validation. The route layer is responsible for
those concerns.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass
from typing import Any


# Batches stay queryable for 24h after upload — long enough to cover
# any plausible "fetch helper output, then click +Sheet" workflow,
# short enough that stale data doesn't quietly pollute later exports.
_DEFAULT_TTL_SECONDS: int = 24 * 60 * 60


@dataclass(frozen=True)
class _StoredBatch:
    """Immutable record kept in the cache, indexed by batch id."""

    tests: tuple[dict[str, Any], ...]
    fetched_at: str
    uploaded_at: float


class ApplitoolsBatchStore:
    """Thread-safe in-memory cache of helper-uploaded Applitools batches.

    Exposes only ``put`` and ``get`` — each cache entry is a frozen
    snapshot, so callers cannot accidentally mutate stored data through
    the returned dict.

    Args:
        ttl_seconds: How long an entry remains queryable after upload.
                     Falls back to a sensible default of 24h.
    """

    def __init__(self, ttl_seconds: int = _DEFAULT_TTL_SECONDS) -> None:
        self._ttl_seconds: int = max(1, ttl_seconds)
        self._lock: threading.Lock = threading.Lock()
        self._entries: dict[str, _StoredBatch] = {}

    def put(
        self,
        batch_id: str,
        tests: list[dict[str, Any]],
        fetched_at: str,
    ) -> None:
        """Store the helper-fetched test rows for *batch_id*.

        Re-uploading the same batch id replaces the previous entry —
        QA may re-run the helper if a batch was incomplete.
        """
        # Defensive copy so callers can mutate their own list afterwards
        # without affecting what we cached. Tuple of read-through dicts
        # gives us an immutable spine while keeping JSON-serialization
        # cheap on the read path.
        snapshot = tuple(dict(row) for row in tests)
        with self._lock:
            self._entries[batch_id] = _StoredBatch(
                tests=snapshot,
                fetched_at=fetched_at,
                uploaded_at=time.time(),
            )

    def get(self, batch_id: str) -> dict[str, Any] | None:
        """Return the cached payload for *batch_id*, or ``None`` if absent/expired."""
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
                "tests": [dict(row) for row in entry.tests],
            }

    def _evict_expired(self, now: float) -> None:
        cutoff = now - self._ttl_seconds
        stale = [k for k, v in self._entries.items() if v.uploaded_at < cutoff]
        for key in stale:
            del self._entries[key]
