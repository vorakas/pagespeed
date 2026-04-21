---
type: source-summary
source_file: raw/ACAB/
ingested: 2026-04-13
task_count: 284
resync: 2026-04-19T16:14
---

# Source Summary: ACAB (Jira) — 2026-04-10

Ingested from `raw/ACAB/` on 2026-04-10. Data exported via `JiraToObsidia.py`.

## Recent Changes (2026-04-19 Re-sync)

- **+1 Bug (283→284):** [[ACAB-331 - Applying All Filters under Specials Returns 404 Page\|ACAB-331]] — **Closed** (resolved 2026-04-13, High, Naga Ambarish Chigurala). When user applies all multi-select filters under Specials, a 404 page was returned. Root cause: efq vs. fq Bloomreach query parameter used depending on number of filters selected. Fix applied; QA verified pass on staging 2026-04-08 and mcprod 2026-04-13. This bug also appears in `raw/WPM/Bug/` as part of the WPM master pull.

## Issue Counts

| Type | Count |
|------|-------|
| Epic | 1 |
| Task | 24 |
| Sub-task | 58 |
| Bug | 130 |
| Research | 20 |
| Test Case | 51 |
| **Total** | **284** |

## Status Distribution (All Issues)

| Status | Count |
|--------|-------|
| Cancelled | 137 |
| Closed | 135 |
| Open | 4 |
| Stakeholder Test | 2 |
| Groomed | 2 |
| In Progress | 1 |
| Deployment - PPE | 1 |
| Code Review | 1 |

## Active vs Resolved

- **Resolved (Closed + Cancelled):** 272 (96%)
- **Active (all other statuses):** 11 (4%)

## Epic

1. **[[ACAB-1 - AC Implementation - App Builder Integration|ACAB-1]]** — App Builder Integration (`In Progress`, Eilat Vardi)
   - Goal: Implement Bloomreach (BR) search on Adobe Commerce via App Builder
   - Covers: Search API integration, facets, filters, sort, pricing, URL handling, Suggest API

## Key Findings

- **Bug-heavy project**: 129 bugs (46% of all issues) — reflects intensive QA against Bloomreach parity with legacy LP site
- **Very high cancellation rate**: 137 cancelled (48%) — many early bugs became obsolete as the integration matured
- **All 20 research tasks closed** — includes EDS support tasks and App Builder onboarding
- **Research tasks doubled as support**: "App Builder Support For [Name]" and "EDS SUPPORT (Part N)" tasks used for developer onboarding/pairing
- **Test cases mostly cancelled**: 44 of 51 test cases cancelled — likely superseded by updated test plans

## Bug Status Breakdown

| Status | Count |
|--------|-------|
| Cancelled | 78 |
| Closed | 47 |
| Stakeholder Test | 2 |
| Open | 1 |
| Deployment - PPE | 1 |

## Top Assignees

| Assignee | Count |
|----------|-------|
| Unassigned | 141 |
| Naga Ambarish Chigurala | 35 |
| Alex Tadevosyan | 23 |
| Rajesh Kumar Mohanty | 15 |
| Saurabh Wawarkar | 14 |
| Akim Malkov | 14 |
| Siddhesh Avhad | 8 |
| Divya Bharathi | 8 |
| Amitkumar Jaiswar | 8 |

## Related Wiki Pages

- [[ws-app-builder]] — App Builder workstream page
- [[team-acab]] — ACAB team roster
