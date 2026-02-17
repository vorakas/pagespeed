# PageSpeed Insights Monitor

A comprehensive web performance monitoring dashboard for LampsPlus, built with Python/Flask and deployed on Railway. Integrates Google PageSpeed Insights, New Relic APM, Azure Log Analytics (IIS logs), and AI-powered analysis via Claude and OpenAI.

## Features

### Dashboard & Testing
- **Site/URL Management** -- Add sites and URLs to monitor
- **PageSpeed Testing** -- Run Google PageSpeed Insights tests (mobile & desktop) on demand or via daily scheduled jobs
- **Core Web Vitals Reference** -- Built-in reference guide for LCP, FID, CLS thresholds
- **Historical Performance** -- Track Lighthouse scores and metrics over time with comparison charts
- **Dark/Light Mode** -- Full theme support across all pages

### New Relic Integration
- Connect to New Relic via NerdGraph GraphQL API
- Core Web Vitals monitoring (LCP, FID, CLS, INP, TTFB)
- APM metrics (transactions, database, external calls, errors)
- Performance overview with current vs. previous period comparison
- Custom NRQL query execution

### IIS Logs (Azure Log Analytics)
- Connect to Azure Log Analytics workspace via OAuth2
- Search and filter W3CIISLog entries by date, status code, URL, and method
- Dashboard summary with request counts, error rates, and response times
- Status code distribution and top pages analysis
- **KQL Query Mode** -- Write custom KQL queries with presets, saved queries, and syntax reference
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

## Tech Stack

- **Backend:** Python 3.11, Flask, Gunicorn
- **Database:** PostgreSQL (production on Railway), SQLite (local development)
- **Frontend:** Vanilla HTML/CSS/JS, marked.js (markdown), JSZip (exports)
- **APIs:** Google PageSpeed Insights, New Relic NerdGraph, Azure Log Analytics REST API, Anthropic Claude, OpenAI
- **Deployment:** Railway (Docker-based with Nixpacks)
- **Scheduling:** APScheduler for daily automated tests

## Project Structure

```
pagespeed-monitor/
├── app.py                  # Flask app, routes, API endpoints
├── models.py               # Database abstraction (SQLite/PostgreSQL)
├── pagespeed_service.py    # Google PageSpeed Insights API client
├── newrelic_service.py     # New Relic NerdGraph API client
├── azure_service.py        # Azure Log Analytics API client
├── ai_service.py           # Claude & OpenAI service classes
├── requirements.txt        # Python dependencies
├── Dockerfile              # Container configuration
├── Procfile                # Gunicorn process definition
├── railway.json            # Railway deployment config
├── templates/
│   ├── index.html          # Dashboard home
│   ├── setup.html          # Site/URL configuration
│   ├── test.html           # URL testing interface
│   ├── metrics.html        # Performance metrics view
│   ├── newrelic.html       # New Relic integration
│   ├── iislogs.html        # IIS logs & KQL queries
│   └── ai_analysis.html    # AI-powered analysis
└── static/
    ├── css/style.css       # All styles (dark + light mode)
    ├── js/app.js           # Shared JavaScript
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
| GET | `/api/sites` | List all sites |
| POST | `/api/sites` | Add a new site |
| POST | `/api/test-url` | Test a single URL |
| POST | `/api/test-all` | Test all URLs |
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
