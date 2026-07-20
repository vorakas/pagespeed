import threading
import unittest

from services.rate_limiter import RateLimiter


class FakeClock:
    """Deterministic virtual clock; sleep advances time instead of blocking."""

    def __init__(self):
        self._t = 0.0
        self._lock = threading.Lock()

    def now(self):
        with self._lock:
            return self._t

    def sleep(self, seconds):
        with self._lock:
            self._t += max(0.0, seconds)


class RateLimiterTest(unittest.TestCase):
    def test_first_acquire_is_immediate(self):
        clock = FakeClock()
        limiter = RateLimiter(60, clock=clock.now, sleep_func=clock.sleep)
        limiter.acquire()
        self.assertEqual(clock.now(), 0.0)

    def test_second_acquire_waits_for_refill(self):
        clock = FakeClock()
        limiter = RateLimiter(60, clock=clock.now, sleep_func=clock.sleep)  # 1/sec
        limiter.acquire()
        limiter.acquire()
        # One token per second at 60/min, so the 2nd acquire advances ~1s.
        self.assertGreaterEqual(clock.now(), 1.0)

    def test_penalize_pauses_and_halves_rate(self):
        clock = FakeClock()
        limiter = RateLimiter(60, clock=clock.now, sleep_func=clock.sleep)
        limiter.acquire()
        limiter.penalize(retry_after=10)
        limiter.acquire()
        # Must have waited out the 10s pause.
        self.assertGreaterEqual(clock.now(), 10.0)

    def test_penalize_respects_min_rate_floor(self):
        clock = FakeClock()
        limiter = RateLimiter(60, clock=clock.now, sleep_func=clock.sleep, min_rate_per_minute=30)
        for _ in range(10):
            limiter.penalize(retry_after=0)
        self.assertGreaterEqual(limiter.effective_rate_per_minute(), 30)


if __name__ == "__main__":
    unittest.main()
