---
type: workstream
status: in-progress
task_count: 510
blocked_count: 0
---

# Workstream: Edge Delivery System (EDS)

> Jira Project: **ACEDS** | Epics: [[ACEDS-3 - AC Implementation - Edge Delivery System (EDS) Implementation|ACEDS-3]], [[ACEDS-311 - AC Implementation - Hybrid Content Migration|ACEDS-311]] | Lead: Ben Blunt
> Source: [[source-jira-aceds]]

## Overview

The ACEDS project implements **Adobe Edge Delivery Services (EDS)** as the frontend delivery layer for the Adobe Commerce migration. EDS handles the public-facing pages that are content-driven or hybrid (commerce + content), delivering them via Adobe's CDN/edge infrastructure rather than through the Commerce storefront directly.

### Scope (from [[ACEDS-3 - AC Implementation - Edge Delivery System (EDS) Implementation|ACEDS-3]])

| Page Type | Status |
|-----------|--------|
| Homepage | Closed (MVP refresh done) |
| PLP (Search/Sort) | Active — ongoing bug fixes and enhancements |
| More Like This | QA on PPE |
| Recently Viewed | Closed |
| Brands | Closed |
| CLPs (ceiling-lights, home-decor, lamps, kitchen-lights) | Closed (MVP refresh done) |
| Room Scenes | **Dropped** |

### Content Platform

- **DA.live** (`da.live/#/lampsplus-ac`) — Adobe's content authoring/publishing platform
- Hybrid content (splash blocks) migrated from legacy `tblSearchSplashContent` to DA.live

## Progress Summary

| Metric | Count |
|--------|-------|
| Total issues | 510 |
| Closed | 310 (61%) |
| Cancelled | 118 (23%) |
| Active | 84 (16%) |
| Groomed (backlog) | 46 |
| In Progress | 7 |
| Stakeholder Test | 4 |
| In Deployment/QA pipeline | 13 |

## Components

- [[comp-eds-plp-search]] — PLP, search bar, autocomplete, facets, filters, sort, breadcrumbs, pagination
- [[comp-eds-homepage]] — Homepage redesign, content scheduling, DY sliders, MVP refresh
- [[comp-eds-header-nav]] — Header, sticky header, sign-in, hamburger menu, top navigation
- [[comp-eds-footer]] — Footer refresh, email subscribe, social links, rate us
- [[comp-eds-dynamic-yield]] — DY widget infrastructure, CLP/Homepage/Footer/PLP/404/MLT/RV widgets
- [[comp-eds-tealium-analytics]] — Tealium utag.js, utag_data, GA4 events, New Relic
- [[comp-eds-seo-meta]] — Meta data for all page types, schema markup, pagination tags
- [[comp-eds-accessibility]] — AQA (Automated Quality Assurance) accessibility issues
- [[comp-eds-hybrid-content]] — Hybrid content migration from tblSearchSplashContent to DA.live

## Active Work (as of 2026-04-13)

### In Progress
- **[[ACEDS-538 - EDS Content-Security-Policy|ACEDS-538]]** — EDS Content-Security-Policy (Tyler Marés)
- **[[ACEDS-547 - Rate Us Link is Not Displaying in the Footer Section|ACEDS-547]]** — Rate Us Link is Not Displaying in the Footer Section (George Djaniants)

### Approved Code Review
- **[[ACEDS-530 - Homepage Update for category and DY Sliders|ACEDS-530]]** — Homepage Update for category and DY Sliders (Glenn Vergara)

### In Deployment Pipeline (PPE)
- **[[ACEDS-455 - Build Hybrid Content Components for LD JSON Schema|ACEDS-455]]** — Build Hybrid Content Components for LD JSON Schema
- **[[ACEDS-511 - AQA Issue - ESI - The -svg- element does not have alternative text (PLP (Search and Autocomplete))|ACEDS-511]]/515** — AQA SVG alt text fixes (ESI)
- **[[ACEDS-544 - Update the global footer background color and email subscribe layout|ACEDS-544]]** — Footer background color and email subscribe layout update
- **[[ACEDS-552 - Update Stars On PLP (Product Tile and Customer Rating Filter) To Gold Stars|ACEDS-552]]** — Update PLP stars to gold
- **[[ACEDS-557 - EDS Header- Secondary Navigation Intermittently Hidden on mcstaging2|ACEDS-557]]** — EDS Header secondary nav intermittently hidden on mcstaging2
- **[[ACEDS-580 - Incorrect Homepage Content Displayed On Initial Load|ACEDS-580]]** — Incorrect Homepage Content Displayed On Initial Load

### Stakeholder Test
- **[[ACEDS-446 - Sale Navigation Menu - Splash Images Linking to Old URLs Instead of New Updated URLs|ACEDS-446]]** — Sale Navigation Menu splash images linking to old URLs
- **[[ACEDS-454 - Build Hybrid Content Components for Meta Title, Meta Description, and h1|ACEDS-454]]** — Build Hybrid Content Components for Meta Title/Description/h1
- **[[ACEDS-522 - Extra Spaces are Not Stripped  to Single Space on the Search Box|ACEDS-522]]** — Extra spaces not stripped in search box
- **[[ACEDS-572 - Research Root Cause Of Issue Where First Load Of PLP intermittently Does Not Load|ACEDS-572]]** — PLP intermittent load failure root cause identified: large `@adobe/aio-sdk` imports cause cold start latency; fix is to increase Fastly first-byte timeout (Alex Tadevosyan)

### Open / Awaiting Assignment
- **[[ACEDS-560 - Address ACEDS bug fixes to resolve Tealium issues|ACEDS-560]]** — Address ACEDS bug fixes to resolve Tealium issues
- **[[ACEDS-563 - Unique Authorisation - Bearer is Not Displayed Upon Logging into an Account|ACEDS-563]]** — Unique Authorization Bearer not displayed on login
- **[[ACEDS-570 - Count of Products Not Displaying Next to Filter Options Under -Specials- Filter Menu|ACEDS-570]]** — Product count not displaying next to Specials filter options
- **[[ACEDS-578 - Add BreadcrumbList schema on PLPs|ACEDS-578]]** — Add BreadcrumbList schema on PLPs
- **[[ACEDS-579 - Add CollectionPage entity schema to the PLP|ACEDS-579]]** — Add CollectionPage entity schema to PLPs

### Groomed Backlog (key items)
- **[[ACEDS-582 - Searching For A Term From Recently Searched Drop Down  Containing Quotes (-) Strips Off In Characters|ACEDS-582]]** — Search dropdown with quotes strips characters (High Priority, Unassigned) — NEW
- **[[ACEDS-457 - Carryover for Hybrid Content Pill Buttons|ACEDS-457]]/458/459/460/461/462** — Hybrid content carryover tasks (pill buttons, splash banner, top/bottom copy, meta, LD JSON)
- **[[ACEDS-488 - AQA Issue - The -svg- element does not have alternative text (PLP (Search and Autocomplete))|ACEDS-488]]–500** — AQA accessibility fixes (7 tasks)
- **[[ACEDS-542 - Install the New Relic Browser Agent|ACEDS-542]]** — Install New Relic Browser Agent
- **[[ACEDS-591 - Update the utag data page type for sale pages|ACEDS-591]]** — Update utag_data page type for sale pages

## Cross-References to ACE2E Workstreams

EDS delivers the frontend for several areas that have backend/commerce counterparts in ACE2E:

| EDS Component | ACE2E Workstream |
|---------------|------------------|
| [[comp-eds-plp-search]] | [[ws-plp]] |
| [[comp-eds-homepage]], [[comp-eds-header-nav]], [[comp-eds-footer]] | [[ws-homepage-navigation]] |
| [[comp-eds-dynamic-yield]] | [[ws-integrations]] |
| [[comp-eds-tealium-analytics]] | [[ws-pixels-analytics]] |
| [[comp-eds-seo-meta]] | [[ws-seo]] |
| [[comp-eds-accessibility]] | [[ws-privacy-compliance]] |

## Team

See [[team-aceds]] for full roster. Key contributors:
- **Tyler Marés** — PLP lead, early EDS development
- **Alex Tadevosyan** — Search/autocomplete, bug fixes
- **Glenn Vergara** — Homepage, header, hybrid content
- **George Djaniants** — Dynamic Yield widgets, hybrid content
- **Konstantin Minevich** — Tealium/analytics, accessibility
- **Oliver Syson** — SEO meta, GA4, bug fixes
- **Calvin Liu** — GA4 analytics, accessibility fixes

## Asana Coverage (LAMPSPLUS + LPWE)
**LAMPSPLUS Implementation:** ~34 tasks (Edge Delivery System frontend, styling, migration)
- Key: Search data migration, category styling

**LPWE (Post-Launch):** EDS work is distributed across other workstreams (PLP/Search, Homepage, Employee Tools, CMS). Key completed items:
- EDS Style Category Landing Page, EDS Style Search Results Page, EDS Style Search Bar
- EDS Employee Session Linking and Store Switcher
- EDS PLP Schema Updates, EDS Scaffolding Changes
