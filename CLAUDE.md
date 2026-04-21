# CLAUDE.md — Pharos Operations Hub

## Context
This file documents the full project state so a new session can pick up where we left off. The project is an internal operations hub for **Lamps Plus**, branded as **Pharos — Operations Hub** (sidebar subtitle). Deployed on **Railway** with manual deployment from the `master` branch. It started as a PageSpeed-only dashboard and has grown to cover multiple operations concerns; the Adobe Commerce migration dashboard is the next domain being added.

---

## Project Overview

**Purpose:** Unified operations hub covering web performance monitoring (Google PageSpeed Insights), APM (New Relic), IIS log analysis (Azure Log Analytics), AI-powered analysis (Claude + OpenAI side-by-side), Azure DevOps automation orchestration and build monitoring, BlazeMeter load testing, and (in progress) an Adobe Commerce migration dashboard.

**Tech Stack:**
- **Backend:** Python 3.11, Flask, Gunicorn, APScheduler
- **Database:** SQLite (local dev) / PostgreSQL (production via Railway)
- **React Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS 4, shadcn/ui (base-ui primitives), Recharts, TanStack React Table, react-day-picker, date-fns, marked.js, SheetJS (xlsx) (served at `/`)
- **Legacy Frontend (archived):** Vanilla HTML/CSS/JS, Chart.js, marked.js, JSZip (archived at `/legacy/` — do NOT update)
- **External APIs:** Google PageSpeed Insights, New Relic NerdGraph (GraphQL), Azure Log Analytics (REST/KQL), Anthropic Claude, OpenAI
- **Deployment:** Railway (Dockerfile builder, manual deploy via `npx @railway/cli up -m "message"`)

**Repository:** `https://github.com/vorakas/pagespeed.git`

---

## Deployment

- **Production URL:** `https://pagespeed-production.up.railway.app/`
  - `/` — React frontend (primary, all 8 pages)
  - `/legacy/` — Archived Flask/template frontend (read-only reference, do NOT update)
- **Production branch:** `master`
- **Builder:** Dockerfile (multi-stage: node:20-alpine for React build, python:3.11-slim for Flask)
- **GitHub webhook is broken** — auto-deploy on push does not work. **Always deploy via Railway CLI** (the GraphQL `serviceInstanceDeploy` mutation reuses Docker cache and may serve stale frontend bundles):
  ```
  git push
  npx @railway/cli up -m "$(git log -1 --pretty=%s)"
  ```
- **Railway API deploy:** Token stored in `.env` (`RAILWAY_TOKEN`). See "Deploy Rules" section for the automated workflow triggered by "Push to GitHub and deploy to Railway"
- **Railway IDs:** Project `a6cb2ea4-df71-4b99-b162-38571eea72fa`, Service `0b3030d3-7c70-4d6a-a4ab-47d84a58b123`, Environment `0226ddd8-058c-4d74-a18a-e4d831d1a195`
- **PORT:** Railway sets `$PORT` env var. Ensure Railway networking matches (currently 5000).

---

## Architecture

The backend follows a **3-layer architecture** with dependency injection:

```
Routes (Flask Blueprints)  →  Services (Business Logic)  →  Data Access (Repositories)
```

- **Routes** (`routes/`) — Thin Flask blueprints. Handle HTTP request/response only. No SQL, no business logic. Created via factory functions that receive injected dependencies.
- **Services** (`services/`) — Business logic and external API clients. Orchestrate repositories and clients. Raise domain-specific exceptions.
- **Data Access** (`data_access/`) — Repository pattern. All SQL lives here. `ConnectionManager` abstracts PostgreSQL vs SQLite differences.

**Cross-cutting modules:**
- `config.py` — Centralized configuration constants (env vars, defaults, timeouts)
- `enums.py` — Domain enums (`Strategy`, `PerformanceStatus`, `ScoreRating`, `SchedulePreset`, `TriggerStrategy`) replacing magic strings
- `exceptions.py` — Exception hierarchy (`AppError` → `ValidationError`, `DatabaseError`, `ExternalAPIError` → `PageSpeedError`, `NewRelicError`, `SchedulerError`, etc.)

**Dependency flow** (app.py wires everything):
```python
ConnectionManager → Repositories → Services → Blueprints
```

---

## File Structure

```
├── app.py                    # Application factory, DI wiring, error handlers (~95 lines)
├── config.py                 # Centralized configuration constants (~100 lines)
├── enums.py                  # Domain enums: Strategy, PerformanceStatus, ScoreRating, SchedulePreset, TriggerStrategy (~96 lines)
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
│   ├── devops_client.py      # Azure DevOps REST API client (~750 lines) — builds, triggers, test results, branches, effective status, test attachments/screenshots
│   └── validation.py         # Shared validation helpers (~50 lines)
├── routes/
│   ├── __init__.py           # register_blueprints() factory
│   ├── pages.py              # Legacy page routes under /legacy/ (~52 lines, ARCHIVED)
│   ├── sites_api.py          # Site/URL CRUD API (~56 lines)
│   ├── testing_api.py        # PageSpeed testing API (~83 lines)
│   ├── metrics_api.py        # Test results query API (~69 lines)
│   ├── triggers_api.py       # Trigger CRUD + toggle + presets API (~81 lines)
│   ├── newrelic_api.py       # New Relic proxy API (~78 lines)
│   ├── azure_api.py          # Azure Log Analytics proxy API (~107 lines)
│   ├── ai_api.py             # AI analysis API (~159 lines)
│   └── devops_api.py         # Azure DevOps API (~124 lines) — builds, triggers, branches, test results, skipped tests
├── requirements.txt          # Python dependencies
├── Dockerfile                # Production container (multi-stage)
├── Procfile                  # Gunicorn: 2 workers, 300s timeout
├── railway.json              # Railway config (Nixpacks, ON_FAILURE restart)
├── setup.sh                  # Local dev setup script
├── README.md                 # Project documentation
├── CLAUDE.md                 # This file — project context for Claude sessions
├── .gitignore
├── templates/                # ARCHIVED — Legacy Flask templates (served at /legacy/, do NOT update)
│   ├── index.html            # Dashboard home, worst performers, CWV reference guide
│   ├── setup.html            # Site/URL management + scheduled trigger configuration
│   ├── test.html             # PageSpeed testing with desktop/mobile toggle
│   ├── metrics.html          # Performance metrics charts
│   ├── newrelic.html         # New Relic integration page
│   ├── iislogs.html          # IIS logs + KQL queries + profiles (~1624 lines, heavy inline JS)
│   └── ai_analysis.html      # AI analysis with parallel Claude + OpenAI
├── static/                   # ARCHIVED — Legacy static assets (do NOT update)
│   ├── css/style.css         # Legacy styles, dark+light mode (~5830 lines)
│   ├── js/app.js             # Legacy frontend JS (~1740 lines)
│   ├── favicon.ico
│   └── images/               # Logo variants (LampsPlus dark/light, Pharos, Pharos-dark)
├── frontend/                   # React frontend (served at /)
│   ├── package.json
│   ├── vite.config.ts          # Build config, /api proxy to localhost:5000, base: /
│   ├── public/images/          # Pharos.png, Pharos-dark.png, LampsPlus logos
│   ├── src/
│   │   ├── App.tsx             # React Router with 8 routes under AppLayout
│   │   ├── index.css           # Tailwind + shadcn design tokens (dark/light), themed scrollbars
│   │   ├── services/api.ts     # Typed API client (30+ endpoints, snake_case conversion for NR/Azure, screenshot proxy)
│   │   ├── services/spreadsheetExport.ts  # XLSX generation utility (SheetJS) — formatted regression tracking spreadsheet
│   │   ├── types/index.ts      # TypeScript interfaces for all entities
│   │   ├── lib/utils.ts        # cn(), formatters, scoring helpers, cron description, escapeHtml
│   │   ├── context/
│   │   │   ├── ThemeContext.tsx # Dark/light theme with localStorage
│   │   │   └── SitesContext.tsx # Sites + URLs loaded on mount
│   │   ├── hooks/
│   │   │   ├── use-api.ts      # Generic async API hook
│   │   │   ├── use-sites.ts    # Sites context consumer
│   │   │   ├── use-theme.ts    # Theme context consumer
│   │   │   └── use-local-config.ts # localStorage sync hook
│   │   ├── components/
│   │   │   ├── layout/         # AppLayout, Sidebar (nav only), Header (logo banner + page title)
│   │   │   ├── ui/             # ~33 shadcn/ui components (incl. calendar, popover, date-time-picker, switch, checkbox w/ indeterminate)
│   │   │   ├── shared/         # ScoreBadge (fixed-width), EmptyState, LoadingSpinner
│   │   │   ├── dashboard/      # WorstPerformersSection, CwvReferenceSection, LighthouseExplanation
│   │   │   ├── metrics/        # HistoricalChart, PageComparison
│   │   │   ├── test-urls/      # TestResultsTable, TestProgressPanel, TestDetailDialog
│   │   │   ├── setup/          # SiteUrlManager, TriggerForm, TriggerCard, TriggerList
│   │   │   ├── newrelic/       # NewRelicConfig, CwvMetrics, PerformanceOverview, ApmMetrics, CustomQuery
│   │   │   ├── ai-analysis/    # AiConfigPanel, AnalysisPanel (markdown chat w/ marked.js)
│   │   │   ├── iis-logs/       # AzureConfigPanel, LogSearchPanel, DashboardSummary, KqlQueryPanel
│   │   │   └── builds/         # Azure DevOps build monitoring components
│   │   │       ├── BuildCard.tsx           # Individual build card with status, Run/Results/Skipped/+Sheet buttons, per-card branch/env overrides
│   │   │       ├── BuildGrid.tsx           # Orchestrated grid layout (WarmUp + SpreadsheetWidget + Functional→Visual per platform)
│   │   │       ├── BuildResultsModal.tsx   # (Legacy — replaced by BuildResultsPanel)
│   │   │       ├── BuildResultsPanel.tsx   # Side panel for failed/skipped test results with prefetch support, screenshot thumbnails + lightbox modal
│   │   │       ├── DevOpsConfigPanel.tsx   # PAT/organization/project configuration
│   │   │       ├── OrchestratorPanel.tsx   # Run All Builds: checkboxes, branch dropdown, environment selector
│   │   │       ├── PipelineMapper.tsx      # Map role keys to Azure DevOps pipeline definition IDs
│   │   │       └── SpreadsheetWidget.tsx   # Spreadsheet export widget: release name input, breakdown table, download .xlsx
│   │   └── pages/
│   │       ├── Dashboard.tsx   # ✅ Complete — worst performers, CWV reference, Lighthouse
│   │       ├── Metrics.tsx     # ✅ Complete — historical chart + page comparison
│   │       ├── TestUrls.tsx    # ✅ Complete — batch testing, progress, results table, detail dialog
│   │       ├── Setup.tsx       # ✅ Complete — site/URL CRUD, trigger management
│   │       ├── NewRelic.tsx    # ✅ Complete — CWV, performance overview, APM, custom queries
│   │       ├── AiAnalysis.tsx  # ✅ Complete — parallel Claude/OpenAI, follow-up conversations
│   │       ├── IisLogs.tsx     # ✅ Complete — Azure logs, dashboard, KQL queries, profiles
│   │       └── Builds.tsx      # ✅ Complete — Azure DevOps build monitoring, orchestration, test results
│   └── dist/                   # Vite build output (copied to Docker image)
```

---

## Database Schema (data_access/)

Five tables managed by individual repositories in `data_access/`: `sites`, `urls`, `test_results`, `scheduled_triggers`, `trigger_urls`

- **sites:** id, name (unique), created_at
- **urls:** id, site_id (FK), url, created_at — unique constraint on (site_id, url)
- **test_results:** id, url_id (FK), performance_score, accessibility_score, best_practices_score, seo_score, fcp, lcp, cls, inp, ttfb, tti, tbt, speed_index, total_byte_weight, raw_data (JSON), strategy (TEXT DEFAULT 'desktop'), tested_at
- **scheduled_triggers:** id, name (unique), schedule_type, schedule_value, strategy (DEFAULT 'desktop'), enabled (DEFAULT 1), created_at, updated_at
- **trigger_urls:** id, trigger_id (FK → scheduled_triggers), url_id (FK → urls), UNIQUE(trigger_id, url_id)

The `strategy` column on test_results was added via ALTER TABLE migration with `COALESCE(strategy, 'desktop')` for backward compatibility.

Cascade deletes: deleting a URL cleans up `trigger_urls` and `test_results`; deleting a site cascades through its URLs.

---

## API Routes (routes/)

Routes are split across 8 Flask Blueprints in `routes/`, each created via a factory function with injected dependencies.

**Legacy Pages** (`routes/pages.py`): `/legacy/`, `/legacy/setup`, `/legacy/test`, `/legacy/metrics`, `/legacy/newrelic`, `/legacy/iislogs`, `/legacy/ai-analysis` — ARCHIVED, do not update

**Site/URL CRUD** (`routes/sites_api.py`): `POST/GET /api/sites`, `POST/GET /api/sites/<id>/urls`, `PUT/DELETE /api/sites/<id>`, `DELETE /api/urls/<id>`

**Testing** (`routes/testing_api.py`): `POST /api/test-url`, `POST /api/test-url-async`, `POST /api/test-site/<id>`, `POST /api/test-all` — all accept `strategy` param (default: 'desktop')

**Results** (`routes/metrics_api.py`): `GET /api/sites/<id>/latest-results`, `GET /api/urls/<id>/history`, `GET /api/test-details/<id>`, `GET /api/worst-performing`, `GET /api/comparison`, `GET /api/comparison/urls` — all accept `strategy` query param

**New Relic** (`routes/newrelic_api.py`): `POST /api/newrelic/test-connection`, `POST /api/newrelic/core-web-vitals`, `POST /api/newrelic/performance-overview`, `POST /api/newrelic/apm-metrics`, `POST /api/newrelic/custom-query` — backend expects snake_case keys (`api_key`, `account_id`, `app_name`)

**Azure** (`routes/azure_api.py`): `POST /api/azure/test-connection`, `POST /api/azure/search-logs`, `POST /api/azure/dashboard-summary`, `POST /api/azure/execute-query`, `POST /api/azure/list-sites` — backend expects snake_case keys (`tenant_id`, `client_id`, `client_secret`, `workspace_id`)

**AI** (`routes/ai_api.py`): `POST /api/ai/analyze` (parallel Claude + OpenAI), `POST /api/ai/follow-up`

**Triggers** (`routes/triggers_api.py`): `GET /api/triggers`, `POST /api/triggers`, `PUT /api/triggers/<id>`, `DELETE /api/triggers/<id>`, `PATCH /api/triggers/<id>/toggle`, `POST /api/triggers/<id>/run-now`, `GET/POST/DELETE /api/triggers/presets`

**Azure DevOps** (`routes/devops_api.py`): `POST /api/devops/test-connection`, `POST /api/devops/pipelines`, `POST /api/devops/builds`, `POST /api/devops/builds/<id>`, `POST /api/devops/effective-status/<id>`, `POST /api/devops/failed-tests/<id>`, `POST /api/devops/skipped-tests/<id>`, `POST /api/devops/test-screenshot/<runId>/<resultId>/<attachmentId>` (proxies image from Azure DevOps), `POST /api/devops/branches`, `POST /api/devops/trigger/<pipeline_id>`, `POST /api/devops/trigger-orchestrator` — credentials sent per-request from localStorage (PAT-based auth)

**Scheduled:** User-configurable triggers via APScheduler, managed on the Setup page. Supports preset schedules (daily, every 6h/12h, weekly) and custom cron expressions. Each trigger has its own strategy (desktop/mobile/both) and URL selection. Jobs are synced from the database on startup via `trigger_service.sync_all_jobs()`.

---

## Credential Storage

All API credentials are stored **client-side in localStorage** (not on the server):
- `nrConfig` — New Relic API key, Account ID, App Name (camelCase; API client converts to snake_case)
- `azureConfig` — Azure Tenant ID, Client ID, Client Secret, Workspace ID, Secret Expiration Date, Site (camelCase; API client converts to snake_case)
- `aiConfig` — Claude API Key/Model, OpenAI API Key/Model
- `kqlProfiles` — Per-user KQL query profiles with saved queries (migrated from legacy `kqlSavedQueries`)
- `devOpsConfig` — Azure DevOps PAT, Organization, Project, Orchestrator Pipeline ID, Pipeline Map (role key → definition ID)

Server-side env vars: `DATABASE_URL` (Railway auto-sets), `PORT`, `PAGESPEED_API_KEY` (optional).
Local-only env vars (`.env`, gitignored): `RAILWAY_TOKEN` — used for Railway deploy automation via GraphQL API.

---

## React Frontend (Primary) — All Development Happens Here

**IMPORTANT:** The React frontend is the sole active frontend. All new features, bug fixes, and UI changes must be made in the React frontend (`frontend/src/`). Do NOT modify the legacy `templates/`, `static/css/`, or `static/js/` files — they are archived at `/legacy/` for reference only.

All 8 pages are fully implemented and served at `/`.

### Header & Branding
- **Lamps Plus Pharos** branding — Lamps Plus logo + Pharos lighthouse logo side-by-side in top banner
- Pharos logo has light variant (dark navy text) and dark variant (white text + soft white glow for visibility)
- Logo sizes: Lamps Plus `h-10`, Pharos `h-24`, separated by vertical divider
- Theme toggle (sun/moon) in banner, page title + description below

### Dashboard (`/`)
- Worst performers per site (sortable TanStack tables), CWV reference guide, Lighthouse explanation
- Desktop/Mobile strategy toggle

### Metrics (`/metrics`)
- Historical performance area chart (Recharts AreaChart, natural curve interpolation, gradient fills, shadcn-style dark tooltip)
- Date range dropdown (7/14/30/60/90 days, default 30), multiple tests per day averaged into single data point
- Page Comparison (side-by-side URL comparison with Lighthouse scores, CWV, size, and diff summary)

### Test URLs (`/test`)
- Desktop/Mobile strategy toggle, "Test All URLs" batch testing with progress panel
- Site tabs, sortable 13-column results table (TanStack), retest/delete per URL
- Performance detail dialog with score breakdown, metric weights, opportunities, failed audits

### Setup (`/setup`)
- Add Site / Add URL forms, collapsible site drawers with URL lists, delete site/URL
- Trigger create/edit/delete with preset or custom cron schedules, strategy selection
- URL checkbox grid with per-site select-all and indeterminate state
- Trigger cards with enable/disable switch, run-now, last-run status

### New Relic (`/newrelic`)
- Config panel with localStorage persistence and connection test
- Core Web Vitals with percentile cards (P50/P75/P90) and threshold indicators
- Performance overview with period comparison (response time, throughput, error rate, Apdex)
- APM metrics with tabbed tables (transactions, database, external, errors)
- Custom NRQL query runner with JSON results

### AI Analysis (`/ai-analysis`)
- Config panel for Claude and OpenAI API keys/models
- Parallel analysis with side-by-side markdown results (marked.js)
- Multi-turn follow-up conversations with context preservation
- Cumulative token usage tracking, data source status badges
- Experimental disclaimer

### IIS Logs (`/iislogs`)
- Azure config with secret expiration warnings, connection test
- Log search with themed calendar date-time picker (react-day-picker + hour/minute/AM-PM controls), URL/status filters, results table with status coloring
- Dashboard summary (stat cards, P50/P90/P99/Max percentiles, top pages, status distribution)
- KQL query mode with 5 presets, saved query management, per-user profiles
- Table/JSON view toggle, CSV export, site selector

### Automation Builds (`/builds`)
- Azure DevOps pipeline monitoring with PAT-based auth (stored in localStorage as `devOpsConfig`)
- **Build Grid:** WarmUp card (24rem fixed width) + 4 platform rows (Windows/Mac/iPhone/Android) each with Functional→Visual chain
- **Orchestrator Panel (Run All Builds):** Checkboxes for build types (WarmUp/Functional/Visual) and platforms (Windows/Mac/iPhone/Android), branch dropdown (fetched from Azure DevOps Git repos), environment selector (TargetInstance A-I)
- **Per-card overrides:** Collapsible branch/env override per card via `<details>`, CSS grid layout to prevent card distortion from long branch names
- **Results side panel:** Sticky panel to the right of the grid, shows failed or skipped test details when clicking Results/Skipped buttons. Uses `flex-1` to fill remaining viewport width
- **Background prefetching:** Failed and skipped tests are prefetched sequentially after builds load (failed first, then skipped). Panel renders instantly from cache when available. `prefetchingTests` state tracks loading progress and shows spinner in SpreadsheetWidget
- **Failure screenshots:** Screenshots attached to failed test results in Azure DevOps are fetched via `_apis/test/runs/{runId}/results/{resultId}/attachments` (preview API version `7.2-preview.1`). Thumbnails appear below the stack trace in the expandable details accordion; clicking opens a full-size lightbox modal (Dialog component). Screenshots are prefetched in the background via `useScreenshotPrefetch` hook as soon as failed test data loads. Backend proxies image downloads through `POST /api/devops/test-screenshot/{runId}/{resultId}/{attachmentId}` to handle PAT authentication
- **Visual Target test filtering:** Tests with "Baseline visual test failed and comparison test shouldn't be executed" in the error message are filtered out client-side (in both the Results panel and spreadsheet export)
- **Skipped tests:** Uses `outcome == "NotExecuted"` server-side filter (matching xUnit `[Fact(Skip=...)]`) rather than the broad "Others" outcome which includes NotApplicable, Blocked, etc.
- **Effective status:** Accounts for re-run passes (orange "Partial" becomes green "Passed (Re-runs)")
- **Polling:** 10-second interval while any build is running
- **Pipeline mapping:** Collapsible advanced section to map role keys to pipeline definition IDs
- **Spreadsheet Export:** QA clicks "+ Sheet" button on each completed build card to collect failed/skipped tests. SpreadsheetWidget (CSS grid next to WarmUp card, height-locked) shows breakdown table with frozen header/totals and failed/skipped counts per build. User enters a release name (tab name), then downloads a formatted `.xlsx` via SheetJS (browser-side, no backend). Spreadsheet matches the Google Sheets tracker format: grey merged section headers (`#D9D9D9`), hyperlinked TC URLs (`lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/LP-{testId}`), Automation Execution Status (Skipped/Failed), columns E-I left blank for manual QA entry. Section order: Functional Skipped × 4 platforms, Visual Skipped × 4, Warmup Failures, Functional Failed × 4, Visual Failed × 4, Unresolved × 4 (empty placeholders for future Applitools integration), Manual Execution
  - **Known issue (WIP):** Skipped test counts may still need validation across all build types. Spreadsheet data accuracy is being refined

### UI Polish
- Dark/light themed scrollbars (thin, rounded, theme-aware)
- Fixed-width score badges (`min-w-9`)
- Full-width select dropdowns with absolute-positioned chevron
- "Access" column label (was "A11y")
- **Table column sizing:** Metric columns use `width: 1px` + `whitespace-nowrap` trick to shrink-wrap to content. URL column uses `width: 100%` (Dashboard) to absorb surplus space. Test URLs page uses `width: 1px` on metric headers without explicit URL width.
- **Themed date-time picker:** Custom `DateTimePicker` component (`ui/date-time-picker.tsx`) with `Calendar` popover + chevron-based hour/minute/AM-PM controls, replacing native `datetime-local` inputs

---

## Recent Commit History (newest first)

```
e5579f9 Fix WarmUp card width to fit all 4 buttons on one row
e284cd1 Fix skipped tests: filter by outcome=NotExecuted server-side
834b47b Fix button clipping, widget height lock, and skipped test counts
ab05adb Fix widget layout, button fit, and skipped test filtering
899239c Fix spreadsheet widget layout and add loading indicator
9a41f58 Fix spreadsheet export: button wrap, fetch skipped, filter baseline
27b78e6 Add spreadsheet export for regression tracking
e37afe5 Prefetch screenshots in background when failed tests load
bfc1390 Force Docker cache invalidation for frontend rebuild
c371a02 Fix attachment API version to use preview endpoint for screenshots
0081329 Add failure screenshot display to build results panel
a69fd9a Add Azure DevOps build monitoring and orchestration dashboard
3a6f5fa Update CLAUDE.md: React is primary frontend, legacy archived at /legacy/
f0de140 Move React frontend to root URL, archive legacy site at /legacy/
08f31e2 Replace native time input with themed hour/minute/AM-PM picker
1a77d89 Replace native date inputs with themed Calendar date-time picker
d7f439a Set URL column to width:100% on Dashboard worst performers table
7687ef3 Shrink-wrap metric columns using width:1px + nowrap trick
b7bbc06 Tighten metric column widths to give more space to URL column
b2a0f83 Widen URL column on Dashboard and Test URLs tables
c225240 Add date range dropdown to historical performance chart
2d35e41 Average multiple test results per day on historical chart
923852f Fix duplicate date labels on historical chart X-axis
d63774e Match shadcn/ui area chart style: remove dots, clean grid, richer fills
fb6d5fe Smooth area chart curves and style tooltip like shadcn/ui
31c3f0d Switch Historical Performance chart from line to area chart
9a265cd Move radar chart legend outside SVG to prevent label collision
519389e Tighten comparison layout, shrink bars, fix radar legend overlap
0132d69 Redesign sidebar as floating panel with rounded cards
b70f6b8 Enlarge Pharos logo with bigger text matching Lamps Plus logo size
504bf17 Rebrand to Lamps Plus Pharos with transparent lighthouse logo in header
4743bdf Polish UI: banner layout, score badges, dropdowns, scrollbars, column labels
563636b Add IIS Logs page with search, dashboard, and KQL query mode
0f28916 Add AI Analysis page with parallel Claude/OpenAI and follow-up conversations
e5554fe Add New Relic page with CWV, performance overview, APM, and custom queries
9a8cbdb Add Setup page with site/URL CRUD and trigger management
d54188f Add Test URLs page with batch testing, results table, and detail dialog
38bf97f Add Metrics page with historical chart and page comparison
6a03c01 Switch to multi-stage Dockerfile for Railway deployment
345384a Add React frontend scaffold with Dashboard page, served at /app/
```

---

## Known Patterns & Conventions

### Backend Architecture
- **3-layer architecture:** Routes → Services → Data Access. Dependencies always flow downward, never upward
- **Dependency injection:** `app.py` wires `ConnectionManager → Repositories → Services → Blueprints` at startup
- **Repository pattern:** All SQL lives in `data_access/` repositories. Services never touch SQL directly
- **Blueprint factories:** Each route file exports a `create_*_blueprint()` function that receives its dependencies as arguments
- **Custom exceptions:** Domain-specific exception hierarchy in `exceptions.py`; centralized error handlers in `app.py`
- **Enums over magic strings:** `enums.py` provides `Strategy`, `PerformanceStatus`, `ScoreRating`, `SchedulePreset`, `TriggerStrategy`
- **Centralized config:** All env vars and defaults in `config.py`
- **No test suite** — no automated tests exist; all testing is manual

### React Frontend Patterns
- **Component organization:** Feature-based directories under `components/` (dashboard, test-urls, setup, newrelic, ai-analysis, iis-logs)
- **State management:** SitesContext for global site data, `useLocalConfig` hook for localStorage-persisted configs (NR, Azure, AI)
- **API client:** `services/api.ts` with `nrBody()` and `azBody()` helpers that convert camelCase TypeScript config to snake_case for backend
- **Tables:** TanStack React Table with sortable columns, ScoreBadge components, formatters from `lib/utils.ts`. Metric columns use `width: 1px` shrink-wrap trick; URL column absorbs remaining space
- **Markdown rendering:** `marked` npm package for AI analysis chat panels
- **shadcn/ui:** base-ui primitives (not Radix) — Dialog, Select, Tabs, Progress, Checkbox (with indeterminate), Switch, Calendar, Popover, DateTimePicker, etc.
- **Tailwind CSS 4:** Design tokens in `index.css`, `cn()` utility for class merging

### Legacy Frontend (ARCHIVED — do NOT modify)
The legacy Flask/template frontend (`templates/`, `static/`) is archived at `/legacy/`. It remains in the repo for reference but should never be updated. All development happens in the React frontend.

### UI Conventions
- **Status code coloring:** 2xx (green), 3xx (blue/primary), 4xx (yellow/average), 5xx (red/poor)
- **Score coloring:** `score-good` (90+, green), `score-average` (50-89, orange), `score-poor` (0-49, red) — used in ScoreBadge and threshold indicators
- **Lucide icons** — 20px in sidebar nav, smaller in buttons/actions
- **Toast notifications** — Sonner toasts (React), `showToast()` (legacy)
- **Empty states** — EmptyState component with icon, title, description, optional action

### Workflow
- **Commit messages:** Always include `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`
- **Deploy command:** `npx @railway/cli up -m "$(git log -1 --pretty=%s)"` — uses git commit subject as deploy message

---

## OOP Guidelines

### Core Principles
- When generating new classes, briefly explain which OOP principle guided the design decision before writing the code
- Follow SOLID principles, especially Single Responsibility — each class should have one clear reason to exist and one reason to change
- Favor composition over inheritance. Use inheritance only for true "is-a" relationships, not for code reuse
- Keep classes focused and small. If a class exceeds ~200 lines, consider whether it's doing too much
- Design to interfaces/abstractions, not concrete implementations. Use abstract base classes (Python) or interfaces (C#) to define contracts between components

### Encapsulation and Access
- Make fields private by default. Expose only what's necessary through properties or methods
- Never expose mutable internal state directly — return copies or use read-only properties
- Avoid public setters unless there's a genuine need for external mutation. Prefer construction-time initialization

### Class Design
- Every class must have a clear, single purpose described by its name — if you can't name it without "And" or "Manager", it's doing too much
- Constructor parameters should be the minimum needed to create a valid object. No half-initialized objects
- Use dependency injection to pass collaborators into a class rather than creating them internally
- Prefer small, well-defined method signatures. If a method needs more than 3-4 parameters, consider a parameter object or rethink the design
- Keep methods short and focused on one task. If a method exceeds ~30 lines, look for extraction opportunities

### Patterns and Practices
- Use the Repository pattern for database access — keep SQL/query logic out of business logic and UI classes
- Use the Observer pattern or events for communication between loosely coupled components (e.g., UI reacting to data changes)
- Avoid God objects and singletons unless absolutely justified. If something feels like it needs to be a singleton, it probably needs dependency injection instead
- Use enums instead of magic strings or numbers
- Use type hints (Python) and strong typing (C#) consistently on all method signatures and return types
- Use complete words when naming variables. Variable names should accurately reflect what they are storing

### Error Handling
- Use custom exception classes for domain-specific errors rather than raising generic Exception
- Handle exceptions at the appropriate level — don't catch exceptions in low-level code just to re-raise them
- Fail fast and visibly. Validate inputs at class boundaries

### Code Organization
- One class per file as the default. Small, tightly related helper classes can share a file
- Group related classes into modules/namespaces that reflect the domain, not the technical layer
- Keep the dependency direction clean — UI depends on business logic, business logic depends on data access, never the reverse

## Workflow Rules

- When the user begins a message with "New Feature:", enter planning mode before writing any code. This means:
  1. Summarize the feature request
  2. Identify affected files and modules
  3. Propose an implementation plan with steps
  4. Wait for user approval before proceeding

## Refactoring Rules
- When begins a message with "Refactor:", always start by analyzing the current implementation and listing specific issues before changing code
  1. Preserve all existing tests, if any, and verify they pass after changes
  2. Refactor in small, testable increments — never rewrite entire modules in one pass
  3. Performance refactors must include before/after benchmarks

## Bug Fixing Rules
- When begins a message with "Bug:", first reproduce and confirm the issue by reading the relevant code before making any changes
  1. Identify the root cause, not just the symptom — explain why the bug exists before proposing a fix
  2. Show the minimal fix first. Avoid refactoring or improving surrounding code during a bug fix unless directly related
  3. If a fix could affect other parts of the app, list the potential side effects before implementing
  4. Write or update a test that would have caught the bug
  5. If you can't confidently identify the cause, say so and suggest diagnostic steps (add logging, isolate the condition, etc.) rather than guessing at a fix
  6. Never silently swallow exceptions or errors to make a bug "go away"
  7. After applying a fix, verify that existing tests, if any, still pass

## Data Safety During Bug Fixes
  1. Never modify audio file metadata or database records as part of debugging without explicit confirmation
  2. When a bug involves file operations or database writes, test the fix against a copy of the data first
  3. If a bug fix requires a database schema change, provide a migration path that preserves existing data

## Commit Rules
- When the user types "Update and Commit" do the following:
  1. Update the CLAUDE.md
  2. Update the README.md
  3. Commit and push all recent changes to GitHub.

## Deploy Rules
- When the user types "Push to GitHub and deploy to Railway" do the following:
  1. Push to GitHub (`git push` from `C:/pagespeed-monitor`)
  2. Read the `RAILWAY_TOKEN` from `C:/pagespeed-monitor/.env`
  3. Trigger a fresh deploy via the Railway GraphQL API:
     ```bash
     source /c/pagespeed-monitor/.env && curl -s -X POST https://backboard.railway.app/graphql/v2 \
       -H "Authorization: Bearer $RAILWAY_TOKEN" \
       -H "Content-Type: application/json" \
       -d '{"query": "mutation { serviceInstanceDeploy(environmentId: \"0226ddd8-058c-4d74-a18a-e4d831d1a195\", serviceId: \"0b3030d3-7c70-4d6a-a4ab-47d84a58b123\") }"}'
     ```
  4. Verify the deploy used the new commit. The GraphQL mutation **often redeploys the previously-built image** instead of building the just-pushed commit, so check:
     ```bash
     curl -s -X POST https://backboard.railway.app/graphql/v2 \
       -H "Authorization: Bearer $RAILWAY_TOKEN" -H "Content-Type: application/json" \
       -d '{"query": "query { deployments(first: 1, input: { serviceId: \"0b3030d3-7c70-4d6a-a4ab-47d84a58b123\", environmentId: \"0226ddd8-058c-4d74-a18a-e4d831d1a195\" }) { edges { node { status meta } } } }"}'
     ```
     If `meta.commitHash` is not the HEAD you just pushed, fall back to the CLI (step 5).
  5. **Fallback — force a fresh build via Railway CLI** when the mutation served a stale image:
     ```bash
     cd /c/pagespeed-monitor && source .env && RAILWAY_API_TOKEN="$RAILWAY_TOKEN" npx @railway/cli up -m "$(git log -1 --pretty=%s)"
     ```
     - The CLI requires the token under `RAILWAY_API_TOKEN` (account-scoped). `RAILWAY_TOKEN` is reserved for project-scoped tokens and fails CLI auth with "Invalid RAILWAY_TOKEN".
     - `railway up` uploads the local working tree and forces a fresh Docker build, bypassing the image cache.

---

## Current State

**React frontend is the primary (and only active) frontend**, served at `/`. The legacy Flask/template site is archived at `/legacy/` and must not be updated.

**App rebranded to "Lamps Plus Pharos"** with lighthouse logo in header (dark/light variants).

**Infrastructure:** Backend is 3-layer architecture with DI. Dockerfile uses multi-stage build (node:20-alpine → python:3.11-slim). Railway GitHub webhook integration is broken; deploy via Railway GraphQL API (see Deploy Rules) or `npx @railway/cli up -m "$(git log -1 --pretty=%s)"`. Railway CLI v4.37.3 installed globally.

**Known issues:**
- Railway GitHub webhook does not auto-create on repo connect — manual deploy required
- `.gitignore` root `lib/` rule was anchored to `/lib/` to avoid ignoring `frontend/src/lib/`
- **Dashboard table column alignment:** The "Worst Performing URLs" section renders separate `<table>` elements per site. With `table-auto`, sites with shorter URLs (e.g., Adobe) still have wider metric columns than sites with longer URLs (e.g., LampsPlus) because the browser distributes surplus space proportionally. The `width: 1px` trick on metric headers + `width: 100%` on the URL header improved it but didn't fully resolve cross-table alignment. A definitive fix would require a single table for all sites, CSS `table-layout: fixed` with explicit pixel widths on every column including URL, or JavaScript-based column width synchronization across tables.

**Potential next steps:**
- **Spreadsheet export data refinement (WIP):** Skipped test counts need validation across all build types; the `outcome == "NotExecuted"` filter may need adjustment. Unresolved section (Applitools integration) is a placeholder
- Resolve Dashboard cross-table column alignment (see known issues above)
- Visual polish and customization of the React frontend
- Automated testing
