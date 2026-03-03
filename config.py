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
"""UTC hour at which the daily scheduled PageSpeed test runs (via APScheduler)."""

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
