---
type: workstream
epics: ["[[ACE2E-28 - AC E2E - Cart Overview|ACE2E-28]]"]
status: not-started
task_count: 25
closed_count: 0
failed_qa_count: 0
groomed_count: 25
in_progress_count: 0
blocked_count: 0
---

# Workstream: Cart

## Description

This workstream covers the shopping cart experience, including cart display, printing, BOPIS (Buy Online Pick Up In Store) cart integration, employee cart features, add-by-style number, quick order, split line items, international checkout from cart, cart styling, save for later, email cart, and bulb add-ons.

## Scope

- **[[ACE2E-28 - AC E2E - Cart Overview|ACE2E-28]]: Cart Overview** (Evaluated) — All cart page functionality and customizations.

## Related Tasks

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [ACE2E-270](../raw/ACE2E/Task/ACE2E-270%20-%20ROUND1-%20Cart%20Print%20Enhancements%20%5BNew%20Logic%5D.md) | Cart print | Groomed | Unassigned |
| [[ACE2E-271 - ROUND1- Store Pickup (BOPIS) and Store Inventory Shipping Options Extension - CanShipFromStore and CanPickUpFromStore\|ACE2E-271]] | BOPIS cart (task 1) | Groomed | Unassigned |
| [[ACE2E-272 - ROUND1- Store Pickup (BOPIS) and Store Inventory Shipping Options Extension - Store Inventory Tab\|ACE2E-272]] | BOPIS cart (task 2) | Groomed | Unassigned |
| [[ACE2E-273 - ROUND1- Employee Block - Cart Print Enhancements\|ACE2E-273]] | Employee cart (task 1) | Groomed | Unassigned |
| [[ACE2E-274 - ROUND1- Cart Print-Email Enhancements - Bulbs, Inventory & Images\|ACE2E-274]] | Employee cart (task 2) | Groomed | Unassigned |
| [ACE2E-275](../raw/ACE2E/Task/ACE2E-275%20-%20ROUND1-%20%5BAPI%20MESH%5D%20SKU%20on%20the%20Fly%20Enhancement.md) | Add by style (task 1) | Groomed | Unassigned |
| [[ACE2E-276 - ROUND1- Store Pickup (BOPIS) and Store Inventory Shipping Options Extension - Store Pickup\|ACE2E-276]] | Add by style (task 2) | Groomed | Unassigned |
| [[ACE2E-277 - ROUND1- Add by Style Customization\|ACE2E-277]] | Quick order (task 1) | Groomed | Unassigned |
| [[ACE2E-278 - ROUND1- Quick Order Form and Employee Restriction Customization\|ACE2E-278]] | Quick order (task 2) | Groomed | Unassigned |
| [[ACE2E-279 - ROUND1- Employee Cart-Order Fields Enhancement\|ACE2E-279]] | Split line (task 1) | Groomed | Unassigned |
| [[ACE2E-280 - ROUND1- Split Line Item Enhancement\|ACE2E-280]] | Split line (task 2) | Groomed | Unassigned |
| [[ACE2E-281 - ROUND1- Employee Order and Line-Item Notes Customization\|ACE2E-281]] | International checkout (task 1) | Groomed | Unassigned |
| [[ACE2E-282 - ROUND1- International Checkout Customizations\|ACE2E-282]] | International checkout (task 2) | Groomed | Unassigned |
| [[ACE2E-283 - ROUND1- Cart Customization Support\|ACE2E-283]] | Cart styling (task 1) | Groomed | Unassigned |
| [[ACE2E-284 - ROUND1- Cart and Checkout Availability Check and Force Removal\|ACE2E-284]] | Cart styling (task 2) | Groomed | Unassigned |
| [[ACE2E-285 - ROUND1- Cart Print Enhancements\|ACE2E-285]] | Cart styling (task 3) | Groomed | Unassigned |
| [[ACE2E-286 - ROUND1- Cart Number Enhancement\|ACE2E-286]] | Save for later (task 1) | Groomed | Unassigned |
| [[ACE2E-287 - ROUND1- Sales Timer\|ACE2E-287]] | Save for later (task 2) | Groomed | Unassigned |
| [[ACE2E-288 - ROUND1- Cart Customization - Edit Cart Name\|ACE2E-288]] | Email cart (task 1) | Groomed | Unassigned |
| [[ACE2E-289 - ROUND1- Product Flags - Cart\|ACE2E-289]] | Email cart (task 2) | Groomed | Unassigned |
| [[ACE2E-290 - ROUND1- Style Cart Page\|ACE2E-290]] | Bulbs (task 1) | Groomed | Unassigned |
| [[ACE2E-291 - ROUND1- Style Request for Quote\|ACE2E-291]] | Bulbs (task 2) | Groomed | Unassigned |
| [[ACE2E-292 - ROUND1- Save for Later Enhancement\|ACE2E-292]] | Cart feature (task 1) | Groomed | Unassigned |
| [[ACE2E-293 - ROUND1- Cart Customization - Recommended Bulbs Module\|ACE2E-293]] | Cart feature (task 2) | Groomed | Unassigned |
| [[ACE2E-294 - ROUND1- Email Cart Module and Extensions\|ACE2E-294]] | Cart feature (task 3) | Groomed | Unassigned |

### Status Summary

- Groomed: 25

## Bugs

### Asana LAMPSPLUS Bugs (2026-04-10 to 2026-04-13)

| ID | Summary | Priority | Assignee | Status |
|----|---------|----------|----------|--------|
| [[766083 - Remove autofill from the Commission Employee field\|766083]] | Browser autofill enabled on Commission Employee field on cart — employees may accidentally submit wrong commission data; fix deployed and awaiting UAT | Medium | Leslie Manzanera Ornelas | **Ready For UAT In Prod** (100% complete) |
| [[498161 - Updated Cart Name is Displayed Below Shopping cart instead of Appearing to the Left of the Edit button\|498161]] | Cart Name displays below cart instead of left of Edit button | High | Héctor Omar Tello Avellaneda | Open — Not Ready To Test |
| [[553885 - Countdown Timer Still Visible on Cart Page After Being Disabled in Configuration.\|553885]] | Countdown Timer persists on cart after disabled in admin config | High | Héctor Omar Tello Avellaneda | Open — Not Ready To Test (due 2026-04-22; replicated 2026-04-13) |
| 665884 - PayPal Option not Enabled on Cart|665884 - PayPal Option not Enabled on Cart | PayPal payment option not enabled on cart for Guest/Employee | High | Héctor Omar Tello Avellaneda | Open — Not Ready To Test (root: "International Checkout" rule) |
| [[520010 - 'Add Bulbs' link is Missing on Cart Page\|520010]] | "Add Bulbs" link missing on Cart Page (mcprod) — per Figma it should appear on each line item AND as a cart-level link for both consumers and employees | High | Eilat Vardi | Open — Not Ready To Test (**design decision in progress**: Eilat confirmed 2026-04-10 to add per-line and cart-level Add Bulbs for all user types; FE devs working on it) |

## Asana Coverage (LAMPSPLUS + LPWE)
**LAMPSPLUS Implementation:** ~103 tasks (Cart area)
- Examples: Email Cart Module, Session Manager and Link Account/Import Cart, Recommended Products Configuration, Cart Price Rules Extensions, Cart Customization - Edit Cart Name
- Key: Session manager integration, cart price rules affect pricing display

**LPWE (Post-Launch):** 25 tasks (15 open)
- Open: Cart Overview Design Updates, Quantity Field Behavior, MPR Discount Logic, Promo Code Utility Enhancements, Shipping & Processing Fee Override, Discounting Rules (Cart Price Rules + Employee), Delay Shipping, Remove Build Full System Feature, Import Cart Functionality Updates, others
- Completed: Session Linking for Guest Carts, Tiered Coupon Module, Empty Cart Overview, Coupon Logic

### Key Tasks

- [[LPWE-154 - Cart Overview Design Updates|LPWE-154: Cart Overview Design Updates]] (Open)
- [[LPWE-155 - Quantity Field Behavior|LPWE-155: Quantity Field Behavior]] (Open)
- [[LPWE-144 - MPR - Discount Logic and Feedback|LPWE-144: MPR Discount Logic and Feedback]] (Open)
- [[LPWE-158 - Promo Code Utility Enhancements|LPWE-158: Promo Code Utility Enhancements]] (Open)
- [[LPWE-18 - Shipping & Processing Fee Override|LPWE-18: Shipping & Processing Fee Override]] (Open)
- [[LPWE-27 - Discounting Rules - Cart Price Rules Validation Logic|LPWE-27: Discounting Rules — Cart Price Rules Validation]] (Open)
- [[LPWE-26 - Discounting Rules - Employee Discount Logic|LPWE-26: Discounting Rules — Employee Discount Logic]] (Open)
- [[LAMPSPLUS-503 - Session Manager and Link Account-Import Cart Enhancement - Session Management|LAMPSPLUS-503: Session Manager — Session Management]]
- [[LPWE-159 - -Post Launch- Import Cart Functionality Updates|LPWE-159: Import Cart Functionality Updates]] (Open)

## Dependencies

- [[ws-pdp]] — Add-to-cart originates from PDP.
- [[ws-checkout]] — Cart transitions into checkout flow.
- [[ws-stores]] — BOPIS cart items require store inventory lookup.
- [[ws-employee-tools]] — Employee cart features share employee session context.
- [[ws-financial-calculators]] — Cart pricing, coupons, and promotions.
- [[ws-payments]] — Payment method availability shown in cart summary.
- [[ws-inventory-atp]] — Stock validation and delivery estimates in cart.

## Cross-References

- [[ACE2E-282 - ROUND1- International Checkout Customizations|ACE2E-282]] (international checkout) also relates to [[ws-checkout]] billing scope.
- QA test cycle tasks for Cart may exist in the [[ACE2E-296 - ROUND 1- Test Case Cycle Execution for Account Management|ACE2E-296]] to [[ACE2E-322 - ROUND 1- Verify Easy Post|ACE2E-322]] range.
