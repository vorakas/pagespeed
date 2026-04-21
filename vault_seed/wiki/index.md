# Wiki Index

> Auto-maintained by the LLM. Lists every wiki page with a one-line summary.

## Overview & Status

- [[overview]] — High-level project overview and current state
- [[status-2026-04-16]] — Cross-project health snapshot (updated each sync; previous days archived to `wiki/archive/`)

## Source Summaries

- [[source-jira-ace2e]] — ACE2E Jira project ingest: 301 issues (34 epics, 253 tasks, 12 bugs, 2 sub-tasks)
- [[source-jira-aceds]] — ACEDS Jira project ingest: 510 issues (2 epics, 165 tasks, 106 bugs, 195 sub-tasks, 16 research, 26 test cases)
- [[source-jira-acab]] — ACAB Jira project ingest: 283 issues (1 epic, 24 tasks, 129 bugs, 58 sub-tasks, 20 research, 51 test cases)
- [[source-jira-acaqa]] — ACAQA Jira project ingest: 16 issues (1 epic, 14 tasks, 1 bug) — WCAG 2.2 AA audit, mostly cancelled (migrated to ACEDS)
- [[source-jira-accms]] — ACCMS Jira project ingest: 9 issues (1 epic, 5 tasks, 2 sub-tasks, 1 bug) — CMS content management
- [[source-jira-acm]] — ACM Jira project ingest: 21 issues (1 epic, 6 tasks, 10 sub-tasks, 3 bugs, 1 test case) — Commerce-EDS parity
- [[source-jira-wpm]] — WPM master pull: 2,844 issues across 28 projects via WPM-4610 hierarchy (excludes cancelled + sub-tasks)
- [[source-asana-lampsplus]] — Asana LAMPSPLUS ingest: 2,136 tasks (~566 open) — full migration project managed by Concentrix Catalyst
- [[source-asana-lpwe]] — Asana LPWE ingest: 191 tasks (80 open) — post-migration managed services

## Workstreams — Discovery & Legacy Platform

- [[ws-discovery]] — AC Discovery phase: Global, Products, Profile, Store/Kiosk, Checkout (COMPLETE)
- [[ws-lp-site]] — Legacy LP site implementation: ATP, URL structure, left nav, data cleanup (LP, PSS, LPA, SCMS — 1,073 issues)
- [[ws-taxonomy]] — Taxonomy restructuring: Batch A (done), Batch B (in progress) (LP, LPATCH, PSS — ~100 issues)
- [[ws-dynamic-yield-lp]] — Dynamic Yield on legacy LP: AB testing, recommendations, evaluators (LP, LAB — ~50 issues)

## Workstreams — Data & Infrastructure

- [[ws-data-platform]] — WUP data platform, DBADMIN, data syncing, dashboards (DBADMIN, MSP, WEBADMIN — ~480 issues)
- [[ws-bloomreach-feed]] — Bloomreach feed generation, APIs, pixel, display support (UTI — 123 issues)
- [[ws-tealium-tags]] — Tealium tag verification and EventStream connectors (TEAL — 128 issues, 63 ACTIVE)
- [[ws-infrastructure]] — CI/CD, environments, WUP Dashboard, Magento research (CI — 87 issues)

## Workstreams — Commerce Implementation & CMS

- [[ws-commerce-implementation]] — Commerce-EDS parity: header, footer, search, kiosk, DY widget, order status (Epic ACM-4) — 71% ACTIVE
- [[ws-cms]] — CMS content: Help & Policies, Blog, CMS blocks, image alt text (Epic ACCMS-1)

## Workstreams — Storefront

- [[ws-homepage-navigation]] — Homepage, header, footer, mega menu, sticky header (Epics ACE2E-24, ACE2E-25)
- [[ws-plp]] — Product listing page: search, sort, filters, pagination (Epic ACE2E-26)
- [[ws-pdp]] — Product detail page: pricing, images, reviews, ATC, load rules (Epics ACE2E-27, ACE2E-50)
- [[ws-other-pages]] — CMS, blog, landing pages, contact forms, careers, 404 (Epic ACE2E-34)

## Workstreams — Checkout Flow

- [[ws-cart]] — Cart: pricing, discounts, BOPIS, print/email, save for later (Epic ACE2E-28)
- [[ws-checkout]] — Shipping, billing, order confirmation, payment methods (Epics ACE2E-29, ACE2E-30, ACE2E-31)
- [[ws-payments]] — Card swipe, kiosk hardware integration (Epic ACE2E-45)

## Workstreams — User & Account

- [[ws-user-management]] — Session management, account creation, login, CCPA, profile (Epics ACE2E-32, ACE2E-33)

## Workstreams — Commerce Features

- [[ws-gift-card]] — Gift card purchase, balance check, reverse auth (Epic ACE2E-43)
- [[ws-inventory-atp]] — Inventory sync, ATP delivery dates, stock checks (Epics ACE2E-44, ACE2E-51)
- [[ws-financial-calculators]] — Discounts, coupons, promotions, tax, UMRP (Epic ACE2E-52)
- [[ws-wish-list]] — Wishlist for guests and employees (Epic ACE2E-39)
- [[ws-stores]] — Store locator, regional pages, BOPIS (Epic ACE2E-37) — IN PROGRESS

## Workstreams — Integrations & Analytics

- [[ws-integrations]] — Dynamic Yield, Service Broker, Turn To reviews (Epics ACE2E-41, ACE2E-42, ACE2E-46)
- [[ws-pixels-analytics]] — Tealium, BBB, TrustPilot, Bizrate, Google Surveys, and more (Epic ACE2E-36)
- [[ws-email-communications]] — Easy Post email templates, incentivized email modals (Epics ACE2E-40, ACE2E-47)

## Workstreams — SEO & Compliance

- [[ws-seo]] — Sitemaps, robots.txt, meta tags, schema markup (Epic ACE2E-35)
- [[ws-privacy-compliance]] — Cookie consent, catalog opt out, accessibility/UsableNet (Epics ACE2E-48, ACE2E-49, ACE2E-53)

## Workstreams — Employee & Internal

- [[ws-employee-tools]] — Employee search, print, email, order lookup (Epic ACE2E-38)

## Workstreams — App Builder / Bloomreach

- [[ws-app-builder]] — App Builder middleware connecting EDS to Bloomreach search API (Epic ACAB-1)
  - [[comp-ab-search-facets]] — Search API, facets, filters, sort, pricing, URL logic
  - [[comp-ab-suggest-auth]] — Suggest API, authentication, developer onboarding

## Workstreams — Edge Delivery System (EDS)

- [[ws-eds]] — EDS frontend layer: homepage, PLP, search, header/footer, DY, analytics, hybrid content (Epics ACEDS-3, ACEDS-311)
  - [[comp-eds-plp-search]] — PLP, search bar, autocomplete, facets, filters, sort, breadcrumbs, pagination
  - [[comp-eds-homepage]] — Homepage redesign, content scheduling, DY sliders, MVP refresh
  - [[comp-eds-header-nav]] — Header, sticky header, sign-in, hamburger menu, top navigation
  - [[comp-eds-footer]] — Footer refresh, email subscribe, social links, rate us
  - [[comp-eds-dynamic-yield]] — DY widget infrastructure across all page types
  - [[comp-eds-tealium-analytics]] — Tealium utag.js, utag_data, GA4 events, New Relic
  - [[comp-eds-seo-meta]] — Meta data for all page types, schema markup, pagination tags
  - [[comp-eds-accessibility]] — AQA accessibility issues (14 groomed, unassigned)
  - [[comp-eds-hybrid-content]] — Hybrid content migration from tblSearchSplashContent to DA.live

## Workstreams — QA & Testing

- [[ws-qa-testing]] — Test cycle execution per workstream, exploratory testing (Epic ACE2E-325 + 28 test tasks)

## Workstreams — Managed Services

- [[ws-managed-services]] — LPWE post-migration T&M support: 191 tasks (80 open) — improvements, new features, bug fixes

## Workstreams — New / Unscoped

- [[ws-new-epics]] — Resubmit Utility, Marketing Parameters (Epics ACE2E-323, ACE2E-324) — newly created, no tasks yet

## Blockers & Risks

- [[blocker-project-timeline]] — Compounding timeline delays: Jan 2026 → Apr 22-29, 2026
- [[blocker-data-syncing]] — Data syncing workstream risk: cart, session, company, customer mapping (CRITICAL)
- [[blocker-analytics-delay]] — Analytics workstream blocked by TMS change and Tealium issues (CRITICAL)
- [[blocker-tealium-instability]] — Tealium module performance/compatibility issues with AC/EDS (CRITICAL)
- [[blocker-tms-decision]] — GTM → Tealium change requiring analytics rework
- [[blocker-enhancements-volume]] — 526h of enhancements vs 300h budgeted capacity (CRITICAL)
- [[blocker-pdp-design]] — PDP design change and badges delays
- [[blocker-search-vendor]] — Bloomreach selection delay; implementation in progress
- [[blocker-sso-flow]] — SSO email logic risk affecting identity resolution
- [[blocker-wunderkind]] — Wunderkind integration scope clarification needed (CRITICAL)
- [[blocker-eds-licensing]] — EDS licensing/cost negotiation with Adobe
- [[blocker-mao-delay]] — MAO launch delay and mapping changes
- [[blocker-kiosk-e2e]] — Kiosk E2E testing accuracy with emulator

## Decisions

- [[dec-search-engine]] — Bloomreach selected as search engine (2025-03-12)
- [[dec-tms-platform]] — TMS changed from GTM to Tealium (2025-05-19)
- [[dec-data-sync-approach]] — Unidirectional export from AC to legacy (2025-10-20)
- [[dec-launch-strategy]] — Phased soft launch: kiosks → CSRs → 10% → full

## Teams & People

- [[team-ace2e]] — ACE2E project team: PM, QA lead, 12 developers, assignment distribution
- [[team-aceds]] — ACEDS/EDS team: lead, 11 developers, 14 QA engineers
- [[team-acab]] — ACAB/App Builder team: 7 developers, 9 QA engineers
- [[team-concentrix]] — Concentrix Catalyst: implementation vendor (Megan Anaya, PM)

## Log

- [[log]] — Chronological record of all wiki operations
