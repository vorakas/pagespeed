---
type: workstream
status: in-progress
task_count: 21
blocked_count: 1
---

# Workstream: Commerce Implementation

> Jira Project: **ACM** | Epic: [[ACM-4 - AC Implementation - Commerce Implementation|ACM-4]] | Reporter: Seth Wilde
> Source: [[source-jira-acm]]

## Overview

The ACM project handles **Commerce-side implementation** tasks — specifically aligning the Adobe Commerce storefront pages (non-EDS) with the EDS frontend. While EDS delivers the homepage, PLPs, and content pages, Commerce still renders checkout, account, PDP, and other transactional pages. This project ensures visual and functional parity between the two.

### Scope

- **Header/Footer alignment** — Commerce header and footer must match the EDS versions
- **Search bar** — Search suggestions on Commerce pages (currently Failed QA)
- **Kiosk mode** — Kiosk batch script updates for employee data
- **Order status** — Cleanup of order status page elements
- **DY widget** — Recently Viewed widget in the global footer
- **Bug fixes** — Global search SKU issue, SFP pricing/sale date issues

## Progress Summary

| Metric | Count |
|--------|-------|
| Total issues | 21 |
| Closed | 4 (19%) |
| Cancelled | 4 (19%) |
| Active | 13 (62%) |

62% of issues remain in-flight.

## Active Work (as of 2026-04-13)

### In Development

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACM-5 - Update Commerce Header to Match EDS Header\|ACM-5]] | Update Commerce Header to Match EDS Header | Code Review | Glenn Vergara |
| [[ACM-9 - Update Kiosk Batch Script for Employee Data on Kiosk Mode\|ACM-9]] | Update Kiosk Batch Script for Employee Data on Kiosk Mode | Code Complete | Glenn Vergara |
| [[ACM-8 - QA- Support Search Bar Suggestions On Commerce Pages\|ACM-8]] | QA: Support Search Bar Suggestions On Commerce Pages | In Progress | Shivam Yadav |

### Needs Rework

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACM-3 - Support Search Bar Suggestions On Commerce Pages\|ACM-3]] | Support Search Bar Suggestions On Commerce Pages | Failed QA | Tyler Marés |

### Evaluation / Groomed

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACM-12 - Global Search Returns “No Results” for SKU Across PDP and Other Pages\|ACM-12]] | Global Search Returns "No Results" for SKU on PDP/Other Pages | Evaluated | Tyler Marés |
| [[ACM-10 - QA- Update Kiosk Batch Script for Employee Data on Kiosk Mode\|ACM-10]] | QA: Kiosk Batch Script Update | Evaluated | Unassigned |
| [[ACM-21 - QA- Add the Recently Viewed DY widget to the global footer\|ACM-21]] | QA: Add Recently Viewed DY Widget to Footer | Evaluated | Unassigned |
| [[ACM-24 - QA- Update Commerce Footer to Match EDS Footer\|ACM-24]] | QA: Update Commerce Footer to Match EDS Footer | Evaluated | Unassigned |
| [[ACM-19 - Add the Recently Viewed DY widget to the global footer\|ACM-19]] | Add the Recently Viewed DY widget to the global footer | Groomed | George Djaniants |
| [[ACM-23 - Update Commerce Footer to Match EDS Footer\|ACM-23]] | Update Commerce Footer to Match EDS Footer | Groomed | George Djaniants | **BLOCKED** by ACEDS-547, ACEDS-544; **OVERDUE** (due 2026-04-06) |
| [[ACM-6 - QA- Update Commerce Header to match EDS header\|ACM-6]] | QA: Update Commerce Header to Match EDS Header | Groomed | Unassigned |

### Open

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACM-22 - Sale End Date Not Displayed on SFPs\|ACM-22]] | Sale End Date Not Displayed on SFPs | Open | Unassigned |

## Cross-References

| ACM Area | Related Workstream |
|----------|--------------------|
| Commerce header/footer matching EDS | [[comp-eds-header-nav]], [[comp-eds-footer]] |
| Search bar suggestions | [[comp-eds-plp-search]], [[comp-ab-suggest-auth]] |
| DY Recently Viewed widget | [[comp-eds-dynamic-yield]] |
| Kiosk mode | [[ws-employee-tools]], [[ws-stores]] |
| Order status page | [[ws-checkout]] |
| CMS content (child project) | [[ws-cms]] (ACCMS) |
| Global search SKU issue | [[ws-plp]] |

### Cancelled (2026-04-13)

| Key | Summary | Reason |
|-----|---------|--------|
| [[ACM-15 - Update and Clean Up Elements on Order Status Page\|ACM-15]] | Update and Clean Up Elements on Order Status Page | Handed off to Concentrix (CNX) |
| [[ACM-16 - QA- Update and Clean Up Elements on Order Status Page\|ACM-16]] | QA: Update and Clean Up Elements on Order Status Page | Cancelled with parent ACM-15 |

## Notes

- **Parent-child relationship**: [[ACM-4 - AC Implementation - Commerce Implementation|ACM-4]] is the parent epic; ACCMS-1 (CMS content) implements it
- **Failed QA on search bar** ([[ACM-3 - Support Search Bar Suggestions On Commerce Pages|ACM-3]]) is a key risk — search suggestions on Commerce pages not working correctly
- **Commerce-EDS parity** is the main theme — as EDS gets refreshed (header, footer, DY widgets), Commerce pages need to stay in sync
- **Same developers** working on both EDS and Commerce sides (Tyler Marés, Glenn Vergara, George Djaniants)
