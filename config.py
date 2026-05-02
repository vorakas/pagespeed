"""Centralized configuration constants and environment variable access.

Single Responsibility: This module owns all application-wide configuration.
Other modules import from here instead of calling os.getenv() directly,
ensuring one source of truth for defaults and environment overrides.
"""

import json
import logging
import os


# ---------------------------------------------------------------------------
# Environment variables
# ---------------------------------------------------------------------------

DATABASE_URL: str | None = os.getenv('DATABASE_URL')
"""PostgreSQL connection string (set by Railway). None falls back to SQLite."""

DB_POOL_MIN_CONNECTIONS: int = int(os.getenv('DB_POOL_MIN_CONNECTIONS', '1'))
"""Minimum PostgreSQL connections kept open per app process."""

DB_POOL_MAX_CONNECTIONS: int = int(os.getenv('DB_POOL_MAX_CONNECTIONS', '10'))
"""Maximum PostgreSQL connections opened per app process."""

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

DEVOPS_PAT: str | None = os.getenv('DEVOPS_PAT')
"""Azure DevOps Personal Access Token (server-side env var; never sent to the client).

When set, the Automation Builds page skips its config panel and uses this
PAT for all users. When unset, falls back to per-user localStorage so
local dev still works without setting an env var."""

DEVOPS_ORGANIZATION: str = os.getenv('DEVOPS_ORGANIZATION', 'LampsPlus')
"""Azure DevOps organization slug. Defaults to ``LampsPlus``."""

DEVOPS_PROJECT: str = os.getenv('DEVOPS_PROJECT', 'TestAutomation')
"""Azure DevOps project name. Defaults to ``TestAutomation``."""


def _parse_int_env(name: str) -> int | None:
    raw = os.getenv(name)
    if not raw:
        return None
    try:
        return int(raw)
    except ValueError:
        logging.warning('%s must be an integer; ignoring %r', name, raw)
        return None


DEVOPS_ORCHESTRATOR_PIPELINE_ID: int | None = _parse_int_env('DEVOPS_ORCHESTRATOR_PIPELINE_ID')
"""Optional pipeline definition id for the Run-All orchestrator. Pre-fills
the Builds page so users don't need to set it in localStorage."""


def _parse_pipeline_map(raw: str | None) -> dict[str, int]:
    """Parse ``DEVOPS_PIPELINE_MAP`` — JSON of ``{role_key: definition_id}``.

    Empty/missing/invalid yields an empty map, in which case the frontend
    falls back to its hardcoded defaults."""
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logging.warning('DEVOPS_PIPELINE_MAP is not valid JSON; ignoring')
        return {}
    if not isinstance(data, dict):
        logging.warning('DEVOPS_PIPELINE_MAP must be a JSON object; got %s', type(data))
        return {}
    out: dict[str, int] = {}
    for k, v in data.items():
        try:
            out[str(k)] = int(v)
        except (TypeError, ValueError):
            logging.warning('DEVOPS_PIPELINE_MAP[%s] must be an integer; skipping', k)
    return out


DEVOPS_PIPELINE_MAP: dict[str, int] = _parse_pipeline_map(os.getenv('DEVOPS_PIPELINE_MAP'))
"""Map of role key (e.g. ``Windows_Functional``) → pipeline definition id."""

# ---------------------------------------------------------------------------
# Applitools helper-upload token
# ---------------------------------------------------------------------------

APPLITOOLS_HELPER_TOKEN: str | None = os.getenv('APPLITOOLS_HELPER_TOKEN')
"""Shared secret the desktop helper sends in ``X-Pharos-Helper-Token``.

The helper runs on a QA machine (where the corporate firewall actually
permits Applitools API calls) and POSTs fetched batch rows to
``/api/applitools/upload-batch``. Without this env var, uploads are
disabled and the endpoint returns 503 — failing closed so a misconfigured
production deploy never silently accepts unauthenticated writes."""

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

# ---------------------------------------------------------------------------
# Obsidian Bridge (Jira + Asana → vault) defaults
# ---------------------------------------------------------------------------

OBSIDIAN_VAULT_ROOT: str = os.getenv(
    'OBSIDIAN_VAULT_ROOT',
    '/data/vault',
)
"""Absolute path to the Obsidian vault root on disk.

Defaults to ``/data/vault`` which matches the Railway volume mount. Locally
you can point this at the Desktop LPAdobe copy for dev."""

JIRA_BASE_URL: str = os.getenv('JIRA_BASE_URL', 'https://lampstrack.lampsplus.com')
"""Jira Data Center base URL used for the Obsidian sync."""

JIRA_PAT: str | None = os.getenv('JIRA_PAT')
"""Jira personal access token. None disables the Jira side of the sync."""

ASANA_PAT: str | None = os.getenv('ASANA_PAT')
"""Asana personal access token. None disables the Asana side of the sync."""

VAULT_REPO_URL: str | None = os.getenv('VAULT_REPO_URL')
"""HTTPS clone URL of the GitHub-hosted vault (``lpadobe-vault``).

When set alongside ``VAULT_BOT_TOKEN``, the Obsidian bridge commits and
pushes every completed sync to this repo. When unset, the bridge falls
back to the Docker-image seed and leaves the vault volume-local."""

VAULT_BOT_TOKEN: str | None = os.getenv('VAULT_BOT_TOKEN')
"""Fine-grained GitHub PAT with contents:write on the vault repo.

Embedded in the remote URL after clone so subsequent push/pull run
without per-call credential plumbing."""

VAULT_COMMITTER_NAME: str = os.getenv('VAULT_COMMITTER_NAME', 'pharos-sync-bot')
"""Display name on commits created by the Railway sync hook."""

VAULT_COMMITTER_EMAIL: str = os.getenv('VAULT_COMMITTER_EMAIL', 'sync@pharos.local')
"""Email on commits created by the Railway sync hook."""

VAULT_ACTIVE_HOURS_TZ: str = os.getenv('VAULT_ACTIVE_HOURS_TZ', 'America/Los_Angeles')
"""IANA timezone whose hours the active-hours window is interpreted in.

The vault auto-refresh and Jira/Asana sync schedulers only fire their
real work when the local-clock hour in this timezone is within the
``[VAULT_ACTIVE_HOURS_START, VAULT_ACTIVE_HOURS_END]`` window."""

VAULT_ACTIVE_HOURS_START: int = int(os.getenv('VAULT_ACTIVE_HOURS_START', '8'))
"""Earliest local hour (0-23) at which periodic vault jobs may run. Default 8 AM."""

VAULT_ACTIVE_HOURS_END: int = int(os.getenv('VAULT_ACTIVE_HOURS_END', '22'))
"""Latest local hour (0-23, inclusive) at which periodic vault jobs may run.

Default 22 (10 PM) — meaning the last fire window of the day spans
22:00–22:59 local time, and nothing runs between 23:00 and the start
hour the next morning."""

GITHUB_WEBHOOK_SECRET: str | None = os.getenv('GITHUB_WEBHOOK_SECRET')
"""Shared secret for verifying GitHub webhook HMAC signatures.

When set, ``POST /api/github-webhook/lpadobe-vault`` verifies incoming
``X-Hub-Signature-256`` headers and, on a push that touches ``wiki/``,
runs a vault pull + dashboard refresh. When unset the endpoint 503s so
a misconfigured deploy fails loudly rather than silently skipping auth."""


def _parse_project_map(raw: str | None) -> dict[str, str]:
    """Parse ``ASANA_PROJECT_MAP`` which is JSON of ``{name: gid}``.

    Returns an empty dict if unset or unparseable — the sync service treats
    an empty map as "Asana not configured" rather than erroring."""
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logging.warning('ASANA_PROJECT_MAP is not valid JSON; Asana sync disabled')
        return {}
    if not isinstance(data, dict):
        logging.warning('ASANA_PROJECT_MAP must be a JSON object; got %s', type(data))
        return {}
    return {str(k): str(v) for k, v in data.items()}


ASANA_PROJECT_MAP: dict[str, str] = _parse_project_map(os.getenv('ASANA_PROJECT_MAP'))
"""Map of Asana project name → GID. Set as JSON in ``ASANA_PROJECT_MAP``."""

JIRA_DEFAULT_PROJECTS: list[str] = [
    p.strip() for p in os.getenv(
        'JIRA_DEFAULT_PROJECTS',
        'ACE2E,ACEDS,ACAB,ACAQA,ACCMS,ACM',
    ).split(',') if p.strip()
]
"""Comma-separated Jira project keys to sync when none are specified."""


def _parse_jql_queries(raw: str | None) -> dict[str, str]:
    """Parse ``JIRA_JQL_QUERIES`` — JSON of ``{output_folder: jql_string}``.

    Each entry runs a custom JQL pull alongside the regular project sync,
    writing results into ``<vault>/raw/<output_folder>/``. Returns an empty
    dict if unset or unparseable; the sync service treats that as "no
    custom JQL feeds configured" rather than erroring."""
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logging.warning('JIRA_JQL_QUERIES is not valid JSON; custom JQL feeds disabled')
        return {}
    if not isinstance(data, dict):
        logging.warning('JIRA_JQL_QUERIES must be a JSON object; got %s', type(data))
        return {}
    return {str(k): str(v) for k, v in data.items() if k and v}


JIRA_JQL_QUERIES: dict[str, str] = _parse_jql_queries(os.getenv('JIRA_JQL_QUERIES'))
"""Map of output-folder name → JQL string. Set as JSON in ``JIRA_JQL_QUERIES``.

Example: ``{"WPM": "key in (WPM-4610, childIssuesOf(WPM-4610)) AND ..."}``
writes to ``<vault>/raw/WPM/``."""
