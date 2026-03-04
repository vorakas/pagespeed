# CLAUDE.md — PageSpeed Insights Monitor

## Context
This file documents the full project state so a new session can pick up where we left off. The project is a web performance monitoring dashboard for **LampsPlus**, deployed on **Railway** with automatic deployment from the `master` branch.

---

## Project Overview

**Purpose:** Monitor website performance via Google PageSpeed Insights, New Relic APM, Azure IIS Logs, and AI-powered analysis (Claude + OpenAI side-by-side).

**Tech Stack:**
- **Backend:** Python 3.11, Flask, Gunicorn, APScheduler
- **Database:** SQLite (local dev) / PostgreSQL (production via Railway)
- **Frontend:** Vanilla HTML/CSS/JS, Chart.js, marked.js, JSZip
- **External APIs:** Google PageSpeed Insights, New Relic NerdGraph (GraphQL), Azure Log Analytics (REST/KQL), Anthropic Claude, OpenAI
- **Deployment:** Railway (auto-deploys on push to `master`, Nixpacks builder)

**Repository:** `https://github.com/vorakas/pagespeed.git`

---

## Git Worktree Workflow

- **Main repo:** `C:\pagespeed-monitor`
- **Worktree:** `C:\Users\AdamB\.claude-worktrees\pagespeed-monitor\focused-kilby`
- **Development branch:** `focused-kilby`
- **Production branch:** `master`

**Deploy process:**
1. Make changes on `focused-kilby` branch in the worktree
2. Commit changes
3. `cd C:\pagespeed-monitor && git merge focused-kilby && git push`
4. Railway auto-deploys from `master`

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
├── Dockerfile                # Production container (python:3.11-slim)
├── Procfile                  # Gunicorn: 2 workers, 300s timeout
├── railway.json              # Railway config (Nixpacks, ON_FAILURE restart)
├── setup.sh                  # Local dev setup script
├── README.md                 # Project documentation
├── CLAUDE.md                 # This file — project context for Claude sessions
├── .gitignore
├── templates/
│   ├── index.html            # Dashboard home, worst performers, CWV reference guide
│   ├── setup.html            # Site/URL management + scheduled trigger configuration
│   ├── test.html             # PageSpeed testing with desktop/mobile toggle
│   ├── metrics.html          # Performance metrics charts
│   ├── newrelic.html         # New Relic integration page
│   ├── iislogs.html          # IIS logs + KQL queries + profiles (~1624 lines, heavy inline JS)
│   └── ai_analysis.html      # AI analysis with parallel Claude + OpenAI
├── static/
│   ├── css/style.css         # All styles, dark+light mode (~5830 lines)
│   ├── js/app.js             # Shared frontend JS (~1740 lines)
│   ├── favicon.ico
│   └── images/               # Logo variants (light/dark, LampsPlus)
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

**New Relic** (`routes/newrelic_api.py`): `POST /api/newrelic/test-connection`, `POST /api/newrelic/core-web-vitals`, `POST /api/newrelic/performance-overview`, `POST /api/newrelic/apm-metrics`, `POST /api/newrelic/custom-query`

**Azure** (`routes/azure_api.py`): `POST /api/azure/test-connection`, `POST /api/azure/search-logs`, `POST /api/azure/dashboard-summary`, `POST /api/azure/execute-query`, `POST /api/azure/list-sites`

**AI** (`routes/ai_api.py`): `POST /api/ai/analyze` (parallel Claude + OpenAI), `POST /api/ai/follow-up`

**Triggers** (`routes/triggers_api.py`): `GET /api/triggers`, `POST /api/triggers`, `PUT /api/triggers/<id>`, `DELETE /api/triggers/<id>`, `PATCH /api/triggers/<id>/toggle`, `GET /api/triggers/presets`

**Scheduled:** User-configurable triggers via APScheduler, managed on the Setup page. Supports preset schedules (daily, every 6h/12h, weekly) and custom cron expressions. Each trigger has its own strategy (desktop/mobile/both) and URL selection. Jobs are synced from the database on startup via `trigger_service.sync_all_jobs()`.

---

## Credential Storage

All API credentials are stored **client-side in localStorage** (not on the server):
- `nrConfig` — New Relic API key, Account ID, App Name
- `azureConfig` — Azure Tenant ID, Client ID, Client Secret, Workspace ID, Secret Expiration Date, Site
- `aiConfig` — Claude API Key/Model, OpenAI API Key/Model
- `kqlProfiles` — Per-user KQL query profiles with saved queries (migrated from legacy `kqlSavedQueries`)

Server-side env vars: `DATABASE_URL` (Railway auto-sets), `PORT`, `PAGESPEED_API_KEY` (optional).

---

## Key Features Implemented

### Dashboard (index.html, app.js)
- **Worst Performing URLs** — Top 5 lowest-scoring URLs **per site**, each rendered as a separate table with a site name heading. Uses 13 columns matching the Test URLs page
- Desktop/Mobile strategy toggle to switch between test strategies
- All column headers and values centered except URL (left-aligned)
- Detail button (📊) opens Lighthouse breakdown modal
- Empty state shown when no test results exist
- Auto-loads on page visit via `loadWorstPerformers()` function
- Repository uses `ROW_NUMBER() OVER (PARTITION BY site)` window function for efficient per-site limiting in a single query

### PageSpeed Testing (test.html, app.js)
- Desktop/Mobile strategy toggle (radio buttons)
- Batch "Test All URLs" with real-time progress bar
- Site-tabbed dashboard with sortable 13-column results table
- URL comparison (side-by-side)
- 30-day historical chart (Chart.js)
- Detailed modal with Lighthouse scores, metric weights, opportunities, failed audits

### IIS Logs (iislogs.html — most complex page)
- **Azure connection:** OAuth2 config with Test Connection, auto-save, secret expiration warning
- **Secret expiration:** Shows warning when <= 30 days; shows expired message when <= 0 days
- **Test Connection message:** Persists on screen with dismiss × button (fixed timer conflict with saveAzureConfig)
- **Search/Filter:** Date range, URL path, status code (2xx/3xx/4xx/5xx), limit selector
- **Results table:** 8 columns (Time 6%, Method 3%, URL Path 24%, Query String 40%, Status 5%, Time Taken 7%, Client IP 7%, Site 8%)
  - `table-layout: fixed` with percentage widths
  - All `td` elements default to `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`
  - Query String uses `wrap-cell` class (word-break, white-space: normal, max-width: 0)
  - Time, Client IP, Site use `truncate-cell` with `title` attributes for hover
- **Manual column resizing:** `initTableResize(table)` generic function — converts % to px on first drag, compensates adjacent column, min 40px, double-click to reset defaults
- **KQL Query Mode:**
  - Tabbed interface (in-memory, not persisted across page reload)
  - 5 preset queries + save/load/delete custom queries (localStorage)
  - **KQL Profiles:** Per-user named profiles with private saved queries and share/copy between profiles
  - Table View + Raw JSON View toggle
  - CSV/ZIP export (JSZip)
  - Tab bar positioned inside `.kql-editor`, directly above `<textarea>`
  - Background query support (results stored silently if tab switched during query)
  - KQL results table also has manual column resizing (same `initTableResize` function)
- **Dashboard summary:** Stats cards, response time breakdown (P50/P90/P99/Max), top pages, status distribution

### New Relic (newrelic.html)
- Core Web Vitals (LCP, CLS, Page Load, Backend, Frontend, TTFB, DOM Processing) with percentiles (p50, p75, p90)
- Performance Overview (response time, throughput, error rate, Apdex) with period comparison
- APM Metrics (transactions, database ops, external calls, errors)
- Custom NerdGraph queries

### AI Analysis (ai_analysis.html)
- Parallel Claude + OpenAI analysis side-by-side
- Auto-gathers New Relic CWV + Azure IIS logs for selected URL
- Multi-turn follow-up conversations with context preservation
- Token usage tracking (input/output per provider)
- Experimental disclaimer banner
- Site availability notice
- Markdown rendering (marked.js)

### Scheduled Test Triggers (setup.html, app.js)
- **User-configurable triggers** — Replace hardcoded daily 2 AM test with multiple named triggers on the Setup page
- **Schedule presets** — Daily at 2 AM UTC, Daily at 6 AM UTC, Every 6 hours, Every 12 hours, Weekly on Monday at 2 AM UTC
- **Custom cron expressions** — 5-field cron format (minute hour day month weekday) with collapsible syntax reference
- **Per-trigger strategy** — Desktop, Mobile, or Both (runs two passes with delay between strategies)
- **URL selection** — Checkbox grid grouped by site with select-all per site and indeterminate state
- **Enable/disable toggle** — CSS-only toggle switch per trigger card; adds/removes APScheduler job in real-time
- **Trigger cards** — Display name, schedule description, strategy, URL count, toggle, edit/delete buttons
- **Startup sync** — `TriggerService.sync_all_jobs()` restores APScheduler jobs for all enabled triggers on app start
- **Cascade deletes** — Deleting a URL or site cascades to `trigger_urls` junction table
- **Rate limiting** — Configurable delay between tests via `REQUEST_DELAY_SECONDS`

### UI/UX
- Dark mode (default) + Light mode with localStorage persistence
- **Inter web font** with system font fallback stack (`@import` from Google Fonts)
- **Nav icons** — Inline SVG Feather-style icons on all 7 navigation links (stroke: currentColor for theme inheritance)
- **Card shadows** — Subtle resting shadows on `.setup-card`, `.site-urls-card`, `.stat-card`, `.browser-metric-card`, `.cwv-metric-card`, `.config-card`, `.infra-card`
- **Toast notifications** — `showToast(message, type, duration)` replaces all `alert()` calls; 4 types (success/error/info/warning) with auto-dismiss
- **Zebra striping** — `tbody tr:nth-child(even)` alternating backgrounds on `.results-table` and `.reference-table`
- **Sticky table headers** — `position: sticky; top: 0; z-index: 2` on all table headers
- **Enhanced empty states** — `createEmptyState()` helper + `EMPTY_ICONS` SVG constants; icon, title, description, and action button
- **Consistent loading spinners** — `.loading-indicator` with `.loading-spinner` across all data-loading sections
- **Collapsible site drawers** — URL lists in Setup page cards expand/collapse with chevron toggle
- Side navigation (7 pages) with active state indicator
- Responsive design with media queries
- Theme toggle button in header

---

## Recent Commit History (newest first)

```
PENDING  Add scheduled test triggers with user-configurable schedules on Setup page
98ad636 Center column alignment on results tables across Dashboard and Test URLs
f6174f3 Show worst performing URLs per site with centered columns on Dashboard
0c0f673 Add worst performing URLs section to Dashboard page
83aa2cd Refactor backend into 3-layer architecture with dependency injection
43b127b Add enhanced empty states with icons and consistent loading spinners
eb6c84a Add zebra striping and sticky table headers for improved readability
6ee3b70 Add visual polish: Inter font, card shadows, nav icons, toast notifications
fdc5d18 Tighten spacing between URLs in site cards on Setup page
7b57c7a Add collapsible drawers to site cards on Setup page
babeffe Change secondary button color from pink to blue
d5f4903 Add KQL query profiles with per-user saved queries and sharing
bd67173 Add CLAUDE.md with comprehensive project context documentation
25d425a Add manual column resizing to KQL results table
f50abc1 Improve column resize to allow manual width adjustment in IIS Logs table
bf9bbb0 Drastically reduce column widths to fix query string overflow in IIS Logs table
4d24f4c Fix query string column overflowing into status column in IIS Logs
aed8d8c Move KQL query tabs directly above the textarea
2ec39dd Add tabbed query interface to KQL Query Mode section
75d4b1d Fix secret expiration showing 'expires in 0 days' on expiry day
92c6603 Fix Test Connection message disappearing after 3 seconds on IIS Logs page
94edefa Switch default PageSpeed strategy to desktop and add mobile toggle
8a469c4 Add site availability notice to AI Analysis disclaimer
a9fe904 Use percentage column widths to fill available table space
fd9fe5d Add resizable columns to IIS Logs search results table
e68ee9c Add hover popup for truncated cells + exact URL match on IIS Logs page
a61770d Truncate long query strings and URL paths in IIS logs table
58e7fca Use exact URL match for IIS logs in AI analysis
9b19096 Remove report title header from Claude + show full data in preview
5ca8109 Fix markdown list rendering in AI analysis results
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

### Frontend Patterns
- **Inline JS in iislogs.html** — ~1200 lines of inline `<script>` (tab management, Azure config, KQL queries, column resize, profiles, etc.)
- **Shared JS in app.js** — dashboard functionality, site management, testing, charting, theme toggle, `showToast()`, `createEmptyState()`
- **CSS organization:** Major sections separated by `/* ==================== */` comment headers, light mode overrides grouped at end of each section
- **localStorage for config** — all API credentials stored client-side, passed to server in request bodies
- **`escapeHtml()` utility** — defined in iislogs.html inline script, used for all user-facing data rendering

### UI Conventions
- **Status code coloring:** `.status-2xx` (green), `.status-3xx` (blue), `.status-4xx` (yellow), `.status-5xx` (red)
- **Score coloring:** `.score-good` (90+, green), `.score-average` (50-89, yellow), `.score-poor` (0-49, red)
- **Inline SVG icons** — Nav icons and empty state icons use Feather-style stroke SVGs with `currentColor` for automatic theme inheritance
- **Toast notifications** — `showToast(message, type, duration)` in app.js; types: 'success', 'error', 'info', 'warning'
- **Empty states** — `createEmptyState({icon, title, description, actionText, actionHref})` in app.js; `EMPTY_ICONS` object has 10 reusable SVG constants

### Workflow
- **Commit messages:** Always include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

---

## CSS Key Locations (style.css ~5830 lines)

- **Side nav + nav icons:** ~17-95
- **Buttons:** ~206-330
- **Results table + zebra striping + sticky headers + centered columns:** ~335-475
- **Modal:** ~477-756
- **Score badges:** ~758-797
- **Progress bar:** ~797-871
- **Empty state component:** ~1121-1200
- **Worst performers section:** ~1216-1248
- **Scheduled triggers section:** ~2092-2490 (form, cards, toggle switch, URL checkboxes, cron reference)
- **Collapsible drawers:** ~2050-2090
- **Table fixed layout + overflow:** ~2880-2910
- **Resizable columns:** ~2950-3025
- **Loading indicator + spinner:** ~3560-3605
- **New Relic styles:** ~2680-3900
- **IIS Logs styles:** ~4208-4440
- **KQL Query Mode + profiles:** ~4442-4690
- **AI Analysis styles:** ~4974-5400
- **Toast notifications:** ~5662-5790

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

All features are implemented and deployed. The backend uses a **3-layer architecture** (Routes → Services → Data Access) with dependency injection, custom exceptions, domain enums, and centralized configuration. The Dashboard includes a "Worst Performing URLs" section showing the 5 lowest-scoring URLs per site with a desktop/mobile strategy toggle. The Setup page now includes a "Scheduled Test Triggers" section allowing users to create multiple named triggers with preset/custom cron schedules, per-trigger strategy selection (Desktop/Mobile/Both), and URL checkboxes grouped by site. Triggers replace the old hardcoded daily 2 AM test job, with APScheduler jobs synced from the database on startup. No pending tasks or known bugs at time of writing.
