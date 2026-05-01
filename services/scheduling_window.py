"""Active-hours window for gating periodic background jobs.

Encapsulation principle: the question "is it OK to do real work right
now?" is one cohesive concern (timezone resolution, hour comparison,
bounds validation), so it lives behind a single class instead of
being inlined into every scheduler tick.

Used by ``app.py`` to short-circuit the vault auto-refresh and
Jira/Asana sync ticks outside the user's working hours — overnight
syncs would just hammer upstream APIs while no human is around to
consume the orchestrator output, so they're skipped at the top of
the tick.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo


class ActiveHoursWindow:
    """A read-only [start_hour, end_hour] window in a fixed timezone.

    Hours are inclusive on both ends, indexed 0-23. With ``start=8`` and
    ``end=22`` the window spans 08:00–22:59 local time; everything
    outside (23:00–07:59) is closed.

    The class is intentionally tiny — just enough behavior to answer
    ``is_open()`` and to describe itself in logs. If we ever need
    day-of-week or holiday gating, it grows here rather than spreading
    through every caller.
    """

    def __init__(self, *, start_hour: int, end_hour: int, timezone: str) -> None:
        if not 0 <= start_hour <= 23:
            raise ValueError(
                f"start_hour must be in [0, 23], got {start_hour!r}"
            )
        if not 0 <= end_hour <= 23:
            raise ValueError(f"end_hour must be in [0, 23], got {end_hour!r}")
        if start_hour > end_hour:
            raise ValueError(
                f"start_hour ({start_hour}) must be <= end_hour ({end_hour}); "
                "overnight windows are not supported."
            )
        self._start_hour: int = start_hour
        self._end_hour: int = end_hour
        self._timezone_label: str = timezone
        self._tz: ZoneInfo = ZoneInfo(timezone)  # raises if unknown — fail-fast

    @property
    def start_hour(self) -> int:
        return self._start_hour

    @property
    def end_hour(self) -> int:
        return self._end_hour

    @property
    def timezone_label(self) -> str:
        return self._timezone_label

    def is_open(self, now: Optional[datetime] = None) -> bool:
        """Return True when the local hour is within the active window.

        Pass ``now`` to test against a specific instant; defaults to the
        current wall-clock time. Naive datetimes are interpreted in this
        window's timezone; aware datetimes are converted into it.
        """
        if now is None:
            local_now = datetime.now(self._tz)
        elif now.tzinfo is None:
            local_now = now.replace(tzinfo=self._tz)
        else:
            local_now = now.astimezone(self._tz)
        return self._start_hour <= local_now.hour <= self._end_hour

    def describe(self) -> str:
        """Human-readable summary, suitable for a log line at startup."""
        return (
            f"{self._start_hour:02d}:00–{self._end_hour:02d}:59 "
            f"{self._timezone_label}"
        )
