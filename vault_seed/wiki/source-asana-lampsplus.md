---
type: source-summary
source_file: raw/asana/LAMPSPLUS/
ingested: 2026-04-17
task_count: 1961
resync: 2026-04-20T00:00
---

# Source: Asana LAMPSPLUS (2026-04-16)

## Overview
Asana project tracking the full Adobe Commerce Cloud migration, managed by Concentrix Catalyst (implementation vendor). Project owner: Megan Anaya.

**Asana GID:** 1209008749804809

## Task Counts

| Section | Open | Completed | Total |
|---------|-----:|----------:|------:|
| Implementation | 346 | 896 | 1,242 |
| Action Items | 9 | 314 | 323 |
| Milestones | 114 | 170 | 284 |
| PTO | 3 | 105 | 108 |
| Pre-Launch | 32 | 45 | 77 |
| Holidays | 2 | 21 | 23 |
| Risks | 19 | 2 | 21 |
| Launch | 9 | 0 | 9 |
| Discovery | 0 | 6 | 6 |
| Plan & Define | 0 | 3 | 3 |
| Design | 0 | 3 | 3 |
| Governance | 1 | 0 | 1 |
| **Total** | **535** | **1,565** | **2,100** |

## Key Findings

- **Vendor:** Concentrix Catalyst — comprehensive migration from existing platform to Adobe Commerce Cloud
- **Scope:** Discovery, design, implementation, pre-launch, launch — full project lifecycle
- **Naming convention:** Tasks prefixed `[LAMPSPLUS-####]` for tracked items
- **Custom fields:** UAT status, E2E status, completion %, build phase, build sprints, plus jira_* fields synced from vendor's Jira (concentrix-catalyst.atlassian.net — NOT our lampstrack.lampsplus.com Jira)
- **Skipped during wiki ingest:** PTO (108 tasks) and Holidays (23 tasks) — not relevant to migration

## Data Quality

- **Implementation:** Rich — detailed acceptance criteria, Figma mockups, UAT tracking, extensive comment threads
- **Risks:** Very high — structured cause/effect analyses with mitigation strategies
- **Action Items:** High — clear action tracking with audit trails
- **Milestones:** Medium-high — open questions and decision records, good narrative trail
- **Pre-Launch:** Lower — sparse descriptions, placeholder-level tasks

## Recent Changes (2026-04-20 Re-sync)

**1 completion + 1 new bug + 2 task updates + 1 milestone refresh (task_count 1961, unchanged):**

**Completion (Blocker resolved):**

| ID | Summary | Priority | Status | Assignee |
|----|---------|----------|--------|----------|
| [[919491 - Cart is displaying the error -We can't ship to this address right now...- when a gift card is added to the cart.\|919491]] | Cart gift card error — “We can't ship to this address right now...” | **Blocker** | **Completed / Passed-Production** 2026-04-20 | Leslie Manzanera Ornelas |

**New task:**

| ID | Summary | Priority | Status | Assignee | Due |
|----|---------|----------|--------|----------|-----|
| [[143248 - More Like This Link missing from cart\|143248]] | "More Like This" link missing from cart (slide-out panel with recommended items; originally employee-only, confirmed all users) | **P3** | Open | Leslie Manzanera Ornelas | — |

**Task status changes:**

| ID | Summary | Change |
|----|---------|--------|
| [[LAMPSPLUS-1348 - “Related Products” Button Not Functional\|LAMPSPLUS-1348]] | "Related Products" Button Not Functional (cart, Employee role, no action on click) | **task_status → On Hold** (uat_status: Ready For Testing in Production; Rajesh Kumar Mohanty) |
| [[LAMPSPLUS-224 - Data Syncing - -Private Link- Wishlist Push\|LAMPSPLUS-224]] | Data Syncing — Private Link Wishlist Push | **Assignee → Leslie Manzanera Ornelas** (was Héctor; still Failed-Production, Ready For UAT In Prod, 100%) |

**Milestone refresh:**
- [[843056 - Full Frontend Review by LP\|843056]] — FE Styling Status doc updated (April 17 EOD snapshot); uat_status: Ready For Testing in Production; Dalin Brinkman. No status change.

## Recent Changes (2026-04-19 Re-sync)

**1 new task + wave of status advances + 1 regression + LAMPSPLUS section restructure (task_count 1961, was 2142 — PTO/Holidays sections removed from export):**

**Note on count change:** PTO (108 tasks) and Holidays (23 tasks) sections no longer appear in the raw export as of this sync, reducing visible task count by 131. The 1 new task LAMPSPLUS-1521 partially offsets this. Working task count is 1,961 files (no PTO/Holidays).

**New task:**

| ID | Summary | Priority | Status | Due |
|----|---------|----------|--------|-----|
| [[LAMPSPLUS-1521 - Bug - Multishipping Errors\|LAMPSPLUS-1521]] | Bug — Multishipping Errors (no description provided) | **Critical** | To Do (0%) | 2026-04-22 |

**Dev completions — advanced to Ready For UAT / Ready For Testing in Production:**

| ID | Summary | Status | Assignee |
|----|---------|--------|----------|
| [[LAMPSPLUS-1421 - Shipping Default Error in Checkout summary\|LAMPSPLUS-1421]] | Shipping Default Error in checkout summary | Ready For UAT In Prod / **Ready For Testing in Production** | Leslie Manzanera Ornelas |
| [[LAMPSPLUS-1279 - Issues with Forms Containing an Email Address\|LAMPSPLUS-1279]] | Email form bugs across 6 forms | **Ready For UAT In Prod** (100%) | Leslie Manzanera Ornelas |
| [[899353 - Product video not displayed on PDP\|899353]] | Product video not displayed on PDP | **Ready For UAT In Prod / Ready For Testing in Production** (100%) | Unassigned |
| [[743738 - Update Button Disabled for Non-Deliverable Address in Standard Shipping Modal\|743738]] | Update button disabled for non-deliverable address | **Ready For Testing in Production** | Unassigned |
| [[946968 - Check Stock- link throws connection error instead of opening internal modal for employees\|946968]] | Check Stock link (employee) connection error | **Ready For Testing in Production** | Unassigned |
| [[LAMPSPLUS-1076 - Data Layer Event List - Link Coupon Add -Tealium-\|LAMPSPLUS-1076]] | Tealium Data Layer — Link Coupon Add event | **Ready For UAT In Prod / Ready for Retest** (100%) | Unassigned |
| [[LAMPSPLUS-857 - Employee Contact Information at Checkout\|LAMPSPLUS-857]] | Employee Contact Information at Checkout | **Ready for Retest** (100%) | Unassigned |

**Regression — Failed Production:**

| ID | Summary | Priority | Status |
|----|---------|----------|--------|
| [[LAMPSPLUS-856 - Employee Customer Checkout updates\|LAMPSPLUS-856]] | Employee Customer Checkout updates — **REGRESSION** | High | **Failed - Production** (100% coded, overdue from 2026-08-05) |

**Still active dev:**

| ID | Summary | Status |
|----|---------|--------|
| [[LAMPSPLUS-1512 - Checkout Goes Blank Using Multiple Addresses as Employee\|LAMPSPLUS-1512]] | Checkout blank for employee multi-address | In Progress 50%, due 2026-04-22 |
| [[557410 - The Short SKU is not displayed in the Print Modal\|557410]] | Short SKU not in Print Modal | In Progress 50% |
| [[828518 - Remove Item and Undo Messages Not Displayed on Cart Page After Item Removal\|828518]] | Remove Item and Undo Messages not displayed | In Progress 50% |

**Data quality concern:**
- [[LAMPSPLUS-1425 - PDP Image Gallery is Showing a Different Preview Before Loading\|LAMPSPLUS-1425]] — `status: Completed` (completed_at: 2026-04-15) but `task_status: In Progress`, `completion: 0.50`. Likely accidentally completed; needs owner review.

**62 other files touched** — metadata refreshes with no meaningful status change (UAT statuses unchanged, `modified: 2026-04-18` or `2026-04-19`).

## Recent Changes (2026-04-17 Re-sync)

**3 new bugs + LAMPSPLUS-1335 RESOLVED (task_count 2139→2142):**

**Major resolution:**
- [[LAMPSPLUS-1335 - DY scripts are not firing in the right sequence on all Commerce pages\|LAMPSPLUS-1335]] — **Done / Passed - Production** as of 2026-04-16 (Leslie Manzanera Ornelas). Was "Needs Attention / Failed - Production (25%)" — the highest-risk open production failure. Now fully closed.

**New bugs filed 2026-04-16 (all Unassigned, all due 2026-04-22):**

| ID | Summary | Priority |
|----|---------|----------|
| [[LAMPSPLUS-1509 - Bug -  Infinite looping with collectTotals().\|LAMPSPLUS-1509]] | Infinite looping with collectTotals() — no description provided | High |
| [[LAMPSPLUS-1511 - Catalog product attribute tables - Remove unused attribute\|LAMPSPLUS-1511]] | Catalog product attribute tables — remove unused attribute; no description | Critical |
| [[LAMPSPLUS-1512 - Checkout Goes Blank Using Multiple Addresses as Employee\|LAMPSPLUS-1512]] | Checkout goes blank when employee uses multiple addresses — no description | High |

**Status correction:**
- [[LAMPSPLUS-1508 - Bug -  Address validation component.\|LAMPSPLUS-1508]] — due date is 2026-05-01 (not 2026-04-22 as previously noted in prior sync).

## Recent Changes (2026-04-16 Second Resync)

**1 new bug + 4 UAT advances + 2 completions + WPM +3 (task_count 2138→2139):**

**New task:**

| ID | Summary | Priority | Assignee | Due |
|----|---------|----------|----------|-----|
| [[LAMPSPLUS-1508 - Bug -  Address validation component.\|LAMPSPLUS-1508]] | Bug — Address validation component (no description provided) | Medium | Unassigned | 2026-04-22 |

**Pre-Launch milestone completed:**
- [[LAMPSPLUS-377 - Install Vulnerability Scan Module\|LAMPSPLUS-377]] — **Completed** 2026-04-16 (Héctor Omar Tello Avellaneda). Pre-Launch / Security & Performance item. Ongoing vulnerability scan module installation — Done, due 2026-04-30.

**Dev completions — advanced to Ready For UAT:**

| ID | Summary | UAT Status | Assignee |
|----|---------|------------|----------|
| [[142611 - Shipping Tax Order Interface Failure Input value --2.4751655629139-- is out of range for the field TaxAmount (77000001195)\|142611]] | MAO TaxAmount precision error → order rejected | **Ready For UAT In Stage** (100%) | Kyle Williams |
| [[742368 -  Delayed success message when adding SKU from cart page\|742368]] | Delayed success message adding SKU from cart | **Ready For UAT In Stage** (100%) | Héctor Omar Tello Avellaneda |
| [[288603 - SKU Creation Fails with “Something went wrong” Error on Cart Page|288603]] | SKU Creation "Something went wrong" error on Cart | **Ready For UAT In Prod** (100%) | Héctor Omar Tello Avellaneda |
| [[229170 - New task created from Jira project\|229170]] | Anonymous Jira-synced task (no description) | **Ready For UAT In Stage** (100%) | Unassigned |

**Completions:**
- [[055030 - Most Popular Product Flag is Missing on Product Detail Page\|055030]] — **Completed / Not Needed** (completed 2026-04-15); task marked Not Applicable for UAT/E2E.

**Status updates (no UAT change):**
- [[LPWE-145 - Update Logic for Employee Generated Account to Send User to set password Flow Instead of Create Account Flow\|LPWE-145]] (LPWE Improvements) — **In Progress 50%** (Leslie Manzanera Ornelas); note this is in the LPWE project, listed here as a cross-project update.

## Recent Changes (2026-04-16 Re-sync)

**2 new tasks + wave of dev completions advancing to UAT (task_count 2136→2138):**

**New tasks:**

| ID | Summary | Priority | Assignee | Status |
|----|---------|----------|----------|--------|
| [[LAMPSPLUS-1503 - Bug - Wishlist dropdown double-click and max limit\|LAMPSPLUS-1503]] | Wishlist dropdown double-click and max limit bug — no description; Medium, due 2026-04-22 | Medium | Unassigned | To Do (0%) |
| [[LAMPSPLUS-1504 - PayPal Option on Cart\|LAMPSPLUS-1504]] | PayPal not enabled on Cart — root cause: "International Checkout" rule left disabled (Héctor: 2026-04-10); clarification pending on whether intentional | High | Leslie Manzanera Ornelas | To Do (0%), due 2026-04-22 |

**Dev completions — advanced to Ready For UAT:**

| ID | Change | Notes |
|----|--------|-------|
| [[LAMPSPLUS-1446 - Bug - Checkout Behavior\|LAMPSPLUS-1446]] | In Progress 50% → **Ready For UAT In Stage 100%** | High, Unassigned, due 2026-04-22; no description in file |
| [[LAMPSPLUS-1461 - Bug - Duplicate Company Assignment Causing Customer Role Conflict\|LAMPSPLUS-1461]] | In Progress 50% → **Ready For UAT In Stage 100%** | High, Unassigned, due was 2026-04-15 (overdue) |
| [[LAMPSPLUS-1496 - Bug - Default shipping address always sent as false\|LAMPSPLUS-1496]] | To Do 0% → **Ready For UAT In Stage 100%** | High, Unassigned, due 2026-04-22 |
| [[LAMPSPLUS-1268 - Frontend General Support and Updates\|LAMPSPLUS-1268]] | In Progress 50% → **Ready For UAT In Stage 100%** | Critical, Unassigned; repeated regression/advance cycle |
| [[LAMPSPLUS-1279 - Issues with Forms Containing an Email Address\|LAMPSPLUS-1279]] | In Progress 50% → **Ready For UAT In Stage 100%** | Medium (was Critical), Leslie; PR raised 2026-04-14, overdue 2026-04-15 |
| [[LAMPSPLUS-1340 - sales_order_item.updated_at not updating when sales_order.updated_at  updated (e.g. KU0102250442058199003)\|LAMPSPLUS-1340]] | → **Ready For UAT In Prod, Ready for Retest** | Medium, Antonia Hope, overdue 2026-04-08; Kyle confirmed fix on staging PL tables 2026-04-14 |

**Resolved (Done/Passed):**

| ID | Change | Notes |
|----|--------|-------|
| [[LAMPSPLUS-1451 - Bug - Employee Billing Address Error\|LAMPSPLUS-1451]] | Ready For UAT In Prod → **Done** (completed 2026-04-15) | Critical; resolved |
| [[LAMPSPLUS-1364 - TaxExemptId Expected on Orders where Tax Exemption Applied\|LAMPSPLUS-1364]] | → **Done, Passed - Production** | Medium, Leslie. Antonia confirmed pass 2026-04-15; related defect filed as new task (ID: 1214088875169804, not yet exported) |

**Production failure update:**
- [[LAMPSPLUS-263 - Cybersource Failover Customization\|LAMPSPLUS-263]] — uat_status changed to **Ready for Retest** (was Failed-Production). Miguel (2026-04-15): CC decline only occurs with Cybersource test account, not production; investigating failover order 66000006637 not reaching MAO. Tan Nguyen retesting. **Completion still 100%; still overdue from 2026-02-27.**
- [[LAMPSPLUS-1335 - DY scripts are not firing in the right sequence on all Commerce pages\|LAMPSPLUS-1335]] — still **Needs Attention / Failed - Production** (25%). Miguel (2026-04-16): DY script is in the `<head>` but positioned below other Adobe scripts; asked if that placement is acceptable. Root cause confirmed, resolution pending. Due 2026-04-17 — AT RISK.

**Milestone completed:**
- [[969039 - CHANGE v2 - -Private Link- Order History Mapping\|969039]] — **Completed** 2026-04-15 per Kyle Williams' Teams confirmation (Héctor closed). Original due 2026-02-04.

## Recent Changes (2026-04-15 Re-sync)

**11 new tasks filed + milestone completed (task_count 2125→2136):**

**Key new bugs — wave of UAT discoveries (Leslie Manzanera Ornelas, Tan Nguyen, Kyle Williams):**

| ID | Summary | Priority | Assignee | Area |
|----|---------|----------|----------|------|
| [[873346 - utag_data.website_mode is not populated correctly on all Commerce pages. For example, https---mcprod.lampsplus.com-p-56-inch-casa-esperanza-teak-bronze-and-gold-led-ceiling-.md\|873346]] | utag_data.website_mode not populated correctly on Commerce pages — should reflect Kiosk/Professional/Global mode based on context; EDS uses isKiosk flag but Commerce pages not wired | **Blocker** | Leslie Manzanera Ornelas | Tealium/Analytics |
| [[180520 - Freight Shipping Charges Not Reflected in Order Summary or Total Price on Cart Page.md\|180520]] | Freight shipping charges not reflected in cart Order Summary or Total; option selected but price not displayed | High | Leslie Manzanera Ornelas | Cart |
| [[340640 - Cart Page Tax is not Calculated and its showing '0'.md\|340640]] | Cart page shows $0 tax — similar to prior bug 980080 but appearing as a new distinct issue | High | Leslie Manzanera Ornelas | Cart/Tax |
| [[684034 - Billing address form not displayed when “My billing and shipping address are the same” checkbox is unchecked (Pros User)\|684034]] | Billing address form hidden when same-as-shipping checkbox is unchecked for Pro users | High | Leslie Manzanera Ornelas | Checkout |
| [[754491 - Product Images Missing From SFPs.md\|754491]] | Product images missing from SFPs (Special Feature Pages) | High | Leslie Manzanera Ornelas | PDP/CMS |
| [[904692 - Discontinued Product Showing Quantity left in PDP.md\|904692]] | Discontinued products still showing "X left" quantity badge on PDP | High | Leslie Manzanera Ornelas | PDP |
| [[327410 - Price Displayed for Unavailable SKU on PDP.md\|327410]] | Price shown for unavailable SKU on PDP — should be suppressed | High | Leslie Manzanera Ornelas | PDP |
| [[717739 - Unable to Close Image Modal on PDP Page.\|717739]] | Image modal cannot be closed on PDP | Unknown | Leslie Manzanera Ornelas | PDP |
| [[499092 - Product Click from PLP Leads to 404, But Search Loads Correct PDP With Incorrect URL.md\|499092]] | Product click from PLP → 404; search finds product but loads with wrong URL | High | Kyle Williams | PLP/SEO |
| [[811403 - Shipping methods not displayed on Checkout Shipping page.md\|811403]] | Shipping methods not displayed on Checkout Shipping page | Unknown | Tan Nguyen | Checkout |
| [[LAMPSPLUS-1496 - Bug - Default shipping address always sent as false\|LAMPSPLUS-1496]] | Default shipping address flag always `false` — causes incorrect address defaulting in checkout | High | Unassigned | Checkout |

**Milestone completed:**
- [[969042 - CHANGE v2 - -Private Link- Staging - Order History Table.md\|969042]] — **CHANGE v2 \| [Private Link] Staging - Order History Table** completed 2026-04-14 (Miguel Garrido, overdue from original 2026-01-14). Staging milestone done; production milestone (969045, Kyle Williams) still Open.

**Frontend Review status update (843056):**
- "Full Frontend Review by LP" updated 2026-04-14 EOD: PDP review **In Progress** (Out of Stock product still pending), Email review **In Progress** (LPWE approved), Add-to-Cart Modal **Ready for UAT**, Maintenance/50X pages **In Progress** (ETA Tuesday 2026-04-15). Most sections (Store Locator, Gift Cards, Wishlist, Scaffolding, Designer Lightning) **Done**.

**Status shifts (no new task):**
- [[LAMPSPLUS-1461 - Bug - Duplicate Company Assignment Causing Customer Role Conflict\|LAMPSPLUS-1461]] — advanced to **In Progress 50%** (modified 2026-04-15); due today (2026-04-15), High priority, Unassigned.
- [[LAMPSPLUS-1451 - Bug - Employee Billing Address Error\|LAMPSPLUS-1451]] — confirmed **Ready For UAT In Prod** (100% complete); passed into UAT queue.

**Persistent production failures (unchanged):**
- [[LAMPSPLUS-263 - Cybersource Failover Customization\|LAMPSPLUS-263]] — still Failed - Production
- [[LAMPSPLUS-1335 - DY scripts are not firing in the right sequence on all Commerce pages\|LAMPSPLUS-1335]] — still Needs Attention / Failed - Production

## Recent Changes (2026-04-14 Re-sync)

**Large wave of dev completions + 5 new tasks (task_count 2120→2125):**

**Fully Resolved (Done + Passed Production):**

| ID | Summary | Priority |
|----|---------|----------|
| [[LAMPSPLUS-802 - -API MESH- Gift Card Reverse Authorization Integration - Failure Online Payment Methods\|LAMPSPLUS-802]] | Gift Card Reverse Authorization Integration (API MESH) — Critical integration for failed payment reversal; now Done + Passed Production | Critical |
| [[LAMPSPLUS-687 - Link-Search Account Customer Profile Form\|LAMPSPLUS-687]] | Link/Search Account Customer Profile Form — Done + Passed Production | Medium |
| [[LAMPSPLUS-1385 - Careers Page Banner Image Layout Issue\|LAMPSPLUS-1385]] | Careers Page Banner Image Layout fix — Done + Passed Production (Leslie Manzanera Ornelas) | Medium |
| [[LAMPSPLUS-1426 - UMRP Popup – Remove Functionality (Storefront Only)\|LAMPSPLUS-1426]] | UMRP Popup Remove (storefront) — Ready For UAT In Prod + Passed Production (Leslie) | Critical |

**Dev Complete — Ready For UAT (new this sync):**

| ID | Summary | Priority | Assignee |
|----|---------|----------|----------|
| [[LAMPSPLUS-1451 - Bug - Employee Billing Address Error\|LAMPSPLUS-1451]] | Employee Billing Address Error — Critical, Ready For UAT In Prod (100%) | Critical | Unassigned |
| [[LAMPSPLUS-1425 - PDP Image Gallery is Showing a Different Preview Before Loading\|LAMPSPLUS-1425]] | PDP Image Gallery Preview pre-load issue — Ready For UAT In Prod (100%) | Medium | Unassigned |
| [[LAMPSPLUS-1421 - Shipping Default Error in Checkout summary\|LAMPSPLUS-1421]] | Shipping Default Error in checkout summary — Ready For UAT In Prod (100%) | Medium | Leslie Manzanera Ornelas |
| [[LAMPSPLUS-1332 - lp_source_event data coming from AC to WUP should include specific source name in ACDATA.dbo.AdobeCustomerDataEvents table.\|LAMPSPLUS-1332]] | lp_source_event data to WUP — Ready For UAT In Prod (100%) | High | Miguel Garrido |
| [[LAMPSPLUS-1365 - Store Locator Amasty patch\|LAMPSPLUS-1365]] | Store Locator Amasty patch — Ready For UAT In Prod (100%) | Medium | Unassigned |
| LAMPSPLUS-1394 | Short SKU on PDP (Grouping SKU shown instead) — Ready For UAT In Prod (100%) | High | Miguel Garrido |
| [[LAMPSPLUS-732 - MultiAddress checkout - Address per line in Single Address Checkout page\|LAMPSPLUS-732]] | **MultiAddress Checkout (per-line employee shipping)** — Critical, was In Progress 50%; now **Ready For UAT In Stage (100%)** | Critical | Unassigned |
| [[LAMPSPLUS-939 - Data Syncing - -Private Link- Cart Push\|LAMPSPLUS-939]] | Cart Push Private Link Sync — Ready For UAT In Stage (100%) | Medium | Unassigned |
| [[LAMPSPLUS-1428 - Align Clearance-Open Box Logic on PLA with PDP\|LAMPSPLUS-1428]] | Clearance/OB PLA Logic — Ready For UAT In Stage (100%); was 50% at-risk as of 2026-04-13 | High | Leslie Manzanera Ornelas |

**In Progress Advances:**

| ID | Change | Notes |
|----|--------|-------|
| [[LAMPSPLUS-1446 - Bug - Checkout Behavior\|LAMPSPLUS-1446]] | To Do 0% → **In Progress 50%** | Previously unassigned High priority checkout bug; now picked up |
| [[LAMPSPLUS-1279 - Issues with Forms Containing an Email Address\|LAMPSPLUS-1279]] | 25% → **50%** In Progress | Due 2026-04-15; improving but still at-risk |

**Regressions / On Hold:**

| ID | Change | Notes |
|----|--------|-------|
| [[LAMPSPLUS-1268 - Frontend General Support and Updates\|LAMPSPLUS-1268]] | Was "Ready For UAT In Stage 100%" (decenary) → back to **In Progress 50%** Unassigned | Status rollback or sync artifact; still Critical |
| [[LAMPSPLUS-1348 - “Related Products” Button Not Functional\|LAMPSPLUS-1348]] | → **On Hold** | Tan Nguyen; uat_status "Ready For Testing in Production" but task on hold |

**New tasks (+5, task_count 2120→2125):**

| ID | Summary | Status | Notes |
|----|---------|--------|-------|
| [[LAMPSPLUS-1462 - Bug - Inconsistent State Mapping for International Addresses -MAO-\|LAMPSPLUS-1462]] | Bug — Inconsistent State Mapping for International Addresses (MAO) | To Do — 0% — Medium — Unassigned | New MAO integration bug |
| [[229170 - New task created from Jira project\|229170]] | Anonymous task from Jira (no description) | To Do — 0% — Medium — Unassigned | Auto-created Jira placeholder |
| [[461077 - New task created from Jira project\|461077]] | Anonymous task from Jira (no description) | Ready For UAT In Prod — 100% — Medium — Unassigned | Dev complete, no context |
| [[567473 - New task created from Jira project\|567473]] | Anonymous task from Jira (no description) | In Progress — 50% — Medium — Unassigned | In active dev |
| [[926602 - New task created from Jira project\|926602]] | Anonymous task from Jira (no description) | Ready For UAT In Prod — 100% — Medium — Unassigned | Dev complete, no context |

**Still open production failures:**
- [[LAMPSPLUS-263 - Cybersource Failover Customization\|LAMPSPLUS-263]] — Still Failed - Production; dev is 1.00 complete but QA continues to fail (Leslie Manzanera Ornelas)
- [[LAMPSPLUS-1335 - DY scripts are not firing in the right sequence on all Commerce pages\|LAMPSPLUS-1335]] — Still Needs Attention / Failed - Production (25% complete)

## Recent Changes (2026-04-13 Decenary Re-sync)

**1 new task + 1 status update (task_count 2119→2120):**

| ID | Summary | Area | Priority | Assignee | Status |
|----|---------|------|----------|----------|--------|
| [[766083 - Remove autofill from the Commission Employee field\|766083]] | Remove browser autofill from Commission Employee field on cart — prevents employees from accidentally submitting orders with wrong commission data | Cart | Medium | Leslie Manzanera Ornelas | Ready For UAT In Prod (100% complete) |

**Status update (no task_count change):**
- **[[LAMPSPLUS-1268 - Frontend General Support and Updates\|LAMPSPLUS-1268]]** — Previously tracked as 50% / In Progress / Critical / Unassigned. Now `task_status: "Ready For UAT In Stage"`, completion: 1.00. Frontend General Support task completed development and advanced to UAT stage testing.

**Field updates (no meaningful change):**
- 142611, 574213, 860227, 983224, 958535, 991902 (Order Integration Bugs), LAMPSPLUS-1281, LAMPSPLUS-1428 — timestamp refreshes only; statuses unchanged.

## Recent Changes (2026-04-13 Novenery Re-sync)

**2 newly exported tasks (task_count 2117→2119):**

| ID | Summary | Area | Priority | Assignee | Status |
|----|---------|------|----------|----------|--------|
| [[595444 - New task created from Jira project\|595444]] | Anonymous task created from Jira — no description, no owner; 50% complete, In Progress | Unknown | Medium | Unassigned | Open — Not Ready To Test |
| [[LAMPSPLUS-1316 - Breadcrumb URL fragment concatenation should be done on Commerce side\|LAMPSPLUS-1316]] | Breadcrumb URL fragment concatenation moved to Commerce side — WUP stopped sending concatenated paths (DBADMIN-6820/6931); Commerce now concatenates from JSON fragments; completed 2026-04-13 by Jayasri Krithivasan | PDP | Medium | Jayasri Krithivasan | **Completed** — Ready For Testing in Production |

**Notes:**
- LAMPSPLUS-1316 is a Commerce Bug that resolves a data handoff change: WUP (DBADMIN-6820/6931) changed to send raw JSON fragments instead of concatenated URLs; Commerce now handles concatenation. Kyle Williams commented with a screenshot 2026-04-13 confirming completion.
- 595444 ("New task created from Jira project") is an auto-generated placeholder. No description, no assignee, no Jira link visible. Cannot map to a workstream without more context.
- LAMPSPLUS-1268 (Frontend General Support) — timestamp-only update; still In Progress, 50%, Unassigned, Critical.

## Recent Changes (2026-04-13 Octary Re-sync)

**3 new LAMPSPLUS tasks (2 resolved/near-resolved, 1 active design decision):**

| ID | Summary | Area | Priority | Assignee | Status |
|----|---------|------|----------|----------|--------|
| [[520010 - 'Add Bulbs' link is Missing on Cart Page\|520010]] | "Add Bulbs" link missing on Cart page (mcprod); Eilat confirmed 2026-04-10 to restore per-line + cart-level link for all user types; FE dev in progress | Cart | High | Eilat Vardi | Open — Not Ready To Test |
| [[LAMPSPLUS-1281 - Pro Savings Incorrect Calculation - Open Box\|LAMPSPLUS-1281]] | Pro Savings incorrectly included OB product discount in calculation; fix confirmed by Adam Blais 2026-04-10, rounding behavior clarified (round down on PLP/PDP, exact on cart) | Cart/Pricing | Critical | Adam Blais | 100% complete — UAT Passed Production |
| [[LAMPSPLUS-1446 - Bug - Checkout Behavior\|LAMPSPLUS-1446]] | Checkout Behavior bug — no description provided; High priority, due 2026-04-22, Unassigned, 0% | Checkout | High | Unassigned | To Do — Not Ready To Test |

**Notes:**
- 520010 represents a feature re-addition, not just a bug: "Add Bulbs" was previously removed per Figma but Eilat re-approved it. Both per-line and cart-level "Add Bulbs" links to be shown for consumers and employees.
- LAMPSPLUS-1281 is effectively complete — Adam Blais closed it 2026-04-10 after confirming the rounding discrepancy is intentional (UAT Sprint 28, Passed - Production).
- LAMPSPLUS-1446 had a prior file entry (already referenced in status page as at-risk for 2026-04-15) but this is its first full export. The file contains no description — needs owner triage.

## Recent Changes (2026-04-13 Sextary Re-sync)

**2 newly tracked Order Integration Bug tasks (previously existed in Asana but first exported after Héctor's follow-up comments tonight):**

| ID | Summary | Area | Priority | Assignee | Status |
|----|---------|------|----------|----------|--------|
| [[440428 - Transition the MAO Integration to Use Line-Level Details\|440428]] | Transition MAO to use new line-level discount/tax fields from ACData.dbo.OrderItemData (LineSalesTax, LineShippingTax, LineProfessionalDiscount, LineManualDiscount, LinePromoDiscount, LinePromoFreightDiscount) | Order Integration | Critical | Antonia Hope | Ready for Retest (100% complete) |
| [[LAMPSPLUS-1382 - Order failed in MAO – Line discount exceeds line subtotal\|LAMPSPLUS-1382]] | MAO order failure: "Total line discount cannot exceed more than the line subtotal" for orders with KIT items (employee checkout with credit card) | Order Integration | Medium | magrawal@lampsplus.com | Ready for Retest (100% complete) |

**Context:** Both tasks are 100% coded and awaiting QA in Production. Kyle Williams deployed a fix for LAMPSPLUS-1382 on 2026-03-27 ("placed fixed since order was placed — please retry"). Héctor followed up on both at ~18:45 today. Note: **440428 is directly related to the 5 Private Link order history gaps from the quaternary sync** — the new line-level fields (LineSalesTax, LineShippingTax, etc.) ARE the fields that were missing from order history. Completing 440428 QA would resolve those gaps.

## Recent Changes (2026-04-13 Quinary Re-sync)

**4 new bugs + 2 field updates (6 task files + MOC/section index modified):**

| ID | Summary | Area | Priority | Assignee |
|----|---------|------|----------|----------|
| [[471526 - Technical Specification section is displayed even when there are no specifications available for the SKU\|471526]] | Technical Specification section shows when no specs available for SKU (should hide, per LP site) | PDP | Medium | Leslie Manzanera Ornelas |
| [[498161 - Updated Cart Name is Displayed Below Shopping cart instead of Appearing to the Left of the Edit button\|498161]] | Cart Name position wrong — displays below cart instead of left of Edit button | Cart | High | Héctor Omar Tello Avellaneda |
| 665884 - PayPal Option not Enabled on Cart | PayPal not enabled on cart for Guest/Employee; root cause: "International Checkout" rule left disabled | Cart/Payments | High | Héctor Omar Tello Avellaneda |
| [[LAMPSPLUS-1461 - Bug - Duplicate Company Assignment Causing Customer Role Conflict\|LAMPSPLUS-1461]] | Duplicate Company Assignment causes Customer Role Conflict | User Management | High | Unassigned |

**Field updates (no content change):**
- [[553885 - Countdown Timer Still Visible on Cart Page After Being Disabled in Configuration.\|553885]] — Héctor confirmed replication 2026-04-13 18:32; due 2026-04-22
- [[LAMPSPLUS-732 - MultiAddress checkout - Address per line in Single Address Checkout page\|LAMPSPLUS-732]] — Critical, In Progress, 50%, Unassigned (Sprint 31 checkout story; enables per-item shipping addresses for employee checkout)

## Recent Changes (2026-04-13 Quaternary Re-sync)

**New project/section: 8 Order Integration Bugs**

A new LAMPSPLUS Asana project (GID: 1209008749804809) was added with 8 tasks, all filed 2026-04-08/09 through the E2E Bug Submission form. All assigned to Kyle Williams, all 0% completion, all "Not Ready To Test". These are production-blocking order data integrity bugs:

| ID | Summary | Category |
|----|---------|----------|
| [[142611 - Shipping Tax Order Interface Failure Input value --2.4751655629139-- is out of range for the field TaxAmount (77000001195)\|142611]] | Shipping TaxAmount not rounded to 2dp → order fails to MAO | MAO Interface |
| [[849028 - Duplicate Order Interfaces Processing to MAO (e.g. 000002449)\|849028]] | Duplicate orders being submitted to MAO | MAO Interface |
| [[980080 - Cart page Order Summary displays incorrect tax amount compared to existing Lamps Plus site\|980080]] | Cart page shows $0.00 tax for guests (previously tracked) | Tax Display |
| [[574213 - Private Link Reference to ACData.dbo.OrderItemData.LINE_PROMO_DISCOUNT Not Accurately Reflected On Order History (66000006487)\|574213]] | LINE_PROMO_DISCOUNT not on order history | Private Link |
| [[983224 - Private Link Reference to ACData.dbo.OrderItemData.LINE_MANUAL_DISCOUNT Not Reflected On Order History (IJ0102251406031729003 and 66000005957)\|983224]] | LINE_MANUAL_DISCOUNT not on order history | Private Link |
| [[958535 - Private Link Reference to ACData.dbo.OrderItemData.LINE_PROFESSIONAL_DISCOUNT Not Reflected On Order History (66000006408)\|958535]] | LINE_PROFESSIONAL_DISCOUNT not on order history | Private Link |
| [[991902 - Private Link Reference to ACData.dbo.OrderItemData.LINE_SHIPPING_TAX Not Reflected On Order History (77000001072)\|991902]] | LINE_SHIPPING_TAX not on order history | Private Link |
| [[860227 - Order Line Status Inconsistent with Private Link (CF0815241814444439003)\|860227]] | Order line status inconsistent between AC and Private Link | Private Link |

**Patterns:**
- **MAO Interface (2 bugs):** Order submission to MAO failing due to data formatting (TaxAmount precision) and duplicate processing. Both are pre-go-live blockers for order placement.
- **Private Link Order History (5 bugs):** Several discount/tax fields in `ACData.dbo.OrderItemData` are not being populated from Adobe Commerce data. These fields are used by the legacy site's order history pages, creating data gaps post-launch.

## Recent Changes (2026-04-13 Tertiary Re-sync)

**Updated tasks (4 files modified):**

- **[[LAMPSPLUS-1279 - Issues with Forms Containing an Email Address|LAMPSPLUS-1279]] (Email Form Bugs)** — Eilat Vardi added updated form audit table on 2026-04-13 17:50 clarifying that all employee user forms should display email field as "Required (not pre-populated)" — **never pre-populated for any employee type**. Task still at 25% / Needs Attention / due 2026-04-15. **AT RISK** — due tomorrow, only 25% complete.
- **[[LAMPSPLUS-267 - Cybersource Payment Method Credentials Enhancements Support|LAMPSPLUS-267]] (Cybersource Credentials)** — uat_status changed to **"Ready for Retest"** (Leslie returned from PTO 2026-04-13). Leslie left a retest request on 2026-04-09 with QA order reference. Pro merchant ID fix for saved cards needs verification. Task at 1.00 completion, awaiting Tan Nguyen retest.
- **[[LAMPSPLUS-263 - Cybersource Failover Customization|LAMPSPLUS-263]] (Cybersource Failover)** — No new comments since Miguel Garrido's 2026-04-10 note about the Cybersource test order price range rule ($1,200–$1,600 fails due to CyberSource range policy, not a code bug). Still Failed - Production. Investigation ongoing.
- **[[LAMPSPLUS-1268 - Frontend General Support and Updates|LAMPSPLUS-1268]] (Frontend General Support)** — No new comments. Still In Progress, 50%, Unassigned, Critical. Timestamp-only update.

**Key risk:**
- LAMPSPLUS-1279 (email form bugs) is due 2026-04-15 at 25% complete. 6 forms with issues identified. Eilat clarified requirements — CNX needs to implement fixes today.

## Recent Changes (2026-04-13 Secondary Re-sync)

**Updated tasks (3 files modified):**

- **[[845560 - Apple Pay Option not Enabled on Cart.|845560]] (Apple Pay not on Cart)** — Eilat Vardi confirmed: **Apple Pay AND Google Pay have been removed from go-live scope**. Bug can be cancelled. ACE2E-290 (Style Cart Page) is the related Jira item.
- **[[LAMPSPLUS-224 - Data Syncing - -Private Link- Wishlist Push|LAMPSPLUS-224]] (Wishlist Private Link Sync)** — Still "Failed - Production." New UAT issues found 2026-04-10:
  1. Wishlist quantity update does not persist (resets to 1 on navigation) — AC uses checkbox on add-to-cart, not wishlist; enhancement needed for wishlist qty
  2. On PDP with multiple wishlists, clicking heart icon shows "+Add new Wish List" first instead of existing lists — CNX confirmed internal bug, will fix
  3. First wishlist always loads regardless of which was last active — being sent to LP design team for review
  Max 3 public wishlists is intentional (configurable in Admin). Issues 1 and 3 sent to LP design team.
- **[[LAMPSPLUS-1327 - Bug - Google API Shipping Address Validation|LAMPSPLUS-1327]] (Google API Shipping)** — No new comments since 2026-03-24. Likely a field/metadata update only. Still In Progress, 50%, Unassigned.

**Scope decision (important):** Apple Pay and Google Pay removed from go-live. No go-live testing needed for these payment methods. Related ACE2E tasks (ACE2E-168 Google Pay, ACE2E-169 Apple Pay) can be deprioritized.

## Recent Changes (2026-04-13 Re-sync)

**Newly opened (today):**
- 553885 — Countdown Timer Still Visible on Cart Page (Bug, Hector Tello)
- 980080 — Cart Order Summary incorrect tax ($0.00 for guests) (Bug, Hector Tello, linked to ACE2E-234)

**Completed/closed (today):**
- 472787 — Product Quantity Update on Cart/PDP (closed as expected AC behavior)
- 739235 — Bulb SKU qty prefill (closed as acceptable difference — req was qty=0)
- 877083 — Zip Code BOPIS modal (bug no longer reproducible)

**Active UAT failures (high priority):**
- LAMPSPLUS-263 — Cybersource Failover (Failed - Production, overdue from Sprint 28)
- LAMPSPLUS-1070 — Tealium view_item event (Failed - Production, 50% complete)
- LAMPSPLUS-1335 — DY script sequencing on Commerce pages (Failed - Production, dev says 100% but QA fails)

**At-risk due dates (2026-04-15):**
- LAMPSPLUS-1279 — Email form bugs across 6 forms (25% complete, Critical)
- LAMPSPLUS-1428 — Clearance/OB PLA logic (50% complete)
- LAMPSPLUS-1446 — Checkout Behavior bug (0% complete, no description)

**Notable:** Leslie Manzanera Ornelas returned from PTO 2026-04-13 — she is assignee on 7+ active items.

## Notes
- Jira references within tasks are from the vendor's own Jira instance (concentrix-catalyst.atlassian.net), not from our Jira (lampstrack.lampsplus.com). Only references with lampstrack URLs are linked to our wiki.
- Original launch target was July/August 2025; has been revised multiple times (see risk items).
