---
type: overview
last_updated: 2026-04-13
---

# LampsPlus.com Adobe Commerce Migration

## Project Summary
End-to-end migration and testing of LampsPlus.com from its current platform to Adobe Commerce. Two Jira projects track the work:
- **ACE2E** — Commerce backend, checkout, integrations, and QA across 33 functional workstreams
- **ACEDS** — Edge Delivery System (EDS) frontend layer: homepage, PLP, search, header/footer, analytics, content migration
- **ACAB** — App Builder middleware connecting EDS to Bloomreach search engine
- **ACAQA** — WCAG 2.2 AA accessibility audit (mostly cancelled; issues migrated to ACEDS)
- **ACCMS** — CMS content management: Help & Policies, Blog, image alt text
- **ACM** — Commerce Implementation: aligning Commerce pages with EDS (header, footer, search, kiosk)
- **WPM** (master pull) — 2,818 issues across 28 Jira projects via WPM-4610 hierarchy. Includes LP (legacy site), DBADMIN (data platform), TEAL (Tealium tags), UTI (Bloomreach feeds), CI (infrastructure), and 22 other projects

## Current State
**Status: At Risk**

**ACE2E (Commerce):** Large volume of groomed but unassigned work (161 of 267 tasks, 60%). Only 6 tasks actively in progress. 27 tasks have failed QA and need rework. Most epics are "Evaluated" — scoped but not started.

**ACEDS (EDS):** More mature — 84% resolved (310 closed + 118 cancelled). Active work concentrated in hybrid content migration carryover (5 of 7 tasks groomed/unassigned), accessibility fixes (14 groomed items), and Tealium/analytics parity. PLP intermittent load failure under active investigation.

**ACAB (App Builder):** Nearly complete — 96% resolved (135 closed + 137 cancelled). 11 active items remain, primarily around auth header updates, special callouts, and VIP data. Naga Ambarish Chigurala is the sole active developer.

## Sources
- **Jira (ACE2E)**: 301 issues ingested 2026-04-10. See [[source-jira-ace2e]].
- **Jira (ACEDS)**: 510 issues ingested 2026-04-10. See [[source-jira-aceds]].
- **Jira (ACAB)**: 283 issues ingested 2026-04-10. See [[source-jira-acab]].
- **Jira (ACAQA)**: 16 issues ingested 2026-04-10. See [[source-jira-acaqa]].
- **Jira (ACCMS)**: 9 issues ingested 2026-04-10. See [[source-jira-accms]].
- **Jira (ACM)**: 21 issues ingested 2026-04-10. See [[source-jira-acm]].
- **Jira (WPM master pull)**: 2,818 issues ingested 2026-04-10. See [[source-jira-wpm]].
- **Asana (LAMPSPLUS)**: 2,100 tasks ingested 2026-04-13. Full migration project managed by Concentrix Catalyst. See [[source-asana-lampsplus]].
- **Asana (LPWE)**: 191 tasks ingested 2026-04-13. Post-migration managed services (T&M). See [[source-asana-lpwe]].

## Key Metrics

| Source | Total | Open/Active | Completed |
|--------|------:|------------:|----------:|
| Jira (per-project) | 1,140 | ~120 | ~700 |
| Jira (WPM master pull) | 2,818 | ~450 | ~1,800 |
| Asana (LAMPSPLUS) | 2,100 | 535 | 1,565 |
| Asana (LPWE) | 191 | 80 | 111 |
| **Combined unique** | **~5,920** | **~1,065** | **~3,870** |

*Jira unique combined accounts for ~328 duplicates between per-project and WPM. Asana tasks are fully separate from Jira (tracked by vendor Concentrix Catalyst).*

### Task Status Breakdown

| Status | Count | % |
|--------|------:|---:|
| Groomed (ready, unassigned) | 161 | 60% |
| Closed (complete) | 46 | 17% |
| Failed QA | 27 | 10% |
| Cancelled | 8 | 3% |
| On Hold | 7 | 3% |
| Clarification Needed | 7 | 3% |
| In Progress | 6 | 2% |
| QA on PPE In Progress | 3 | 1% |
| Deployment - PPE | 1 | <1% |
| Open | 1 | <1% |

### Epic Status Breakdown

| Status | Count |
|--------|------:|
| Evaluated | 27 |
| In Progress | 4 |
| Open | 2 |
| Closed | 1 |

## Active Work (In Progress)

| Epic | Area | Owner |
|------|------|-------|
| [[ws-stores\|ACE2E-37 Stores]] | Store locator | Tan Nguyen |
| [[ws-inventory-atp\|ACE2E-44 Inventory]] | Stock sync | Unassigned |
| [[ws-integrations\|ACE2E-46 Turn To]] | Reviews integration | Unassigned |
| [[ws-email-communications\|ACE2E-47 Incentivized Email]] | Email modals | Unassigned |

## Risk Areas

### From Jira
1. **High unassignment rate** — 67% of non-cancelled ACE2E tasks have no assignee
2. **Failed QA backlog** — 27 tasks need rework across PDP, Cart, PLP, and other areas
3. **Clarification blockers** — 7 tasks waiting on answers (store locator, subscription, catalog, add by style, sales timer)
4. **New epics unscoped** — Resubmit Utility and Marketing Parameters have no tasks yet

### From Asana (13 active risk items — see [[index#Blockers & Risks]])
5. **Project timeline** — Launch slipped from Jan 2026 to Apr 22-29, 2026 due to compounding delays: [[blocker-project-timeline]]
6. **Data syncing capacity** — ~1000h needed vs ~500h budgeted; changed to unidirectional export: [[blocker-data-syncing]]
7. **Analytics/Tealium blocked** — TMS changed from GTM to Tealium; module unstable with AC/EDS: [[blocker-analytics-delay]], [[blocker-tealium-instability]]
8. **Enhancement volume** — 526h of enhancements vs 300h capacity, with new requests arriving monthly: [[blocker-enhancements-volume]]
9. **PDP design change** — Design changed mid-implementation; badges delayed: [[blocker-pdp-design]]
10. **Wunderkind integration** — Scope clarification needed; estimation in progress: [[blocker-wunderkind]]

## Workstream Summary

See [[index]] for the full catalog. Key workstreams by size:

| Workstream | Tasks | Closed | Failed QA | In Progress |
|-----------|------:|-------:|----------:|------------:|
| [[ws-pdp]] | ~31 | ~10 | ~8 | ~2 |
| [[ws-qa-testing]] | ~28 | ~3 | 0 | 0 |
| [[ws-cart]] | ~25 | ~10 | ~7 | ~3 |
| [[ws-checkout]] | ~24 | ~2 | ~2 | 0 |
| [[ws-homepage-navigation]] | ~18 | ~1 | 0 | 0 |
| [[ws-plp]] | ~17 | ~1 | ~4 | 0 |
| [[ws-other-pages]] | ~16 | ~7 | ~3 | ~1 |
| [[ws-financial-calculators]] | ~15 | 0 | 0 | 0 |

## EDS Active Work (In Progress)

| Area | Key Task | Owner |
|------|----------|-------|
| Homepage | ACEDS-530 DY Sliders update | Glenn Vergara |
| Security | ACEDS-538 Content-Security-Policy | Tyler Marés |
| Footer | ACEDS-547 Rate Us link | George Djaniants |
| PLP | ACEDS-572 Intermittent load failure investigation | Alex Tadevosyan |

See [[ws-eds]] for full EDS workstream details.

## Vendor
- [[team-concentrix]] — Concentrix Catalyst: implementation vendor for full migration and post-launch managed services (Owner: Megan Anaya)

## Teams
- [[team-ace2e]] — Commerce implementation team (PM: Seth Wilde, QA Lead: Saurabh Wawarkar)
- [[team-aceds]] — EDS frontend team (Lead: Ben Blunt, 11 devs, 14 QA)
- [[team-acab]] — App Builder / Bloomreach team (Lead: Eilat Vardi, 7 devs, 9 QA)

## Key Decisions
- [[dec-search-engine]] — Bloomreach selected as search engine (2025-03-12)
- [[dec-tms-platform]] — TMS changed from GTM to Tealium (2025-05-19)
- [[dec-data-sync-approach]] — Unidirectional export from AC to legacy (2025-10-20)
- [[dec-launch-strategy]] — Phased soft launch: kiosks → CSRs → 10% → full
