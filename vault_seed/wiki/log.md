# Log

> Append-only record of wiki operations. Each entry prefixed with date and operation type.

## [2026-04-20] resync | 919491 Blocker COMPLETED + 1 new bug + LPWE-172 new request + WPM 2,910→2,921 (scheduled auto-sync)

- **Scope:** 2,975 raw files newer than log.md (full re-pull of WPM + Asana LAMPSPLUS/LPWE changes)
- **Asana LAMPSPLUS changes (task_count 1961, unchanged):**
  - **Completion (Blocker):** [[919491 - Cart is displaying the error -We can't ship to this address right now...- when a gift card is added to the cart.|919491]] — **Completed / Passed-Production** 2026-04-20 (Leslie Manzanera Ornelas). Cart gift card error “We can't ship to this address right now...” resolved. Was a Blocker-priority bug.
  - **New task:** [[143248 - More Like This Link missing from cart|143248]] — P3, Open, Leslie Manzanera Ornelas, created 2026-04-20. Cart “More Like This” link missing (should open slide-out panel with recommended items; confirmed for all users, not employee-only).
  - **Status change:** [[LAMPSPLUS-1348 - “Related Products” Button Not Functional|LAMPSPLUS-1348]] — task_status → **On Hold** (uat_status: Ready For Testing in Production; Rajesh Kumar Mohanty; Medium/P3).
  - **Reassignment:** [[LAMPSPLUS-224 - Data Syncing - -Private Link- Wishlist Push|LAMPSPLUS-224]] — assignee changed from Héctor Omar Tello Avellaneda to **Leslie Manzanera Ornelas**; still Failed-Production.
  - **Milestone refresh:** [[843056 - Full Frontend Review by LP|843056]] — FE Styling doc updated (April 17 EOD content); uat_status: Ready For Testing in Production; Dalin Brinkman.
- **Asana LPWE changes (task_count 193, unchanged):**
  - **New task:** [[LPWE-172 - Update Graphql on Employee switcher-session to call AC Directly|LPWE-172]] — New Request, Héctor Omar Tello Avellaneda, created 2026-04-20. Update GraphQL on Employee switcher/session to call AC Directly. No description yet.
  - **Metadata refresh:** [[LPWE-23 - Kiosk Detection Using IP Range|LPWE-23]] — modified 2026-04-20; still To Do (0%), Estimate Approved, Héctor. No status advance.
- **WPM changes (2,910→2,921, +11 net new):** Full re-pull (2,896 of 2,921 files re-exported). 26 Branch RC files now included (taxonomy/URL structure: LP-68289 through LP-72123, MSP-1056/1073/1079, PSS-1669; all Closed). 26 ACAB Bug files refreshed. No new active pipeline changes.
- **Wiki pages updated:** source-asana-lampsplus.md (2026-04-20 section added), source-asana-lpwe.md (2026-04-20 section added), source-jira-wpm.md (task_count 2910→2921, 2026-04-20 section added), status-2026-04-20.md (created), status-2026-04-19.md (archived → wiki/archive/), log.md
- **Lint fixes (2):**
  - Fixed literal / escape sequences in wikilink targets (source-asana-lampsplus.md, status-2026-04-20.md) — replaced with actual Unicode curly-quote characters copied from disk stems
  - Full-wiki exact-stem check: 0 broken raw-file links across all 79 wiki pages; 0 ASCII-quote ghosts

## [2026-04-19] resync | LAMPSPLUS-1521 Critical new bug + LPWE-150 completed + 7 new WPM items (scheduled auto-sync)

- **Scope:** 3,022 raw files newer than log.md (full re-pull of WPM + ACAB/ACE2E updates + Asana LAMPSPLUS/LPWE changes)
- **Asana LAMPSPLUS changes (task_count 2142→1961; PTO/Holidays sections removed from export):**
  - **New task:** [[LAMPSPLUS-1521 - Bug - Multishipping Errors\|LAMPSPLUS-1521]] — Critical, To Do (0%), Unassigned, created 2026-04-18, due 2026-04-22. No description provided.
  - **Regression:** [[LAMPSPLUS-856 - Employee Customer Checkout updates\|LAMPSPLUS-856]] — `uat_status: "Failed - Production"` (was previously in UAT queue). 100% coded, assignee Unassigned.
  - **Dev completions (advanced to UAT):** LAMPSPLUS-1421, LAMPSPLUS-1279, 899353, 743738, 946968, LAMPSPLUS-1076, LAMPSPLUS-857 all advanced to Ready For UAT / Ready For Testing in Production.
  - **Active dev:** LAMPSPLUS-1512 In Progress 50%; 557410 In Progress 50%; 828518 In Progress 50%.
  - **Data quality concern:** [[LAMPSPLUS-1425 - PDP Image Gallery is Showing a Different Preview Before Loading\|LAMPSPLUS-1425]] — `status: Completed` (completed_at: 2026-04-15) but `task_status: In Progress` / `completion: 0.50`. Likely accidental close.
  - **Note on count drop:** PTO (108) and Holidays (23) sections no longer exported (131 tasks removed). Net: 2142 - 131 + 1 new = 2012 expected vs. 1961 actual; some additional tasks may have been moved/deleted in Asana.
- **Asana LPWE changes (task_count 191→193; +2 tasks):**
  - **Completion:** [[LPWE-150 - Support Anonymous Cart Across Both Platforms\|LPWE-150]] — Completed / Closed 2026-04-17 (Héctor Omar Tello Avellaneda). Major New Feature milestone shipped.
  - **Section restructure:** New "Implementation" section created; [[LPWE-124 - Update ATP - Delivery Date Logic\|LPWE-124]] moved from Bug Fixes to Implementation. Bug Fixes now 2 tasks; Improvements now 122 (+2).
- **WPM changes (+8, total 2,902→2,910):** 7 new tasks created 2026-04-17:
  - [[ACE2E-351 - Sitemaps Validation -- HTML CMS, Video, and Store Locator (ACE2E-158, 159, 161)\|ACE2E-351]], [[ACE2E-352 - Core Web Vitals QA -- Performance Parity Review (Legacy vs Adobe)\|ACE2E-352]] — QA tasks (Groomed, Unassigned)
  - [[ACEDS-615 - Research Logic On PLP Wish List Functionality (For Pros-Employee-Kiosk)\|ACEDS-615]] — Wishlist research (Groomed, Unassigned)
  - [[LP-72655 - Identify GA4 custom events on legacy WUP site\|LP-72655]] — GA4 custom events audit (Evaluating, Unassigned)
  - [[TEAL-3140 - -adobecommerce- profile - Platform identifier - GA4 -ecp- mappings for  ecommerce events\|TEAL-3140]], [[TEAL-3141 - -adobecommerce- profile - Platform identifier - GA4 -ecp- mappings for custom events\|TEAL-3141]] — GA4 ecp profile mappings
  - [[TEAL-3143 - Pebblepost pixel is not firing on Order Confirmation page\|TEAL-3143]] — **New Bug** (Open, High, Glenn Vergara)
  - Updated: [[PSS-1953 - Support Showing QuickShip Facet On LP-AC (Part 4)\|PSS-1953]] → Deployment-PPE; [[DBADMIN-7032 - Update Quick Ship Attribute Value in tblAttributeValue to -Same Day Shipping-\|DBADMIN-7032]] → Stakeholder Test; ACE2E-101 got Eilat comment.
- **ACAB changes (283→284):** [[ACAB-331 - Applying All Filters under Specials Returns 404 Page\|ACAB-331]] — new Bug (Closed, resolved 2026-04-13; Naga Ambarish Chigurala; efq/fq Bloomreach fix).
- **Wiki pages updated:** source-jira-wpm.md, source-asana-lampsplus.md, source-asana-lpwe.md, source-jira-acab.md
- **Status page:** Created status-2026-04-19.md; archived status-2026-04-17.md → wiki/archive/
- **Lint fixes (3):**
  - `684034` link in status page: replaced ASCII straight quotes with exact Unicode curly-quote stem (U+201C/U+201D) copied from filename on disk
  - `LAMPSPLUS-1508` link: corrected single space to double space (`Bug -  Address`) to match raw filename
  - `LAMPSPLUS-1509` link: corrected single space to double space (`Bug -  Infinite`) to match raw filename
  - Full-wiki ASCII-quote ghost scan: 0 ghosts detected across 53 stems with Unicode characters

## [2026-04-17] resync | LAMPSPLUS-1335 DY scripts RESOLVED + 3 new bugs + WPM +55 files (scheduled auto-sync)

- **Scope:** 3,009 raw files newer than log.md (full re-pull); meaningful changes in Asana LAMPSPLUS (+3 new bugs, major LAMPSPLUS-1335 resolution), Asana LPWE (status corrections, no new tasks), WPM +55 files (52 ACAB Bloomreach bugs + Task/Epic additions)
- **Asana LAMPSPLUS changes (+3 tasks, task_count 2139→2142):**
  - **MAJOR RESOLUTION:** [[LAMPSPLUS-1335 - DY scripts are not firing in the right sequence on all Commerce pages\|LAMPSPLUS-1335]] — **Done / Passed - Production** as of 2026-04-16 (Leslie Manzanera Ornelas). Was "Needs Attention / Failed - Production (25%)" — the highest-risk open production failure as of yesterday's sync. Now fully closed.
  - **New bugs (all filed 2026-04-16, all Unassigned, all due 2026-04-22):**
    - [[LAMPSPLUS-1509 - Bug -  Infinite looping with collectTotals().\|LAMPSPLUS-1509]] — High, no description
    - [[LAMPSPLUS-1511 - Catalog product attribute tables - Remove unused attribute\|LAMPSPLUS-1511]] — Critical, no description
    - [[LAMPSPLUS-1512 - Checkout Goes Blank Using Multiple Addresses as Employee\|LAMPSPLUS-1512]] — High, no description
  - **Correction:** [[LAMPSPLUS-1508 - Bug -  Address validation component.\|LAMPSPLUS-1508]] — due date corrected to 2026-05-01 (prior sync noted 2026-04-22)
- **Asana LPWE changes (task_count 191, unchanged):**
  - [[LPWE-26 - Discounting Rules - Employee Discount Logic\|LPWE-26]] — raw file `task_status: "Ready For UAT In Prod"` (was noted as On Hold in prior sync per EOD comment); `uat_status: "Failed - Production"` unchanged. On Hold state was transient or comment-level only.
  - [[LPWE-84 - Tax Exempt Checkbox for Pro Sessions with a Tax Exempt Certificate\|LPWE-84]] — new tester being assigned (Tan is out); task still To Do 0%, UAT Ready for Retest.
  - [[LPWE-169 - On Shipping Page, Add Fallback Delivery Range Countdown Message\|LPWE-169]] — `estimate_approval: "Pending Estimate Approval"` confirmed in raw file (Héctor's 8h estimate awaiting LP sign-off).
  - [[LPWE-136 - Send the Import Cart Source to MAO\|LPWE-136]] — metadata refresh only; `uat_status: "Passed - Production"` but `task_status: "To Do"` (data quality anomaly, no action needed).
- **WPM changes (+55, total 2,847→2,902):** Full re-pull. 52 new ACAB Bug files now in raw/ (Bloomreach/search bugs, mostly Closed/Groomed); Task +40, Epic +2, Research +1, Test Case +1, Bug +7 net. No dramatic status pipeline change from prior sync.
- **Pages updated:** source-asana-lampsplus (2139→2142, 2026-04-17 section), source-asana-lpwe (task_count 191, 2026-04-17 section), source-jira-wpm (2847→2902, 2026-04-17 section), status-2026-04-17 (created), status-2026-04-16 (archived to wiki/archive/), log.md
- **Wikilink validation:** 5,579 raw stems indexed; all wiki pages scanned — 0 broken raw-file wikilinks.
  - **Lint fix (1):** [[684034 - Billing address form not displayed when “My billing and shipping address are the same” checkbox is unchecked (Pros User)|684034]] — filename uses Unicode curly quotes (U+201C/U+201D); status-2026-04-17.md was written with ASCII `"` which would fail in Obsidian. Corrected to exact Unicode stem.

## [2026-04-16] resync | Pre-Launch security scan done + 4 UAT advances + LAMPSPLUS-1508 new bug + WPM +3 (scheduled auto-sync)

- **Scope:** 2,927 files touched by full re-pull (2,850 WPM, 77 Asana); meaningful changes in Asana LAMPSPLUS (+1 new task, 4 UAT advances, 1 Pre-Launch milestone), WPM +3 issues
- **Asana LAMPSPLUS changes (+1 task, task_count 2138→2139):**
  - **New task:** [[LAMPSPLUS-1508 - Bug -  Address validation component.|LAMPSPLUS-1508]] (Medium, Unassigned, due 2026-04-22; no description provided — filed 2026-04-16)
  - **Pre-Launch milestone:** [[LAMPSPLUS-377 - Install Vulnerability Scan Module|LAMPSPLUS-377]] — **Completed** 2026-04-16 (Héctor Omar Tello Avellaneda; Pre-Launch / Security & Performance)
  - **UAT advances (new this sync):** [[142611 - Shipping Tax Order Interface Failure Input value --2.4751655629139-- is out of range for the field TaxAmount (77000001195)|142611]] → Ready For UAT In Stage 100% (Kyle; was "awaiting triage"); [[742368 -  Delayed success message when adding SKU from cart page|742368]] → Ready For UAT In Stage 100% (Héctor); [[288603 - SKU Creation Fails with “Something went wrong” Error on Cart Page|288603]] → Ready For UAT In Prod 100% (Héctor); [[229170 - New task created from Jira project|229170]] → Ready For UAT In Stage 100% (Unassigned)
  - **Completion:** [[055030 - Most Popular Product Flag is Missing on Product Detail Page|055030]] — Completed / Not Needed (2026-04-15; not captured in prior sync)
  - **LPWE cross-update:** [[LPWE-145 - Update Logic for Employee Generated Account to Send User to set password Flow Instead of Create Account Flow|LPWE-145]] — In Progress 50% (Leslie)
- **WPM changes (+3, total 2844→2847):** Full re-pull; type shifts (Task +4, Research +2, Bug -1, Epic -1, Test Case -1 per MOC). No dramatic pipeline change from prior sync.
- **Pages updated:** source-asana-lampsplus (2138→2139, Second Resync 2026-04-16 section), source-jira-wpm (2844→2847, issue counts + 2026-04-16 notable changes), status-2026-04-16 (updated source table, added LAMPSPLUS-1508 to new bugs, LAMPSPLUS-377 to positives, 142611 advance, order integration bug count updated to 7), log.md
- **Wikilink validation:** 5,535 raw stems indexed; all wiki pages scanned — 0 broken raw-file wikilinks.
  - **Lint fix (1):** [[288603 - SKU Creation Fails with “Something went wrong” Error on Cart Page|288603]] — filename uses Unicode curly quotes (U+201C/U+201D); ASCII `"` in new links would fail in Obsidian. Fixed in source-asana-lampsplus.md, status-2026-04-16.md, and log.md to use exact Unicode stem.

## [2026-04-16] resync | 2 new bugs + 8 dev completions + LPWE-26 regression + 3 LPWE completions (scheduled auto-sync)

- **Scope:** ~2,956 Asana/WPM files touched by full re-pull; meaningful changes in Asana LAMPSPLUS (+2 tasks, multiple status advances) and Asana LPWE (3 completions, 1 regression, estimate progress)
- **Asana LAMPSPLUS changes (+2 tasks, task_count 2136→2138):**
  - **New tasks:** [[LAMPSPLUS-1503 - Bug - Wishlist dropdown double-click and max limit|LAMPSPLUS-1503]] (Medium, Unassigned, due 2026-04-22); [[LAMPSPLUS-1504 - PayPal Option on Cart|LAMPSPLUS-1504]] (High, Leslie, due 2026-04-22; root cause: "International Checkout" rule left disabled)
  - **Dev completions → Ready For UAT:** [[LAMPSPLUS-1446 - Bug - Checkout Behavior|LAMPSPLUS-1446]] (100%, UAT Stage), [[LAMPSPLUS-1461 - Bug - Duplicate Company Assignment Causing Customer Role Conflict|LAMPSPLUS-1461]] (100%, UAT Stage, overdue), [[LAMPSPLUS-1496 - Bug - Default shipping address always sent as false|LAMPSPLUS-1496]] (100%, UAT Stage), [[LAMPSPLUS-1268 - Frontend General Support and Updates|LAMPSPLUS-1268]] (100%, UAT Stage), [[LAMPSPLUS-1279 - Issues with Forms Containing an Email Address|LAMPSPLUS-1279]] (100%, UAT Stage), [[LAMPSPLUS-1340 - sales_order_item.updated_at not updating when sales_order.updated_at  updated (e.g. KU0102250442058199003)|LAMPSPLUS-1340]] (Ready For UAT In Prod, Ready for Retest)
  - **Resolved:** [[LAMPSPLUS-1451 - Bug - Employee Billing Address Error|LAMPSPLUS-1451]] Done (Critical, completed 2026-04-15); [[LAMPSPLUS-1364 - TaxExemptId Expected on Orders where Tax Exemption Applied|LAMPSPLUS-1364]] Done + Passed Production (Antonia confirmed 2026-04-15; related defect filed as new subtask not yet exported)
  - **Cybersource update:** [[LAMPSPLUS-263 - Cybersource Failover Customization|LAMPSPLUS-263]] uat_status improved to **Ready for Retest** (was Failed-Production); Miguel (2026-04-15) confirmed CC decline is test-account-specific; investigating order 66000006637 not reaching MAO
  - **DY scripts still failing:** [[LAMPSPLUS-1335 - DY scripts are not firing in the right sequence on all Commerce pages|LAMPSPLUS-1335]] — Miguel (2026-04-16): DY script confirmed in head but below Adobe scripts; due 2026-04-17 AT RISK
  - **Milestone completed:** [[969039 - CHANGE v2 - -Private Link- Order History Mapping|969039]] completed per Kyle Williams confirmation; Héctor closed 2026-04-15
- **Asana LPWE changes (task_count 191, no new tasks):**
  - **Completed:** [[LPWE-81 - Merge the Gift Card PDP Functionality Into the Gift Card Landing Page|LPWE-81]] Passed Production; [[LPWE-82 - Per Line Shipping Address Selection for Gift Card Purchases|LPWE-82]] Passed Production; [[LPWE-64 - Set Up Logging for Employee Tools URL - Search Bar|LPWE-64]] Passed Production
  - **Regression On Hold:** [[LPWE-26 - Discounting Rules - Employee Discount Logic|LPWE-26]] → On Hold / Failed-Production; Leslie (2026-04-15 EOD): new bug LPWE-84/LAMPSPLUS-1429 blocking cart totals reload
  - **Estimate progress:** [[LPWE-166 - Move California Warning Message Beneath Place Order Button on Billing Page|LPWE-166]] 4h estimate from Héctor (awaiting approval); [[LPWE-169 - On Shipping Page, Add Fallback Delivery Range Countdown Message|LPWE-169]] 8h estimate from Héctor (pending approval)
  - **Post-launch confirmed:** [[LPWE-157 - Include Day of Week on PDP ETA|LPWE-157]] deferred post-launch; [[LPWE-96 - Support Store-Only Promotions Using Store Modifier Data|LPWE-96]] likely duplicate of LPWE-158, merge post-launch
  - **ATP docs delivered:** [[LPWE-124 - Update ATP - Delivery Date Logic|LPWE-124]] Harry Donihue delivered ATP verbiage docs 2026-04-15; Leslie to re-estimate
- **WPM files:** 7 WPM Branch files (LP-68289, 68659, 68666, 69209, 69267, 69481, 69482) in changed list but all are old/Closed taxonomy branches re-pulled with no new content; no WPM source summary update needed
- **Pages updated:** source-asana-lampsplus (2136→2138, 2026-04-16 changes section), source-asana-lpwe (task counts updated, 2026-04-16 changes section), status-2026-04-16 (created), status-2026-04-15 (archived to wiki/archive/), index.md (status page pointer updated), log.md
- **Wikilink validation:** 83 wiki pages scanned, 5,525 raw stems indexed — all raw-file wikilinks resolve cleanly.
  - **Lint fixes (4):**
    - 665884 - PayPal Option not Enabled on Cart (source-asana-lampsplus.md, Quinary Re-sync section, pre-existing) — no raw markdown file exists for this ID (only a PNG attachment); converted to plain text
    - [[684034 - Billing address form not displayed when “My billing and shipping address are the same” checkbox is unchecked (Pros User)|684034]] (status-2026-04-16.md) — filename uses Unicode curly quotes (U+201C/U+201D); link used ASCII `”` which would fail in Obsidian; corrected to use curly-quote form matching exact filename stem
    - ws-qa-testing.md — file corrupted by buggy regex (root cause: `r' +(' + bs + r'\|)'` treated `\\|` as “backslash OR empty” alternation, causing every space run in the file to be deleted). Fully reconstructed from raw ACE2E task data. Status counts updated to reflect actual state: Groomed 19, On Hold 5, Closed 2, Open 2.
    - ACE2E-296, ACE2E-322, ACE2E-326 — ghost nodes caused by the same corruption; resolved by reconstruction.

## [2026-04-15] resync | 11 new production bugs + WPM +21 issues + Private Link Staging milestone completed (scheduled auto-sync)

- **Scope:** 2,844 WPM files (full re-pull, +21 net — Task +15, Research +3, Bug +2, Epic +1); 104 Asana LAMPSPLUS files (11 new bugs/tasks, 2 status advances, 3 milestone updates); 20 Asana LPWE files (timestamp refreshes, no status changes)
- **WPM changes (+21, total 2823→2844):**
  - Pipeline progression: QA on PPE +7, Deployment-PPE +5, Evaluated +7, Code Review +3, In Progress +2, Failed QA +2
  - Regression signals: QA on PPE In Progress -2, Clarification Needed -3, Open -2, Code Review In Progress cleared
  - New status observed: Requirements Review (+2)
  - New issues primarily in LP, DBADMIN, TEAL tracks (from overnight 2026-04-14 dev activity)
- **Asana LAMPSPLUS changes (+11 tasks, task_count 2125→2136):**
  - [[873346 - utag_data.website_mode is not populated correctly on all Commerce pages. For example, https---mcprod.lampsplus.com-p-56-inch-casa-esperanza-teak-bronze-and-gold-led-ceiling-.md|873346]] **new Blocker** — utag_data.website_mode not populated on Commerce pages; EDS logic exists but Commerce not wired (Leslie).
  - 4 new PDP bugs: [[717739 - Unable to Close Image Modal on PDP Page.|717739]] (modal stuck), [[327410 - Price Displayed for Unavailable SKU on PDP|327410]] (unavailable SKU price showing), [[904692 - Discontinued Product Showing Quantity left in PDP|904692]] (qty badge on discontinued), [[754491 - Product Images Missing From SFPs|754491]] (SFP images missing)
  - 4 new cart/checkout bugs: [[180520 - Freight Shipping Charges Not Reflected in Order Summary or Total Price on Cart Page|180520]] (freight not in summary), [[340640 - Cart Page Tax is not Calculated and its showing '0'|340640]] (tax $0), [[684034 - Billing address form not displayed when “My billing and shipping address are the same” checkbox is unchecked (Pros User)|684034]] (billing form hidden for Pros), [[811403 - Shipping methods not displayed on Checkout Shipping page|811403]] (no shipping methods)
  - [[499092 - Product Click from PLP Leads to 404, But Search Loads Correct PDP With Incorrect URL|499092]] **new** — PLP click → 404; URL routing bug (Kyle Williams)
  - [[LAMPSPLUS-1496 - Bug - Default shipping address always sent as false|LAMPSPLUS-1496]] **new** — Default shipping address always false (High, Unassigned, due 2026-04-22)
  - [[969042 - CHANGE v2 - -Private Link- Staging - Order History Table|969042]] **Completed** — Private Link Staging - Order History Table milestone done (Miguel Garrido, 2026-04-14)
  - [[LAMPSPLUS-1461 - Bug - Duplicate Company Assignment Causing Customer Role Conflict|LAMPSPLUS-1461]] — advanced to In Progress 50% (due today 2026-04-15)
  - [[LAMPSPLUS-1451 - Bug - Employee Billing Address Error|LAMPSPLUS-1451]] — confirmed Ready For UAT In Prod (100%)
  - Frontend Review (843056) updated 2026-04-14 EOD: most sections Done; PDP Out-of-Stock + Email still In Progress
- **Asana LPWE changes (task_count 191, no change):**
  - LPWE-167/168 (Critical checkout tasks) confirmed still Estimating (Héctor, 2026-04-15 modified)
  - LPWE-124 (ATP/Delivery Date Logic) confirmed To Do 0% (Leslie, modified 2026-04-15)
  - LPWE-101 (Homepage Redesign for EDS) confirmed Completed (completed 2026-04-06)
- **Pages updated:** source-jira-wpm (2823→2844, status table, notable changes 2026-04-15), source-asana-lampsplus (2125→2136, 2026-04-15 changes section), status-2026-04-15 (created), status-2026-04-14 (archived to wiki/archive/), index.md (status page pointer + counts updated), log.md
- **Wikilink validation:** All wikilinks in updated files resolved. 99 false positives from table-escape backslash (`\|`) stripped by validator. 1 real fix applied.
  - **Lint fix:** [[684034 - Billing address form not displayed when “My billing and shipping address are the same” checkbox is unchecked (Pros User)|684034]] (Billing address form/Pros User) — filename contains Unicode curly quotes (U+201C/U+201D); links that used ASCII `"` would fail in Obsidian. Reduced to bare task ID `[[684034 - Billing address form not displayed when “My billing and shipping address are the same” checkbox is unchecked (Pros User)|684034]]` in source-asana-lampsplus.md, status-2026-04-15.md, and log.md.
- **Table rendering:** No missing blank-line-before-table issues found in updated pages.
- **Hash-in-target:** No `#` characters found in any wikilink targets in updated pages.

## [2026-04-14] resync | Major dev wave: LAMPSPLUS-732 UAT In Stage + LAMPSPLUS-802 Done + LPWE-37 Passed + ACE2E-329/330 new bugs (scheduled auto-sync)

- **Scope:** 2,823 WPM files (full re-pull, +3 net — 2 new bugs + 1 task); 100 Asana LAMPSPLUS files (5 new tasks + widespread status advances); 17 Asana LPWE files (status changes only)
- **WPM changes (Bug +2, Task +1, total 2820→2823):**
  - [[ACE2E-329 - The Search Dropdown is Showing  3 Recently viewed PDP Thumbnail images by Default on  PDP ,PLP, Commerce Pages|ACE2E-329]] **new bug** — Search dropdown showing 3 recently-viewed thumbnails by default (Sirisha Boddu, Open, Not Prioritized). Sub-issue from LPWE-37 search box work.
  - [[ACE2E-330 - UI  Gap is showing on  Search Suggestions Dropdown on Wish list page|ACE2E-330]] **new bug** — UI gap in search suggestions on Wishlist page (Sirisha Boddu, Open, Not Prioritized). Sub-issue from LPWE-37.
  - Status distribution: Closed +4, Groomed -5, Failed QA +2, QA on PPE In Progress +2, Evaluating -2
- **Asana LAMPSPLUS changes (+5 tasks, many status advances, task_count 2120→2125):**
  - [[LAMPSPLUS-802 - -API MESH- Gift Card Reverse Authorization Integration - Failure Online Payment Methods|LAMPSPLUS-802]] — **Done + Passed Production** (Critical). Gift Card reverse auth on failed payments fully resolved.
  - [[LAMPSPLUS-687 - Link-Search Account Customer Profile Form|LAMPSPLUS-687]] — **Done + Passed Production**.
  - [[LAMPSPLUS-1385 - Careers Page Banner Image Layout Issue|LAMPSPLUS-1385]] — **Done + Passed Production**.
  - [[LAMPSPLUS-1426 - UMRP Popup – Remove Functionality (Storefront Only)|LAMPSPLUS-1426]] — Ready For UAT In Prod + Passed Production (Critical).
  - [[LAMPSPLUS-732 - MultiAddress checkout - Address per line in Single Address Checkout page|LAMPSPLUS-732]] — **In Progress 50% → Ready For UAT In Stage 100%** (Critical). Major milestone for employee checkout.
  - [[LAMPSPLUS-1451 - Bug - Employee Billing Address Error|LAMPSPLUS-1451]] — new, Critical, Ready For UAT In Prod 100%.
  - 7 more tasks → Ready For UAT In Prod (LAMPSPLUS-1425, 1421, 1332, 1365, 1394, 1428, 939)
  - [[LAMPSPLUS-1446 - Bug - Checkout Behavior|LAMPSPLUS-1446]] — To Do 0% → In Progress 50%.
  - [[LAMPSPLUS-1279 - Issues with Forms Containing an Email Address|LAMPSPLUS-1279]] — 25% → 50% (due today 2026-04-15).
  - [[LAMPSPLUS-1268 - Frontend General Support and Updates|LAMPSPLUS-1268]] — **regression**: decenary showed "Ready For UAT In Stage" but today shows In Progress 50% Unassigned.
  - New tasks: LAMPSPLUS-1462 (Bug — Inconsistent State Mapping/MAO, Unassigned), 229170/461077/567473/926602 (anonymous Jira placeholders).
- **Asana LPWE changes (task_count unchanged at 191):**
  - [[LPWE-37 - EDS-Commerce Update Desktop Search Box & Autofill Functionality|LPWE-37]] — uat_status **Passed - Production** (Leslie Manzanera Ornelas). Desktop search autocomplete now passing UAT.
  - [[LPWE-145 - Update Logic for Employee Generated Account to Send User to set password Flow Instead of Create Account Flow|LPWE-145]] — unblocked, Tan Nguyen, Ready For Testing in Production.
  - [[LPWE-153 - Set Avalara API Timeout|LPWE-153]] — task_status "To Do"; still Failed-Production/Blocker.
  - [[LPWE-158 - Promo Code Utility Enhancements|LPWE-158]] — Estimate Ready For Review.
- **Pages updated:** source-jira-wpm (2820→2823, status distribution, notable changes), source-asana-lampsplus (2120→2125, new recent changes section), source-asana-lpwe (status advances section), ws-checkout (LAMPSPLUS-732 advance, LAMPSPLUS-1446 added), ws-managed-services (LPWE-37/145/153/158 status updates), status-2026-04-14 (created), status-2026-04-13 (archived to wiki/archive/), index.md (status page updated)
- **Wikilink validation:** All 24 new raw-file wikilinks verified: ACE2E-329 ✓, ACE2E-330 ✓, LAMPSPLUS-802 ✓, LAMPSPLUS-687 ✓, LAMPSPLUS-1385 ✓, LAMPSPLUS-1426 ✓, LAMPSPLUS-1451 ✓, LAMPSPLUS-1425 ✓, LAMPSPLUS-1421 ✓, LAMPSPLUS-1332 ✓, LAMPSPLUS-1365 ✓, LAMPSPLUS-1394 ✓, LAMPSPLUS-732 ✓, LAMPSPLUS-939 ✓, LAMPSPLUS-1428 ✓, LAMPSPLUS-1446 ✓, LAMPSPLUS-1279 ✓, LAMPSPLUS-1268 ✓, LAMPSPLUS-1348 ✓, LAMPSPLUS-1462 ✓, 229170 ✓, 461077 ✓, 567473 ✓, 926602 ✓

## [2026-04-13] resync | ACEDS-597 new CLP page_type task + 766083 cart autofill fix + LAMPSPLUS-1268 UAT advance (scheduled auto-sync)

- **Scope:** 2,820 WPM files (full re-pull, +1 net — 1 new task); 12 Asana LAMPSPLUS files (1 new task + field updates)
- **WPM changes (Evaluated +1, total +1):**
  - [[ACEDS-597 - Update the utag data page type for Category Landing Pages|ACEDS-597]] **new task** — "Update utag_data.page_type for Category Landing Pages" (Evaluated, Unassigned, High, created 2026-04-13). Changes CLP page_type "all" → "landing". Has QA subtask ACEDS-598. Linked to TEAL-2987; companion to ACEDS-588 (Approved Code Review).
- **Asana LAMPSPLUS changes (+1 task, 1 status advance, task_count 2119→2120):**
  - [[766083 - Remove autofill from the Commission Employee field|766083]] **new** — Cart Commission Employee field autofill removed (Medium, Leslie Manzanera Ornelas, 100% complete, Ready For UAT In Prod).
  - [[LAMPSPLUS-1268 - Frontend General Support and Updates|LAMPSPLUS-1268]] advanced **In Progress (50%) → Ready For UAT In Stage (100%)**; previously Unassigned Critical task now complete in dev.
- **Pages updated:** source-jira-wpm (task_count 2819→2820, Evaluated 42→43, decenary dist/notable), source-asana-lampsplus (task_count 2119→2120, decenary section), ws-tealium-tags (ACEDS-597 added to Recent Activity), ws-cart (766083 added to Bugs), status-2026-04-13 (decenary section)
- **Wikilink validation:** ACEDS-597 ✓, 766083 ✓, LAMPSPLUS-1268 ✓

## [2026-04-13] resync | DBADMIN-7059 On Hold + PSS-1953 QA advance + Breadcrumb completion (scheduled auto-sync)

- **Scope:** 2,819 WPM files (full re-pull, +0 net — 2 status changes); 3 new/updated Asana LAMPSPLUS files
- **WPM status changes (In Progress -1, On Hold +1, QA on PPE -1, QA on PPE In Progress +1):**
  - [[DBADMIN-7059 - Update SyncAttributesProductMicroservicesAndCarteasy to Support Batch-B|DBADMIN-7059]] moved **In Progress → On Hold** (Aarthi Natarajan); Batch-B attribute sync paused, reason undocumented
  - [[PSS-1953 - Support Showing QuickShip Facet On LP-AC (Part 4)|PSS-1953]] advanced **QA on PPE → QA on PPE In Progress** (Aarthi Natarajan, fix_version 38.1)
- **New Asana LAMPSPLUS tasks (+2, task_count 2117→2119):**
  - [[595444 - New task created from Jira project|595444]] — Anonymous placeholder, In Progress, 50%, Unassigned, Medium; no description
  - [[LAMPSPLUS-1316 - Breadcrumb URL fragment concatenation should be done on Commerce side|LAMPSPLUS-1316]] — **Completed 2026-04-13** (Jayasri Krithivasan); Commerce now handles breadcrumb URL concatenation from WUP JSON fragments (DBADMIN-6820/6931)
- **Pages updated:** ws-data-platform (DBADMIN-7059 → On Hold section, Key Risks updated, In Progress count 4→3), ws-taxonomy (DBADMIN-7059 + PSS-1953 statuses updated), source-asana-lampsplus (task_count 2117→2119, novenery section), source-jira-wpm (status distribution novenery), status-2026-04-13 (novenery section)
- **Wikilink validation:** All 4 new raw-file wikilinks verified: 595444 ✓, LAMPSPLUS-1316 ✓, DBADMIN-7059 ✓, PSS-1953 ✓

## [2026-04-13] resync | Taxonomy Batch-B DB/DY fixes + Add Bulbs cart bug (scheduled auto-sync)

- **Scope:** 2,819 WPM files (full re-pull, +0 net — minor status changes); 3 new Asana LAMPSPLUS tasks
- **WPM status changes (In Progress +1, Failed QA -1):**
  - [[DBADMIN-7057 - Revert DBADMIN-7038|DBADMIN-7057]] advanced **Evaluated → In Progress** (Armen Shagmirian, WUPv12)
  - [[DBADMIN-7059 - Update SyncAttributesProductMicroservicesAndCarteasy to Support Batch-B|DBADMIN-7059]] confirmed **In Progress** (Aarthi Natarajan) — Batch-B Type/Feature attribute support in legacy sync proc
  - [[UTI-8531 - Usages Moved to Type are Still Showing Under Usage in DY Feed|UTI-8531]] confirmed **In Progress** (Rupali Deshmukh) — DY feed taxonomy bug from Batch-B branch
- **New Asana LAMPSPLUS tasks (+3, task_count 2114→2117):**
  - [[520010 - 'Add Bulbs' link is Missing on Cart Page|520010]] — Open, Eilat Vardi; design re-confirmed 2026-04-10 to add per-line + cart-level Add Bulbs for all users; FE implementing
  - [[LAMPSPLUS-1281 - Pro Savings Incorrect Calculation - Open Box|LAMPSPLUS-1281]] — Complete, 100%, UAT Passed Production; rounding behavior clarified (round-down on PLP/PDP, exact on cart)
  - [[LAMPSPLUS-1446 - Bug - Checkout Behavior|LAMPSPLUS-1446]] — High, Unassigned, 0%, no description; due 2026-04-22; needs owner
- **Pages updated:** ws-data-platform (DBADMIN-7057 moved to In Progress, DBADMIN-7059 added), ws-bloomreach-feed (UTI-8531 added), ws-cart (520010 added), source-asana-lampsplus (octary section), source-jira-wpm (octary distribution), status-2026-04-13 (octary section)
- **Wikilink validation:** All 6 new raw-file wikilinks verified: DBADMIN-7057 ✓, DBADMIN-7059 ✓, UTI-8531 ✓, 520010 ✓, LAMPSPLUS-1281 ✓, LAMPSPLUS-1446 ✓

## [2026-04-13] resync | DBADMIN-7047 Approved CR + Tealium utag fix (scheduled auto-sync)

- **Scope:** 2,819 WPM files (full re-pull, +0 net count, status changes only)
- **Key status changes:**
  - [[DBADMIN-7047 - Back Populate Line-Level Tax and Discount Fields to tblSharedItems for MAO Order Sync|DBADMIN-7047]] advanced **Code Review → Approved Code Review** (David Goben, 2026-04-13). Back-populates 6 MAO line-level fields for LP.com orders ≥ 2023-01-01. Deploying this resolves all 5 Private Link order history gaps from prior sync.
  - [[ACEDS-588 - Update the utag data page type for search results pages|ACEDS-588]] reached **Approved Code Review** (Calvin Liu, 2026-04-13). Fixes `utag_data.page_type` = "search-results" → "searchresults" for search result pages; triggered by Criteo OneTag tag verification (TEAL-2983/TEAL-3017).
  - Broader reshuffle: In Progress +4 (39→43), Code Review -3 (8→5), Evaluated -2 (44→42), Open +1 (62→63), Closed +1 (2,113→2,114). No new epics or tasks.
- **Pages updated:** source-jira-wpm (status distribution refreshed, septenary changes noted), ws-data-platform (DBADMIN-7047 moved to Approved CR section, Code Review -1, Key Risks updated), ws-tealium-tags (ACEDS-588 Recent Activity added), status-2026-04-13 (septenary re-sync section + health table + recommendation updated)
- **Wikilink validation:** All 4 new raw-file wikilinks verified: DBADMIN-7047 ✓, ACEDS-588 ✓, CI-4441 ✓, TEAL-3098 ✓

## [2026-04-13] resync | MAO integration cluster + ACE2E-328 epic (scheduled auto-sync)

- **Scope:** 14 Asana files newer than log.md (2 LAMPSPLUS + 2 LPWE newly tracked + 4 previously processed + 4 index files); 2,819 WPM files (full re-pull, +2 from prior: +1 epic ACE2E-328 + 1 task)
- **New tracked LAMPSPLUS tasks (2 Order Integration Bugs, first export after Héctor follow-up at ~18:45):**
  - [[440428 - Transition the MAO Integration to Use Line-Level Details|440428]] — Critical, Antonia Hope, 100% complete, Ready for Retest in Prod. Transitions MAO integration to use new line-level DB fields (LineSalesTax, LineShippingTax, LineProfessionalDiscount, LineManualDiscount, LinePromoDiscount, LinePromoFreightDiscount). **Resolves the 5 Private Link order history gaps from prior sync** — these are the exact fields that were missing.
  - [[LAMPSPLUS-1382 - Order failed in MAO – Line discount exceeds line subtotal|LAMPSPLUS-1382]] — Medium, magrawal@lampsplus.com, 100% complete, Ready for Retest. Fix deployed 2026-03-27 by Kyle Williams; awaiting QA retry. KIT item employee checkout edge case.
- **New tracked LPWE tasks (2 Critical Improvements, first tracked in wiki after Héctor follow-up at ~18:47-18:50):**
  - [[LPWE-136 - Send the Import Cart Source to MAO|LPWE-136]] — Critical, Antonia Hope, To Do, 0%. Send ImportCartSource attribute ("link to customer" or "resubmit") to MAO. 4h estimate approved by Eilat Vardi 2026-03-11. Depends on LPWE-127.
  - [[LPWE-152 - Add Platform Information to the MAO Call|LPWE-152]] — Critical, Antonia Hope, In Progress, 50%. Add Platform=2 to all AC MAO orders for analytics.
- **WPM updates:**
  - New epic: [[ACE2E-328 - AC E2E - ROUND 1 Bugs|ACE2E-328]] (Open, created 2026-04-13) — umbrella epic for Round 1 E2E bug tracking. Epic count 98→99.
  - Task count 1946→1947 (+1). Total 2817→2819.
- **Risk surfaced:** Antonia Hope is single assignee on 3 critical open MAO tasks (440428, LPWE-136, LPWE-152). 440428 completion would unblock Private Link order history gap resolution.
- **Pages updated:** source-asana-lampsplus (task_count: 2112→2114, sextary section added), source-asana-lpwe (quaternary section added), source-jira-wpm (task_count: 2817→2819, epic 98→99), ws-managed-services (MAO cluster table added), ws-new-epics (ACE2E-328 added), status-2026-04-13 (sextary re-sync section + new recommendation)
- **Wikilink validation:** All 5 raw-file wikilinks verified: 440428 ✓, LAMPSPLUS-1382 ✓, LPWE-136 ✓, LPWE-152 ✓, ACE2E-328 ✓

## [2026-04-13] resync | Asana LAMPSPLUS cart/PDP/user bugs + LAMPSPLUS-732 update (scheduled auto-sync)

- **Scope:** 8 files newer than log.md — 6 Asana LAMPSPLUS Implementation task files + MOC/section index; 2,819 WPM files (full re-pull, content unchanged from prior WPM sync today)
- **4 new LAMPSPLUS bugs (not previously tracked):**
  - [[471526 - Technical Specification section is displayed even when there are no specifications available for the SKU|471526]] — PDP: Technical Specification section shows even when no specs available (should hide per LP site). Medium, Leslie Manzanera Ornelas, Ready For UAT In Stage, 100% complete, Not Ready To Test. Related Jira: ACE2E-269.
  - [[498161 - Updated Cart Name is Displayed Below Shopping cart instead of Appearing to the Left of the Edit button|498161]] — Cart: Cart Name position wrong (below cart vs left of Edit button). High, Héctor Omar Tello Avellaneda, created 2026-04-10. Héctor noted no Figma mockup; linked to Jira for follow-up.
  - 665884 - PayPal Option not Enabled on Cart — Cart/Payments: PayPal payment option not enabled on cart for Guest/Employee. High, Héctor Omar Tello Avellaneda, created 2026-04-10. Root cause: "International Checkout" rule left disabled (Héctor holding pending investigation).
  - [[LAMPSPLUS-1461 - Bug - Duplicate Company Assignment Causing Customer Role Conflict|LAMPSPLUS-1461]] — User Management: Duplicate Company Assignment causing Customer Role Conflict. High, Unassigned, created 2026-04-08. 100% coded/Ready For UAT In Stage — needs UAT assignment.
- **Field updates (previously tracked, no content change):**
  - [[553885 - Countdown Timer Still Visible on Cart Page After Being Disabled in Configuration.|553885]] — Héctor confirmed replication 2026-04-13 18:32; due 2026-04-22
  - [[LAMPSPLUS-732 - MultiAddress checkout - Address per line in Single Address Checkout page|LAMPSPLUS-732]] — Critical story, In Progress, 50%, Unassigned (Sprint 31; per-item employee shipping addresses)
- **Pages updated:** ws-cart (3 new bugs), ws-pdp (1 new bug), ws-checkout (LAMPSPLUS-732 active item), ws-user-management (LAMPSPLUS-1461 bug), source-asana-lampsplus (task_count: 2108→2112, quinary re-sync section added), status-2026-04-13 (source coverage updated, quinary re-sync changes added)
- **Wikilink validation:** All 6 raw-file wikilinks verified against filenames in raw/asana/LAMPSPLUS/Implementation/ ✓

## [2026-04-13] resync | Asana LAMPSPLUS new order integration bugs (scheduled auto-sync)

- **Scope:** 10 files newer than log.md — 8 new Asana LAMPSPLUS Implementation tasks, 2 updated LAMPSPLUS section index files; 2819 WPM files (full re-pull, no meaningful content changes — same 2817 task count and status distribution already documented)
- **New Asana LAMPSPLUS tasks (8 Order Integration Bugs):**
  - All filed 2026-04-08/09 via E2E Bug Submission form, assigned to Kyle Williams, 0% completion, Not Ready To Test
  - **MAO Interface (2 bugs):** [[142611 - Shipping Tax Order Interface Failure Input value --2.4751655629139-- is out of range for the field TaxAmount (77000001195)|142611]] (shipping TaxAmount precision causing order failure to MAO), [[849028 - Duplicate Order Interfaces Processing to MAO (e.g. 000002449)|849028]] (duplicate order submissions)
  - **Private Link Order History (5 bugs):** [[574213 - Private Link Reference to ACData.dbo.OrderItemData.LINE_PROMO_DISCOUNT Not Accurately Reflected On Order History (66000006487)|574213]] (LINE_PROMO_DISCOUNT), [[983224 - Private Link Reference to ACData.dbo.OrderItemData.LINE_MANUAL_DISCOUNT Not Reflected On Order History (IJ0102251406031729003 and 66000005957)|983224]] (LINE_MANUAL_DISCOUNT), [[958535 - Private Link Reference to ACData.dbo.OrderItemData.LINE_PROFESSIONAL_DISCOUNT Not Reflected On Order History (66000006408)|958535]] (LINE_PROFESSIONAL_DISCOUNT), [[991902 - Private Link Reference to ACData.dbo.OrderItemData.LINE_SHIPPING_TAX Not Reflected On Order History (77000001072)|991902]] (LINE_SHIPPING_TAX), [[860227 - Order Line Status Inconsistent with Private Link (CF0815241814444439003)|860227]] (order line status)
  - **Tax Display (1 bug, previously tracked):** [[980080 - Cart page Order Summary displays incorrect tax amount compared to existing Lamps Plus site|980080]]
- **Pages updated:** source-asana-lampsplus (task_count: 2100→2108), ws-checkout (new Bugs section with 8 order integration bugs), status-2026-04-13 (source coverage counts updated, Checkout row escalated to Blocked, new Order Integration Bugs critical issues section, new recommendation)
- **Wikilink validation:** All 8 raw-file wikilinks verified against filenames in raw/asana/LAMPSPLUS/Implementation/ ✓

## [2026-04-13] resync | Asana LAMPSPLUS + LPWE + WPM full re-pull (scheduled auto-sync)

- **Scope:** 2,824 files newer than log.md — 2,819 WPM (full re-pull), 5 Asana (LAMPSPLUS + LPWE targeted changes)
- **WPM changes (full re-pull, 2,817 total, -1 from prior):**
  - 11 new closures (Closed: 2,102→2,113)
  - 6 more Failed QA (30→36) — noteworthy increase; items advanced to testing and failed
  - 11 fewer Groomed (197→186) — items moving out of backlog
  - 4 fewer In Progress (43→39)
  - 2 more Deployment - PPE (86→88)
  - WPM Map of Content regenerated 2026-04-13 10:59
- **LAMPSPLUS changes (3 meaningful updates):**
  - LAMPSPLUS-1279 (Email Forms): Eilat Vardi clarified employee email field should never be pre-populated; task at 25% and due 2026-04-15 — AT RISK
  - LAMPSPLUS-267 (Cybersource Credentials): uat_status now "Ready for Retest"; Leslie returned from PTO 2026-04-13
  - LAMPSPLUS-263 (Cybersource Failover): No new comments; Miguel's 2026-04-10 note stands (Cybersource price range rule $1,200–$1,600 may explain test failures)
  - LAMPSPLUS-1268 (Frontend General Support): Timestamp-only update
- **LPWE changes (1 meaningful update):**
  - LPWE-153 (Avalara Timeout): CHRONIC REGRESSION — Miguel updated to 180s at 14:55; Adam reported reset to 60s by 17:54. AvataxPortal config may be overriding. Root cause not resolved.
- **Pages updated:** source-asana-lampsplus, source-asana-lpwe, source-jira-wpm, ws-managed-services
- **Wikilink validation:** All 12 raw-file wikilinks verified ✓

## [2026-04-13] resync | Asana LAMPSPLUS + LPWE (secondary sync)

- **Scope:** 5 raw files newer than log.md — 3 LAMPSPLUS tasks, 2 LPWE tasks
- **LAMPSPLUS changes:**
  - 845560 (Apple Pay): Eilat Vardi confirmed Apple Pay AND Google Pay removed from go-live scope — bug cancellable; ACE2E-168/169 deprioritized
  - LAMPSPLUS-224 (Wishlist Private Link Sync): 3 new UAT issues found — qty not persisting (enhancement), PDP multi-wishlist UX (internal bug, CNX fixing), wishlist load order (design review); task still Failed - Production
  - LAMPSPLUS-1327 (Google API Shipping): No new comments; likely field-only update; still In Progress 50% Unassigned
- **LPWE changes:**
  - LPWE-145 (Employee Account Flow): Full customer import not run over weekend; Miguel waiting on LP to update `lp_is_customer` logic; Tan Nguyen still blocked on testing
  - LPWE-37 (Search Box): 2 new sub-bugs (search dropdown UI gap, Recently Viewed thumbnails); Miguel confirmed EDS issues; LP/EDS team to decide on task creation; Leslie on vacation
- **Pages updated:** source-asana-lampsplus, source-asana-lpwe, ws-wish-list, ws-checkout, ws-managed-services, status-2026-04-13

## [2026-04-13] status | Cross-project status snapshot

- **Created**: `status-2026-04-13.md` — comprehensive health snapshot covering all 9 sources (~5,928 unique items)
- **Replaces**: `status-2026-04-10.md` was ACE2E-only (267 tasks); new snapshot covers all Jira + Asana projects
- **Key findings**: 4 production failures active (Cybersource failover, Avalara timeout, Tealium view_item, DY scripts), 5 Critical LPWE tasks with no estimates, 9 days to launch window
- **Index updated**: New status page added, old status page marked as historical

## [2026-04-13] resync | Incremental Jira + Asana sync

- **Scope**: 6 projects (ACAB, ACEDS, ACM, WPM, LAMPSPLUS, LPWE) — ~55 modified raw files
- **Jira changes**:
  - ACAB: ACAB-339 new QA subtask (Groomed); Bloomreach timeout env var constraint noted
  - ACEDS: ACEDS-582 new search bug (Groomed, High Priority); ACEDS-572 In Progress → Stakeholder Test (root cause: Fastly first-byte timeout)
  - ACM: ACM-15 + ACM-16 Cancelled (handed to CNX); ACM-23 now blocked by ACEDS-547/544, overdue since 2026-04-06
  - WPM: ACE2E-166 new BOPIS/checkout task (Groomed); UTI-8451/8452 new legacy data push tasks (Evaluated, unassigned)
- **Asana LAMPSPLUS changes**:
  - 2 new bugs today: 553885 (cart countdown timer), 980080 (cart tax $0.00)
  - 3 completed today: 472787, 739235, 877083 (all closed as expected behavior/non-reproducible)
  - 3 active UAT failures: LAMPSPLUS-263 (Cybersource failover), LAMPSPLUS-1070 (Tealium view_item), LAMPSPLUS-1335 (DY script order)
  - 3 tasks due 2026-04-15 at risk: LAMPSPLUS-1279 (25%), LAMPSPLUS-1428 (50%), LAMPSPLUS-1446 (0%)
  - Leslie Manzanera Ornelas returned from PTO 2026-04-13
- **Asana LPWE changes**:
  - 5 new tasks (LPWE-166 through 170), all Critical/Estimating/0%, all checkout/cart improvements
  - LPWE-153 (Avalara timeout) now Failed - Production — live blocker, value being reset
  - LPWE-37 (search box retest) stalled with new sub-bugs
- **Pages updated**: ws-app-builder, ws-eds, ws-commerce-implementation, ws-stores, ws-bloomreach-feed, ws-managed-services, source-jira-acab, source-jira-aceds, source-jira-acm, source-asana-lampsplus, source-asana-lpwe
- **Key risks surfaced**: Cybersource failover failing in prod, Avalara timeout resetting in prod, 5 new Critical LPWE tasks with no estimates

## [2026-04-10] refactor | Source summary naming convention

- **Change**: Removed date suffixes from all 9 source summary filenames
- **Reason**: Source summaries are now overwritten in place on each re-sync; the `ingested` frontmatter field tracks the pull date
- **Files renamed**:
  - `source-jira-ace2e-2026-04-10.md` → `source-jira-ace2e.md`
  - `source-jira-aceds-2026-04-10.md` → `source-jira-aceds.md`
  - `source-jira-acab-2026-04-10.md` → `source-jira-acab.md`
  - `source-jira-acaqa-2026-04-10.md` → `source-jira-acaqa.md`
  - `source-jira-accms-2026-04-10.md` → `source-jira-accms.md`
  - `source-jira-acm-2026-04-10.md` → `source-jira-acm.md`
  - `source-jira-wpm-2026-04-10.md` → `source-jira-wpm.md`
  - `source-asana-lampsplus-2026-04-13.md` → `source-asana-lampsplus.md`
  - `source-asana-lpwe-2026-04-13.md` → `source-asana-lpwe.md`
- **Wikilinks updated**: 41 references across 19 files
- **CLAUDE.md updated**: Naming convention and source-summary schema updated to reflect new pattern

## [2026-04-13] ingest | Asana LAMPSPLUS + LPWE Projects

- **Source**: `raw/asana/LAMPSPLUS/` (2,100 tasks) and `raw/asana/LPWE/` (191 tasks)
- **Export tool**: `AsanaToObsidia.py` — new script written for Asana REST API export using PAT
- **Skipped**: PTO (108 tasks) and Holidays (23 tasks) — not relevant to migration
- **Pages created**: 21 wiki pages
  - 2 source summaries: `source-asana-lampsplus-2026-04-13.md`, `source-asana-lpwe-2026-04-13.md`
  - 1 workstream page: `ws-managed-services.md` (LPWE post-migration support)
  - 13 blocker pages: `blocker-project-timeline.md`, `blocker-data-syncing.md`, `blocker-analytics-delay.md`, `blocker-tealium-instability.md`, `blocker-tms-decision.md`, `blocker-enhancements-volume.md`, `blocker-pdp-design.md`, `blocker-search-vendor.md`, `blocker-sso-flow.md`, `blocker-wunderkind.md`, `blocker-eds-licensing.md`, `blocker-mao-delay.md`, `blocker-kiosk-e2e.md`
  - 4 decision pages: `dec-search-engine.md`, `dec-tms-platform.md`, `dec-data-sync-approach.md`, `dec-launch-strategy.md`
  - 1 team page: `team-concentrix.md`
- **Pages updated**: 23 workstream pages with Asana Coverage sections
  - Storefront: ws-pdp, ws-plp, ws-cart, ws-checkout, ws-homepage-navigation, ws-user-management
  - Supporting: ws-integrations, ws-pixels-analytics, ws-stores, ws-gift-card, ws-inventory-atp, ws-financial-calculators, ws-employee-tools, ws-seo, ws-privacy-compliance, ws-payments, ws-wish-list, ws-email-communications, ws-cms
  - Infrastructure: ws-data-platform, ws-infrastructure, ws-eds, ws-qa-testing
- **Index, overview, log updated**
- **Key findings**:
  - Concentrix Catalyst is the implementation vendor managing both projects
  - LAMPSPLUS covers full migration lifecycle; LPWE is T&M post-launch support
  - Checkout is the largest workstream area (169 Asana tasks)
  - 13 active risks identified, 7 at Critical priority
  - Launch target shifted from Jan 2026 to Apr 22-29, 2026 due to compounding delays
  - Key decisions surfaced: Bloomreach search engine, GTM→Tealium TMS change, unidirectional data sync, phased soft launch
  - Vendor uses their own Jira (concentrix-catalyst.atlassian.net) — NOT linked to our wiki
  - Combined project now tracks ~5,920 unique items across Jira + Asana

## [2026-04-12] resync | Incremental Jira sync
- **New issue**: ACE2E-327 — General Exploratory Testing (Open, unassigned) → added to ws-qa-testing
- **Status change**: ACEDS-530 — Homepage DY Sliders: In Progress → Approved Code Review → updated in ws-eds, comp-eds-homepage, comp-eds-dynamic-yield
- **New attachments**: 5 files added to ACE2E-131 (2 videos, 2 screenshots, 1 recording)
- **Formatting**: All raw files regenerated with improved markdown conversion (tables, panels, HTML, bullets, spacing)

## [2026-04-10] ingest | WPM Master Pull (28 Jira Projects)
- **Source**: `raw/WPM/` directory — 2,818 issues pulled via custom JQL from WPM-4610 hierarchy
- **JQL**: PM-provided query traversing childIssuesOf(WPM-4610), excludes Cancelled and sub-tasks
- **Script modified**: Added `--jql-file` and `--output` flags to JiraToObsidia.py
- **Projects found**: 28 Jira projects (LP, DBADMIN, WPM, PSS, TEAL, UTI, CI, LPATCH, CHA, MSP, MAR, EXTSRV, SCMS, LPA, WEBADMIN, LAB, SKUOTF, + others)
- **Overlap**: 328 issues duplicate existing per-project ingests (ACEDS 213, ACAB 98, ACM 9, ACCMS 7, ACAQA 1). ACE2E not in pull.
- **New issues**: ~2,490 from 22 previously unseen projects
- **Pages created**: 9 wiki pages
  - 1 source summary: `source-jira-wpm-2026-04-10.md`
  - 8 workstream pages: ws-data-platform, ws-tealium-tags, ws-bloomreach-feed, ws-dynamic-yield-lp, ws-taxonomy, ws-lp-site, ws-discovery, ws-infrastructure
- **Index, overview, log updated**
- **Key findings**:
  - WPM-4610 is the root "Collection" for the entire Adobe Commerce migration (owner: Eilat Vardi)
  - Soft launch plan: Kiosks → CSRs → 10% customers → Increased % → Full Launch
  - **Tealium tag verification** is the largest active backlog (63 tasks) — go-live blocker
  - **Taxonomy Batch B** is actively in progress across LP, PSS, DBADMIN
  - **Data platform (DBADMIN)** has 459 issues — entire WUP backend infrastructure
  - Discovery phase (5 epics) is complete
  - Fills both coverage gaps from lint: Data Migration (ws-data-platform) and Infrastructure (ws-infrastructure)

## [2026-04-10] ingest | ACM Jira Project
- **Source**: `raw/ACM/` directory — 21 markdown files exported via JiraToObsidia.py
- **Organization**: Files in `Bug/` (3), `Epic/` (1), `Task/` (6), `Sub-task/` (10), `Test Case/` (1)
- **Pages created**: 2 wiki pages
  - 1 source summary: `source-jira-acm-2026-04-10.md`
  - 1 workstream page: `ws-commerce-implementation.md`
- **Index, overview, log updated**
- **Cross-references updated**: `ws-cms.md` now links to ACM-4 as parent
- **Key findings**:
  - Most active project by percentage — 71% of issues in active states
  - Core theme: aligning Commerce-rendered pages with EDS (header, footer, search, DY widget)
  - ACM-3 (search bar suggestions on Commerce pages) has Failed QA — needs rework
  - ACM-4 is parent of ACCMS-1 (CMS project)
  - Same dev team as EDS: Tyler Marés, Glenn Vergara, George Djaniants

## [2026-04-10] ingest | ACCMS Jira Project
- **Source**: `raw/ACCMS/` directory — 9 markdown files exported via JiraToObsidia.py
- **Organization**: Files in `Bug/` (1), `Epic/` (1), `Task/` (5), `Sub-task/` (2)
- **Pages created**: 2 wiki pages
  - 1 source summary: `source-jira-accms-2026-04-10.md`
  - 1 workstream page: `ws-cms.md`
- **Index, overview, log updated**
- **Key findings**:
  - Small, PM-driven project (Seth Wilde owns 5 of 9 issues)
  - 3 open tasks: Email Us messaging update, CMS page alt text, CMS block alt text
  - Scope: Help & Policies pages, Blog, CMS blocks
  - Epic ACCMS-1 links to ACM-4 (parent Commerce Implementation project, not yet ingested)
  - Fills the CMS coverage gap identified in the lint

## [2026-04-10] ingest | ACAQA Jira Project
- **Source**: `raw/ACAQA/` directory — 16 markdown files exported via JiraToObsidia.py
- **Organization**: Files in `Bug/` (1), `Epic/` (1), `Task/` (14)
- **Pages created**: 1 wiki page
  - 1 source summary: `source-jira-acaqa-2026-04-10.md`
- **No workstream/team pages**: Project is effectively empty (15/16 cancelled). AQA issues migrated to ACEDS.
- **Cross-reference added**: `comp-eds-accessibility.md` now references ACAQA as the original audit project
- **Index, overview, log updated**
- **Key finding**: ACAQA was the initial WCAG 2.2 AA audit project for mcprod.lampsplus.com. All tasks were cancelled and the work was absorbed into the ACEDS project's AQA issue tracking.

## [2026-04-10] lint | Full wiki lint after 3-project ingest
- **Scope**: All 44 wiki pages checked
- **Orphan pages**: 0 — all pages in index.md
- **Broken wiki links**: 0 — all wiki-to-wiki links resolve
- **Isolated pages**: 0 — all pages have inbound links
- **Status schema violations**: 21 fixed — normalized Groomed/Open/In Progress to schema values (not-started, in-progress)
- **Status contradictions**: 3 fixed — ws-inventory-atp, ws-integrations, ws-email-communications had "Groomed" but In Progress epics; corrected to in-progress
- **Frontmatter type missing**: 2 (index.md, log.md) — intentional, these are structural files not wiki content pages
- **Coverage gaps identified**: 2 areas with no dedicated workstream:
  1. **Data Migration** — no ETL/legacy data mapping workstream (only partial coverage via hybrid content)
  2. **Infrastructure** — no CI/CD, hosting, environments workstream (only partial via CSP and New Relic tasks in EDS)

## [2026-04-10] ingest | ACAB Jira Project
- **Source**: `raw/ACAB/` directory — 283 markdown files exported via JiraToObsidia.py
- **Organization**: Files in `Bug/` (129), `Epic/` (1), `Task/` (24), `Sub-task/` (58), `Research/` (20), `Test Case/` (51)
- **Pages created**: 5 wiki pages
  - 1 source summary: `source-jira-acab-2026-04-10.md`
  - 1 workstream page: `ws-app-builder.md`
  - 2 component pages: `comp-ab-search-facets.md`, `comp-ab-suggest-auth.md`
  - 1 team page: `team-acab.md`
- **Index updated**: `index.md` cataloged all 5 new pages
- **Overview updated**: `overview.md` now covers ACE2E, ACEDS, and ACAB (1,094 total issues)
- **Key findings**:
  - 96% resolved (135 closed + 137 cancelled out of 283)
  - Only 11 active issues remain
  - Bloomreach is the search engine; App Builder is the middleware translation layer
  - Naga Ambarish Chigurala is the sole active developer on all remaining items
  - All 20 research/onboarding tasks closed — team is self-sufficient
  - High cancellation rate (48%) reflects early integration instability that was resolved

## [2026-04-10] ingest | ACEDS Jira Project
- **Source**: `raw/ACEDS/` directory — 510 markdown files exported via JiraToObsidia.py
- **Organization**: Files in `Bug/` (106), `Epic/` (2), `Task/` (165), `Sub-task/` (195), `Research/` (16), `Test Case/` (26)
- **Pages created**: 12 wiki pages
  - 1 source summary: `source-jira-aceds-2026-04-10.md`
  - 1 workstream page: `ws-eds.md`
  - 9 component pages: `comp-eds-*.md` (plp-search, homepage, header-nav, footer, dynamic-yield, tealium-analytics, seo-meta, accessibility, hybrid-content)
  - 1 team page: `team-aceds.md`
- **Index updated**: `index.md` cataloged all 12 new pages
- **Overview updated**: `overview.md` now covers both ACE2E and ACEDS
- **Key findings**:
  - 84% resolved (310 closed + 118 cancelled out of 510)
  - 82 active issues remain; 44 are Groomed backlog
  - Hybrid content migration carryover is the main bottleneck (5 of 7 tasks unassigned)
  - 14 accessibility (AQA) issues groomed but unassigned
  - PLP intermittent load failure under active investigation (ACEDS-572)
  - Tealium bug fixes open and unassigned (ACEDS-560)
  - New SEO schema work just opened (BreadcrumbList, CollectionPage)

## [2026-04-10] ingest | ACE2E Jira Project
- **Source**: `raw/` directory — 301 markdown files exported via Python script
- **Organization**: Files in `Bug/`, `Epic/`, `Sub-task/`, `Task/` subdirectories + Dashboard and Map of Content
- **Pages created**: 25 wiki pages
  - 1 source summary: `source-jira-ace2e-2026-04-10.md`
  - 21 workstream pages: `ws-*.md`
  - 1 team page: `team-ace2e.md`
  - 1 status summary: `status-2026-04-10.md`
  - 1 overview update: `overview.md`
- **Index updated**: `index.md` cataloged all 25 pages
- **Key findings**:
  - 60% of tasks are Groomed but unassigned
  - 10% have Failed QA
  - Only 4 of 33 epics are In Progress
  - Bug tracking is transitioning from Jira to Asana
  - 2 new epics (Resubmit Utility, Marketing Parameters) have no tasks yet

## [2026-04-10] init | Wiki initialized
- Created vault structure: `raw/jira/`, `raw/asana/`, `wiki/`
- Schema defined in `CLAUDE.md`
- Awaiting first Jira project export for ingestion
