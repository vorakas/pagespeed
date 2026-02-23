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
├── models.py                 # Database layer, SQLite/PostgreSQL (~406 lines)
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
│   ├── setup.html            # Site/URL management
│   ├── test.html             # PageSpeed testing with desktop/mobile toggle
│   ├── metrics.html          # Performance metrics charts
│   ├── newrelic.html         # New Relic integration page
│   ├── iislogs.html          # IIS logs + KQL queries (~1337 lines, heavy inline JS)
│   └── ai_analysis.html      # AI analysis with parallel Claude + OpenAI
├── static/
│   ├── css/style.css         # All styles, dark+light mode (~4700 lines)
│   ├── js/app.js             # Shared frontend JS (~1320 lines)
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
- Side navigation (7 pages)
- Responsive design with media queries
- Theme toggle button in header

---

## Recent Commit History (newest first)

```
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
e1a9134 Remove app-wide NR data from AI analysis prompt
0fbe2f9 Restrict AI analysis IIS data to the specific URL only
d962eb6 Fix LCP and CLS queries returning empty results
9a2f713 Fix follow-up input layout: textarea crushed and button oversized
db295a0 Update README with comprehensive project documentation
64eb040 Add follow-up question support to AI Analysis page
c016c5c Add experimental AI disclaimer to AI Analysis page
2a44577 Improve AI Analysis input layout and rename URL field
a472ead Add IIS site selector to AI Analysis page
a7e1ad8 Add AI Analysis page with parallel Claude and OpenAI integration
a49e09a Add CSV and ZIP export for KQL query results
298e10d Change default search limit from 100 to 50
c57a5d6 Add IIS site selector dropdown for filtering logs by site name
```

---

## Known Patterns & Conventions

- **No test suite** — no automated tests exist; all testing is manual
- **Inline JS in iislogs.html** — ~1000 lines of inline `<script>` (tab management, Azure config, KQL queries, column resize, etc.)
- **Shared JS in app.js** — dashboard functionality, site management, testing, charting, theme toggle
- **CSS organization:** Major sections separated by comment headers, light mode overrides grouped at end of each section
- **localStorage for config** — all API credentials stored client-side, passed to server in request bodies
- **`escapeHtml()` utility** — defined in iislogs.html inline script, used for all user-facing data rendering
- **Status code coloring:** `.status-2xx` (green), `.status-3xx` (blue), `.status-4xx` (yellow), `.status-5xx` (red)
- **Score coloring:** `.score-good` (90+, green), `.score-average` (50-89, yellow), `.score-poor` (0-49, red)
- **Commit messages:** Always include `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`

---

## CSS Key Locations (style.css ~4700 lines)

- **Side nav:** ~17-72
- **Buttons:** ~206-330
- **Results table:** ~335-458
- **Modal:** ~460-739
- **Score badges:** ~741-780
- **Progress bar:** ~780-854
- **Table fixed layout + overflow:** ~2404-2434
- **Resizable columns:** ~2474-2550
- **New Relic styles:** ~2201-3406
- **IIS Logs styles:** ~3575-3809
- **KQL Query Mode:** ~3809-4059
- **AI Analysis styles:** ~4147-4702

---

## Current State

All features are implemented and deployed. The most recent work focused on **IIS Logs table usability** — column widths, overflow handling, manual column resizing for both the IIS search results table and the KQL results table. No pending tasks or known bugs at time of writing.
