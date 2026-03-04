# PageSpeed Insights Monitor

A comprehensive web performance monitoring dashboard for LampsPlus, built with Python/Flask and deployed on Railway. Integrates Google PageSpeed Insights, New Relic APM, Azure Log Analytics (IIS logs), and AI-powered analysis via Claude and OpenAI.

## Features

### Dashboard & Testing
- **Worst Performing URLs** -- Dashboard shows the 5 lowest-scoring URLs per site with desktop/mobile toggle
- **Site/URL Management** -- Add sites and URLs to monitor, with collapsible drawer cards
- **PageSpeed Testing** -- Run Google PageSpeed Insights tests (mobile & desktop) on demand or via user-configurable scheduled triggers
- **Core Web Vitals Reference** -- Built-in reference guide for LCP, FID, CLS thresholds
- **Historical Performance** -- Track Lighthouse scores and metrics over time with comparison charts
- **Dark/Light Mode** -- Full theme support across all pages

### New Relic Integration
- Connect to New Relic via NerdGraph GraphQL API
- Core Web Vitals monitoring (LCP, FID, CLS, INP, TTFB)
- APM metrics (transactions, database ops, external calls, errors)
- Performance overview with current vs. previous period comparison
- Custom NRQL query execution

### IIS Logs (Azure Log Analytics)
- Connect to Azure Log Analytics workspace via OAuth2
- Search and filter W3CIISLog entries by date, status code, URL, and method
- Dashboard summary with request counts, error rates, and response times
- Status code distribution and top pages analysis
- **KQL Query Mode** -- Write custom KQL queries with presets, saved queries, and syntax reference
- **KQL Profiles** -- Per-user query profiles with sharing/copying between profiles
- **Site selector** -- Filter logs by IIS site name
- **CSV/ZIP export** -- Download KQL query results with file size estimation

### AI Analysis
- Enter a URL path and the system automatically gathers relevant New Relic and IIS log data
- Sends collected performance data to **Claude** and **OpenAI** APIs in parallel
- Side-by-side comparison of AI analyses with markdown rendering
- **Follow-up questions** -- Continue the conversation with full context preservation
- Cumulative token usage tracking across conversation turns
- Configurable models (Claude Sonnet 4 / Opus 4, GPT-4o / GPT-4o Mini)
- Experimental feature disclaimer

### Scheduled Test Triggers
- **Multiple named triggers** -- Create and manage automated test schedules on the Setup page
- **Schedule presets** -- Daily, every 6h/12h, weekly options plus custom 5-field cron expressions
- **Per-trigger strategy** -- Choose Desktop, Mobile, or Both for each trigger
- **URL selection** -- Checkbox grid grouped by site with select-all capability
- **Enable/disable toggle** -- Toggle triggers on/off with real-time scheduler sync
- **Collapsible cron reference** -- Built-in cron syntax guide for custom schedules

### UI/UX Polish
- **Inter web font** with system font fallback stack
- **Nav icons** -- Inline SVG Feather-style icons on all navigation links
- **Card shadows** -- Subtle depth on all card components (dark + light mode)
- **Toast notifications** -- Non-blocking slide-in toasts replacing browser `alert()` dialogs
- **Zebra striping** -- Alternating row backgrounds on all data tables
- **Sticky table headers** -- Headers remain visible when scrolling long tables
- **Enhanced empty states** -- SVG icons, descriptive text, and action buttons when no data exists
- **Consistent loading spinners** -- Uniform spinner indicators across all pages
- **Collapsible site drawers** -- URL lists collapse/expand on the Setup page

## Tech Stack

- **Backend:** Python 3.11, Flask, Gunicorn
- **Database:** PostgreSQL (production on Railway), SQLite (local development)
- **Frontend:** Vanilla HTML/CSS/JS, Chart.js, marked.js (markdown), JSZip (exports)
- **APIs:** Google PageSpeed Insights, New Relic NerdGraph, Azure Log Analytics REST API, Anthropic Claude, OpenAI
- **Deployment:** Railway (Docker-based with Nixpacks)
- **Scheduling:** APScheduler for user-configurable automated tests (preset + custom cron schedules)

## Project Structure

The backend uses a **3-layer architecture** with dependency injection:

**Routes** (Flask Blueprints) → **Services** (Business Logic) → **Data Access** (Repositories)

```
pagespeed-monitor/
├── app.py                  # Application factory, DI wiring, error handlers
├── config.py               # Centralized configuration constants
├── enums.py                # Domain enums (Strategy, PerformanceStatus, ScoreRating)
├── exceptions.py           # Custom exception hierarchy
├── data_access/            # Repository pattern — all SQL lives here
│   ├── connection.py       # DB connection manager (PostgreSQL/SQLite)
│   ├── site_repository.py  # Sites table CRUD
│   ├── url_repository.py   # URLs table CRUD
│   ├── trigger_repository.py  # Trigger + trigger_urls CRUD
│   └── test_result_repository.py  # Test results queries
├── services/               # Business logic & external API clients
│   ├── site_service.py     # Site/URL orchestration + validation
│   ├── testing_service.py  # PageSpeed test workflows
│   ├── trigger_service.py  # Trigger CRUD + APScheduler job sync
│   ├── pagespeed_client.py # Google PageSpeed Insights API client
│   ├── newrelic_client.py  # New Relic NerdGraph API client
│   ├── azure_client.py     # Azure Log Analytics API client
│   ├── ai_base.py          # Abstract base class for AI providers
│   ├── ai_claude.py        # Claude API client
│   ├── ai_openai.py        # OpenAI API client
│   ├── ai_orchestrator.py  # Parallel AI analysis orchestrator
│   └── validation.py       # Shared validation helpers
├── routes/                 # Flask Blueprints (thin HTTP layer)
│   ├── pages.py            # Page rendering routes
│   ├── sites_api.py        # Site/URL CRUD API
│   ├── testing_api.py      # PageSpeed testing API
│   ├── triggers_api.py     # Trigger CRUD + toggle + presets API
│   ├── metrics_api.py      # Test results query API
│   ├── newrelic_api.py     # New Relic proxy API
│   ├── azure_api.py        # Azure Log Analytics proxy API
│   └── ai_api.py           # AI analysis API
├── templates/
│   ├── index.html          # Dashboard home (worst performers, CWV reference)
│   ├── setup.html          # Site/URL config + scheduled triggers
│   ├── test.html           # URL testing interface
│   ├── metrics.html        # Performance metrics view
│   ├── newrelic.html       # New Relic integration
│   ├── iislogs.html        # IIS logs & KQL queries
│   └── ai_analysis.html    # AI-powered analysis
└── static/
    ├── css/style.css       # All styles (dark + light mode, ~5830 lines)
    ├── js/app.js           # Shared JavaScript (~1740 lines)
    ├── favicon.ico
    └── images/             # Logos and icons
```

## Configuration

All API credentials are stored client-side in localStorage and sent with each request. No server-side credential storage.

| Config Key | Page | Contents |
|---|---|---|
| `nrConfig` | New Relic | API key, Account ID, App Name |
| `azureConfig` | IIS Logs | Tenant ID, Client ID, Client Secret, Workspace ID, Selected Site |
| `aiConfig` | AI Analysis | Claude API Key/Model, OpenAI API Key/Model |
| `kqlProfiles` | IIS Logs | Per-user KQL query profiles with saved queries |

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run locally (uses SQLite)
python app.py

# Visit http://localhost:5000
```

## Deployment (Railway)

The app deploys automatically from GitHub to Railway on push to `master`. Railway uses the Dockerfile for builds.

```bash
# Manual redeploy via CLI
npx @railway/cli redeploy --yes

# Check deployment status
npx @railway/cli deployment list

# View logs
npx @railway/cli logs --lines 50
```

### Environment Variables (Railway)

- `DATABASE_URL` -- PostgreSQL connection string (set automatically by Railway)
- `PORT` -- Server port (set automatically by Railway)

## API Endpoints

### Pages
| Route | Description |
|---|---|
| `/` | Dashboard home |
| `/setup` | Site/URL configuration |
| `/test` | Run PageSpeed tests |
| `/metrics` | View performance metrics |
| `/newrelic` | New Relic integration |
| `/iislogs` | IIS log analysis |
| `/ai-analysis` | AI-powered analysis |

### Key API Routes
| Method | Route | Description |
|---|---|---|
| GET | `/api/worst-performing` | Get worst performing URLs across all sites |
| GET | `/api/sites` | List all sites |
| POST | `/api/sites` | Add a new site |
| POST | `/api/test-url` | Test a single URL |
| POST | `/api/test-all` | Test all URLs |
| GET | `/api/triggers` | List all scheduled triggers |
| POST | `/api/triggers` | Create a new trigger |
| PUT | `/api/triggers/<id>` | Update a trigger |
| DELETE | `/api/triggers/<id>` | Delete a trigger |
| PATCH | `/api/triggers/<id>/toggle` | Enable/disable a trigger |
| GET | `/api/triggers/presets` | Get available schedule presets |
| POST | `/api/newrelic/test-connection` | Test New Relic API connection |
| POST | `/api/newrelic/core-web-vitals` | Fetch Core Web Vitals |
| POST | `/api/newrelic/apm-metrics` | Fetch APM metrics |
| POST | `/api/azure/test-connection` | Test Azure connection |
| POST | `/api/azure/search` | Search IIS logs |
| POST | `/api/azure/dashboard-summary` | Get IIS dashboard data |
| POST | `/api/azure/execute-query` | Execute custom KQL |
| POST | `/api/azure/list-sites` | List available IIS sites |
| POST | `/api/ai/analyze` | Run AI performance analysis |
| POST | `/api/ai/follow-up` | Send follow-up question |
