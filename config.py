"""Centralized configuration constants and environment variable access.

Single Responsibility: This module owns all application-wide configuration.
Other modules import from here instead of calling os.getenv() directly,
ensuring one source of truth for defaults and environment overrides.
"""

import os


# ---------------------------------------------------------------------------
# Environment variables
# ---------------------------------------------------------------------------

DATABASE_URL: str | None = os.getenv('DATABASE_URL')
"""PostgreSQL connection string (set by Railway). None falls back to SQLite."""

PORT: int = int(os.getenv('PORT', '5000'))
"""HTTP listen port. Railway sets this automatically; defaults to 5000 locally."""

PAGESPEED_API_KEY: str | None = os.getenv('PAGESPEED_API_KEY')
"""Optional Google PageSpeed Insights API key. None uses unauthenticated quota."""

# ---------------------------------------------------------------------------
# PageSpeed defaults
# ---------------------------------------------------------------------------

DEFAULT_STRATEGY: str = 'desktop'
"""Default Lighthouse strategy when none is specified."""

PAGESPEED_API_URL: str = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed'
"""Google PageSpeed Insights REST endpoint."""

PAGESPEED_TIMEOUT_SECONDS: int = 90
"""HTTP timeout for Google PageSpeed API requests (Google can be slow)."""

REQUEST_DELAY_SECONDS: int = 2
"""Delay between consecutive PageSpeed API calls to respect rate limits."""

# ---------------------------------------------------------------------------
# AI service defaults
# ---------------------------------------------------------------------------

MAX_AI_TOKENS: int = 4096
"""Maximum response tokens for both Claude and OpenAI completions."""

# ---------------------------------------------------------------------------
# Scheduler defaults
# ---------------------------------------------------------------------------

DAILY_TEST_HOUR: int = 2
"""UTC hour at which the daily scheduled PageSpeed test runs (via APScheduler).

.. deprecated::
    Retained for backward compatibility. New triggers use ``SCHEDULE_PRESETS``.
"""

TRIGGER_JOB_PREFIX: str = 'trigger_'
"""APScheduler job-id prefix for user-created triggers (e.g. ``trigger_7``)."""

SCHEDULE_PRESETS: dict[str, dict] = {
    'daily_2am': {
        'label': 'Daily at 2:00 AM UTC',
        'hour': 2,
        'minute': 0,
    },
    'daily_6am': {
        'label': 'Daily at 6:00 AM UTC',
        'hour': 6,
        'minute': 0,
    },
    'every_6h': {
        'label': 'Every 6 hours',
        'hour': '*/6',
        'minute': 0,
    },
    'every_12h': {
        'label': 'Every 12 hours',
        'hour': '*/12',
        'minute': 0,
    },
    'weekly_mon_2am': {
        'label': 'Weekly on Monday at 2:00 AM UTC',
        'day_of_week': 'mon',
        'hour': 2,
        'minute': 0,
    },
}
"""Preset cron schedules mapping preset key → APScheduler cron kwargs + label."""

# ---------------------------------------------------------------------------
# New Relic defaults
# ---------------------------------------------------------------------------

NEWRELIC_GRAPHQL_ENDPOINT: str = 'https://api.newrelic.com/graphql'
"""New Relic NerdGraph GraphQL API endpoint."""

NEWRELIC_TIMEOUT_SECONDS: int = 30
"""HTTP timeout for New Relic NerdGraph requests."""

DEFAULT_TIME_RANGE: str = '30 minutes ago'
"""Default NRQL SINCE clause for New Relic queries."""

# ---------------------------------------------------------------------------
# Azure defaults
# ---------------------------------------------------------------------------

AZURE_TOKEN_TIMEOUT_SECONDS: int = 15
"""HTTP timeout for Azure OAuth2 token acquisition."""

AZURE_QUERY_TIMEOUT_SECONDS: int = 30
"""HTTP timeout for Azure Log Analytics query execution."""

AZURE_LOG_ANALYTICS_SCOPE: str = 'https://api.loganalytics.io/.default'
"""OAuth2 scope for Azure Log Analytics REST API."""

AZURE_LOG_ANALYTICS_BASE_URL: str = 'https://api.loganalytics.io/v1/workspaces'
"""Base URL for Azure Log Analytics REST API."""

# ---------------------------------------------------------------------------
# Azure DevOps defaults
# ---------------------------------------------------------------------------

AZDO_API_VERSION: str = '7.1'
"""Azure DevOps REST API version for pipeline and build operations."""

AZDO_REQUEST_TIMEOUT_SECONDS: int = 15
"""HTTP timeout for Azure DevOps REST API requests."""

# ---------------------------------------------------------------------------
# BlazeMeter defaults
# ---------------------------------------------------------------------------

BLAZEMETER_API_KEY_ID: str | None = os.getenv('BLAZEMETER_API_KEY_ID')
"""BlazeMeter API key ID (server-side env var; never sent to the client)."""

BLAZEMETER_API_SECRET: str | None = os.getenv('BLAZEMETER_API_SECRET')
"""BlazeMeter API key secret (server-side env var; never sent to the client)."""

BLAZEMETER_WORKSPACE_ID: str | None = os.getenv('BLAZEMETER_WORKSPACE_ID')
"""BlazeMeter workspace ID used to scope test listings."""

BLAZEMETER_PROJECT_ID: str | None = os.getenv('BLAZEMETER_PROJECT_ID')
"""Optional BlazeMeter project ID used to further scope test listings."""

BLAZEMETER_BASE_URL: str = 'https://a.blazemeter.com/api/v4'
"""BlazeMeter REST API v4 base URL."""

BLAZEMETER_TIMEOUT_SECONDS: int = 30
"""HTTP timeout for BlazeMeter REST requests."""

BLAZEMETER_POLL_SECONDS: int = 20
"""Interval at which the queue manager polls the active BlazeMeter run."""
