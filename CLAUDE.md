# CLAUDE.md — Pharos Operations Hub

Internal operations hub for **Lamps Plus**, branded **Pharos — Operations Hub**. Deployed on **Railway**, manual deploy from `master`. Started as a PageSpeed-only dashboard, grown to cover multiple operations concerns.

## Detail docs (read on demand — not auto-loaded)
- **[docs/architecture.md](docs/architecture.md)** — backend 3-layer architecture, full file structure, DB schema, API routes, credential storage.
- **[docs/frontend.md](docs/frontend.md)** — React/Aurora frontend, per-page features, UI conventions, vault orchestration contract.
- **[docs/deploy.md](docs/deploy.md)** — Railway deploy steps, IDs, gotchas, "Update and Commit" / "Push and deploy" workflows.

For backend OOP/refactoring/bug-fixing/data-safety conventions, see the global `~/.claude/CLAUDE.md` (do not duplicate them here).

---

## Overview
**Purpose:** Web performance monitoring (Google PageSpeed Insights), APM (New Relic), IIS log analysis (Azure Log Analytics), AI analysis (Claude + OpenAI side-by-side), Azure DevOps build orchestration, BlazeMeter load testing, and (in progress) an Adobe Commerce migration dashboard.

**Tech stack:**
- **Backend:** Python 3.11, Flask, Gunicorn, APScheduler. 3-layer architecture (Routes → Services → Data Access) with dependency injection wired in `app.py`.
- **Database:** SQLite (local dev) / PostgreSQL (production via Railway).
- **Frontend:** React 19 + TypeScript + Vite 8 + Tailwind 4 + shadcn/ui (base-ui), served at `/`. Legacy Flask/template site archived at `/legacy/`.
- **External APIs:** Google PageSpeed Insights, New Relic NerdGraph, Azure Log Analytics, Anthropic Claude, OpenAI, Azure DevOps, BlazeMeter.
- **Repository:** `https://github.com/vorakas/pagespeed.git`

## Critical rules
- **React frontend is the sole active frontend** (`frontend/src/`). Do NOT modify legacy `templates/`, `static/css/`, `static/js/` — archived at `/legacy/`, reference only.
- **All credentials are client-side** in localStorage (`nrConfig`, `azureConfig`, `aiConfig`, `kqlProfiles`, `devOpsConfig`), never on the server.
- **No automated test suite** — all testing is manual.
- **Deploy:** GitHub webhook is broken; the GraphQL deploy mutation often serves stale images. Deploy via Railway CLI. See [docs/deploy.md](docs/deploy.md).
- **Commit trailer:** `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`

## Workflow triggers
- **"New Feature:"** — enter planning mode first (summarize request, identify affected files, propose plan, wait for approval) before writing code.
- **"Refactor:" / "Bug:"** — follow the rules in global `~/.claude/CLAUDE.md`.
- **"Update and Commit"** / **"Push to GitHub and deploy to Railway"** — see [docs/deploy.md](docs/deploy.md).

---

## Current State

The **Aurora register rollout is complete (Phases 1–3)**. Production renders the lifted-card Aurora register at every URL (`/`, `/dashboard`, `/test`, `/metrics`, `/newrelic`, `/iislogs`, `/ai-analysis`, `/builds`, `/load-testing`, `/obsidian`, `/setup`, plus migration cluster pages). The parallel `/prototype/<page>/aurora` URL space is retired (catch-all redirects orphans to `/`). The two-row brand banner above page titles is gone — branding now lives in the sidebar.

- **Phase 1 (de-slop):** removed animated blur blobs, `backdrop-filter` blur, gradient text on numbers, glow halos, pulse keyframes, conic brand orbs.
- **Phase 2 (route promotion):** `BeaconHeader` → `PageHeader` (with `actions` slot), `BeaconSidebar` → `AppSidebar` (hash-aware active matching, theme toggle in footer), `AppLayout` → `beacon beacon-shell dark aurora` shell. All PrototypeAurora wrappers and `/prototype/...` routes deleted.
- **Phase 3 (consolidate):** merged the CSS split into a single `frontend/src/styles/aurora.css` (~2,600 lines), dropped dead `.aurora-app-shell` rules and 5 unused `--aurora-glow-*` tokens, scoped shadcn overrides under `.aurora`, renamed `Beacon*` components.

(Class-name detail and component map in [docs/frontend.md](docs/frontend.md).)

## Known Issues
- Railway GitHub webhook doesn't auto-create on connect — manual deploy required.
- Railway GraphQL `serviceInstanceDeploy` mutation has served stale `master` images even after a push — prefer `railway up` CLI.
- `.gitignore` root `lib/` rule is anchored to `/lib/` to avoid ignoring `frontend/src/lib/`.
- **Dashboard table column alignment:** "Worst Performing URLs" renders one `<table>` per site. With `table-auto`, metric column widths differ across tables (browser distributes surplus space proportionally). The `width: 1px` + `width: 100%` trick improved but didn't fully resolve cross-table alignment. Definitive fix needs a single table, `table-layout: fixed` with explicit widths, or JS column-width sync.

## Potential Next Steps
- Visual polish on the unified Aurora register.
- **Spreadsheet export data refinement (WIP):** validate skipped test counts across all build types; the `outcome == "NotExecuted"` filter may need adjustment. Unresolved section (Applitools) is a placeholder.
- **Jira sync rename-ghost** in `services/obsidian_sync/jira_sync.py` — match by key, not filename, when overwriting vs creating. Read-time dedup is in place but `raw/` accumulates orphans.
- Resolve Dashboard cross-table column alignment (above).
- Automated testing.
