---
type: workstream
epics: ["[[ACE2E-29 - AC E2E - Shipping|ACE2E-29]]", "[[ACE2E-30 - AC E2E - Billing|ACE2E-30]]", "[[ACE2E-31 - AC E2E - Order Confirmation|ACE2E-31]]"]
status: in-progress
task_count: 27
closed_count: 1
failed_qa_count: 6
groomed_count: 17
in_progress_count: 2
blocked_count: 0
status_date: 2026-04-10
---
# Workstream: Checkout (Shipping, Billing, Order Confirmation)

## Description

This workstream covers the entire checkout flow from shipping through billing to order confirmation. It includes shipping method selection, freight handling, multi-address shipping, tax calculation, payment methods, address autocomplete, digital wallet payments (Google Pay, Apple Pay), Cybersource integration, payment restrictions, BOPIS success pages, and post-purchase experiences.

## Scope

- **[[ACE2E-29 - AC E2E - Shipping|ACE2E-29]]: Shipping** (Evaluated) — Shipping method selection, freight, multi-address, tax, address autocomplete, BOPIS checkout, interstitial checkout.
- **[[ACE2E-30 - AC E2E - Billing|ACE2E-30]]: Billing** (Evaluated) — Payment method integration (Google Pay, Apple Pay, Cybersource), payment restrictions, international checkout.
- **[[ACE2E-31 - AC E2E - Order Confirmation|ACE2E-31]]: Order Confirmation** (Evaluated) — Order confirmation email to Minisoft, ROKT post-purchase, BOPIS success, custom checkout success.

## Related Tasks

### Shipping Tasks ([[ACE2E-29 - AC E2E - Shipping|ACE2E-29]])

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACE2E-166 - ROUND1- Store Pickup (BOPIS) and Store Inventory Shipping Options Extension - Checkout, Order processing and Messaging\|ACE2E-166]] | BOPIS checkout | Groomed | Unassigned |
| [[ACE2E-167 - ROUND1- Interstitial Checkout Enhancement\|ACE2E-167]] | Interstitial checkout | Groomed | Unassigned |
| [[ACE2E-225 - ROUND1- Modifications to the Shipping Methods Functionality\|ACE2E-225]] | Shipping methods (task 1) | Groomed | Unassigned |
| [[ACE2E-226 - ROUND1- Shipping & Processing Fee Override\|ACE2E-226]] | Shipping methods (task 2) | Groomed | Unassigned |
| [[ACE2E-227 - ROUND1- Employee Contact Information at Checkout\|ACE2E-227]] | Shipping methods (task 3) | Groomed | Unassigned |
| [[ACE2E-228 - ROUND1- Employee Customer Checkout updates\|ACE2E-228]] | Freight (task 1) | Groomed | Unassigned |
| [ACE2E-229](../raw/ACE2E/Task/ACE2E-229%20-%20ROUND1-%20Custom%20Shipping%20Method%20and%20%5BPrivate%20Link%5D%20Freight%20Charges%20Integration%20-%20Checkout%20page.md) | Freight (task 2) | Groomed | Unassigned |
| [ACE2E-230](../raw/ACE2E/Task/ACE2E-230%20-%20ROUND1-%20Custom%20Shipping%20Method%20and%20%5BPrivate%20Link%5D%20Freight%20Charges%20Integration%20-%20Cart%20page.md) | Multi-address (task 1) | Groomed | Unassigned |
| [[ACE2E-231 - ROUND1- MultiAddress checkout - Address per line in Single Address Checkout page\|ACE2E-231]] | Multi-address (task 2) | Groomed | Unassigned |
| [[ACE2E-232 - ROUND1- Avalara Extension Support for Resale Certs\|ACE2E-232]] | Tax (task 1) | Groomed | Unassigned |
| [ACE2E-233](../raw/ACE2E/Task/ACE2E-233%20-%20ROUND1-%20%5BParent%5D%20Custom%20Shipping%20Method%20and%20%5BPrivate%20Link%5D%20Freight%20Charges%20Integration.md) | Tax (task 2) | Groomed | Unassigned |
| [[ACE2E-234 - ROUND1- Avatax Module\|ACE2E-234]] | Payment methods (task 1) | Groomed | Unassigned |
| [[ACE2E-235 - ROUND1- Checkout Customization Support\|ACE2E-235]] | Payment methods (task 2) | Groomed | Unassigned |
| [[ACE2E-236 - ROUND1- Google API Shipping Address Validation Configuration and Residential-Commercial Capture\|ACE2E-236]] | Address autocomplete (task 1) | Groomed | Unassigned |
| [[ACE2E-237 - ROUND1- Wire Transfer Payment Connector and Configuration\|ACE2E-237]] | Address autocomplete (task 2) | Groomed | Unassigned |
| [[ACE2E-238 - ROUND1- Check - Money Order Payment Method Configuration\|ACE2E-238]] | Shipping feature (task 1) | Groomed | Unassigned |
| [[ACE2E-239 - ROUND1- Install & Configure Address Autocomplete Module\|ACE2E-239]] | Shipping feature (task 2) | Groomed | Unassigned |
| [[ACE2E-240 - ROUND1- Configure Shipping Settings\|ACE2E-240]] | Shipping feature (task 3) | Groomed | Unassigned |
| [[ACE2E-241 - ROUND1- Configure Tax Table and Tax Fallback if Avalara Service Fails\|ACE2E-241]] | Shipping feature (task 4) | Groomed | Unassigned |

### Billing Tasks ([[ACE2E-30 - AC E2E - Billing|ACE2E-30]])

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACE2E-168 - ROUND1- Google Payment Method Connector and Configuration\|ACE2E-168]] | Google Pay | Groomed | Unassigned |
| [[ACE2E-169 - ROUND1- Apple Payment Method Connector and Configuration\|ACE2E-169]] | Apple Pay | Groomed | Unassigned |
| [[ACE2E-170 - ROUND1- Install & Configure Payment Module (Cybersource)\|ACE2E-170]] | Cybersource | Groomed | Unassigned |
| [[ACE2E-171 - ROUND1- Install & Configure Payment Method Restriction Module\|ACE2E-171]] | Payment restriction | Groomed | Unassigned |

### Order Confirmation Tasks ([[ACE2E-31 - AC E2E - Order Confirmation|ACE2E-31]])

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [ACE2E-110](../raw/ACE2E/Task/ACE2E-110%20-%20ROUND1-%20%5BAPI%20MESH%5D%20Order%20Confirmation%20Emails%20to%20Minisoft.md) | Order confirmation email to Minisoft | Groomed | Unassigned |
| [[ACE2E-191 - ROUND1- Implement ROKT Post Purchase Offers\|ACE2E-191]] | ROKT post-purchase | Groomed | Unassigned |
| [[ACE2E-192 - ROUND1- Store Pickup (BOPIS) and Store Inventory Shipping Options Extension - Success Order Flow\|ACE2E-192]] | BOPIS success page | Groomed | Unassigned |
| [[ACE2E-193 - ROUND1- Add Custom Data in Checkout Success\|ACE2E-193]] | Custom checkout success | Groomed | Unassigned |

## Progress (as of 2026-04-10)

| Status | Count |
|--------|-------|
| Groomed (backlog) | 17 |
| Failed QA | 6 |
| In Progress | 2 |
| QA on PPE | 1 |
| Closed | 1 |
| **Total (ACE2E scope)** | **27** |

**Completion rate:** 4% (1 closed). This workstream is overwhelmingly still in backlog — 63% groomed/unassigned.

## Active Items

### 🔴 Failed QA (6)
- [[ACE2E-282 - ROUND1- International Checkout Customizations|ACE2E-282]] — International Checkout Customizations (Shivam Yadav)
- [[ACE2E-283 - ROUND1- Cart Customization Support|ACE2E-283]] — Cart Customization Support (Mitali Jadhav)
- [[ACE2E-284 - ROUND1- Cart and Checkout Availability Check and Force Removal|ACE2E-284]] — Cart & Checkout Availability Check and Force Removal (**unassigned**)
- [[ACE2E-288 - ROUND1- Cart Customization - Edit Cart Name|ACE2E-288]] — Cart Customization – Edit Cart Name (Jagrit Raizada)
- [[ACE2E-289 - ROUND1- Product Flags - Cart|ACE2E-289]] — Product Flags – Cart (Jagrit Raizada)
- [[ACE2E-293 - ROUND1- Cart Customization - Recommended Bulbs Module|ACE2E-293]] — Cart Customization – Recommended Bulbs Module (Divya Bharathi)

### 🟡 In Progress (2)
- [[ACE2E-271 - ROUND1- Store Pickup (BOPIS) and Store Inventory Shipping Options Extension - CanShipFromStore and CanPickUpFromStore|ACE2E-271]] — BOPIS Shipping Options – CanShipFromStore/CanPickUpFromStore (Amitkumar Jaiswar)
- [[ACE2E-290 - ROUND1- Style Cart Page|ACE2E-290]] — Style Cart Page (Sakshi Vishwanathwar)

### 🟡 QA on PPE (1)
- [[ACE2E-235 - ROUND1- Checkout Customization Support|ACE2E-235]] — Checkout Customization Support (Sakshi Gupta)

### ✅ Closed (1)
- [[ACE2E-239 - ROUND1- Install & Configure Address Autocomplete Module|ACE2E-239]] — Install & Configure Address Autocomplete Module (Jagrit Raizada)

### ⚪ Groomed / Backlog (17)
All 17 remaining tasks are Groomed, High Priority, and **unassigned**. Key items:
- **Shipping:** BOPIS checkout (ACE2E-166), interstitial checkout (ACE2E-167), shipping methods (ACE2E-225/226), freight integration (ACE2E-229/230), multi-address (ACE2E-231), shipping config (ACE2E-240)
- **Tax:** Avalara resale certs (ACE2E-232), Avatax module (ACE2E-234), tax table/fallback config (ACE2E-241)
- **Billing:** Google Pay (ACE2E-168), Apple Pay (ACE2E-169), Cybersource (ACE2E-170), payment restriction (ACE2E-171)
- **Order Confirmation:** Minisoft emails (ACE2E-110), ROKT post-purchase (ACE2E-191), BOPIS success (ACE2E-192), custom checkout success (ACE2E-193)

### Asana — LAMPSPLUS Active Items

| ID | Summary | Priority | Assignee | Status |
|----|---------|----------|----------|--------|
| [[LAMPSPLUS-732 - MultiAddress checkout - Address per line in Single Address Checkout page\|LAMPSPLUS-732]] | MultiAddress checkout — per-line shipping address for employees in single-address checkout flow | Critical | Unassigned | **Ready For UAT In Stage — 100% complete** (2026-04-14) |
| [[LAMPSPLUS-1446 - Bug - Checkout Behavior\|LAMPSPLUS-1446]] | Checkout Behavior bug — High priority, no description, needs triage | High | Unassigned | **In Progress — 50%** (2026-04-14; was To Do 0% yesterday) |

**Note:** LAMPSPLUS-732 advanced from In Progress 50% → Ready For UAT In Stage 100% on 2026-04-14 — a major milestone for employee checkout per-line shipping. LAMPSPLUS-1446 was picked up today but remains unassigned with no description.

### Asana — LPWE Open Items (4)
- [[LPWE-168 - Replace Credit Card Expiration Drop Downs With Single Text Field|LPWE-168]] — Replace CC Expiration Dropdowns (Héctor Omar Tello Avellaneda)
- [[LPWE-166 - Move California Warning Message Beneath Place Order Button on Billing Page|LPWE-166]] — Move California Warning Message (Héctor Omar Tello Avellaneda)
- [[LPWE-92 - New Checkout Warning Messages|LPWE-92]] — New Checkout Warning Messages (Leslie Manzanera Ornelas)
- [[LPWE-84 - Tax Exempt Checkbox for Pro Sessions with a Tax Exempt Certificate|LPWE-84]] — Tax Exempt Checkbox for Pro Sessions (Leslie Manzanera Ornelas)

### Key Risks
- **6 tasks in Failed QA** — highest concentration of QA failures across all workstreams; cart customizations are the common thread (ACE2E-282/283/284/288/289/293)
- **ACE2E-284 (availability check/force removal) failed QA and is unassigned** — no one is fixing it
- **17 of 27 tasks (63%) still in backlog with no assignee** — checkout has barely started; all payment, tax, and shipping config work is untouched
- **Payment integration is entirely unstarted** — Google Pay, Apple Pay, Cybersource, payment restrictions all groomed/unassigned
- **Avalara tax is unstarted** — critical for order accuracy

## Scope Decision (2026-04-13)

**Apple Pay and Google Pay removed from go-live scope.** Confirmed by Eilat Vardi via Asana task [[845560 - Apple Pay Option not Enabled on Cart.|845560]]. These payment methods are not enabled for guest or employee users at launch.
- ACE2E-168 (Google Pay connector) and ACE2E-169 (Apple Pay connector) can be deprioritized — functionality exists as future scope.
- QA teams should not test Apple Pay / Google Pay as part of the go-live checklist.

## Bugs

### Order Integration Bugs (2026-04-13, Kyle Williams)

8 new bugs filed via E2E Bug Submission form, all "Not Ready To Test" / 0% completion. Two categories:

**MAO Order Interface (2 bugs — order submission failures):**

| ID | Summary | Impact |
|----|---------|--------|
| [[142611 - Shipping Tax Order Interface Failure Input value --2.4751655629139-- is out of range for the field TaxAmount (77000001195)\|142611]] | Shipping TaxAmount sent with too many decimal places → MAO rejects order | Orders with shipping tax fail entirely |
| [[849028 - Duplicate Order Interfaces Processing to MAO (e.g. 000002449)\|849028]] | Some orders submitted to MAO multiple times (duplicate processing) | Duplicate orders in fulfillment system |

**Private Link Order History (5 bugs — data not reflected in legacy order history):**

| ID | Field Missing | Reference Order |
|----|--------------|-----------------|
| [[574213 - Private Link Reference to ACData.dbo.OrderItemData.LINE_PROMO_DISCOUNT Not Accurately Reflected On Order History (66000006487)\|574213]] | LINE_PROMO_DISCOUNT | 66000006487 |
| [[983224 - Private Link Reference to ACData.dbo.OrderItemData.LINE_MANUAL_DISCOUNT Not Reflected On Order History (IJ0102251406031729003 and 66000005957)\|983224]] | LINE_MANUAL_DISCOUNT | 66000005957 |
| [[958535 - Private Link Reference to ACData.dbo.OrderItemData.LINE_PROFESSIONAL_DISCOUNT Not Reflected On Order History (66000006408)\|958535]] | LINE_PROFESSIONAL_DISCOUNT | 66000006408 |
| [[991902 - Private Link Reference to ACData.dbo.OrderItemData.LINE_SHIPPING_TAX Not Reflected On Order History (77000001072)\|991902]] | LINE_SHIPPING_TAX | 77000001072 |
| [[860227 - Order Line Status Inconsistent with Private Link (CF0815241814444439003)\|860227]] | Order line status | CF0815241814444439003 |

**Tax Display (1 bug — previously tracked):**
- [[980080 - Cart page Order Summary displays incorrect tax amount compared to existing Lamps Plus site\|980080]] — Cart shows $0.00 tax for guest users

## Asana Coverage (LAMPSPLUS + LPWE)
**LAMPSPLUS Implementation:** ~169 tasks (Checkout — largest workstream)
- Examples: Install & Configure Payment Method Restriction Module, Configure Tax Table/Avalara Fallback, Multi-Address Checkout, PO Payment Method, International Checkout, Order Confirmation Emails to Minisoft (API MESH)
- Key: Payment configuration (~30+ tasks), Avalara tax critical, MAO order interface, Cybersource failover

**LPWE (Post-Launch):** 9 tasks (5 open)
- Open: Replace CC Expiration Dropdowns With Text Field, Default Shipping Method on Modal, Move California Warning Message, New Checkout Warning Messages, Tax Exempt Checkbox for Pro Sessions
- Completed: Retain Address in Checkout Flow, Promotions Checkout Warning Messages, Employee Customer Checkout Updates

### Key Tasks

- [[LPWE-168 - Replace Credit Card Expiration Drop Downs With Single Text Field|LPWE-168: Replace CC Expiration Dropdowns With Text Field]] (Open)
- [[LPWE-166 - Move California Warning Message Beneath Place Order Button on Billing Page|LPWE-166: Move California Warning Message]] (Open)
- [[LPWE-92 - New Checkout Warning Messages|LPWE-92: New Checkout Warning Messages]] (Open)
- [[LPWE-84 - Tax Exempt Checkbox for Pro Sessions with a Tax Exempt Certificate|LPWE-84: Tax Exempt Checkbox for Pro Sessions]] (Open)
- [[LAMPSPLUS-102 - Install & Configure Payment Method Restriction Module|LAMPSPLUS-102: Install & Configure Payment Method Restriction Module]]
- [[LAMPSPLUS-248 - Configure Tax Table and Tax Fallback if Avalara Service Fails|LAMPSPLUS-248: Configure Tax Table and Avalara Fallback]]
- [[LAMPSPLUS-252 - Multi-Address Checkout Configuration|LAMPSPLUS-252: Multi-Address Checkout Configuration]]

## Dependencies

- [[ws-cart]] — Cart feeds into checkout; cart totals carry forward.
- [[ws-payments]] — Card swipe/kiosk payments for in-store checkout.
- [[ws-stores]] — BOPIS checkout requires store selection and inventory.
- [[ws-financial-calculators]] — Tax calculations, coupon/promotion application during checkout.
- [[ws-user-management]] — Logged-in user address book, saved payment methods.
- [[ws-email-communications]] — Order confirmation triggers transactional emails.
- [[ws-pixels-analytics]] — Conversion tracking on order confirmation.
- [[ws-integrations]] — Service Broker for order processing.

## Cross-References

- [[ACE2E-282 - ROUND1- International Checkout Customizations|ACE2E-282]] (international checkout) in [[ws-cart]] also relates to billing scope.
- QA test cycle tasks for checkout workstreams may exist in the [[ACE2E-296 - ROUND 1- Test Case Cycle Execution for Account Management|ACE2E-296]] to [[ACE2E-322 - ROUND 1- Verify Easy Post|ACE2E-322]] range.
