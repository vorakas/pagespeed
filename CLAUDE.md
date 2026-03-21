# CLAUDE.md — Lamps Plus Pharos

## Context
This file documents the full project state so a new session can pick up where we left off. The project is a web performance monitoring dashboard for **Lamps Plus** (branded as **Pharos**), deployed on **Railway** with manual deployment from the `master` branch.

---

## Project Overview

**Purpose:** Monitor website performance via Google PageSpeed Insights, New Relic APM, Azure IIS Logs, and AI-powered analysis (Claude + OpenAI side-by-side).

**Tech Stack:**
- **Backend:** Python 3.11, Flask, Gunicorn, APScheduler
- **Database:** SQLite (local dev) / PostgreSQL (production via Railway)
- **Legacy Frontend:** Vanilla HTML/CSS/JS, Chart.js, marked.js, JSZip (served at `/`)
- **React Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS 4, shadcn/ui (base-ui primitives), Recharts, TanStack React Table, marked.js (served at `/app/`)
- **External APIs:** Google PageSpeed Insights, New Relic NerdGraph (GraphQL), Azure Log Analytics (REST/KQL), Anthropic Claude, OpenAI
- **Deployment:** Railway (Dockerfile builder, manual deploy via `npx @railway/cli up -m "message"`)

**Repository:** `https://github.com/vorakas/pagespeed.git`

---

## Deployment

- **Production URL:** `https://pagespeed-production.up.railway.app/`
  - `/` — Legacy Flask/template frontend (production)
  - `/app/` — React frontend (all 7 pages complete)
- **Production branch:** `master`
- **Builder:** Dockerfile (multi-stage: node:20-alpine for React build, python:3.11-slim for Flask)
- **GitHub webhook is broken** — auto-deploy on push does not work. Deploy manually:
  ```
  git push
  npx @railway/cli up -m "$(git log -1 --pretty=%s)"
  ```
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
│   └── validation.py         # Shared validation helpers (~50 lines)
├── routes/
│   ├── __init__.py           # register_blueprints() factory (~47 lines)
│   ├── pages.py              # Page rendering routes (~52 lines)
│   ├── sites_api.py          # Site/URL CRUD API (~56 lines)
│   ├── testing_api.py        # PageSpeed testing API (~83 lines)
│   ├── metrics_api.py        # Test results query API (~69 lines)
│   ├── triggers_api.py       # Trigger CRUD + toggle + presets API (~81 lines)
│   ├── newrelic_api.py       # New Relic proxy API (~78 lines)
│   ├── azure_api.py          # Azure Log Analytics proxy API (~107 lines)
│   └── ai_api.py             # AI analysis API (~159 lines)
├── requirements.txt          # Python dependencies
├── Dockerfile                # Production container (multi-stage)
├── Procfile                  # Gunicorn: 2 workers, 300s timeout
├── railway.json              # Railway config (Nixpacks, ON_FAILURE restart)
├── setup.sh                  # Local dev setup script
├── README.md                 # Project documentation
├── CLAUDE.md                 # This file — project context for Claude sessions
├── .gitignore
├── templates/                # Legacy Flask templates
│   ├── index.html            # Dashboard home, worst performers, CWV reference guide
│   ├── setup.html            # Site/URL management + scheduled trigger configuration
│   ├── test.html             # PageSpeed testing with desktop/mobile toggle
│   ├── metrics.html          # Performance metrics charts
│   ├── newrelic.html         # New Relic integration page
│   ├── iislogs.html          # IIS logs + KQL queries + profiles (~1624 lines, heavy inline JS)
│   └── ai_analysis.html      # AI analysis with parallel Claude + OpenAI
├── static/
│   ├── css/style.css         # Legacy styles, dark+light mode (~5830 lines)
│   ├── js/app.js             # Legacy frontend JS (~1740 lines)
│   ├── favicon.ico
│   └── images/               # Logo variants (LampsPlus dark/light, Pharos, Pharos-dark)
├── frontend/                   # React frontend (served at /app/)
│   ├── package.json
│   ├── vite.config.ts          # Build config, /api proxy to localhost:5000, base: /app/
│   ├── public/images/          # Pharos.png, Pharos-dark.png, LampsPlus logos
│   ├── src/
│   │   ├── App.tsx             # React Router with 7 routes under AppLayout
│   │   ├── index.css           # Tailwind + shadcn design tokens (dark/light), themed scrollbars
│   │   ├── services/api.ts     # Typed API client (30+ endpoints, snake_case conversion for NR/Azure)
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
│   │   │   ├── ui/             # ~30 shadcn/ui components (incl. switch, checkbox w/ indeterminate)
│   │   │   ├── shared/         # ScoreBadge (fixed-width), EmptyState, LoadingSpinner
│   │   │   ├── dashboard/      # WorstPerformersSection, CwvReferenceSection, LighthouseExplanation
│   │   │   ├── metrics/        # HistoricalChart, PageComparison
│   │   │   ├── test-urls/      # TestResultsTable, TestProgressPanel, TestDetailDialog
│   │   │   ├── setup/          # SiteUrlManager, TriggerForm, TriggerCard, TriggerList
│   │   │   ├── newrelic/       # NewRelicConfig, CwvMetrics, PerformanceOverview, ApmMetrics, CustomQuery
│   │   │   ├── ai-analysis/    # AiConfigPanel, AnalysisPanel (markdown chat w/ marked.js)
│   │   │   └── iis-logs/       # AzureConfigPanel, LogSearchPanel, DashboardSummary, KqlQueryPanel
│   │   └── pages/
│   │       ├── Dashboard.tsx   # ✅ Complete — worst performers, CWV reference, Lighthouse
│   │       ├── Metrics.tsx     # ✅ Complete — historical chart + page comparison
│   │       ├── TestUrls.tsx    # ✅ Complete — batch testing, progress, results table, detail dialog
│   │       ├── Setup.tsx       # ✅ Complete — site/URL CRUD, trigger management
│   │       ├── NewRelic.tsx    # ✅ Complete — CWV, performance overview, APM, custom queries
│   │       ├── AiAnalysis.tsx  # ✅ Complete — parallel Claude/OpenAI, follow-up conversations
│   │       └── IisLogs.tsx     # ✅ Complete — Azure logs, dashboard, KQL queries, profiles
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

**Pages** (`routes/pages.py`): `/`, `/setup`, `/test`, `/metrics`, `/newrelic`, `/iislogs`, `/ai-analysis`

**Site/URL CRUD** (`routes/sites_api.py`): `POST/GET /api/sites`, `POST/GET /api/sites/<id>/urls`, `PUT/DELETE /api/sites/<id>`, `DELETE /api/urls/<id>`

**Testing** (`routes/testing_api.py`): `POST /api/test-url`, `POST /api/test-url-async`, `POST /api/test-site/<id>`, `POST /api/test-all` — all accept `strategy` param (default: 'desktop')

**Results** (`routes/metrics_api.py`): `GET /api/sites/<id>/latest-results`, `GET /api/urls/<id>/history`, `GET /api/test-details/<id>`, `GET /api/worst-performing`, `GET /api/comparison`, `GET /api/comparison/urls` — all accept `strategy` query param

**New Relic** (`routes/newrelic_api.py`): `POST /api/newrelic/test-connection`, `POST /api/newrelic/core-web-vitals`, `POST /api/newrelic/performance-overview`, `POST /api/newrelic/apm-metrics`, `POST /api/newrelic/custom-query` — backend expects snake_case keys (`api_key`, `account_id`, `app_name`)

**Azure** (`routes/azure_api.py`): `POST /api/azure/test-connection`, `POST /api/azure/search-logs`, `POST /api/azure/dashboard-summary`, `POST /api/azure/execute-query`, `POST /api/azure/list-sites` — backend expects snake_case keys (`tenant_id`, `client_id`, `client_secret`, `workspace_id`)

**AI** (`routes/ai_api.py`): `POST /api/ai/analyze` (parallel Claude + OpenAI), `POST /api/ai/follow-up`

**Triggers** (`routes/triggers_api.py`): `GET /api/triggers`, `POST /api/triggers`, `PUT /api/triggers/<id>`, `DELETE /api/triggers/<id>`, `PATCH /api/triggers/<id>/toggle`, `POST /api/triggers/<id>/run-now`, `GET/POST/DELETE /api/triggers/presets`

**Scheduled:** User-configurable triggers via APScheduler, managed on the Setup page. Supports preset schedules (daily, every 6h/12h, weekly) and custom cron expressions. Each trigger has its own strategy (desktop/mobile/both) and URL selection. Jobs are synced from the database on startup via `trigger_service.sync_all_jobs()`.

---

## Credential Storage

All API credentials are stored **client-side in localStorage** (not on the server):
- `nrConfig` — New Relic API key, Account ID, App Name (camelCase; API client converts to snake_case)
- `azureConfig` — Azure Tenant ID, Client ID, Client Secret, Workspace ID, Secret Expiration Date, Site (camelCase; API client converts to snake_case)
- `aiConfig` — Claude API Key/Model, OpenAI API Key/Model
- `kqlProfiles` — Per-user KQL query profiles with saved queries (migrated from legacy `kqlSavedQueries`)

Server-side env vars: `DATABASE_URL` (Railway auto-sets), `PORT`, `PAGESPEED_API_KEY` (optional).

---

## React Frontend — Complete

All 7 pages are fully implemented in the React frontend at `/app/`.

### Header & Branding
- **Lamps Plus Pharos** branding — Lamps Plus logo + Pharos lighthouse logo side-by-side in top banner
- Pharos logo has light variant (dark navy text) and dark variant (white text + soft white glow for visibility)
- Logo sizes: Lamps Plus `h-10`, Pharos `h-24`, separated by vertical divider
- Theme toggle (sun/moon) in banner, page title + description below

### Dashboard (`/app/`)
- Worst performers per site (sortable TanStack tables), CWV reference guide, Lighthouse explanation
- Desktop/Mobile strategy toggle

### Metrics (`/app/metrics`)
- Historical performance chart (Recharts line chart, 30-day, 4 score lines)
- Page Comparison (side-by-side URL comparison with Lighthouse scores, CWV, size, and diff summary)

### Test URLs (`/app/test`)
- Desktop/Mobile strategy toggle, "Test All URLs" batch testing with progress panel
- Site tabs, sortable 13-column results table (TanStack), retest/delete per URL
- Performance detail dialog with score breakdown, metric weights, opportunities, failed audits

### Setup (`/app/setup`)
- Add Site / Add URL forms, collapsible site drawers with URL lists, delete site/URL
- Trigger create/edit/delete with preset or custom cron schedules, strategy selection
- URL checkbox grid with per-site select-all and indeterminate state
- Trigger cards with enable/disable switch, run-now, last-run status

### New Relic (`/app/newrelic`)
- Config panel with localStorage persistence and connection test
- Core Web Vitals with percentile cards (P50/P75/P90) and threshold indicators
- Performance overview with period comparison (response time, throughput, error rate, Apdex)
- APM metrics with tabbed tables (transactions, database, external, errors)
- Custom NRQL query runner with JSON results

### AI Analysis (`/app/ai-analysis`)
- Config panel for Claude and OpenAI API keys/models
- Parallel analysis with side-by-side markdown results (marked.js)
- Multi-turn follow-up conversations with context preservation
- Cumulative token usage tracking, data source status badges
- Experimental disclaimer

### IIS Logs (`/app/iislogs`)
- Azure config with secret expiration warnings, connection test
- Log search with date range/URL/status filters, results table with status coloring
- Dashboard summary (stat cards, P50/P90/P99/Max percentiles, top pages, status distribution)
- KQL query mode with 5 presets, saved query management, per-user profiles
- Table/JSON view toggle, CSV export, site selector

### UI Polish
- Dark/light themed scrollbars (thin, rounded, theme-aware)
- Fixed-width score badges (`min-w-9`)
- Full-width select dropdowns with absolute-positioned chevron
- "Access" column label (was "A11y")

---

## Recent Commit History (newest first)

```
b70f6b8 Enlarge Pharos logo with bigger text matching Lamps Plus logo size
b063c3e Enhance dark mode Pharos logo and increase logo size
d3d154a Enlarge logos and add white Pharos text for dark mode
504bf17 Rebrand to Lamps Plus Pharos with transparent lighthouse logo in header
4743bdf Polish UI: banner layout, score badges, dropdowns, scrollbars, column labels
563636b Add IIS Logs page with search, dashboard, and KQL query mode
0f28916 Add AI Analysis page with parallel Claude/OpenAI and follow-up conversations
e5554fe Add New Relic page with CWV, performance overview, APM, and custom queries
9a8cbdb Add Setup page with site/URL CRUD and trigger management
d54188f Add Test URLs page with batch testing, results table, and detail dialog
38bf97f Add Metrics page with historical chart and page comparison
c5b4922 Fix .gitignore lib/ rule ignoring frontend/src/lib/utils.ts
15dea9c Remove tsc from build script — fix Railway Nixpacks build
29367e7 Switch to node:20-alpine to bust Railway Docker cache
1ade427 Skip tsc in Docker build — use vite build directly
5d6055b Add .dockerignore and force clean Railway rebuild
6a03c01 Switch to multi-stage Dockerfile for Railway deployment
345384a Add React frontend scaffold with Dashboard page, served at /app/
f805b0e Modernize nav with logo, grouped sections, pill active state, design system tokens
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
- **Tables:** TanStack React Table with sortable columns, ScoreBadge components, formatters from `lib/utils.ts`
- **Markdown rendering:** `marked` npm package for AI analysis chat panels
- **shadcn/ui:** base-ui primitives (not Radix) — Dialog, Select, Tabs, Progress, Checkbox (with indeterminate), Switch, etc.
- **Tailwind CSS 4:** Design tokens in `index.css`, `cn()` utility for class merging

### Legacy Frontend Patterns
- **Inline JS in iislogs.html** — ~1200 lines of inline `<script>` (tab management, Azure config, KQL queries, column resize, profiles, etc.)
- **Shared JS in app.js** — dashboard functionality, site management, testing, charting, theme toggle, `showToast()`, `createEmptyState()`
- **CSS design system** — All colors use CSS custom property tokens defined in `:root`; light mode overrides reassign tokens in `body.light-mode`
- **localStorage for config** — all API credentials stored client-side, passed to server in request bodies

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

---

## Current State

**React frontend migration is complete.** All 7 pages are fully implemented at `/app/`. The legacy Flask/template site remains fully functional at `/`.

**App rebranded to "Lamps Plus Pharos"** with lighthouse logo in header (dark/light variants).

**Infrastructure:** Backend is 3-layer architecture with DI. Dockerfile uses multi-stage build (node:20-alpine → python:3.11-slim). Railway GitHub webhook integration is broken; deploy via `npx @railway/cli up -m "$(git log -1 --pretty=%s)"`.

**Known issues:**
- Railway GitHub webhook does not auto-create on repo connect — manual deploy required
- `.gitignore` root `lib/` rule was anchored to `/lib/` to avoid ignoring `frontend/src/lib/`

**Potential next steps:**
- Visual polish and customization of the React frontend (colors, layouts, additional chart types)
- Legacy frontend deprecation planning
- Automated testing
