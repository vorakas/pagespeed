---
type: workstream
epics: ["[[ACE2E-44 - AC E2E - Inventory|ACE2E-44]]", "[[ACE2E-51 - AC E2E - ATP|ACE2E-51]]"]
status: in-progress
task_count: 8
closed_count: 0
failed_qa_count: 0
groomed_count: 8
in_progress_count: 0
blocked_count: 0
---
t
# Workstream: Inventory & ATP

## Description

This workstream covers inventory management and Available-to-Promise (ATP) functionality, including stock status display, back-in-stock notifications, delivery date estimation, and ship days calculation.

## Scope

- **[[ACE2E-44 - AC E2E - Inventory|ACE2E-44]]: Inventory** (In Progress) — Inventory levels, stock indicators, back-in-stock alerts.
- **[[ACE2E-51 - AC E2E - ATP|ACE2E-51]]: ATP** (Evaluated) — Delivery date calculation, ATP logic, ship days estimation.

## Related Tasks

### Inventory ([[ACE2E-44 - AC E2E - Inventory|ACE2E-44]])

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [ACE2E-95](../raw/ACE2E/Task/ACE2E-95%20-%20ROUND1-%20%5BPrivate%20Link%5D%20Inventory%20(Availability)%20Integration.md) | Inventory (task 1) | Groomed | Unassigned |
| [[ACE2E-96 - ROUND1- Notify when Back in Stock\|ACE2E-96]] | Stock management | Groomed | Unassigned |
| [[ACE2E-97 - ROUND1- PDP Customization -'Check Store Availability'\|ACE2E-97]] | Back in stock notifications | Groomed | Unassigned |

### ATP ([[ACE2E-51 - AC E2E - ATP|ACE2E-51]])

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [ACE2E-113](../raw/ACE2E/Task/ACE2E-113%20-%20ROUND1-%20%5BREST%5D%20Product%20Estimated%20Delivery%20Date%20Integration%20and%20Enhancement%20-%20PDP,%20Cart,%20and%20Checkout.md) | Delivery date (task 1) | Groomed | Unassigned |
| [[ACE2E-114 - ROUND1- First Ship Days and Product Availability Customization\|ACE2E-114]] | Delivery date (task 2) | Groomed | Unassigned |
| [[ACE2E-115 - ROUND1- Ship Days Customization - Order Soon Countdown\|ACE2E-115]] | ATP (task 1) | Groomed | Unassigned |
| [[ACE2E-116 - ROUND1- Update ATP - Delivery Date Logic\|ACE2E-116]] | ATP (task 2) | Groomed | Unassigned |
| [[ACE2E-117 - ROUND1- Update Limitations to Control When ATP is Called (Fallback Scenario)\|ACE2E-117]] | Ship days calculation | Groomed | Unassigned |

### Status Summary

- Groomed: 8
- Epic In Progress: [[ACE2E-44 - AC E2E - Inventory|ACE2E-44]] (Inventory)

## Bugs

No bugs associated with this workstream.

## Dependencies

- [[ws-pdp]] — Stock status and delivery date displayed on PDP.
- [[ws-plp]] — Stock indicators on listing pages.
- [[ws-cart]] — Inventory validation when adding to cart.
- [[ws-checkout]] — Delivery date shown during shipping step.
- [[ws-stores]] — Store-level inventory for BOPIS.
- [[ws-integrations]] — Service Broker for inventory data retrieval.

## Asana Coverage (LAMPSPLUS + LPWE)
**LAMPSPLUS Implementation:** ~27 tasks (Inventory sync, ATP dates, stock levels, availability)
- Key: Inventory/ATP integration, back in stock notifications

**LPWE (Post-Launch):** 6 tasks (3 open)
- Open: Standardize Error Messaging in Check Availability Modal, Adjust Product "Arrives By" Cutoff Time, Update ATP/Delivery Date Logic
- Completed: Add More Vendors to ATP Feature, Add Limitations to Control When ATP is Called

### Key Tasks

- [[LPWE-156 - Standardize the Error Messaging in the Check Availability Modal|Standardize Error Messaging in Check Availability Modal]]
- [[994487 - Adjust Product -Arrives By- Cutoff Time From 2pm to 1pm|Adjust Product "Arrives By" Cutoff Time]]
- [[LPWE-124 - Update ATP - Delivery Date Logic|Update ATP/Delivery Date Logic]]

## Cross-References

- QA test cycle tasks for Inventory/ATP may exist in the [[ACE2E-296 - ROUND 1- Test Case Cycle Execution for Account Management|ACE2E-296]] to [[ACE2E-322 - ROUND 1- Verify Easy Post|ACE2E-322]] range.
