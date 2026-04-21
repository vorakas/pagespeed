---
type: source-summary
source_file: raw/ACEDS/
ingested: 2026-04-13
task_count: 512
---

# Source Summary: ACEDS (Jira) — 2026-04-10

Ingested from `raw/ACEDS/` on 2026-04-10. Data exported via `JiraToObsidia.py`.

## Issue Counts

| Type | Count |
|------|-------|
| Epic | 2 |
| Task | 165 |
| Sub-task | 196 |
| Bug | 107 |
| Research | 16 |
| Test Case | 26 |
| **Total** | **512** |

## Status Distribution (All Issues)

| Status | Count |
|--------|-------|
| Closed | 310 |
| Cancelled | 118 |
| Groomed | 46 |
| Open | 9 |
| In Progress | 7 |
| Deployment - PPE | 7 |
| Evaluated | 4 |
| Stakeholder Test | 4 |
| QA on PPE | 2 |
| QA on PPE In Progress | 1 |
| On Hold | 1 |
| Evaluating | 1 |
| Code Review | 1 |
| Approved Code Review | 1 |

## Active vs Resolved

- **Resolved (Closed + Cancelled):** 428 (84%)
- **Active (all other statuses):** 84 (16%)

## Epics

1. **ACEDS-3** — Edge Delivery System (EDS) Implementation (`In Progress`, Ben Blunt)
   - Scope: Homepage, PLP, More Like This, Recently Viewed, Brands, CLPs
   - The main epic covering all EDS frontend work
2. **ACEDS-311** — Hybrid Content Migration (`In Progress`, Unassigned)
   - Scope: Migrating splash content from tblSearchSplashContent to DA.live
   - Covers image buckets, pill buttons, splash banners, top/bottom copy, meta, LD JSON

## Key Findings

- **Heavily QA-focused**: 195 sub-tasks are mostly QA tasks (prefixed "QA-"), plus 26 test cases
- **High cancellation rate on bugs**: 61 of 106 bugs (58%) were cancelled — many early bugs became obsolete as EDS evolved
- **Accessibility (AQA) wave**: ~30 tasks for SVG alt text, link names, background colors, keyboard operability
- **Hybrid content migration in progress**: Components built but carryover/transformation tasks largely still Groomed
- **Tealium/GA4 instrumentation**: Significant investment in analytics parity with legacy site
- **Research complete**: 14 of 16 research tasks closed — team has completed discovery phase

## Bug Status Breakdown

| Status | Count |
|--------|-------|
| Closed | 38 |
| Cancelled | 61 |
| Stakeholder Test | 2 |
| Open | 2 |
| Deployment - PPE | 2 |
| Groomed | 1 |

## Top Assignees (All Issue Types)

| Assignee | Count |
|----------|-------|
| Unassigned | 180 |
| Alex Tadevosyan | 40 |
| Tyler Marés | 27 |
| Glenn Vergara | 25 |
| Oliver Syson | 22 |
| Konstantin Minevich | 21 |
| George Djaniants | 21 |
| Calvin Liu | 18 |
| Kedar Jakhalekar | 17 |
| Sakshi Gupta | 14 |
| Jagrit Raizada | 14 |
| Pooja Kshirsagar | 13 |

## Related Wiki Pages

- [[ws-eds]] — EDS workstream page
- [[team-aceds]] — ACEDS team roster
