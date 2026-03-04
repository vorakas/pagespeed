"""Domain enums replacing magic strings and numbers.

Each enum inherits from str so values serialize naturally to JSON and
can be used anywhere a plain string was previously expected (e.g. in
SQL parameters or API payloads) without explicit .value access.
"""

from enum import Enum


class Strategy(str, Enum):
    """Lighthouse testing strategy (device type)."""

    DESKTOP = 'desktop'
    MOBILE = 'mobile'


class PerformanceStatus(str, Enum):
    """Traffic-light health status for APM / infrastructure metrics.

    Thresholds (response time):
        GOOD     — < 500 ms
        WARNING  — 500–2000 ms
        CRITICAL — > 2000 ms
    """

    GOOD = 'good'
    WARNING = 'warning'
    CRITICAL = 'critical'

    @staticmethod
    def from_response_time(milliseconds: float) -> 'PerformanceStatus':
        """Derive status from an average response time in milliseconds.

        Args:
            milliseconds: Average response time to classify.

        Returns:
            The corresponding PerformanceStatus value.
        """
        if milliseconds < 500:
            return PerformanceStatus.GOOD
        if milliseconds < 2000:
            return PerformanceStatus.WARNING
        return PerformanceStatus.CRITICAL


class ScoreRating(str, Enum):
    """Lighthouse score rating band.

    Thresholds (0–100 score):
        GOOD    — >= 90
        AVERAGE — >= 50
        POOR    — < 50
    """

    GOOD = 'good'
    AVERAGE = 'average'
    POOR = 'poor'

    @staticmethod
    def from_score(score: float) -> 'ScoreRating':
        """Map a Lighthouse 0–100 score to its rating band.

        Args:
            score: Lighthouse score (0–100).

        Returns:
            The corresponding ScoreRating value.
        """
        if score >= 90:
            return ScoreRating.GOOD
        if score >= 50:
            return ScoreRating.AVERAGE
        return ScoreRating.POOR


class SchedulePreset(str, Enum):
    """Named schedule presets for test triggers.

    Each value maps to a key in ``config.SCHEDULE_PRESETS`` which holds
    the corresponding APScheduler cron keyword arguments.
    """

    DAILY_2AM = 'daily_2am'
    DAILY_6AM = 'daily_6am'
    EVERY_6H = 'every_6h'
    EVERY_12H = 'every_12h'
    WEEKLY_MON_2AM = 'weekly_mon_2am'


class TriggerStrategy(str, Enum):
    """Lighthouse strategy option for a scheduled test trigger.

    Extends the base ``Strategy`` enum with a ``BOTH`` option that runs
    the test twice — once for desktop and once for mobile.
    """

    DESKTOP = 'desktop'
    MOBILE = 'mobile'
    BOTH = 'both'
