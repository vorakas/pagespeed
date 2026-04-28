---
type: workstream
status: in-progress
task_count: 100
blocked_count: 0
---

# Workstream: Taxonomy Restructuring

> Jira Projects: **LP** (taxonomy tasks), **WPM** (taxonomy epics), **LPATCH** (25 SuperCMS patches), **PSS** (taxonomy mirrors)
> Source: [[source-jira-wpm]]

## Overview

Major restructuring of the LampsPlus product taxonomy — reorganizing categories, attributes, and URL structures. This work spans the legacy LP site, Pro Source (PSS), and prepares data for Adobe Commerce.

### Key Epics (4)

- [[WPM-4792 - LP Implementation - Taxonomy - Misc|WPM-4792]] — Taxonomy Misc
- [[WPM-5235 - LP Implementation - Taxonomy - Batch A|WPM-5235]] — Taxonomy Batch A (closed)
- [[WPM-5236 - LP Implementation - Taxonomy - Batch B|WPM-5236]] — Taxonomy Batch B (in progress)
- [[WPM-5254 - LP Implementation - Taxonomy - Pre Requisites|WPM-5254]] — Taxonomy Pre-Requisites (closed)

### Related Epics

- [[WPM-4989 - LP Implementation - Update URL Structure (PDP & PLP)|WPM-4989]] — Update URL Structure (PDP & PLP)
- [[WPM-4156 - LP Implementation - Static Left Nav|WPM-4156]] — Static Left Nav
- [[WPM-4876 - LP Implementation - Dynamic Sort (Left Nav)|WPM-4876]] — Dynamic Sort (Left Nav)

## Active Items

- [[LP-71839 - RC Branch for LPvTaxonomyBatchB|LP-71839]] — RC Branch for Taxonomy Batch B (In Progress)
- [[LP-72592 - Taxonomy Batch B - Retest Key Tasks From the LPv308 Release|LP-72592]] — Taxonomy Batch B Retest (On Hold)
- [[LP-72598 - Batch B- Update site map with attribute changes for Type-Feature|LP-72598]] — Batch B: Update sitemap with attribute changes (QA on PPE)
- [[DBADMIN-7059 - Update SyncAttributesProductMicroservicesAndCarteasy to Support Batch-B|DBADMIN-7059]] — Update SyncAttributes for Batch B (**On Hold** as of 2026-04-13; Aarthi Natarajan)
- [[LP-72586 - Solar Landscape Lights Navigation Link Returns 404 Page Not Found error|LP-72586]]/72587 — Navigation/sitemap 404 errors (Groomed)
- [[PSS-1953 - Support Showing QuickShip Facet On LP-AC (Part 4)|PSS-1953]] — Support QuickShip Facet on LP/AC Part 4 (**QA on PPE In Progress** as of 2026-04-13; Aarthi Natarajan)

## Cross-References

| Area | Related Workstream |
|------|--------------------|
| Bloomreach feed reflects taxonomy | [[ws-bloomreach-feed]] |
| Product data tables | [[ws-data-platform]] |
| PLP facet display | [[ws-app-builder]], [[comp-eds-plp-search]] |
| SuperCMS patches | LPATCH project (25 issues) |

## Notes

- Batch A is complete; **Batch B is the current active work**
- Taxonomy changes ripple across LP, PSS, DBADMIN, Bloomreach feeds, and the AC site
- Aarthi Natarajan owns most LP taxonomy tasks; Akim Malkov owns PSS/MSP side
