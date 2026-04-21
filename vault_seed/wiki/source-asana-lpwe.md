---
type: source-summary
source_file: raw/asana/LPWE/
ingested: 2026-04-17
task_count: 193
resync: 2026-04-20T00:00
---

# Source: Asana LPWE (2026-04-14)

## Overview
Asana project for post-migration managed services and enhancements, run by Concentrix Catalyst on a T&M (Time & Materials) basis. Project owner: Megan Anaya.

**Asana GID:** 1209196359608155

## Task Counts

| Section | Open | Completed | Total |
|---------|-----:|----------:|------:|
| Improvements | 60 | 60 | 120 |
| New Requests | 10 | 45 | 55 |
| New Features | 6 | 6 | 12 |
| Bug Fixes | 1 | 2 | 3 |
| Upgrades & Security Patches | 0 | 1 | 1 |
| **Total** | **77** | **114** | **191** |

## Key Findings

- **Scope:** T&M support for new features, improvements, bug fixes, and security patches after Adobe Commerce migration
- **Naming convention:** Tasks prefixed `[LPWE-##]`
- **Custom fields:** task_priority, task_status, need (Must Have / Nice To Have), estimate_approval, jira_status, jira_priority, completion %, UAT status, E2E status
- **External docs:** Heavy use of SharePoint BRDs (`/Shared Documents/Business Requirements/`)
- **Attachments:** Video/webm files common for UAT proof and test reproduction

## Data Quality

- **Improvements:** Very high — detailed specs with business logic, formulas, Figma references, extensive UAT comment threads
- **New Requests:** Excellent — substantive requirements with acceptance criteria
- **New Features:** Very high — comprehensive specs with AC1-AC10+ acceptance criteria, vendor coordination
- **Bug Fixes:** Good but minimal — clear problem statements, fewer details

## Recent Changes (2026-04-20 Re-sync)

**1 new task + 1 metadata refresh (task_count 193, unchanged):**

**New task:**

| ID | Summary | Section | Status | Assignee |
|----|---------|---------|--------|----------|
| [[LPWE-172 - Update Graphql on Employee switcher-session to call AC Directly\|LPWE-172]] | Update Graphql on Employee switcher/session to call AC Directly | New Requests | Open (To Do, no description yet) | Héctor Omar Tello Avellaneda |

**Metadata refresh:**
- [[LPWE-23 - Kiosk Detection Using IP Range\|LPWE-23]] — modified 2026-04-20; still To Do (0%), Estimate Approved, Héctor. P1 High, Nice To Have. No status advance.

## Recent Changes (2026-04-19 Re-sync)

**1 major completion + section restructure (task_count 193, +2 from 191):**

**Major completion:**
- [[LPWE-150 - Support Anonymous Cart Across Both Platforms\|LPWE-150]] — **Completed / Closed** 2026-04-17 (Héctor Omar Tello Avellaneda). "Support Anonymous Cart Across Both Platforms" — a New Feature milestone is now shipped.

**Section restructure:**
- **New "Implementation" section** added with [[LPWE-124 - Update ATP - Delivery Date Logic\|LPWE-124]] moved from Bug Fixes into its own Implementation section. LPWE-124 remains at To Do (0%) — Leslie Manzanera Ornelas; ATP delivery date docs delivered by Harry Donihue 2026-04-15, re-estimation pending.
- Bug Fixes now has 2 tasks (LPWE-137, LPWE-162); Improvements now has 122 tasks (+2 from 120).

**LPWE-150 in LAMPSPLUS section:** Also appears as `raw/asana/LAMPSPLUS/Implementation/LPWE-150` (cross-project reference) — both confirmed Completed 2026-04-19.

**Unchanged — still Estimating:**
LPWE-166, LPWE-167, LPWE-168, LPWE-169, LPWE-170 — all Critical, all Estimating; estimates submitted but awaiting approval.

## Recent Changes (2026-04-17 Re-sync)

**Status corrections + estimate updates (task_count 191, unchanged):**

**LAMPSPLUS-1335 resolution — LPWE context:**
- [[LAMPSPLUS-1335 - DY scripts are not firing in the right sequence on all Commerce pages\|LAMPSPLUS-1335]] — Now Done / Passed-Production (2026-04-16). Removes DY sequencing as a blocker for analytics-related LPWE items.

**LPWE-26 status update:**
- [[LPWE-26 - Discounting Rules - Employee Discount Logic\|LPWE-26]] — raw file shows `task_status: "Ready For UAT In Prod"`, `uat_status: "Failed - Production"`, `completion: 1.00`. Previous sync noted as "On Hold / Failed-Production" (per EOD comment from Leslie 2026-04-15). Current export no longer shows On Hold for task_status — either the On Hold was transient or was a comment-level state not reflected in the exported field. UAT status remains Failed-Production. Still being tracked as a production failure.

**LPWE-84 — Tester update:**
- [[LPWE-84 - Tax Exempt Checkbox for Pro Sessions with a Tax Exempt Certificate\|LPWE-84]] — New comment from Leslie Manzanera Ornelas 2026-04-16: tagging a replacement tester (Tan Nguyen is out). Task remains To Do (0%), uat_status: Ready for Retest. No status advance.

**LPWE-169 estimate status:**
- [[LPWE-169 - On Shipping Page, Add Fallback Delivery Range Countdown Message\|LPWE-169]] — `estimate_approval: "Pending Estimate Approval"` (per raw file; Héctor's 8h estimate submitted, awaiting LP approval).

**LPWE-136 metadata refresh:**
- [[LPWE-136 - Send the Import Cart Source to MAO\|LPWE-136]] — modified 2026-04-17; `task_status: "To Do"`, `uat_status: "Passed - Production"`. Unusual combination (passed production but task still To Do). Likely a data quality issue in the sync; no meaningful status change confirmed.

## Recent Changes (2026-04-16 Re-sync)

**3 completions + 1 new regression + estimate progress on Critical tasks (task_count 191, unchanged):**

**Completed (Passed - Production):**

| ID | Summary | Notes |
|----|---------|-------|
| [[LPWE-81 - Merge the Gift Card PDP Functionality Into the Gift Card Landing Page\|LPWE-81]] | Gift Card PDP merged into Landing Page — **Completed 2026-04-16, Passed - Production** | High; Leslie Manzanera Ornelas; message field and bottom text added (confirmed 2026-03-21) |
| [[LPWE-82 - Per Line Shipping Address Selection for Gift Card Purchases\|LPWE-82]] | Per-Line Gift Card Shipping Address — **Completed 2026-04-16, Passed - Production** | Medium; Leslie; fix confirmed by Tan Nguyen retest 2026-04-05 |
| [[LPWE-64 - Set Up Logging for Employee Tools URL - Search Bar\|LPWE-64]] | Employee Tools URL Logging — **Completed 2026-04-16, Passed - Production** | Medium; Leslie; lp_employee_tool_search_log table confirmed in DB (2026-02-13) |

**New regression — On Hold:**

| ID | Change | Notes |
|----|--------|-------|
| [[LPWE-26 - Discounting Rules - Employee Discount Logic\|LPWE-26]] | Ready For UAT In Prod → **On Hold / Failed - Production** | High; Leslie (EOD 2026-04-15): new bug blocking cart totals reload (LPWE-84 / LAMPSPLUS-1429). Fix to proceed under separate identified tickets. |

**Estimate progress — Critical unestimated tasks:**

| ID | Summary | Update |
|----|---------|--------|
| [[LPWE-166 - Move California Warning Message Beneath Place Order Button on Billing Page\|LPWE-166]] | Move Prop 65 warning beneath Place Order button | **4h estimate provided by Héctor** (2026-04-14); awaiting approval |
| [[LPWE-169 - On Shipping Page, Add Fallback Delivery Range Countdown Message\|LPWE-169]] | Fallback delivery range countdown on Shipping page | **8h estimate from Héctor** (2026-04-16), pending approval; Eilat confirmed this covers the countdown requirement, with ATP verbiage docs also covering LPWE-124 scenarios |

**Other status notes:**
- [[LPWE-157 - Include Day of Week on PDP ETA\|LPWE-157]] — Héctor confirmed **post-launch** (2026-04-15); architects focused on launch-critical items. Low priority.
- [[LPWE-96 - Support Store-Only Promotions Using Store Modifier Data\|LPWE-96]] — Héctor noted **likely duplicate of LPWE-158** (2026-04-15); awaiting merge decision post-launch.
- [[LPWE-153 - Set Avalara API Timeout\|LPWE-153]] — Still **Failed - Production / Blocker**; Miguel (2026-04-14) confirmed root cause: timeout config must be set in Avatax Portal, not Magento. No fix applied yet.
- [[LPWE-124 - Update ATP - Delivery Date Logic\|LPWE-124]] — Reclassified to Bug Fixes section; Leslie acknowledged ATP docs delivered by Harry Donihue 2026-04-15, will re-estimate after review. Still To Do / 0%.

## Recent Changes (2026-04-14 Re-sync)

**Key status changes (no new tasks, task_count unchanged at 191):**

| ID | Change | Notes |
|----|--------|-------|
| [[LPWE-37 - EDS-Commerce Update Desktop Search Box & Autofill Functionality\|LPWE-37]] | uat_status: **Passed - Production** | **MAJOR** — previously stuck at "Ready for Retest" with 2 sub-bugs found (2026-04-09). Desktop search autocomplete functionality now passing production UAT (Leslie Manzanera Ornelas, In Progress 50%). Note: two related EDS sub-bugs formally filed as ACE2E-329 and ACE2E-330 today. |
| [[LPWE-145 - Update Logic for Employee Generated Account to Send User to set password Flow Instead of Create Account Flow\|LPWE-145]] | Assignee → Tan Nguyen; uat_status: **Ready For Testing in Production** | Previously blocked on `lp_is_customer` field logic and customer import. Now unblocked — Tan Nguyen actively testing |
| [[LPWE-153 - Set Avalara API Timeout\|LPWE-153]] | task_status: → **To Do** | Still Blocker priority / Failed - Production. Chronic regression (timeout resets to 60s despite 180s updates in prod). AvataxPortal config root cause unresolved |
| [[LPWE-158 - Promo Code Utility Enhancements\|LPWE-158]] | task_status: **Estimate Ready For Review** | Eilat Vardi assigned; estimate submitted for review |
| [[LPWE-124 - Update ATP - Delivery Date Logic\|LPWE-124]] | Re-classified into **Bug Fixes** section | Previously in Implementation; reclassified as a bug fix task (Leslie Manzanera Ornelas) |

**Still Estimating (no change) — 5 Critical LPWE checkout tasks:**
LPWE-166, LPWE-167, LPWE-168, LPWE-169, LPWE-170 — all Héctor Omar Tello Avellaneda, Critical, 0%, no estimates yet.

## Recent Changes (2026-04-13 Quaternary Re-sync)

**2 existing Critical LPWE Improvements received Héctor follow-up (18:47–18:50); newly tracked in wiki:**

| ID | Summary | Priority | Assignee | Status | Completion |
|----|---------|----------|----------|--------|:----------:|
| [[LPWE-136 - Send the Import Cart Source to MAO\|LPWE-136]] | Send "ImportCartSource" attribute (value: "link to customer" or "resubmit") to MAO in Order.OrderAttribute. Estimated 4h (Leslie). Depends on LPWE-127 (Session Manager). | Critical | Antonia Hope | To Do | 0% |
| [[LPWE-152 - Add Platform Information to the MAO Call\|LPWE-152]] | Add Platform=2 attribute to all AC MAO orders for analytics/platform identification | Critical | Antonia Hope | In Progress | 50% |

**Context:** Both assigned to Antonia Hope. Héctor pinged Antonia and MAO team for updates. LPWE-136 has estimate approved (4h, Leslie Manzanera Ornelas); LPWE-152 is 50% done and in review. With Antonia listed as assignee on both tasks, and also on 440428 (LAMPSPLUS), she currently holds 3 open MAO-critical items.

## Recent Changes (2026-04-13 Tertiary Re-sync)

**Updated tasks (1 file modified):**

- **[[LPWE-153 - Set Avalara API Timeout|LPWE-153]] (Avalara API Timeout)** — **CHRONIC REGRESSION.** Timeline today:
  - 2026-04-13 14:55 — Miguel Garrido updated timeout value (again) to 180 seconds in production. Monitoring to ensure it sticks.
  - 2026-04-13 17:54 — Adam Blais reports the value reset AGAIN back to 60 seconds.
  - Miguel suspects the Avatax portal may be overriding the local config (precedent: similar past issue with another AvataxPortal setting). Not yet resolved.
  - **Status:** Still Failed - Production / Blocker / 0% / Adam Blais assigned. This is now a persistent infrastructure issue — the timeout value cannot be made to stick. Root cause investigation of AvataxPortal config precedence needed.

## Recent Changes (2026-04-13 Secondary Re-sync)

**Updated tasks (2 files modified):**

- **[[LPWE-145 - Update Logic for Employee Generated Account to Send User to set password Flow Instead of Create Account Flow|LPWE-145]] (Employee Generated Account Flow)** — Full customer import was NOT run over the weekend. Miguel Garrido (2026-04-13) waiting on LP team to finalize the `lp_is_customer` field logic first, as the new logic will convert many profiles to customers. Testing by Tan Nguyen remains blocked pending import. Still In Progress, 50%.
- **[[LPWE-37 - EDS-Commerce Update Desktop Search Box & Autofill Functionality|LPWE-37]] (Desktop Search Box)** — sirisha boddu found 2 new sub-bugs (2026-04-09): (1) UI gap in search suggestions dropdown on Wishlist and other Commerce pages; (2) 3 "Recently Viewed" thumbnails showing by default on PDP and other Commerce pages. Miguel Garrido (2026-04-13) confirmed these are **EDS issues** — LP/EDS team to decide whether Sirisha should create Asana tasks or handle internally. Leslie on vacation, not involved. LPWE-37 core ACs not yet re-tested for pass/fail. Still In Progress, 50%, Ready for Retest.

## Recent Changes (2026-04-13 Re-sync)

**5 new tasks (all created 2026-04-08, Critical priority, Estimating, 0% complete):**
- LPWE-166 — Move California Warning Message Beneath Place Order Button (Checkout/Compliance)
- LPWE-167 — Default a Shipping Method on Shipping Options Modal (Checkout/Shipping)
- LPWE-168 — Replace Credit Card Expiration Dropdowns With Single Text Field (Checkout/Payments)
- LPWE-169 — Add Fallback Delivery Range Countdown Message on Shipping Page (Checkout/ATP)
- LPWE-170 — Only Display Per Unit Cost When Multiple Units Selected on Cart (Cart)

**Status updates:**
- LPWE-153 (Avalara API Timeout) — UAT now **Failed - Production**; timeout value being reset repeatedly in prod. Live production blocker.
- LPWE-37 (EDS-Commerce Search Box) — Retest stalled; new sub-bugs found (Wishlist page gap, Recently Viewed thumbnails). Leslie on PTO.
- LPWE-145 (Employee Account Flow) — Blocked on full customer import; active thread today.

**All 5 new tasks assigned to Héctor Omar Tello Avellaneda; Eilat Vardi flagged today that no estimates have been provided yet.**

## Notes
- Same vendor Jira cross-referencing pattern as LAMPSPLUS (concentrix-catalyst.atlassian.net)
- Estimate approval workflow tracked via custom field
- Some tasks tagged with `need` classification: Must Have vs Nice To Have
