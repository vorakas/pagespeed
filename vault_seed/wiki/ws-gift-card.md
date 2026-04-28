---
type: workstream
epics: ["[[ACE2E-43 - AC E2E - Gift Card|ACE2E-43]]"]
status: not-started
task_count: 6
closed_count: 0
failed_qa_count: 0
groomed_count: 6
in_progress_count: 0
blocked_count: 0
---

# Workstream: Gift Card

## Description

This workstream covers gift card purchasing, redemption, balance checking, and management within the Adobe Commerce platform.

## Scope

- **[[ACE2E-43 - AC E2E - Gift Card|ACE2E-43]]: Gift Card** (Evaluated) — Gift card product pages, purchase flow, redemption at checkout, balance inquiry.

## Related Tasks

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACE2E-118 - ROUND1- Gift Card PIN\|ACE2E-118]] | Gift card (task 1) | Groomed | Unassigned |
| [ACE2E-119](../raw/ACE2E/Task/ACE2E-119%20-%20ROUND1-%20%5BAPI%20MESH%5D%20Gift%20Card%20Authorization-Reverse%20Authorization%20Integration.md) | Gift card (task 2) | Groomed | Unassigned |
| [ACE2E-120](../raw/ACE2E/Task/ACE2E-120%20-%20ROUND1-%20%5BAPI%20MESH%5D%20Gift%20Card%20Reverse%20Authorization%20Integration%20-%20Failure%20Online%20Payment%20Methods.md) | Gift card (task 3) | Groomed | Unassigned |
| [ACE2E-121](../raw/ACE2E/Task/ACE2E-121%20-%20ROUND1-%20%5BAPI%20MESH%5D%20Gift%20Card%20-%20Check%20Balance%20and%20Balance%20Validation%20Integration.md) | Gift card (task 4) | Groomed | Unassigned |
| [[ACE2E-122 - ROUND1- Per Line Shipping Address Selection for Gift Card Purchases\|ACE2E-122]] | Gift card (task 5) | Groomed | Unassigned |
| [[ACE2E-123 - ROUND1- Merge the Gift Card PDP Functionality Into the Gift Card Landing Page\|ACE2E-123]] | Gift card (task 6) | Groomed | Unassigned |

### Status Summary

- Groomed: 6

## Bugs

No bugs associated with this workstream.

## Dependencies

- [[ws-checkout]] — Gift card redemption during billing/payment step.
- [[ws-cart]] — Gift card applied as payment method in cart.
- [[ws-financial-calculators]] — Gift card balance affects order total calculations.
- [[ws-email-communications]] — Gift card delivery via email.

## Asana Coverage (LAMPSPLUS + LPWE)
**LAMPSPLUS Implementation:** ~10 tasks (Gift card balance, authorization, integrations)

**LPWE (Post-Launch):** 5 tasks (2 open)
- Open: Per Line Shipping Address Selection for Gift Card Purchases, Merge Gift Card PDP Into Gift Card Landing Page
- Completed: Build Support for Custom Gift Cards

### Key Tasks

- [[LPWE-82 - Per Line Shipping Address Selection for Gift Card Purchases|Per Line Shipping Address Selection for Gift Card Purchases]]
- [[LPWE-81 - Merge the Gift Card PDP Functionality Into the Gift Card Landing Page|Merge Gift Card PDP Into Gift Card Landing Page]]

## Cross-References

- QA test cycle tasks for Gift Card may exist in the [[ACE2E-296 - ROUND 1- Test Case Cycle Execution for Account Management|ACE2E-296]] to [[ACE2E-322 - ROUND 1- Verify Easy Post|ACE2E-322]] range.
