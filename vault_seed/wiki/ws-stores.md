---
type: workstream
epics: ["[[ACE2E-37 - AC E2E - Stores|ACE2E-37]]"]
status: in-progress
task_count: 8
closed_count: 0
failed_qa_count: 0
groomed_count: 8
in_progress_count: 0
blocked_count: 0
---

# Workstream: Stores

## Description

This workstream covers the store locator functionality, including store listing pages, individual store detail pages, and store-related UI components. This is the only epic with a named owner (Tan Nguyen) and one of the few with an "In Progress" status.

## Scope

- **[[ACE2E-37 - AC E2E - Stores|ACE2E-37]]: Stores** (In Progress — Tan Nguyen) — Store locator, store pages, BOPIS store integration.

## Related Tasks

| Key      | Summary                | Status  | Assignee   |
| -------- | ---------------------- | ------- | ---------- |
| [[ACE2E-63 - ROUND1- Store Locator Customizations  - Regional Pages\|ACE2E-63]] | Store locator (task 1) | Groomed | Unassigned |
| [[ACE2E-64 - ROUND1- Style - Store Locator Customizations\|ACE2E-64]] | Store locator (task 2) | Groomed | Unassigned |
| [[ACE2E-65 - ROUND1- Store Locator Customizations - Request Forms\|ACE2E-65]] | Store locator (task 3) | Groomed | Unassigned |
| [[ACE2E-66 - ROUND1- Store Locator Customizations - Universal Store Coupon\|ACE2E-66]] | Store locator (task 4) | Groomed | Unassigned |
| [[ACE2E-67 - ROUND1- Store Locator Customizations\|ACE2E-67]] | Store locator (task 5) | Groomed | Unassigned |
| [[ACE2E-68 - ROUND1- Store Locator - My Store Preference Extension\|ACE2E-68]] | Store locator (task 6) | Groomed | Unassigned |
| [[ACE2E-69 - ROUND1- Prepopulate the ZIP Code in the Store Regional Pages\|ACE2E-69]] | Store locator (task 7) | Groomed | Unassigned |
| [[ACE2E-166 - ROUND1- Store Pickup (BOPIS) and Store Inventory Shipping Options Extension - Checkout, Order processing and Messaging\|ACE2E-166]] | BOPIS Shipping Options — Checkout per-item shipping, store pickup/inventory selection (4h est.) | Groomed | Unassigned |

### Status Summary

- Groomed: 8

## Bugs

- **[[ACE2E-9 - Incorrect UI for Make This My Store Button on Regional Stores Page Upon Updating My Store|ACE2E-9]]**: Store page UI issue (Closed)
- **[[ACE2E-10 - Store Page Does Not Show Success Message When Selecting Make This My Store|ACE2E-10]]**: Store page UI issue (Cancelled)

## Dependencies

- [[ws-cart]] — BOPIS cart items depend on store inventory.
- [[ws-checkout]] — BOPIS checkout flow requires store selection.
- [[ws-inventory-atp]] — Store-level inventory availability.
- [[ws-seo]] — Store pages need local SEO (structured data, Google Maps).

## Asana Coverage (LAMPSPLUS + LPWE)
**LAMPSPLUS Implementation:** ~41 tasks (Store locator, BOPIS, store management, store views)
- Key: Store data migration, locator module

**LPWE (Post-Launch):** 5 tasks (2 open)
- Open: Update Store Address Layout on Store Pages, Google Map Behavior for Valid ZIP Not Near Store
- Completed: Prepopulate ZIP Code in Store Regional Pages, Store Locator UAT Feedback

### Key Tasks

- [[LPWE-164 - Update the Layout of the Store Address on the Store Pages|Update Store Address Layout on Store Pages]]
- [[LPWE-163 - -Post Launch- Google Map Behavior for Valid ZIP Code Not Near Store|Google Map Behavior for Valid ZIP Not Near Store]]

## Cross-References

- Epic owner: Tan Nguyen (only assigned epic owner in the project).
- QA test cycle tasks for Stores may exist in the [[ACE2E-296 - ROUND 1- Test Case Cycle Execution for Account Management|ACE2E-296]] to [[ACE2E-322 - ROUND 1- Verify Easy Post|ACE2E-322]] range.
