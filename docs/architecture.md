# Architecture Reference — Pharos Operations Hub

Detail moved out of `CLAUDE.md`. Read this when you need the full backend layout, DB schema, or API surface.

## 3-Layer Architecture

```
Routes (Flask Blueprints)  →  Services (Business Logic)  →  Data Access (Repositories)
```

- **Routes** (`routes/`) — Thin Flask blueprints. HTTP request/response only. No SQL, no business logic. Created via factory functions that receive injected dependencies.
- **Services** (`services/`) — Business logic and external API clients. Orchestrate repositories and clients. Raise domain-specific exceptions.
- **Data Access** (`data_access/`) — Repository pattern. All SQL lives here. `ConnectionManager` abstracts PostgreSQL vs SQLite differences.

**Cross-cutting modules:**
- `config.py` — Centralized configuration constants (env vars, defaults, timeouts)
- `enums.py` — Domain enums (`Strategy`, `PerformanceStatus`, `ScoreRating`, `SchedulePreset`, `TriggerStrategy`) replacing magic strings
- `exceptions.py` — Exception hierarchy (`AppError` → `ValidationError`, `DatabaseError`, `ExternalAPIError` → `PageSpeedError`, `NewRelicError`, `SchedulerError`, etc.)

**Dependency flow** (`app.py` wires everything at startup):
```python
ConnectionManager → Repositories → Services → Blueprints
```

### Backend Patterns & Conventions
- **3-layer architecture:** Routes → Services → Data Access. Dependencies always flow downward, never upward.
- **Dependency injection:** `app.py` wires `ConnectionManager → Repositories → Services → Blueprints` at startup.
- **Repository pattern:** All SQL lives in `data_access/` repositories. Services never touch SQL directly.
- **Blueprint factories:** Each route file exports a `create_*_blueprint()` function that receives its dependencies as arguments.
- **Custom exceptions:** Domain-specific exception hierarchy in `exceptions.py`; centralized error handlers in `app.py`.
- **Enums over magic strings:** `enums.py` provides `Strategy`, `PerformanceStatus`, `ScoreRating`, `SchedulePreset`, `TriggerStrategy`.
- **Centralized config:** All env vars and defaults in `config.py`.
- **No test suite** — all testing is manual.

---

## File Structure

```
├── app.py                    # Application factory, DI wiring, error handlers (~95 lines)
├── config.py                 # Centralized configuration constants (~100 lines)
├── enums.py                  # Domain enums (~96 lines)
├── exceptions.py             # Custom exception hierarchy (~86 lines)
├── data_access/
│   ├── __init__.py           # Re-exports: ConnectionManager, *Repository
│   ├── connection.py         # DB connection manager, schema init, dialect helpers (~300 lines)
│   ├── site_repository.py    # Sites table CRUD with cascade deletes (~105 lines)
│   ├── url_repository.py     # URLs table CRUD with cascade deletes (~88 lines)
│   ├── trigger_repository.py # Trigger + trigger_urls CRUD (~200 lines)
│   └── test_result_repository.py  # Test results queries (~200 lines)
├── services/
│   ├── __init__.py           # Re-exports all services and clients
│   ├── site_service.py       # Site/URL business logic + validation (~128 lines)
│   ├── testing_service.py    # PageSpeed test orchestration (~156 lines)
│   ├── trigger_service.py    # Trigger CRUD, validation, APScheduler job sync (~424 lines)
│   ├── pagespeed_client.py   # Google PageSpeed Insights API client (~192 lines)
│   ├── newrelic_client.py    # New Relic NerdGraph API client (~510 lines)
│   ├── azure_client.py       # Azure Log Analytics API client (~400 lines)
│   ├── ai_base.py            # Abstract base class for AI providers (~50 lines)
│   ├── ai_claude.py          # Claude API client (~100 lines)
│   ├── ai_openai.py          # OpenAI API client (~90 lines)
│   ├── ai_orchestrator.py    # Parallel AI analysis orchestrator (~300 lines)
│   ├── devops_client.py      # Azure DevOps REST API client (~750 lines)
│   └── validation.py         # Shared validation helpers (~50 lines)
├── routes/
│   ├── __init__.py           # register_blueprints() factory
│   ├── pages.py              # Legacy page routes under /legacy/ (ARCHIVED)
│   ├── sites_api.py          # Site/URL CRUD API
│   ├── testing_api.py        # PageSpeed testing API
│   ├── metrics_api.py        # Test results query API
│   ├── triggers_api.py       # Trigger CRUD + toggle + presets API
│   ├── newrelic_api.py       # New Relic proxy API
│   ├── azure_api.py          # Azure Log Analytics proxy API
│   ├── ai_api.py             # AI analysis API
│   └── devops_api.py         # Azure DevOps API
├── requirements.txt
├── Dockerfile                # Production container (multi-stage)
├── Procfile                  # Gunicorn: 2 workers, 300s timeout
├── railway.json              # Railway config
├── templates/                # ARCHIVED — Legacy Flask templates (/legacy/, do NOT update)
├── static/                   # ARCHIVED — Legacy static assets (do NOT update)
└── frontend/                 # React frontend (served at /) — see docs/frontend.md
```

---

## Database Schema (data_access/)

Five tables managed by individual repositories: `sites`, `urls`, `test_results`, `scheduled_triggers`, `trigger_urls`

- **sites:** id, name (unique), created_at
- **urls:** id, site_id (FK), url, created_at — unique constraint on (site_id, url)
- **test_results:** id, url_id (FK), performance_score, accessibility_score, best_practices_score, seo_score, fcp, lcp, cls, inp, ttfb, tti, tbt, speed_index, total_byte_weight, raw_data (JSON), strategy (TEXT DEFAULT 'desktop'), tested_at
- **scheduled_triggers:** id, name (unique), schedule_type, schedule_value, strategy (DEFAULT 'desktop'), enabled (DEFAULT 1), created_at, updated_at
- **trigger_urls:** id, trigger_id (FK → scheduled_triggers), url_id (FK → urls), UNIQUE(trigger_id, url_id)

The `strategy` column on test_results was added via ALTER TABLE migration with `COALESCE(strategy, 'desktop')` for backward compatibility.

Cascade deletes: deleting a URL cleans up `trigger_urls` and `test_results`; deleting a site cascades through its URLs.

---

## API Routes (routes/)

Routes are split across 8 Flask Blueprints, each created via a factory function with injected dependencies.

**Legacy Pages** (`routes/pages.py`): `/legacy/`, `/legacy/setup`, `/legacy/test`, `/legacy/metrics`, `/legacy/newrelic`, `/legacy/iislogs`, `/legacy/ai-analysis` — ARCHIVED, do not update.

**Site/URL CRUD** (`routes/sites_api.py`): `POST/GET /api/sites`, `POST/GET /api/sites/<id>/urls`, `PUT/DELETE /api/sites/<id>`, `DELETE /api/urls/<id>`

**Testing** (`routes/testing_api.py`): `POST /api/test-url`, `POST /api/test-url-async`, `POST /api/test-site/<id>`, `POST /api/test-all` — all accept `strategy` param (default: 'desktop').

**Results** (`routes/metrics_api.py`): `GET /api/sites/<id>/latest-results`, `GET /api/urls/<id>/history`, `GET /api/test-details/<id>`, `GET /api/worst-performing`, `GET /api/comparison`, `GET /api/comparison/urls` — all accept `strategy` query param.

**New Relic** (`routes/newrelic_api.py`): `POST /api/newrelic/test-connection`, `/core-web-vitals`, `/performance-overview`, `/apm-metrics`, `/custom-query` — backend expects snake_case keys (`api_key`, `account_id`, `app_name`).

**Azure** (`routes/azure_api.py`): `POST /api/azure/test-connection`, `/search-logs`, `/dashboard-summary`, `/execute-query`, `/list-sites` — backend expects snake_case keys (`tenant_id`, `client_id`, `client_secret`, `workspace_id`).

**AI** (`routes/ai_api.py`): `POST /api/ai/analyze` (parallel Claude + OpenAI), `POST /api/ai/follow-up`

**Triggers** (`routes/triggers_api.py`): `GET /api/triggers`, `POST /api/triggers`, `PUT /api/triggers/<id>`, `DELETE /api/triggers/<id>`, `PATCH /api/triggers/<id>/toggle`, `POST /api/triggers/<id>/run-now`, `GET/POST/DELETE /api/triggers/presets`

**Azure DevOps** (`routes/devops_api.py`): `POST /api/devops/test-connection`, `/pipelines`, `/builds`, `/builds/<id>`, `/effective-status/<id>`, `/failed-tests/<id>`, `/skipped-tests/<id>`, `/test-screenshot/<runId>/<resultId>/<attachmentId>` (proxies image from Azure DevOps), `/branches`, `/trigger/<pipeline_id>`, `/trigger-orchestrator` — credentials sent per-request from localStorage (PAT-based auth).

**Scheduled:** User-configurable triggers via APScheduler, managed on the Setup page. Supports preset schedules (daily, every 6h/12h, weekly) and custom cron expressions. Each trigger has its own strategy (desktop/mobile/both) and URL selection. Jobs are synced from the database on startup via `trigger_service.sync_all_jobs()`.

---

## Credential Storage

All API credentials are stored **client-side in localStorage** (not on the server):
- `nrConfig` — New Relic API key, Account ID, App Name (camelCase; API client converts to snake_case)
- `azureConfig` — Azure Tenant ID, Client ID, Client Secret, Workspace ID, Secret Expiration Date, Site (camelCase → snake_case)
- `aiConfig` — Claude API Key/Model, OpenAI API Key/Model
- `kqlProfiles` — Per-user KQL query profiles (migrated from legacy `kqlSavedQueries`)
- `devOpsConfig` — Azure DevOps PAT, Organization, Project, Orchestrator Pipeline ID, Pipeline Map (role key → definition ID)

Server-side env vars: `DATABASE_URL` (Railway auto-sets), `PORT`, `PAGESPEED_API_KEY` (optional).
Local-only env vars (`.env`, gitignored): `RAILWAY_TOKEN` — Railway deploy automation.
