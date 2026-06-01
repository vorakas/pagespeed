# Frontend Reference — Pharos React App

Detail moved out of `CLAUDE.md`. The React frontend is the **sole active frontend**, served at `/`. All development happens in `frontend/src/`. Do NOT modify legacy `templates/`, `static/css/`, or `static/js/` (archived at `/legacy/`, reference only).

## Tech Stack
React 19, TypeScript, Vite 8, Tailwind CSS 4, shadcn/ui (base-ui primitives, **not** Radix), Recharts, TanStack React Table, react-day-picker, date-fns, marked.js, SheetJS (xlsx).

## Aurora Register (production shell)

```
frontend/src/
├── components/layout/
│   ├── AppLayout.tsx       # production shell — beacon-shell aurora
│   ├── AppSidebar.tsx      # left rail, hash-aware active matching + theme toggle
│   └── PageHeader.tsx      # sticky title strip with optional actions slot
├── styles/
│   └── aurora.css          # single CSS source: tokens + chrome + page primitives + Launch Cluster (~2,600 lines)
├── lib/
│   ├── utils.ts            # cn(), formatters, scoring helpers, cron description, escapeHtml
│   └── dashboard-links.ts  # path builders for migration cluster (project/workstream/launch)
├── services/
│   ├── api.ts              # Typed API client (30+ endpoints, snake_case conversion, screenshot proxy)
│   └── spreadsheetExport.ts # XLSX generation (SheetJS) — regression tracking spreadsheet
├── context/
│   ├── ThemeContext.tsx    # Dark/light theme with localStorage
│   └── SitesContext.tsx    # Sites + URLs loaded on mount
├── hooks/                  # use-api, use-sites, use-theme, use-local-config
└── pages/                  # one *.tsx per route, each renders <PageHeader /> + body
```

**CSS class naming:**
- `.beacon-*` family (`.beacon-shell`, `.beacon-sidebar`, `.beacon-header`, `.beacon-label`) — the underlying register name, intentionally kept after the `Beacon*` → `AppSidebar`/`PageHeader` component rename. Components are mount points; the register is the visual spec.
- `.aurora-*` family (`.aurora-panel`, `.aurora-input`, `.aurora-num`, `.aurora-score`, `.aurora-tabs-list`, `.aurora-radio-pill`) — page-primitive names shared by every consumer page.

All pages render under `<div class="beacon beacon-shell dark aurora">` + `<AppSidebar>` + `<main class="beacon-main">`. Production renders the Aurora register at every URL; the parallel `/prototype/<page>/aurora` URL space was retired (catch-all redirects orphans to `/`).

## React Patterns
- **Component organization:** feature-based directories under `components/` (dashboard, test-urls, setup, newrelic, ai-analysis, iis-logs, builds).
- **State:** SitesContext for global site data; `useLocalConfig` hook for localStorage-persisted configs (NR, Azure, AI).
- **API client:** `services/api.ts` with `nrBody()` and `azBody()` helpers converting camelCase config → snake_case for backend.
- **Tables:** TanStack React Table, sortable columns, ScoreBadge components. Metric columns use `width: 1px` + `whitespace-nowrap` shrink-wrap trick; URL column absorbs remaining space (`width: 100%`).
- **Markdown:** `marked` npm package for AI chat panels.
- **shadcn/ui:** base-ui primitives — Dialog, Select, Tabs, Progress, Checkbox (indeterminate), Switch, Calendar, Popover, DateTimePicker.

---

## Header & Branding
- **Lamps Plus Pharos** — Lamps Plus logo + Pharos lighthouse logo side-by-side in top banner.
- Pharos logo has light (dark navy text) and dark (white text + soft white glow) variants.
- Logo sizes: Lamps Plus `h-10`, Pharos `h-24`, separated by a vertical divider.
- Theme toggle (sun/moon) in sidebar footer; page title + description in PageHeader.

## Pages

**Dashboard (`/`)** — Worst performers per site (sortable TanStack tables), CWV reference guide, Lighthouse explanation. Desktop/Mobile strategy toggle.

**Metrics (`/metrics`)** — Historical performance area chart (Recharts AreaChart, natural curve, gradient fills, shadcn dark tooltip). Date range dropdown (7/14/30/60/90 days, default 30), multiple tests per day averaged. Page Comparison (side-by-side URL with Lighthouse scores, CWV, size, diff summary).

**Test URLs (`/test`)** — Desktop/Mobile toggle, "Test All URLs" batch testing with progress panel, site tabs, sortable 13-column results table, retest/delete per URL, performance detail dialog (score breakdown, metric weights, opportunities, failed audits).

**Setup (`/setup`)** — Add Site/URL forms, collapsible site drawers with URL lists, delete site/URL. Trigger create/edit/delete with preset or custom cron schedules, strategy selection. URL checkbox grid with per-site select-all + indeterminate state. Trigger cards with enable/disable switch, run-now, last-run status.

**New Relic (`/newrelic`)** — Config panel (localStorage + connection test). Core Web Vitals with percentile cards (P50/P75/P90) + threshold indicators. Performance overview with period comparison (response time, throughput, error rate, Apdex). APM metrics with tabbed tables (transactions, database, external, errors). Custom NRQL query runner.

**AI Analysis (`/ai-analysis`)** — Config panel for Claude/OpenAI keys/models. Parallel analysis with side-by-side markdown (marked.js). Multi-turn follow-up with context preservation. Cumulative token usage tracking, data source status badges. Experimental disclaimer.

**IIS Logs (`/iislogs`)** — Azure config with secret expiration warnings + connection test. Log search with themed calendar date-time picker (react-day-picker + hour/minute/AM-PM), URL/status filters, results table with status coloring. Dashboard summary (stat cards, P50/P90/P99/Max percentiles, top pages, status distribution). KQL query mode with 5 presets, saved query management, per-user profiles. Table/JSON toggle, CSV export, site selector.

**Automation Builds (`/builds`)** — Azure DevOps pipeline monitoring (PAT auth, `devOpsConfig` in localStorage).
- **Build Grid:** WarmUp card (24rem fixed) + 4 platform rows (Windows/Mac/iPhone/Android) each Functional→Visual chain.
- **Orchestrator Panel (Run All Builds):** checkboxes for build types + platforms, branch dropdown (from Azure DevOps Git repos), environment selector (TargetInstance A–I).
- **Per-card overrides:** collapsible branch/env override via `<details>`, CSS grid to prevent distortion from long branch names.
- **Results side panel:** sticky panel right of grid, shows failed/skipped test details. `flex-1` fills remaining viewport.
- **Background prefetching:** failed then skipped tests prefetched sequentially after load; panel renders instantly from cache. `prefetchingTests` state shows spinner in SpreadsheetWidget.
- **Failure screenshots:** fetched via `_apis/test/runs/{runId}/results/{resultId}/attachments` (preview API `7.2-preview.1`). Thumbnails in expandable details accordion; click opens full-size lightbox Dialog. Prefetched via `useScreenshotPrefetch` when failed test data loads. Backend proxies downloads through `POST /api/devops/test-screenshot/...` for PAT auth.
- **Visual Target filtering:** tests with "Baseline visual test failed and comparison test shouldn't be executed" filtered out client-side (Results panel + spreadsheet export).
- **Skipped tests:** `outcome == "NotExecuted"` server-side filter (matches xUnit `[Fact(Skip=...)]`).
- **Effective status:** accounts for re-run passes (orange "Partial" → green "Passed (Re-runs)").
- **Polling:** 10s interval while any build is running.
- **Pipeline mapping:** collapsible advanced section to map role keys → pipeline definition IDs.
- **Spreadsheet Export:** "+ Sheet" on each completed build card collects failed/skipped tests. SpreadsheetWidget (CSS grid next to WarmUp, height-locked) shows breakdown table with frozen header/totals. User enters release name (tab name), downloads formatted `.xlsx` via SheetJS (browser-side). Matches Google Sheets tracker format: grey merged section headers (`#D9D9D9`), hyperlinked TC URLs (`lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/LP-{testId}`), Automation Execution Status (Skipped/Failed), columns E–I left blank for manual QA. Section order: Functional Skipped ×4, Visual Skipped ×4, Warmup Failures, Functional Failed ×4, Visual Failed ×4, Unresolved ×4 (Applitools placeholder), Manual Execution.
  - **Known issue (WIP):** skipped test counts need validation across all build types; spreadsheet data accuracy being refined.

## UI Conventions
- **Status code coloring:** 2xx green, 3xx blue/primary, 4xx yellow/average, 5xx red/poor.
- **Score coloring:** `score-good` (90+, green), `score-average` (50–89, orange), `score-poor` (0–49, red) — ScoreBadge + threshold indicators.
- **Lucide icons** — 20px in sidebar nav, smaller in buttons/actions.
- **Toasts:** Sonner (React).
- **Empty states:** EmptyState component (icon, title, description, optional action).
- **Score badges:** fixed-width (`min-w-9`).
- **Themed scrollbars:** thin, rounded, theme-aware.
- **Date-time picker:** custom `DateTimePicker` (`ui/date-time-picker.tsx`) — Calendar popover + chevron hour/minute/AM-PM controls, replacing native `datetime-local`.

## Vault Workstream Orchestration Contract
The dashboard derives operational workstream panels from raw Jira/Asana task data at request time. The external vault orchestrator treats `wiki/ws-*.md` as the relationship/narrative layer, not the source of dashboard counts.

**Orchestrator must update:** task wikilinks in each `wiki/ws-*.md` (every in-scope task referenced, out-of-scope removed), `### Key Epics` entries with parseable epic IDs/wikilinks, workstream pages when scope changes, curated narrative context (overview, scope, dependencies, decisions, cross-references).

**Orchestrator must NOT recalculate:** Progress counts, Active Items buckets, Developer Workload, Burndown & Velocity, Blockers, Key Risks, Hero Last Update — those are live overlays from raw task files.

`GET /api/obsidian/pending-orchestration` includes an `orchestrationContract` object with the same machine-readable rules. Orchestrator commits must use a subject beginning `[orchestrate]` so the dashboard detects the latest orchestration push.
