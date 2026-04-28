---
type: source-summary
source_file: raw/ACM/
ingested: 2026-04-13
task_count: 21
---

# Source Summary: ACM (Jira) — 2026-04-10

Ingested from `raw/ACM/` on 2026-04-10. Data exported via `JiraToObsidia.py`.

## Issue Counts

| Type | Count |
|------|-------|
| Epic | 1 |
| Task | 6 |
| Sub-task | 10 |
| Bug | 3 |
| Test Case | 1 |
| **Total** | **21** |

## Status Distribution

| Status | Count |
|--------|-------|
| Closed | 4 |
| Evaluated | 4 |
| Groomed | 3 |
| In Progress | 2 |
| Cancelled | 4 |
| Open | 1 |
| Failed QA | 1 |
| Code Review | 1 |
| Code Complete | 1 |

## Active vs Resolved

- **Resolved (Closed + Cancelled):** 8 (38%)
- **Active:** 13 (62%)

## Epic

1. **[[ACM-4 - AC Implementation - Commerce Implementation|ACM-4]]** — Commerce Implementation (`In Progress`, Unassigned)
   - Goal: Implement content and align Commerce storefront pages with EDS
   - Links to: ACCMS-1 (CMS project — "is implemented by")
   - Reporter: Seth Wilde

## All Active Issues

| Key | Summary | Type | Status | Assignee |
|-----|---------|------|--------|----------|
| [[ACM-3 - Support Search Bar Suggestions On Commerce Pages\|ACM-3]] | Support Search Bar Suggestions On Commerce Pages | Task | Failed QA | Tyler Marés |
| [[ACM-5 - Update Commerce Header to Match EDS Header\|ACM-5]] | Update Commerce Header to Match EDS Header | Task | Code Review | Glenn Vergara |
| [[ACM-9 - Update Kiosk Batch Script for Employee Data on Kiosk Mode\|ACM-9]] | Update Kiosk Batch Script for Employee Data on Kiosk Mode | Task | Code Complete | Glenn Vergara |
| [[ACM-19 - Add the Recently Viewed DY widget to the global footer\|ACM-19]] | Add the Recently Viewed DY widget to the global footer | Task | Groomed | George Djaniants |
| [[ACM-23 - Update Commerce Footer to Match EDS Footer\|ACM-23]] | Update Commerce Footer to Match EDS Footer | Task | Groomed | George Djaniants |
| [[ACM-12 - Global Search Returns “No Results” for SKU Across PDP and Other Pages\|ACM-12]] | Global Search Returns "No Results" for SKU Across PDP/Other Pages | Bug | Evaluated | Tyler Marés |
| [[ACM-22 - Sale End Date Not Displayed on SFPs\|ACM-22]] | Sale End Date Not Displayed on SFPs | Test Case | Open | Unassigned |

## Key Findings

- **Highly active project**: 71% of issues are in active states — this is current, in-flight work
- **Commerce-EDS alignment**: Core theme is making Commerce-rendered pages (header, footer, search) match the EDS versions
- **Failed QA**: [[ACM-3 - Support Search Bar Suggestions On Commerce Pages|ACM-3]] (search bar suggestions on Commerce pages) has failed QA — needs rework
- **Developer team**: Tyler Marés, Glenn Vergara, George Djaniants — same EDS developers now working on Commerce-side parity
- **Parent of ACCMS**: [[ACM-4 - AC Implementation - Commerce Implementation|ACM-4]] epic is the parent that ACCMS-1 implements

## Related Wiki Pages

- [[ws-commerce-implementation]] — Commerce Implementation workstream page
- [[ws-cms]] — Child project (ACCMS) workstream
