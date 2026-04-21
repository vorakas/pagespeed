---
type: source-summary
source_file: raw/WPM/
ingested: 2026-04-17
task_count: 2921
resync: 2026-04-19T16:14
---

# Source Summary: WPM Master Pull (Jira) — 2026-04-16

Re-synced from `raw/WPM/` on 2026-04-16 (full re-pull by JiraToObsidia.py). Originally ingested 2026-04-10. Data pulled via custom JQL from [[WPM-4610 - Adobe Commerce Implementation|WPM-4610]] hierarchy (PM-provided query). Excludes Cancelled issues and sub-tasks. Originally ingested 2026-04-10. Data pulled via custom JQL from [[WPM-4610 - Adobe Commerce Implementation|WPM-4610]] hierarchy (PM-provided query). Excludes Cancelled issues and sub-tasks.

## JQL Query

```
(key in (WPM-4610, childIssuesOf(WPM-4610))
 OR issueFunction in subtasksOf("key in (WPM-4610, childIssuesOf(WPM-4610))"))
AND status not in (Cancelled)
AND type in standardIssueTypes()
```

## Issue Counts

| Type | Count | Δ from 2026-04-16 | Δ from 2026-04-10 |
|------|-------|------------------:|------------------:|
| Task | 2,008 | **+40** | **+61** |
| Research | 328 | **+1** | **+6** |
| Bug | 295 | **+7** | **+10** |
| Documentation | 101 | 0 | 0 |
| Epic | 101 | **+2** | **+3** |
| Test Case | 38 | **+1** | 0 |
| Branch | 26 | 0 | 0 |
| Collection | 1 | 0 | 0 |
| **Total** | **2,902** | **+55** | **+84** |

## Root Issue

**[[WPM-4610 - Adobe Commerce Implementation|WPM-4610]]** — Adobe Commerce Implementation (Collection)
- Owner: Eilat Vardi
- Created: 2024-08-01
- Soft launch plan: Kiosks → CSRs → 10% customers → Increased % → Full Launch
- Content syncing scope: hybrid content, top nav, homepage, static pages, blog, privacy policy, landing pages, sitemap, promotions, 301 redirects, metadata

## Status Distribution

| Status | 2026-04-15 | 2026-04-14 | Δ |
|--------|-----------|-----------|---|
| Closed | 2,118 | 2,118 | 0 |
| Groomed | 184 | 181 | **+3** |
| Deployment - PPE | 93 | 88 | **+5** |
| Stakeholder Test | 91 | 90 | **+1** |
| Done | 88 | 88 | 0 |
| Open | 63 | 65 | **-2** |
| Evaluated | 50 | 43 | **+7** |
| In Progress | 45 | 43 | **+2** |
| Failed QA | 39 | 37 | **+2** |
| QA on PPE | 16 | 9 | **+7** |
| On Hold | 13 | 14 | **-1** |
| Evaluating | 12 | 12 | 0 |
| Code Review | 7 | 4 | **+3** |
| Resolved | 5 | 5 | 0 |
| Clarification Needed | 5 | 8 | **-3** |
| QA on PPE In Progress | 4 | 6 | **-2** |
| Requirements Review | 2 | 0 | **+2** |
| Deployment | 3 | 3 | 0 |
| Active Test | 2 | 2 | 0 |
| Approved Code Review | 1 | 1 | 0 |
| Code Review In Progress | 0 | 1 | **-1** |
| QA on Prod | 1 | 1 | 0 |
| Code Complete | 1 | 1 | 0 |
| Blocked | 1 | 1 | 0 |
| **Total** | **2,844** | **2,823** | **+21** |

### Notable Changes (2026-04-20 Re-sync)

- **Full re-pull (2,910→2,921, +11 files):** All 2,896 existing files re-exported with refreshed timestamps. 26 Branch files now included in export (RC branches for taxonomy/URL structure changes — LP-68289 through LP-72123, MSP-1056/1073/1079, PSS-1669; all Closed/Completed). 26 ACAB Bug files refreshed (existing closed Bloomreach/search bugs). Net new: 11 files across other types.
- No new active Jira issues; no pipeline status changes detected. Metadata-only refresh.

### Notable Changes (2026-04-19 Re-sync)

- **+8 files (2,902→2,910):** 7 new tasks created 2026-04-17 + 1 additional untracked task now exported. 4 existing items updated on 2026-04-19.
- **New tasks (created 2026-04-17):**
  - [[ACE2E-351 - Sitemaps Validation -- HTML CMS, Video, and Store Locator (ACE2E-158, 159, 161)\|ACE2E-351]] — Sitemaps Validation for HTML CMS, Video, Store Locator (Groomed, Not Prioritized, Unassigned)
  - [[ACE2E-352 - Core Web Vitals QA -- Performance Parity Review (Legacy vs Adobe)\|ACE2E-352]] — Core Web Vitals QA perf parity (Groomed, Not Prioritized, Unassigned)
  - [[ACEDS-615 - Research Logic On PLP Wish List Functionality (For Pros-Employee-Kiosk)\|ACEDS-615]] — Research PLP Wishlist logic for Pros/Employee/Kiosk (Groomed, High, Unassigned)
  - [[LP-72655 - Identify GA4 custom events on legacy WUP site\|LP-72655]] — Identify GA4 custom events on legacy LP/WUP site (Evaluating, High, Unassigned)
  - [[TEAL-3140 - -adobecommerce- profile - Platform identifier - GA4 -ecp- mappings for  ecommerce events\|TEAL-3140]] — GA4 "ecp" mappings for ecommerce events (Groomed, High, Calvin Liu)
  - [[TEAL-3141 - -adobecommerce- profile - Platform identifier - GA4 -ecp- mappings for custom events\|TEAL-3141]] — GA4 "ecp" mappings for custom events (Evaluated, High, Unassigned)
  - [[TEAL-3143 - Pebblepost pixel is not firing on Order Confirmation page\|TEAL-3143]] — **New Bug:** Pebblepost pixel not firing on Order Confirmation page (Open, High, Glenn Vergara)
- **Updated 2026-04-19:**
  - [[ACAB-331 - Applying All Filters under Specials Returns 404 Page\|ACAB-331]] — Closed (resolved 2026-04-13). Applying all Specials filters → 404 page fixed; QA passed mcprod.
  - [[DBADMIN-7032 - Update Quick Ship Attribute Value in tblAttributeValue to -Same Day Shipping-\|DBADMIN-7032]] — Now in Stakeholder Test (High, Kevin Jarvis); resolved 2026-04-14. Updates "Quickship" attribute value for FDS setup.
  - [[PSS-1953 - Support Showing QuickShip Facet On LP-AC (Part 4)\|PSS-1953]] — Advanced to **Deployment - PPE** (was QA on PPE In Progress); Aarthi Natarajan; fix_version 38.1.
  - ACE2E-101 — New comment from Eilat Vardi 2026-04-19 asking assignee to add bug to Round 1 epic list. Still Failed QA.

### Notable Changes (2026-04-17 Re-sync)
- **+55 files (2,847→2,902):** Large increase driven primarily by 52 new ACAB Bug files exported (Adobe Commerce / Bloomreach-related bugs from lampstrack). Task +40 and Epic +2 also suggest additional WPM tasks/epics now exported. Full re-pull of all files; status distribution not recomputed. ACAB project appears to track Bloomreach/search layer bugs (ACAB-11 through ACAB-350+), most in Closed or Groomed state, with a handful in Evaluating or newer stages.
- **ACAB project (52 bugs now in raw):** Covers Sort Page behavior, filter interactions, URL structure, price facets, and search contextual logic. These bugs are mostly Closed or Groomed — they represent accumulated Bloomreach search issues resolved over the migration period. Notable active ones: ACAB-348 (Invalid URL structure with multiple filters, Groomed, 2026-04-15), ACAB-350 (Special characters stripped in contextual search, Evaluating, 2026-04-16).

### Notable Changes (2026-04-16 Re-sync)
- **+3 issues (Task +4, Research +2, Bug -1, Epic -1, Test Case -1):** Net +3 from 2026-04-15 pull. MOC shows type count shifts consistent with reclassification of some issues alongside new task additions. No dramatic pipeline changes vs. 2026-04-15; full re-pull of all 2,847 files. Status breakdown not re-computed (full scan of 2,847 files required); prior table still directionally accurate. Status page updated separately.

### Notable Changes (2026-04-15 Re-sync)
- **+21 issues (Task +15, Research +3, Bug +2, Epic +1):** Large wave of new items added, mostly in the LP/DBADMIN/TEAL domain — likely overnight additions from dev activity on 2026-04-14 evening and early 2026-04-15.
- **QA on PPE +7 (9→16):** Seven items advanced from earlier pipeline stages into active PPE QA. Significant throughput signal as teams push toward launch window.
- **Evaluated +7 (43→50):** Research/evaluator items completing evaluation phase — consistent with taxonomy and DY evaluator tracks.
- **Deployment - PPE +5 (88→93):** More items deploying to PPE staging environment.
- **Code Review +3 (4→7):** Three additional items entering code review.
- **In Progress +2 (43→45):** Net +2 active development items.
- **Failed QA +2 (37→39):** Two additional QA failures added — maintains persistent QA instability trend.
- **Clarification Needed -3 (8→5):** Clarifications resolved.
- **QA on PPE In Progress -2 (6→4):** Items advanced to Deployment - PPE or QA on PPE.
- **Requirements Review +2 (new status):** Two items now in a requirements review state — new status not seen in prior syncs.

### Notable Changes (2026-04-14 Re-sync)
- **Bug +2 (285→287), Task +1 (1948→1949), total +3 (2820→2823):** Two new ACE2E bugs filed 2026-04-14 by Sirisha Boddu — both are sub-issues from the LPWE-37 (Desktop Search Box) effort, now formally tracked:
  - [[ACE2E-329 - The Search Dropdown is Showing  3 Recently viewed PDP Thumbnail images by Default on  PDP ,PLP, Commerce Pages|ACE2E-329]] — Search Dropdown showing 3 recently-viewed PDP thumbnails by default on PDP/PLP/Commerce pages (Open, Not Prioritized, Unassigned). mcprod reproduction confirmed in fresh session.
  - [[ACE2E-330 - UI  Gap is showing on  Search Suggestions Dropdown on Wish list page|ACE2E-330]] — UI gap in search suggestions dropdown on Wishlist and Commerce pages (Open, Not Prioritized, Unassigned). Both filed 2026-04-14.
- **Status shifts (Closed +4, Groomed -5, Failed QA +2, QA on PPE In Progress +2, Evaluating -2):** Net pipeline progression. ACE2E-329 and ACE2E-330 account for the Failed QA +2. Groomed -5 suggests items moved into active work or closed.

### Notable Changes (2026-04-13 Decenary Re-sync)
- **Evaluated +1 (42→43), total +1 (2,819→2,820):** [[ACEDS-597 - Update the utag data page type for Category Landing Pages|ACEDS-597]] created **2026-04-13** — new task "Update the utag data page type for Category Landing Pages" (Evaluated, Unassigned, High Priority). Changes `utag_data.page_type` on CLPs from `"all"` to `"landing"`. Has QA subtask ACEDS-598. Linked to TEAL-2987 (SundaySky tag verification — discovered while testing). Companion to ACEDS-588 (search results page_type Approved Code Review).

### Notable Changes (2026-04-13 Novenery Re-sync)
- **In Progress -1 (44→43), On Hold +1 (13→14):** [[DBADMIN-7059 - Update SyncAttributesProductMicroservicesAndCarteasy to Support Batch-B|DBADMIN-7059]] moved **In Progress → On Hold** (Aarthi Natarajan); reason not documented in Jira. Batch-B attribute sync proc update paused.
- **QA on PPE -1 (10→9), QA on PPE In Progress +1 (3→4):** [[PSS-1953 - Support Showing QuickShip Facet On LP-AC (Part 4)|PSS-1953]] advanced **QA on PPE → QA on PPE In Progress** (Aarthi Natarajan, fix_version 38.1; 5h spent).

### Notable Changes (2026-04-13 Octary Re-sync)
- **In Progress +1 (43→44), Failed QA -1 (36→35):** One item moved out of Failed QA. Net pipeline shift minimal.
- **DBADMIN-7057** (Revert DBADMIN-7038) moved **Evaluated → In Progress** (Armen Shagmirian, WUPv12); reverts a prior database change.
- **DBADMIN-7059** (Update SyncAttributesProductMicroservicesAndCarteasy to Support Batch-B) confirmed **In Progress** (Aarthi Natarajan); updates legacy attribute sync for Taxonomy Batch-B Type/Feature attributes.
- **UTI-8531** (Usages Moved to Type Still Showing Under Usage in DY Feed) confirmed **In Progress** (Rupali Deshmukh); DY feed taxonomy correctness bug from Batch-B branch.

### Notable Changes (2026-04-13 Septenary Re-sync)
- **DBADMIN-7047** advanced Code Review → Approved Code Review (MAO line-level tax/discount backfill; due 2026-04-10, overdue, now awaiting deployment — resolves 5 Private Link order history gaps once deployed)
- **ACEDS-588** (utag_data page_type fix for search results) reached Approved Code Review; surfaced during Criteo OneTag tag verification (TEAL-2983/3017)
- **+4 In Progress** (39→43), **-3 Code Review** (8→5), **-2 Evaluated** (44→42): moderate pipeline progression
- Newly surfaced statuses: Approved Code Review (+2), QA on Prod (+1, DBADMIN-6090), Code Complete (+1, ACM-9), Blocked (+1, CI-4426) — these reflect items that existed but now have distinct status values

### Notable Changes (2026-04-13 Sextary Re-sync)
- **ACE2E-328** new epic created ("ROUND 1 Bugs") — umbrella epic for all bugs from Round 1 E2E testing; epic count 98→99
- **+1 task** (exact task TBD — consistent with ACE2E-328 child task addition)

### Notable Changes (2026-04-10 → 2026-04-13 prior)
- **+11 Closed** — steady throughput; tasks being completed
- **-11 Groomed** — items moving out of backlog into active states
- **+6 Failed QA** (30→36) — noteworthy increase; 20% growth in QA failures. Combined with -4 In Progress and -3 QA on PPE In Progress, some items advanced to testing and failed.
- **+2 Deployment - PPE** — items advanced to staging deployment

## Active vs Resolved

- **Resolved (Closed + Done + Resolved):** 2,211 (78%)
- **In pipeline (Stakeholder Test + Deployment - PPE):** 184 (6%)
- **Active (all other):** 449 (16%)

## Projects Represented

This pull spans **28 Jira projects**. Issues from 6 projects overlap with prior per-project ingests:

### Already Ingested (328 issues — duplicates, skipped for wiki)

| Project | In WPM | In Original | Notes |
|---------|--------|-------------|-------|
| ACEDS | 213 | 512 | WPM excludes cancelled + sub-tasks |
| ACAB | 98 | 283 | Same |
| ACM | 9 | 21 | Same |
| ACCMS | 7 | 9 | Same |
| ACAQA | 1 | 16 | Same |
| ACE2E | 0 | 301 | Not in WPM pull (ACE2E has its own hierarchy) |

### New Projects (2,478 issues — first time in wiki)

| Project | Count | Description |
|---------|-------|-------------|
| LP | 920 | Core LampsPlus.com — RC branches, releases, site features, taxonomy |
| DBADMIN | 459 | Database/product infrastructure — data sync, legacy tables, WUP |
| WPM | 207 | Web project management — AC implementation, integrations, docs |
| PSS | 135 | Pro Source secondary site — RC branches, releases mirroring LP |
| TEAL | 128 | Tealium analytics — data layer, UDO, tag management, EventStream |
| UTI | 123 | Utilities/APIs — Bloomreach feeds, delivery dates, facets |
| CI | 87 | CI/CD and infrastructure — Magento 2 ramp-up, WUP Dashboard |
| LPATCH | 25 | SuperCMS patches — taxonomy, category additions |
| CHA | 19 | Channel Advisor — marketplace feed research |
| MSP | 15 | Product Microservice — taxonomy, Bloomreach |
| MAR | 14 | Marketing — landing pages, Bluecore, measurement |
| EXTSRV | 14 | External services — Server Experience API |
| SCMS | 10 | SuperCMS search — config, URL structure |
| LPA | 8 | LP Accessories/Pro — discount tiers, account creation |
| WEBADMIN | 5 | Web admin — Private Link, DY feed, assets subdomain |
| LAB | 4 | A/B testing lab — shipping callouts, light collections |
| SKUOTF | 3 | SKU On The Fly microservice |
| Others | 7 | One-off issues from MSGCS, MSS, INTMKTG, DMDEV, AZFM, AS, SKU |

## Epic Categories (98 total)

| Category | Count | Epics |
|----------|-------|-------|
| Already ingested (ACE2E, ACEDS, etc.) | 40 | Duplicates of prior ingests |
| WUP Data Platform | 17 | Product data, architecture, interfaces, dashboards, SSIS |
| LP Implementation | 14 | ATP, URL structure, left nav, data cleanup, misc |
| WPM Infrastructure | 7 | Environment setup, Magento research, Tealium, search provider |
| Bloomreach | 6 | Feed generation, request-response, display, pixel, post-MVP |
| AC Discovery | 5 | Global, Products, Profile Data, Store/Kiosk, Checkout |
| Dynamic Yield | 5 | AB testing, recommendations, custom events, evaluators |
| Taxonomy | 4 | Batch A, Batch B, pre-requisites, misc |

## Key Active Areas (new projects only)

| Area | Active Issues | Key Projects |
|------|--------------|--------------|
| Tealium tag verification | 63 | TEAL |
| Database/data platform | 13 | DBADMIN |
| Core LP site | 11 | LP |
| CI/CD & Dashboard | 9 | CI |
| LP Accessories/Pro accounts | 5 | LPA |
| Pro Source site | 3 | PSS |
| A/B testing | 2 | LAB |

## Related Wiki Pages

- [[ws-data-platform]] — WUP data platform, DBADMIN, data syncing
- [[ws-tealium-tags]] — Tealium tag verification and EventStream
- [[ws-bloomreach-feed]] — Bloomreach feed generation, APIs, pixel, display
- [[ws-dynamic-yield-lp]] — DY on legacy LP site (AB testing, recommendations)
- [[ws-taxonomy]] — Taxonomy restructuring (batches A/B, pre-requisites)
- [[ws-lp-site]] — Core LP site implementation (ATP, URL structure, left nav)
- [[ws-discovery]] — AC Discovery phase research
- [[ws-infrastructure]] — Environment setup, CI/CD, Magento research
