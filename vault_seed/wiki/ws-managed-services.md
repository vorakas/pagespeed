---
type: workstream
status: in-progress
task_count: 196
blocked_count: 2
---

# Managed Services (LPWE)

Post-migration T&M (Time & Materials) support provided by Concentrix Catalyst for new features, improvements, bug fixes, and security patches on the Adobe Commerce platform.

**Source:** [[source-asana-lpwe]]
**Owner:** Megan Anaya (Concentrix Catalyst)

## Status

| Metric | Count |
|--------|------:|
| Total tasks | 196 |
| Open | 85 |
| Completed | 111 |

## Sections

| Section | Open | Completed | Total |
|---------|-----:|----------:|------:|
| Improvements | 67 | 58 | 125 |
| New Requests | 11 | 44 | 55 |
| New Features | 6 | 6 | 12 |
| Bug Fixes | 1 | 2 | 3 |
| Upgrades & Security Patches | 0 | 1 | 1 |

## Task Distribution by Workstream

LPWE tasks map across existing workstreams. The largest concentrations:

| Workstream | Tasks | Open |
|-----------|------:|-----:|
| [[ws-cart]] | 26 | 16 |
| [[ws-pdp]] | 16 | 6 |
| [[ws-pixels-analytics]] | 15 | 3 |
| [[ws-integrations]] | 14 | 6 |
| [[ws-user-management]] | 12 | 6 |
| [[ws-plp]] | 11 | 1 |
| [[ws-employee-tools]] | 9 | 4 |
| [[ws-checkout]] | 12 | 8 |
| [[ws-cms]] | 9 | 2 |
| [[ws-privacy-compliance]] | 7 | 3 |
| [[ws-payments]] | 8 | 2 |
| [[ws-homepage-navigation]] | 7 | 0 |
| [[ws-inventory-atp]] | 6 | 3 |
| [[ws-stores]] | 5 | 2 |
| [[ws-gift-card]] | 5 | 2 |
| [[ws-data-platform]] | 4 | 0 |
| [[ws-wish-list]] | 3 | 2 |
| [[ws-email-communications]] | 2 | 2 |
| [[ws-infrastructure]] | 2 | 0 |

## Key Open Items

**Cart (15 open):** Cart Overview Design Updates, Quantity Field Behavior, MPR Discount Logic, Promo Code Enhancements, Shipping & Processing Fee Override, Discounting Rules (multiple), Delay Shipping, Import Cart Functionality

**User Management (6 open):** Adding 2FA to Site Login, Update Sign-in Screen, Employee Account Flow Updates, Login Solution (Pro), Google One Tap Storefront Logic

**Integrations (6 open):** Wunderkind Integration (3 sub-tasks), MAO Call Platform Info, Avalara API Timeout (**PRODUCTION BLOCKER** — timeout value reset multiple times today; AvataxPortal config may be overriding; root cause under investigation), Google API Shipping

**PDP (6 open):** 60-Day Return Flag, Pricing Logic Update (Pricing Block v10), UMRP Rename, Day of Week on ETA, Open Box Requirements, Promo Modal Extension

### Key Tasks

- [[LPWE-154 - Cart Overview Design Updates|Cart Overview Design Updates]]
- [[LPWE-151 - Adding 2FA to Site Login|Adding 2FA to Site Login]]
- [[LPWE-140 - -PERFORMANCE- Tealium Refactor|Tealium Refactor]]
- [[LPWE-106 - Wunderkind Integration - Remove Coupon modal|Wunderkind Integration - Remove Coupon Modal]]
- [[LPWE-105 - Wunderkind Integration - Promotion Rule Setup|Wunderkind Integration - Promotion Rule Setup]]
- [[LPWE-104 - Wunderkind Integration - Teallium support|Wunderkind Integration - Tealium Support]]
- [[LPWE-39 - Google One Tap Storefront Logic|Google One Tap Storefront Logic]]
- [[LPWE-84 - Tax Exempt Checkbox for Pro Sessions with a Tax Exempt Certificate|Tax Exempt Checkbox]]
- [[LPWE-161 - Support Wish Lists Across Both Platforms for Anonymous Users|Wish Lists - Anonymous Users]]
- [[LPWE-160 - Support Wish Lists Across Both Platforms for Logged Users|Wish Lists - Logged Users]]
- [[LPWE-159 - -Post Launch- Import Cart Functionality Updates|Import Cart Functionality Updates]]
- [[LPWE-18 - Shipping & Processing Fee Override|Shipping & Processing Fee Override]]

## Active Items — MAO Integration Cluster (2026-04-13 Sextary Re-sync)

4 MAO-related tasks urgently followed up by Héctor at ~18:45 tonight. Combined, these represent the full MAO integration risk:

| Key | Summary | Priority | Assignee | Status | Completion | Risk |
|-----|---------|----------|----------|--------|:----------:|------|
| [[440428 - Transition the MAO Integration to Use Line-Level Details\|440428]] | MAO: use new line-level discount/tax DB fields | Critical | Antonia Hope | Ready for Retest | 100% | Untested in prod — resolves 5 Private Link order history gaps |
| [[LAMPSPLUS-1382 - Order failed in MAO – Line discount exceeds line subtotal\|LAMPSPLUS-1382]] | MAO: line discount exceeds subtotal failure (KIT items) | Medium | magrawal@lampsplus.com | Ready for Retest | 100% | Fix deployed 2026-03-27; not yet retested |
| [[LPWE-136 - Send the Import Cart Source to MAO\|LPWE-136]] | MAO: send ImportCartSource attribute (link to customer / resubmit) | Critical | Antonia Hope | To Do | 0% | Depends on LPWE-127; 4h estimate approved |
| [[LPWE-152 - Add Platform Information to the MAO Call\|LPWE-152]] | MAO: add Platform=2 attribute for all AC orders (analytics) | Critical | Antonia Hope | In Progress | 50% | Antonia in review |

**Antonia Hope bottleneck:** Antonia holds all 3 open critical MAO tasks (440428, LPWE-136, LPWE-152). With 9 days to launch, this creates a single-assignee risk.

## New Tasks (2026-04-13)

| Key | Summary | Priority | Workstream |
|-----|---------|----------|------------|
| [[LPWE-166 - Move California Warning Message Beneath Place Order Button on Billing Page\|LPWE-166]] | Move California Prop 65 Warning Beneath Place Order Button | Critical | Checkout/Compliance |
| [[LPWE-167 - Default a Shipping Method on the Shipping Options Modal\|LPWE-167]] | Default a Shipping Method on Shipping Options Modal | Critical | Checkout/Shipping |
| [[LPWE-168 - Replace Credit Card Expiration Drop Downs With Single Text Field\|LPWE-168]] | Replace Credit Card Expiration Dropdowns With Single Text Field | Critical | Checkout/Payments |
| [[LPWE-169 - On Shipping Page, Add Fallback Delivery Range Countdown Message\|LPWE-169]] | Add Fallback Delivery Range Countdown Message on Shipping Page | Critical | Checkout/ATP |
| [[LPWE-170 - On the Cart Overview Page, Only Display the Per Unit Cost When Multiple Units Are Selected\|LPWE-170]] | Only Display Per Unit Cost When Multiple Units Selected | Critical | Cart |

> All 5 assigned to Héctor Omar Tello Avellaneda, all in Estimating (0%), no estimates provided yet as of 2026-04-13.

## Status Updates (2026-04-14 Re-sync)

| Key | Summary | Status | Update |
|-----|---------|--------|--------|
| [[LPWE-37 - EDS-Commerce Update Desktop Search Box & Autofill Functionality\|LPWE-37]] | Desktop Search Box & Autofill | In Progress (50%) | **uat_status: Passed - Production** — major advancement. The core autocomplete functionality has passed production UAT. However, 2 sub-bugs were formally filed today as ACE2E-329 (Recently Viewed thumbnails in search dropdown) and ACE2E-330 (UI gap on Wishlist search dropdown) — EDS team to resolve. |
| [[LPWE-145 - Update Logic for Employee Generated Account to Send User to set password Flow Instead of Create Account Flow\|LPWE-145]] | Employee Generated Account → Set Password Flow | In Progress (50%) | **Unblocked.** Assignee changed to Tan Nguyen; uat_status: "Ready For Testing in Production". The prior blocker (lp_is_customer field logic + full customer import) is resolved. Testing now underway. |
| [[LPWE-153 - Set Avalara API Timeout\|LPWE-153]] | Set Avalara API Timeout | **Failed - Production / Blocker** | task_status changed to "To Do" (from In Progress). Still a production blocker — timeout continues resetting to 60s. Root cause (AvataxPortal config precedence) not yet resolved. |
| [[LPWE-158 - Promo Code Utility Enhancements\|LPWE-158]] | Promo Code Utility Enhancements | Estimate Ready For Review | Eilat Vardi assigned; estimate submitted for LP review. |

## Status Updates (2026-04-13 Tertiary Re-sync)

| Key | Summary | Status | Update |
|-----|---------|--------|--------|
| [[LPWE-153 - Set Avalara API Timeout\|LPWE-153]] | Set Avalara API Timeout | **Failed - Production / Blocker** | **CHRONIC REGRESSION.** Miguel Garrido updated timeout to 180s in prod at 14:55; Adam Blais reported it reset to 60s by 17:54. Miguel suspects AvataxPortal config is overriding local setting. Root cause not yet resolved — this has now reset multiple times. |

## Status Updates (2026-04-13 Secondary Re-sync)

| Key | Summary | Status | Update |
|-----|---------|--------|--------|
| [[LPWE-145 - Update Logic for Employee Generated Account to Send User to set password Flow Instead of Create Account Flow\|LPWE-145]] | Employee Generated Account → Set Password Flow | In Progress (50%) | Full customer import NOT run over weekend. Miguel waiting for LP to finalize `lp_is_customer` logic before running import. Tan Nguyen's testing blocked until import completes. |
| [[LPWE-37 - EDS-Commerce Update Desktop Search Box & Autofill Functionality\|LPWE-37]] | Desktop Search Box & Autofill | In Progress (50%), Ready for Retest | 2 new sub-bugs found: (1) search dropdown UI gap on Wishlist/Commerce pages, (2) 3 "Recently Viewed" thumbnails on search dropdown. Miguel confirmed both are EDS issues. LP/EDS team to decide on task creation. Leslie on vacation — resolution pending. |

## Notes
- Estimate approval workflow tracked via custom field — Concentrix provides estimates before work begins
- Tasks classified as "Must Have" vs "Nice To Have" via `need` field
- SharePoint BRDs are the primary source of truth for business requirements
- Bug tracking uses a Bug & Feature Request form submission process
