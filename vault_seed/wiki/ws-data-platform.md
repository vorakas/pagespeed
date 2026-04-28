---
type: workstream
status: in-progress
task_count: 459
blocked_count: 1
---

# Workstream: Data Platform (WUP / DBADMIN)

> Jira Projects: **DBADMIN** (459 issues), **WPM** (WUP epics), **MSP** (15), **WEBADMIN** (5)
> Source: [[source-jira-wpm]]

## Overview

The data platform workstream covers the **WUP (Web Unified Platform)** — the backend data infrastructure that feeds both the legacy LP site and Adobe Commerce. DBADMIN is the primary project for database tasks; WUP epics in WPM define the architecture.

### Scope

- **Product data** — WUP product tables, data syncing to AC, availability, pricing
- **Profile data** — Customer, employee, company, opt-out, address, payment, history
- **Interfaces** — Azure Private Link, API Mesh real-time, Google Pub/Sub message queue
- **Data syncing** — Legacy-to-AC data flow, SSIS optimization
- **Dashboards** — WUP monitoring for API microservices and Private Link
- **Product Microservice** (MSP) — Taxonomy and Bloomreach integration at the service layer

### Key Epics (17 WUP epics)

- [[WPM-4761 - WUP - Product Data|WPM-4761]] — Product Data
- [[WPM-4775 - WUP - Architecture & Design|WPM-4775]] — Architecture & Design
- [[WPM-4785 - WUP - Relationships|WPM-4785]] — Relationships
- [[WPM-4789 - WUP - Interfaces - Azure Private Linking|WPM-4789]] — Azure Private Linking
- [[WPM-4790 - WUP - Interfaces - API Mesh Real Time|WPM-4790]] — API Mesh Real Time
- [[WPM-4791 - WUP - Interfaces - Google Pub Sub Message Queue|WPM-4791]] — Google Pub Sub Message Queue
- [[WPM-4798 - WUP - Dashboard - Infrastructure|WPM-4798]] — Dashboard Infrastructure
- [[WPM-4799 - WUP - Data Syncing|WPM-4799]] — Data Syncing
- [[WPM-4971 - WUP - Profile Data (Customer, Employee, Company, Opt Out, Address, Payment, History)|WPM-4971]] — Profile Data
- [[WPM-5055 - WUP - Dashboard - Monitoring API Microservices|WPM-5055]] — Dashboard Monitoring API Microservices
- [[WPM-5056 - WUP - Dashboard - Monitoring Private Link|WPM-5056]] — Dashboard Monitoring Private Link
- [[WPM-5094 - WUP - Lighting Collections|WPM-5094]] — Lighting Collections
- [[WPM-5155 - WUP - Data Syncing POC|WPM-5155]] — Data Syncing POC
- [[WPM-5339 - WUP - SSIS Optimization Effort for DBCLUST2|WPM-5339]] — SSIS Optimization DBCLUST2
- [[WPM-5377 - WUP - Private Link Data Ingestion|WPM-5377]] — Private Link Data Ingestion
- [[WPM-5400 - WUP - SSIS Optimization Effort for DBTEST|WPM-5400]] — SSIS Optimization DBTEST

## Progress (as of 2026-04-13)

| Status | Count |
|--------|-------|
| <span style="background:#198754;color:white;padding:2px 8px;border-radius:4px">Closed</span> | 461 |
| <span style="background:#198754;color:white;padding:2px 8px;border-radius:4px">Done</span> | 87 |
| <span style="background:#0dcaf0;color:black;padding:2px 8px;border-radius:4px">Deployment - PPE</span> | 50 |
| <span style="background:#0dcaf0;color:black;padding:2px 8px;border-radius:4px">Stakeholder Test</span> | 41 |
| <span style="background:#6c757d;color:white;padding:2px 8px;border-radius:4px">Evaluated</span> | 9 |
| <span style="background:#adb5bd;color:black;padding:2px 8px;border-radius:4px">Groomed</span> | 5 |
| <span style="background:#5a6c8a;color:white;padding:2px 8px;border-radius:4px">Approved Code Review</span> | 2 |
| <span style="background:#6f42c1;color:white;padding:2px 8px;border-radius:4px">Code Review</span> | 4 |
| <span style="background:#adb5bd;color:black;padding:2px 8px;border-radius:4px">Open</span> | 3 |
| <span style="background:#ffc107;color:black;padding:2px 8px;border-radius:4px">Evaluating</span> | 3 |
| <span style="background:#0dcaf0;color:black;padding:2px 8px;border-radius:4px">Deployment</span> | 3 |
| <span style="background:#0d6efd;color:white;padding:2px 8px;border-radius:4px">In Progress</span> | 4 |
| <span style="background:#dc3545;color:white;padding:2px 8px;border-radius:4px">Blocked</span> / Other | 5 |
| **Total** | **674** |

**Completion rate:** 81% closed/done, 94% including pipeline (Deployment-PPE + Stakeholder Test)

## Active Items

### <span style="background:#dc3545;color:white;padding:2px 8px;border-radius:4px">Blocked</span> (1)
- [[CI-4426 - Set up domain name for WUP Dashboard|CI-4426]] — Set up domain name for WUP Dashboard (John Hilts, blocked since 2026-03-23)

### <span style="background:#0d6efd;color:white;padding:2px 8px;border-radius:4px">In Progress</span> (3)
- [[UTI-8454 - [Private Link] Pull AC data from Adobe Customer Tables  -- Legacy Data Push - Part 1|UTI-8454]] — Pull AC Customer data → Legacy Push Part 1 (Armen Shagmirian)
- [[UTI-8455 - [Private Link] Pull AC data from Adobe Customer Tables  -- Legacy Data Push - Part 2|UTI-8455]] — Pull AC Customer data → Legacy Push Part 2 (Armen Shagmirian)
- [[DBADMIN-7057 - Revert DBADMIN-7038|DBADMIN-7057]] — Revert DBADMIN-7038 (Armen Shagmirian, **moved from Evaluated 2026-04-13**; WUPv12; reverts a prior DB change)

### <span style="background:#adb5bd;color:black;padding:2px 8px;border-radius:4px">On Hold</span> (1 — new)
- [[DBADMIN-7059 - Update SyncAttributesProductMicroservicesAndCarteasy to Support Batch-B|DBADMIN-7059]] — Update SyncAttributesProductMicroservicesAndCarteasy for Taxonomy Batch-B (**moved In Progress → On Hold 2026-04-13**; Aarthi Natarajan; adds Type/Feature attribute support to legacy sync proc; 3h estimate, 0h spent)

### <span style="background:#5a6c8a;color:white;padding:2px 8px;border-radius:4px">Approved Code Review</span> (2)
- [[DBADMIN-7047 - Back Populate Line-Level Tax and Discount Fields to tblSharedItems for MAO Order Sync|DBADMIN-7047]] — Back-populate line-level tax/discount fields for MAO (David Goben, **due 2026-04-10 — 3 days overdue; advanced to Approved CR 2026-04-13**)
- [[CI-4441 - Fix private link query to include jobs in progress|CI-4441]] — Fix Private Link query to include in-progress jobs (John Hilts)

### <span style="background:#6f42c1;color:white;padding:2px 8px;border-radius:4px">Code Review</span> (4)
- [[CI-4415 - Display recent entries on home page|CI-4415]] — WUP Dashboard: display recent entries (Tyler Marés)
- [[CI-4420 - Add response time to Microservice summary page|CI-4420]] — WUP Dashboard: response time on Microservice page (Tyler Marés)
- [[CI-4423 - Add data source links|CI-4423]] — WUP Dashboard: add data source links (Tyler Marés)
- [[CI-4425 - Add additional Private link information to the UI|CI-4425]] — WUP Dashboard: Private Link info (Tyler Marés)

### <span style="background:#adb5bd;color:black;padding:2px 8px;border-radius:4px">Open / Unassigned</span> (3)
- [[DBADMIN-6704 - Replicate Adobe Wishlist tables to Marketing2 database (new server and dbtest server)|DBADMIN-6704]] — Replicate Adobe Wishlist tables to Marketing2 (**unassigned since Jan 14**)
- [[DBADMIN-6708 - Send Adobe Wishlist data feeds to Express Analytics|DBADMIN-6708]] — Send Adobe Wishlist feeds to Express Analytics (**unassigned**)
- [[UTI-8498 - Update the DB connection string to reference prod1_dbclust2|UTI-8498]] — Update DB connection string for prod1_dbclust2 (**unassigned**)

### <span style="background:#ffc107;color:black;padding:2px 8px;border-radius:4px">Evaluating</span> (3)
- [[DBADMIN-6821 - Clean Up Customer Data - Employee info (Part 6)|DBADMIN-6821]] — Clean up Customer Data – Employee info Part 6 (unassigned)
- [[DBADMIN-7035 - Fix Historical Records Related to Tracking Numbers|DBADMIN-7035]] — Fix historical tracking number records (unassigned)
- [[DBADMIN-7052 - Create new tables in WUP for Adobe wishlist data|DBADMIN-7052]] — Create WUP tables for Adobe wishlist data (unassigned)

### <span style="background:#6c757d;color:white;padding:2px 8px;border-radius:4px">Evaluated / Ready for Assignment</span> (9)
- [[DBADMIN-7046 - Remove tables AdobeTableNames & AdobeProcessedDates|DBADMIN-7046]] — Remove AdobeTableNames & AdobeProcessedDates tables (Armen Shagmirian)
- [[DBADMIN-7050 - Add a new column for platform identifier in WUP tables|DBADMIN-7050]] — Add platform identifier column to WUP tables (Armen Shagmirian)
- [[UTI-8450 - [Private Link] Pull AC data from AdobeCartBillingData  -- Legacy Data Push|UTI-8450]] — Pull AdobeCartBillingData → Legacy Push (**unassigned**)
- [[UTI-8451 - [Private Link] Pull AC data from AdobeCartHeaderData  -- Legacy Data Push|UTI-8451]] — Pull AdobeCartHeaderData → Legacy Push (**unassigned**)
- [[UTI-8452 - [Private Link] Pull AC data from AdobeCartHoldReasonData  -- Legacy Data Push|UTI-8452]] — Pull AdobeCartHoldReasonData → Legacy Push (**unassigned**)
- [[UTI-8453 - [Private Link] Pull AC data from AdobeCartItemData  -- Legacy Data Push|UTI-8453]] — Pull AdobeCartItemData → Legacy Push (**unassigned**)
- [[UTI-8457 - [Private Link] Pull AC data from Adobe WishList Tables  -- Legacy Data Push - Part 1|UTI-8457]] — Pull Adobe WishList Tables → Legacy Push Part 1 (**unassigned**)
- [[UTI-8458 - [Private Link] Pull AC data from Adobe WishList Tables  -- Legacy Data Push - Part 2|UTI-8458]] — Pull Adobe WishList Tables → Legacy Push Part 2 (**unassigned**)

### Key Risks
- **6 of 9 Evaluated Private Link data-push tasks are unassigned** — these represent the bidirectional AC↔Legacy data flow for carts and wishlists
- **DBADMIN-7047 is overdue but advancing** (due Apr 10, now Approved Code Review as of 2026-04-13) — MAO order sync tax/discount backfill; approval means deployment is next. Completing this resolves the 5 Private Link order history gaps.
- **DBADMIN-7059 moved On Hold 2026-04-13** — Batch-B attribute sync proc update paused; reason not documented in Jira. May indicate a dependency or scope issue with Taxonomy Batch-B timeline.
- **CI-4426 is blocked** — WUP Dashboard domain name setup, no resolution path documented
- **DBADMIN-6704 has been Open/unassigned for 3 months** — Wishlist table replication to Marketing2

## Estimated Completion

| Month | Closed | Cumulative |
|-------|--------|------------|
| Oct 2024 | 6 | 6 |
| Nov 2024 | 3 | 9 |
| Dec 2024 | 2 | 11 |
| Jan 2025 | 26 | 37 |
| Feb 2025 | 17 | 54 |
| Mar 2025 | 12 | 66 |
| Apr 2025 | 54 | 120 |
| May 2025 | 27 | 147 |
| Jun 2025 | 30 | 177 |
| Jul 2025 | 44 | 221 |
| Aug 2025 | 10 | 231 |
| Sep 2025 | 31 | 262 |
| Oct 2025 | 81 | 343 |
| Nov 2025 | 52 | 395 |
| Dec 2025 | 44 | 439 |
| Jan 2026 | 13 | 452 |
| Feb 2026 | 35 | 487 |
| Mar 2026 | 88 | 575 |
| Apr 2026 (partial) | 11 | 586 |

**Velocity:** ~10.5 tasks/week (Q1 2026 avg) · ~20 tasks/week (March 2026)
**Remaining:** ~88 active tasks (not Closed/Done/Cancelled)
**Projected completion:** ~4–8 weeks at current velocity → **mid-May to mid-June 2026**
*(Assumes no significant scope growth; March velocity suggests the optimistic end)*

## Developer Workload

| Developer | In Progress | Code Review | Pipeline (PPE/Deploy/ST) | Backlog | Total Active |
|-----------|:-----------:|:-----------:|:------------------------:|:-------:|:------------:|
| Dharamsingh Rajput | 0 | 0 | 24 | 0 | 24 |
| Rupali Deshmukh | 0 | 0 | 23 | 0 | 23 |
| Armen Shagmirian | 2 | 0 | 20 | 3 | 25 |
| David Goben | 0 | 1 | 11 | 0 | 12 |
| Naga Ambarish Chigurala | 0 | 0 | 7 | 0 | 7 |
| Tyler Marés | 0 | 4 | 0 | 0 | 4 |
| Aarthi Natarajan | 0 | 0 | 4 | 1 | 5 |
| John Hilts | 0 | 1 | 3 | 1 | 5 |
| Habtamu Baheta | 0 | 0 | 3 | 0 | 3 |
| Kevin Jarvis | 0 | 0 | 2 | 0 | 2 |
| *Unassigned* | 0 | 0 | 0 | 14 | 14 |

**Observations:**
- **Armen Shagmirian** carries the heaviest active load (25 tasks), including the only 2 In Progress items
- **Dharamsingh Rajput** and **Rupali Deshmukh** have ~24 and ~23 pipeline tasks respectively — mostly Deployment-PPE and Stakeholder Test
- **14 tasks are unassigned** — predominantly Evaluated/Groomed backlog (Private Link data-push tasks)

## Recent Activity (since 2026-03-27)

| Task                                                                                                                                                                                                                                                                                                                       | Current Status                                                                                         | Assignee           | Updated       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------ | ------------- |
| [[UTI-8454 - [Private Link] Pull AC data from Adobe Customer Tables  -- Legacy Data Push - Part 1\|UTI-8454]]                                                                                                                                                                                                              | <span style="background:#0d6efd;color:white;padding:2px 8px;border-radius:4px">In Progress</span>      | Armen Shagmirian   | 2026-04-10    |
| [[UTI-8455 - [Private Link] Pull AC data from Adobe Customer Tables  -- Legacy Data Push - Part 2\|UTI-8455]]                                                                                                                                                                                                              | <span style="background:#0d6efd;color:white;padding:2px 8px;border-radius:4px">In Progress</span>      | Armen Shagmirian   | 2026-04-10    |
| [[DBADMIN-7047 - Back Populate Line-Level Tax and Discount Fields to tblSharedItems for MAO Order Sync\|DBADMIN-7047]]                                                                                                                                                                                                     | <span style="background:#5a6c8a;color:white;padding:2px 8px;border-radius:4px">Approved Code Review</span> | David Goben        | **2026-04-13** |
| [[DBADMIN-6929 - Update Attribute Table For BR Field Name and Pros Updates\|DBADMIN-6929]]                                                                                                                                                                                                                                 | <span style="background:#20c997;color:white;padding:2px 8px;border-radius:4px">QA on PPE</span>        | Kevin Jarvis       | 2026-04-10    |
| [[DBADMIN-6090 - SuperCMS- Add Feature to Multiple Categories\|DBADMIN-6090]]                                                                                                                                                                                                                                              | <span style="background:#20c997;color:white;padding:2px 8px;border-radius:4px">QA on Prod</span>       | Dharamsingh Rajput | 2026-04-10    |
| [[DBADMIN-7032 - Update Quick Ship Attribute Value in tblAttributeValue to -Same Day Shipping-\|DBADMIN-7032]]                                                                                                                                                                                                             | <span style="background:#0dcaf0;color:black;padding:2px 8px;border-radius:4px">Deployment - PPE</span> | Kevin Jarvis       | 2026-04-10    |
| [[CI-4441 - Fix private link query to include jobs in progress\|CI-4441]]                                                                                                                                                                                                                                                  | <span style="background:#6f42c1;color:white;padding:2px 8px;border-radius:4px">Approved CR</span>      | John Hilts         | 2026-04-09    |
| [[DBADMIN-7054 - Synchronize updated_at date for ACData Cart tables\|DBADMIN-7054]]                                                                                                                                                                                                                                        | <span style="background:#0dcaf0;color:black;padding:2px 8px;border-radius:4px">Deployment - PPE</span> | Armen Shagmirian   | 2026-04-09    |
| [[CI-4415 - Display recent entries on home page\|CI-4415]]/[[CI-4420 - Add response time to Microservice summary page\|4420]]/[[CI-4423 - Add data source links\|4423]]/[[CI-4425 - Add additional Private link information to the UI\|4425]]                                                                              | <span style="background:#6f42c1;color:white;padding:2px 8px;border-radius:4px">Code Review</span>      | Tyler Marés        | 2026-04-08    |
| [[CI-4426 - Set up domain name for WUP Dashboard\|CI-4426]]                                                                                                                                                                                                                                                                | <span style="background:#dc3545;color:white;padding:2px 8px;border-radius:4px">Blocked</span>          | John Hilts         | 2026-04-08    |
| [[DBADMIN-7057 - Revert DBADMIN-7038\|DBADMIN-7057]]                                                                                                                                                                                                                                                                       | <span style="background:#6c757d;color:white;padding:2px 8px;border-radius:4px">Evaluated</span>        | Armen Shagmirian   | 2026-04-08    |
| [[CI-4329 - Setup Frontend Infrastructure\|CI-4329]]                                                                                                                                                                                                                                                                       | <span style="background:#198754;color:white;padding:2px 8px;border-radius:4px">Done</span>             | Tyler Marés        | 2026-04-08    |
| [[CI-4436 - Code cleanup in WUP Dashboard backend API\|CI-4436]]/[[CI-4429 - Support Solar Winds Direct Links\|4429]]/[[CI-4427 - Add endpoints to support displaying recent entries\|4427]]/[[CI-4396 - Add pagination support\|4396]]/[[CI-4395 - Add filter for ok-error\|4395]]/[[CI-4361 - Add Roles Endpoint\|4361]] | <span style="background:#198754;color:white;padding:2px 8px;border-radius:4px">Done</span>             | John Hilts         | 2026-04-07    |
| [[DBADMIN-7050 - Add a new column for platform identifier in WUP tables\|DBADMIN-7050]]                                                                                                                                                                                                                                    | <span style="background:#6c757d;color:white;padding:2px 8px;border-radius:4px">Evaluated</span>        | Armen Shagmirian   | 2026-04-07    |
| [[UTI-8457 - [Private Link] Pull AC data from Adobe WishList Tables  -- Legacy Data Push - Part 1\|UTI-8457]]/[[UTI-8458 - [Private Link] Pull AC data from Adobe WishList Tables  -- Legacy Data Push - Part 2\|8458]]                                                                                                    | <span style="background:#6c757d;color:white;padding:2px 8px;border-radius:4px">Evaluated</span>        | Unassigned         | 2026-04-06    |
| [[DBADMIN-7052 - Create new tables in WUP for Adobe wishlist data\|DBADMIN-7052]]                                                                                                                                                                                                                                          | <span style="background:#ffc107;color:black;padding:2px 8px;border-radius:4px">Evaluating</span>       | Unassigned         | 2026-04-06    |
| [[DBADMIN-7046 - Remove tables AdobeTableNames & AdobeProcessedDates\|DBADMIN-7046]]                                                                                                                                                                                                                                       | <span style="background:#6c757d;color:white;padding:2px 8px;border-radius:4px">Evaluated</span>        | Armen Shagmirian   | 2026-04-06    |
| [[UTI-8494 - Add Line-Level Tax and Discount Fields to tblSharedItems for MAO Order Sync\|UTI-8494]]                                                                                                                                                                                                                       | <span style="background:#198754;color:white;padding:2px 8px;border-radius:4px">Closed</span>           | Habtamu Baheta     | 2026-04-03    |
| [[DBADMIN-6993 - List of carts that have a company associated but no customers associated\|DBADMIN-6993]]/[[UTI-8463 - Update URL in Adobe Commerce Sitemaps\|UTI-8463]]/[[UTI-8497 - MAO Order Update Incorrectly Assigns All Tracking Numbers to Each Invoice Item\|UTI-8497]]                                           | Closed                                                                                                 | Various            | 2026-04-01–02 |
| DBADMIN-6858–6908 (batch)                                                                                                                                                                                                                                                                                                  | Closed                                                                                                 | Rupali Deshmukh    | 2026-04-01    |

**Summary:** 70 tasks updated since Mar 27. Rupali Deshmukh bulk-closed ~22 tasks on Apr 1 (customer data cleanup). WUP Dashboard saw heavy activity (John Hilts: 6 done, Tyler Marés: 4 in code review). New Private Link wishlist tasks (UTI-8457/8458) entered Evaluated but remain unassigned.

## Dependencies & Blockers

### Active Cross-Project Dependencies

| This Task | Relationship | External Task | External Workstream |
|-----------|-------------|---------------|---------------------|
| [[DBADMIN-6929 - Update Attribute Table For BR Field Name and Pros Updates\|DBADMIN-6929]] (QA on PPE) | is blocking | [[ACAB-302 - Color Temperature Filter Page Returns Error on Staging but Works on WUP LP Website\|ACAB-302]] (Color Temp Filter) | [[ws-app-builder]] |
| [[DBADMIN-7033 - Add New 'Platform' Field to tblDomExportOrderHeader\|DBADMIN-7033]] (Deployment - PPE) | is blocking | LP-72545 (MAO Platform Field) | [[ws-lp-site]] |
| [[UTI-8381 - Update Bloomreach Feed To Support New Data Structure For Prices (priceSKU-priceProTier-priceEmployee)-Sale-Specials\|UTI-8381]] (Deployment - PPE) | is blocking | [[LP-72273 - SEO - Add 301 redirects for the new attribute value records for Sales and Specials\|LP-72273]] (SEO 301 Redirects) | [[ws-seo]] |
| [[DBADMIN-6704 - Replicate Adobe Wishlist tables to Marketing2 database (new server and dbtest server)\|DBADMIN-6704]] (Open) | is blocking | [[DBADMIN-6708 - Send Adobe Wishlist data feeds to Express Analytics\|DBADMIN-6708]] (Wishlist feeds) | Internal |

### Active Internal Chains

| Blocked Task | Blocked By | Status of Blocker |
|-------------|-----------|-------------------|
| [[DBADMIN-6821 - Clean Up Customer Data - Employee info (Part 6)\|DBADMIN-6821]] (Employee cleanup Part 6) | [[DBADMIN-6830 - Research - Customer Data\|DBADMIN-6830]] (Research) | Stakeholder Test |
| [[DBADMIN-6728 - Update Adobe SSIS package to support new Marketing2 database - TruckScheduleData\|DBADMIN-6728]]/[[DBADMIN-6743 - Update Adobe SSIS package to support new Marketing2 database - VendorData\|6743]]/[[DBADMIN-6744 - Update Adobe SSIS package to support new Marketing2 database - VendorCatalogData\|6744]] (SSIS Marketing2) | [[DBADMIN-6749 - Create and update new connection string in SSIS package\|DBADMIN-6749]] (Connection string) | Stakeholder Test |
| DBADMIN-6088–6121 (SuperCMS batch, 11 tasks) | [[DBADMIN-6090 - SuperCMS- Add Feature to Multiple Categories\|DBADMIN-6090]] (Add Feature) | QA on Prod |
| [[DBADMIN-6959 - WUP -- AC - Add new fields for MAO Order Sync to ACData.dbo.OrderItemData and populate data\|DBADMIN-6959]] (MAO Order Sync fields) | [[UTI-8494 - Add Line-Level Tax and Discount Fields to tblSharedItems for MAO Order Sync\|UTI-8494]] (tblSharedItems) | ✅ Closed — unblocked |
| [[CI-4362 - Add WUP Dashboard Role to database\|CI-4362]] (WUP Dashboard DB role) | [[CI-4363 - Add masterscript to WUP Dashboard Pipeline\|CI-4363]] (Pipeline script) | Done — should unblock |

**Critical:** [[blocker-data-syncing]] — data syncing scope at risk (~500h budgeted vs ~1000h needed). See Decisions section below.

## Decisions

| Date | Decision | Status | Impact |
|------|----------|--------|--------|
| 2025-10-20 | [[dec-data-sync-approach]]: Changed to unidirectional export (AC → legacy) | Accepted | Reduced scope; dropped wishlist sync; simplified architecture |

**Key context:** Original bidirectional JSON sync was infeasible (~1000h needed vs ~500h budgeted). Scope narrowed to Cart, Session Manager, Company, and Customer sync. Wishlists confirmed dropped 10/15/25. BI connector (Rivery) rejected.

See also: [[blocker-data-syncing]] (Critical — scope vs. budget risk remains open)

## Asana ↔ Jira Cross-References

| Asana Task | Description | Jira Task | Asana Status | Jira Status | Aligned? |
|------------|-------------|-----------|:------------:|:-----------:|:--------:|
| [[042476 - -Private Link- Create and Populate Company Data for Production\|042476]] | Company Data (Production) | DBADMIN-6723 | <span style="background:#adb5bd;color:black;padding:2px 6px;border-radius:4px">Open</span> | Not in export | <span style="background:#ffc107;color:black;padding:2px 6px;border-radius:4px">⚠️ Unknown</span> |
| [[839553 - -Private Link- Create and Populate Profile History Database Table for Staging\|839553]] | Profile History (Staging) | [[DBADMIN-5908 - [Private Link] Create and Populate Profile History Table\|DBADMIN-5908]] | <span style="background:#adb5bd;color:black;padding:2px 6px;border-radius:4px">Open</span> | <span style="background:#198754;color:white;padding:2px 6px;border-radius:4px">Closed</span> | <span style="background:#dc3545;color:white;padding:2px 6px;border-radius:4px">⚠️ No</span> |
| [[390729 - -API Mesh- Populate IBMi Reward Number Service Mapping\|390729]] | IBMi Reward Number Mapping | LP-68940 | <span style="background:#adb5bd;color:black;padding:2px 6px;border-radius:4px">Open</span> | Not in export | <span style="background:#ffc107;color:black;padding:2px 6px;border-radius:4px">⚠️ Unknown</span> |
| [[181056 - -Private Link- Product Attribute & Attribute Value Mappings\|181056]] | Product Attribute Mappings | [[LP-67989 - Review & Update Product Attribute Mapping\|LP-67989]] | <span style="background:#adb5bd;color:black;padding:2px 6px;border-radius:4px">Open</span> | <span style="background:#198754;color:white;padding:2px 6px;border-radius:4px">Closed</span> | <span style="background:#dc3545;color:white;padding:2px 6px;border-radius:4px">⚠️ No</span> |
| [[841815 - Private Link - Customer Mapping\|841815]] | Customer Mapping | [[LP-68200 - Review and Update Customer Attribute Mappings\|LP-68200]] | <span style="background:#adb5bd;color:black;padding:2px 6px;border-radius:4px">Open</span> | <span style="background:#198754;color:white;padding:2px 6px;border-radius:4px">Closed</span> | <span style="background:#dc3545;color:white;padding:2px 6px;border-radius:4px">⚠️ No</span> |
| [[841815 - Private Link - Customer Mapping\|841815]] ★ | Company Mapping | [[LP-68201 - Review and Update Company Attribute Mappings\|LP-68201]] | <span style="background:#adb5bd;color:black;padding:2px 6px;border-radius:4px">Open</span> | <span style="background:#198754;color:white;padding:2px 6px;border-radius:4px">Closed</span> | <span style="background:#dc3545;color:white;padding:2px 6px;border-radius:4px">⚠️ No</span> |
| [[876312 - CHANGE v2 - -Private Link- Create and Populate Profile Opt Out History Database Table for Staging\|876312]] | Profile Opt Out History (Staging) | — | <span style="background:#adb5bd;color:black;padding:2px 6px;border-radius:4px">Open</span> | — | <span style="background:#6c757d;color:white;padding:2px 6px;border-radius:4px">No Jira link</span> |
| [[191219 - -Private Link- Create and Populate Product Asset Database Table for Staging\|191219]] | Product Asset DB (Staging) | — | <span style="background:#adb5bd;color:black;padding:2px 6px;border-radius:4px">Open</span> | — | <span style="background:#6c757d;color:white;padding:2px 6px;border-radius:4px">No Jira link</span> |
| [[248234 - -Private Link- Create and Populate Profile History Database Table for Production\|248234]] | Profile History (Production) | — | <span style="background:#adb5bd;color:black;padding:2px 6px;border-radius:4px">Open</span> | — | <span style="background:#6c757d;color:white;padding:2px 6px;border-radius:4px">No Jira link</span> |
| [[390730 - -API Mesh- Provide IBMi to Web Dev Web Service Endpoints for Staging\|390730]] | IBMi Web Service Endpoints | — | <span style="background:#adb5bd;color:black;padding:2px 6px;border-radius:4px">Open</span> | — | <span style="background:#6c757d;color:white;padding:2px 6px;border-radius:4px">No Jira link</span> |

★ Same Asana task — LP-68201 (Company) was tracked alongside LP-68200 (Customer) in a single Asana action item.

**⚠️ 4 tasks show status misalignment** — Jira shows Closed but Asana still shows Open. These likely represent LP-side action items that were completed in Jira but never updated in Asana. Should be reviewed and closed in Asana if the work is truly done.

**2 tasks reference Jira keys not in the WPM export** (DBADMIN-6723, LP-68940) — these may be in a different Jira project or were excluded by the JQL filter.

## Cross-References

| Area | Related Workstream |
|------|--------------------|
| Product data feeds Bloomreach | [[ws-bloomreach-feed]] |
| Profile data feeds AC checkout | [[ws-checkout]], [[ws-user-management]] |
| API Mesh consumed by App Builder | [[ws-app-builder]] |
| Data syncing feeds inventory | [[ws-inventory-atp]] |
| Wishlist data replication | [[ws-wish-list]] |

## Team

Key assignees: Habtamu Baheta, Armen Shagmirian, Rupali Deshmukh, Dharamsingh Rajput, David Goben, John Hilts

## Asana Coverage (LAMPSPLUS)
**LAMPSPLUS Implementation:** ~65 tasks (Data imports/exports, BI setup, Private Link integration)
- Key: Product data import is foundational

**LAMPSPLUS Action Items:** 9 open — all data mapping/database tasks
- CHANGE v2 tables for Profile Opt Out History, Product Assets, Company Data, Profile History (staging + production)
- API Mesh: IBMi to Web Dev Web Service Endpoints for Staging, IBMi Reward Number Service Mapping
- Private Link: Product Attribute & Attribute Value Mappings, Customer Mapping

### Key Tasks

- [[876312 - CHANGE v2 - -Private Link- Create and Populate Profile Opt Out History Database Table for Staging|Profile Opt Out History (Staging)]]
- [[191219 - -Private Link- Create and Populate Product Asset Database Table for Staging|Product Asset Database (Staging)]]
- [[042476 - -Private Link- Create and Populate Company Data for Production|Company Data for Production]]
- [[248234 - -Private Link- Create and Populate Profile History Database Table for Production|Profile History Database (Production)]]
- [[839553 - -Private Link- Create and Populate Profile History Database Table for Staging|Profile History Database (Staging)]]
- [[390730 - -API Mesh- Provide IBMi to Web Dev Web Service Endpoints for Staging|API Mesh: IBMi Web Service Endpoints (Staging)]]
- [[390729 - -API Mesh- Populate IBMi Reward Number Service Mapping|API Mesh: IBMi Reward Number Service Mapping]]
- [[181056 - -Private Link- Product Attribute & Attribute Value Mappings|Product Attribute & Attribute Value Mappings]]
- [[841815 - Private Link - Customer Mapping|Customer Mapping]]

**LPWE (Post-Launch):** 4 tasks
- Completed: New Data Syncing Approach (Firebear), Automate Catalog Opt Out Process
