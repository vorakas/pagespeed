"""Thread-safe token-bucket rate limiter with adaptive slow-down on throttling."""

from __future__ import annotations

import threading
import time
from typing import Callable


class RateLimiter:
    """Token bucket shared across worker threads.

    Refills ``rate_per_minute`` tokens evenly over a minute. ``acquire`` blocks
    (via the injected sleep) until a token is available. ``penalize`` — called on
    HTTP 429 — halves the effective rate down to ``min_rate_per_minute`` and pauses
    all callers for ``retry_after`` seconds. ``recover`` nudges the rate back up.
    """

    def __init__(
        self,
        rate_per_minute: float,
        clock: Callable[[], float] = time.monotonic,
        sleep_func: Callable[[float], None] = time.sleep,
        min_rate_per_minute: float = 6.0,
    ) -> None:
        self._base_rate = max(1.0, float(rate_per_minute))
        self._rate = self._base_rate
        self._min_rate = min(float(min_rate_per_minute), self._base_rate)
        self._clock = clock
        self._sleep = sleep_func
        self._lock = threading.Lock()
        self._tokens = 1.0
        self._last_refill = clock()
        self._paused_until = 0.0

    def _refill(self, now: float) -> None:
        elapsed = now - self._last_refill
        if elapsed > 0:
            self._tokens = min(self._rate, self._tokens + elapsed * (self._rate / 60.0))
            self._last_refill = now

    def acquire(self) -> None:
        while True:
            with self._lock:
                now = self._clock()
                if now < self._paused_until:
                    wait = self._paused_until - now
                else:
                    self._refill(now)
                    if self._tokens >= 1.0:
                        self._tokens -= 1.0
                        return
                    wait = (1.0 - self._tokens) / (self._rate / 60.0)
            self._sleep(max(wait, 0.001))

    def penalize(self, retry_after: float = 30.0) -> None:
        with self._lock:
            self._rate = max(self._min_rate, self._rate / 2.0)
            now = self._clock()
            self._paused_until = max(self._paused_until, now + max(1.0, float(retry_after)))
            self._tokens = 0.0

    def recover(self) -> None:
        with self._lock:
            self._rate = min(self._base_rate, self._rate * 1.5)

    def effective_rate_per_minute(self) -> float:
        with self._lock:
            return self._rate
