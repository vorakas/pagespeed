"""In-memory sequential queue for BlazeMeter load tests.

Single Responsibility: owns the queue state machine (pending → running →
completed) and drives advancement.  Delegates all HTTP to
:class:`~services.blazemeter_client.BlazemeterClient`.

State is in-memory and resets on process restart.  Acceptable for a
single-process Railway service; revisit if we horizontally scale.
"""

from __future__ import annotations

import itertools
import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler

from config import BLAZEMETER_POLL_SECONDS
from services.blazemeter_client import BlazemeterClient

logger = logging.getLogger(__name__)

# BlazeMeter master string statuses that mean the run has finished.
# Note: BlazeMeter's /masters/{id} endpoint returns `status` as either a
# string ("ENDED") or a numeric code (e.g. 140 = ENDED, negative = aborted).
# The authoritative terminal signal is a non-null `ended` timestamp.
_TERMINAL_STATUSES: frozenset[str] = frozenset(
    {"ENDED", "FAILED", "CANCELLED", "ABORTED", "ENDED_TIMEOUT"}
)

# String statuses that mean the run completed unsuccessfully.
_FAILED_STATUSES: frozenset[str] = frozenset(
    {"FAILED", "CANCELLED", "ABORTED"}
)

# Numeric code for a successful ENDED on /masters/{id}.
_ENDED_CODE: int = 140


@dataclass
class QueueItem:
    """A single entry in the BlazeMeter queue.

    Attributes:
        item_id:    Local queue-item identifier (monotonic).
        test_id:    BlazeMeter test id to execute.
        test_name:  Display name (snapshot at enqueue time).
        status:     Queue-local status: ``pending``, ``running``, ``completed``,
                    ``failed``, ``cancelled``.
        master_id:  BlazeMeter master (run) id once started.
        enqueued_at: Unix epoch seconds.
        started_at:  Unix epoch seconds when the run kicked off.
        ended_at:    Unix epoch seconds when the run terminated.
        last_status: Last BlazeMeter master status observed.
        error:       Optional error message when ``status == 'failed'``.
    """

    item_id: int
    test_id: int
    test_name: str
    project_id: Optional[int] = None
    project_name: Optional[str] = None
    status: str = "pending"
    master_id: Optional[int] = None
    enqueued_at: float = field(default_factory=time.time)
    started_at: Optional[float] = None
    ended_at: Optional[float] = None
    last_status: Optional[str] = None
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "itemId": self.item_id,
            "testId": self.test_id,
            "testName": self.test_name,
            "projectId": self.project_id,
            "projectName": self.project_name,
            "status": self.status,
            "masterId": self.master_id,
            "enqueuedAt": self.enqueued_at,
            "startedAt": self.started_at,
            "endedAt": self.ended_at,
            "lastStatus": self.last_status,
            "error": self.error,
        }


class BlazemeterQueueService:
    """Sequential FIFO queue for BlazeMeter test runs.

    Only one item runs at a time.  When the active run reaches a
    terminal BlazeMeter status, the next pending item is started
    automatically on the next poll tick.

    Args:
        client:    BlazemeterClient used for all API calls.  Passed at
                   construction so the queue is testable and swappable.
        scheduler: APScheduler used to poll the active run.  Reuses the
                   existing app-level scheduler.
    """

    def __init__(
        self,
        client: BlazemeterClient,
        scheduler: BackgroundScheduler,
    ) -> None:
        self._client: BlazemeterClient = client
        self._scheduler: BackgroundScheduler = scheduler
        self._items: list[QueueItem] = []
        self._active: Optional[QueueItem] = None
        self._lock: threading.RLock = threading.RLock()
        self._id_seq = itertools.count(1)
        self._job_id: str = "blazemeter_queue_poll"
        self._scheduler.add_job(
            self._tick,
            "interval",
            seconds=BLAZEMETER_POLL_SECONDS,
            id=self._job_id,
            replace_existing=True,
            max_instances=1,
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def snapshot(self) -> dict:
        """Return a JSON-serialisable view of the queue."""
        with self._lock:
            return {
                "active": self._active.to_dict() if self._active else None,
                "pending": [i.to_dict() for i in self._items if i.status == "pending"],
                "history": [
                    i.to_dict()
                    for i in self._items
                    if i.status in ("completed", "failed", "cancelled")
                ][-20:],
                "pollSeconds": BLAZEMETER_POLL_SECONDS,
            }

    def enqueue(
        self,
        test_id: int,
        test_name: str,
        project_id: Optional[int] = None,
        project_name: Optional[str] = None,
    ) -> QueueItem:
        """Append a test to the queue."""
        with self._lock:
            item = QueueItem(
                item_id=next(self._id_seq),
                test_id=int(test_id),
                test_name=test_name,
                project_id=project_id,
                project_name=project_name,
            )
            self._items.append(item)
            logger.info(
                "BlazeMeter queue: enqueued item %s (testId=%s, project=%s, %s)",
                item.item_id, item.test_id, item.project_name or "—", item.test_name,
            )
        self._tick()  # try to start immediately if queue was idle
        return item

    def remove_pending(self, item_id: int) -> bool:
        """Remove a still-pending item from the queue."""
        with self._lock:
            for idx, item in enumerate(self._items):
                if item.item_id == item_id and item.status == "pending":
                    self._items.pop(idx)
                    return True
            return False

    def cancel_active(self) -> bool:
        """Terminate the currently-running master, if any."""
        with self._lock:
            active = self._active
        if not active or not active.master_id:
            return False
        try:
            self._client.stop_master(active.master_id)
        except Exception as exc:  # noqa: BLE001 — intentional broad catch
            logger.warning("Failed to stop master %s: %s", active.master_id, exc)
        with self._lock:
            active.status = "cancelled"
            active.ended_at = time.time()
            self._active = None
        return True

    def clear_pending(self) -> int:
        """Drop every pending item; returns how many were removed."""
        with self._lock:
            removed = [i for i in self._items if i.status == "pending"]
            self._items = [i for i in self._items if i.status != "pending"]
            return len(removed)

    # ------------------------------------------------------------------
    # Internal orchestration
    # ------------------------------------------------------------------

    def _tick(self) -> None:
        """Advance the state machine.

        * If nothing is active and something is pending → start it.
        * If something is active → poll its status and move on when terminal.
        """
        try:
            with self._lock:
                active = self._active
            if active is not None:
                self._poll_active(active)
            else:
                self._start_next_if_any()
        except Exception:  # noqa: BLE001
            logger.exception("BlazeMeter queue tick raised")

    def _start_next_if_any(self) -> None:
        with self._lock:
            next_item: Optional[QueueItem] = next(
                (i for i in self._items if i.status == "pending"), None,
            )
            if next_item is None:
                return
            next_item.status = "running"
            next_item.started_at = time.time()
            self._active = next_item

        try:
            master = self._client.start_test(next_item.test_id)
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to start BlazeMeter test %s", next_item.test_id)
            with self._lock:
                next_item.status = "failed"
                next_item.error = str(exc)
                next_item.ended_at = time.time()
                self._active = None
            return

        with self._lock:
            next_item.master_id = master.get("id")
            next_item.last_status = master.get("status")

    def _poll_active(self, item: QueueItem) -> None:
        if not item.master_id:
            return
        try:
            master = self._client.get_master(item.master_id)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Poll failed for master %s: %s", item.master_id, exc)
            return

        raw_status = master.get("status")
        ended_epoch = master.get("ended")
        status_str = str(raw_status).upper() if raw_status is not None else ""

        # A non-null `ended` epoch is the authoritative terminal signal.
        terminal_by_ended = bool(ended_epoch)
        terminal_by_status = status_str in _TERMINAL_STATUSES
        terminal_by_code = (
            isinstance(raw_status, int) and (raw_status == _ENDED_CODE or raw_status < 0)
        )
        is_terminal = terminal_by_ended or terminal_by_status or terminal_by_code

        logger.debug(
            "BlazeMeter poll master=%s raw_status=%r ended=%s terminal=%s",
            item.master_id, raw_status, ended_epoch, is_terminal,
        )

        with self._lock:
            item.last_status = status_str or (
                str(raw_status) if raw_status is not None else None
            )
            if is_terminal:
                failed = status_str in _FAILED_STATUSES or (
                    isinstance(raw_status, int) and raw_status < 0
                )
                item.status = "failed" if failed else "completed"
                if failed:
                    item.error = master.get("note") or item.last_status
                item.ended_at = time.time()
                self._active = None
