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

## File Structure

```
├── app.py                    # Flask app, all routes (~1087 lines)
├── models.py                 # Database layer, SQLite/PostgreSQL (~405 lines)
├── pagespeed_service.py      # Google PageSpeed API client (~164 lines)
├── newrelic_service.py       # New Relic NerdGraph client (~510 lines)
├── azure_service.py          # Azure Log Analytics client (~150 lines)
├── ai_service.py             # Claude + OpenAI parallel analysis (~353 lines)
├── requirements.txt          # Python dependencies
├── Dockerfile                # Production container (python:3.11-slim)
├── Procfile                  # Gunicorn: 2 workers, 300s timeout
├── railway.json              # Railway config (Nixpacks, ON_FAILURE restart)
├── setup.sh                  # Local dev setup script
├── README.md                 # Project documentation
├── CLAUDE.md                 # This file — project context for Claude sessions
├── .gitignore
├── templates/
│   ├── index.html            # Dashboard home, CWV reference guide
│   ├── setup.html            # Site/URL management with collapsible drawers
│   ├── test.html             # PageSpeed testing with desktop/mobile toggle
│   ├── metrics.html          # Performance metrics charts
│   ├── newrelic.html         # New Relic integration page
│   ├── iislogs.html          # IIS logs + KQL queries + profiles (~1624 lines, heavy inline JS)
│   └── ai_analysis.html      # AI analysis with parallel Claude + OpenAI
├── static/
│   ├── css/style.css         # All styles, dark+light mode (~5390 lines)
│   ├── js/app.js             # Shared frontend JS (~1436 lines)
│   ├── favicon.ico
│   └── images/               # Logo variants (light/dark, LampsPlus)
```

---

## Database Schema (models.py)

Three tables: `sites`, `urls`, `test_results`

- **sites:** id, name (unique), created_at
- **urls:** id, site_id (FK), url, created_at — unique constraint on (site_id, url)
- **test_results:** id, url_id (FK), performance_score, accessibility_score, best_practices_score, seo_score, fcp, lcp, cls, inp, ttfb, tti, tbt, speed_index, total_byte_weight, raw_data (JSON), strategy (TEXT DEFAULT 'desktop'), tested_at

The `strategy` column was added via ALTER TABLE migration with `COALESCE(strategy, 'desktop')` for backward compatibility.

---

## API Routes (app.py)

**Pages:** `/`, `/setup`, `/test`, `/metrics`, `/newrelic`, `/iislogs`, `/ai-analysis`

**Site/URL CRUD:** `POST/GET /api/sites`, `POST/GET /api/sites/<id>/urls`, `PUT/DELETE /api/sites/<id>`, `DELETE /api/urls/<id>`

**Testing:** `POST /api/test-url`, `POST /api/test-url-async`, `POST /api/test-site/<id>`, `POST /api/test-all` — all accept `strategy` param (default: 'desktop')

**Results:** `GET /api/sites/<id>/latest-results`, `GET /api/urls/<id>/history`, `GET /api/test-details/<id>`, `GET /api/comparison`, `GET /api/comparison/urls` — all accept `strategy` query param

**New Relic:** `POST /api/newrelic/test-connection`, `POST /api/newrelic/core-web-vitals`, `POST /api/newrelic/performance-overview`, `POST /api/newrelic/apm-metrics`, `POST /api/newrelic/custom-query`

**Azure:** `POST /api/azure/test-connection`, `POST /api/azure/search-logs`, `POST /api/azure/dashboard-summary`, `POST /api/azure/execute-query`, `POST /api/azure/list-sites`

**AI:** `POST /api/ai/analyze` (parallel Claude + OpenAI), `POST /api/ai/follow-up`

**Scheduled:** Daily tests at 2 AM UTC via APScheduler, strategy hardcoded to 'desktop'.

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

- **No test suite** — no automated tests exist; all testing is manual
- **Inline JS in iislogs.html** — ~1200 lines of inline `<script>` (tab management, Azure config, KQL queries, column resize, profiles, etc.)
- **Shared JS in app.js** — dashboard functionality, site management, testing, charting, theme toggle, `showToast()`, `createEmptyState()`
- **CSS organization:** Major sections separated by `/* ==================== */` comment headers, light mode overrides grouped at end of each section
- **localStorage for config** — all API credentials stored client-side, passed to server in request bodies
- **`escapeHtml()` utility** — defined in iislogs.html inline script, used for all user-facing data rendering
- **Status code coloring:** `.status-2xx` (green), `.status-3xx` (blue), `.status-4xx` (yellow), `.status-5xx` (red)
- **Score coloring:** `.score-good` (90+, green), `.score-average` (50-89, yellow), `.score-poor` (0-49, red)
- **Inline SVG icons** — Nav icons and empty state icons use Feather-style stroke SVGs with `currentColor` for automatic theme inheritance
- **Toast notifications** — `showToast(message, type, duration)` in app.js; types: 'success', 'error', 'info', 'warning'
- **Empty states** — `createEmptyState({icon, title, description, actionText, actionHref})` in app.js; `EMPTY_ICONS` object has 10 reusable SVG constants
- **Commit messages:** Always include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

---

## CSS Key Locations (style.css ~5390 lines)

- **Side nav + nav icons:** ~17-95
- **Buttons:** ~206-330
- **Results table + zebra striping + sticky headers:** ~335-475
- **Modal:** ~477-756
- **Score badges:** ~758-797
- **Progress bar:** ~797-871
- **Empty state component:** ~1121-1200
- **Collapsible drawers:** ~2015-2055
- **Table fixed layout + overflow:** ~2480-2510
- **Resizable columns:** ~2550-2625
- **Loading indicator + spinner:** ~3160-3205
- **New Relic styles:** ~2280-3500
- **IIS Logs styles:** ~3808-4040
- **KQL Query Mode + profiles:** ~4042-4290
- **AI Analysis styles:** ~4574-5000
- **Toast notifications:** ~5262-5390

---

## Current State

All features are implemented and deployed. Recent work focused on **UI/UX polish**: Inter web font, card shadows, nav icons, toast notifications, zebra striping, sticky table headers, enhanced empty states with SVG icons and action buttons, and consistent loading spinners across all pages. No pending tasks or known bugs at time of writing.
