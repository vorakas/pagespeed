---
type: workstream
epics: ["[[ACE2E-45 - AC E2E - Card Swipe|ACE2E-45]]"]
status: not-started
task_count: 2
closed_count: 0
failed_qa_count: 0
groomed_count: 2
in_progress_count: 0
blocked_count: 0
---

# Workstream: Payments (Card Swipe / Kiosk)

## Description

This workstream covers in-store payment hardware integration, specifically card swipe and kiosk card reading capabilities for the Adobe Commerce platform.

## Scope

- **[[ACE2E-45 - AC E2E - Card Swipe|ACE2E-45]]: Card Swipe** (Evaluated) — Kiosk and card reader integration for in-store transactions.

## Related Tasks

| Key       | Summary                     | Status  | Assignee   |
| --------- | --------------------------- | ------- | ---------- |
| [[ACE2E-102 - ROUND1- Kiosk Hardware Card Reading Integration\|ACE2E-102]] | Kiosk/card reading (task 1) | Groomed | Unassigned |
| [[ACE2E-103 - ROUND1- Add CVV Input to Kiosk Credit Card Reader on Billing Page\|ACE2E-103]] | Kiosk/card reading (task 2) | Groomed | Unassigned |

### Status Summary

- Groomed: 2

## Bugs

No bugs associated with this workstream.

## Dependencies

- [[ws-checkout]] — Payment methods in checkout flow (Google Pay, Apple Pay, Cybersource are in checkout scope).
- [[ws-employee-tools]] — Employee-initiated in-store transactions.
- [[ws-stores]] — Physical store context for kiosk payments.

## Asana Coverage (LAMPSPLUS + LPWE)
**LAMPSPLUS Implementation:** ~4 tasks (Cybersource edge cases, saved cards)

**LPWE (Post-Launch):** 7 tasks (1 open)
- Open: Cybersource 404 Transaction REST API Bug
- Completed: Update Fraud Rules, Suppress Info from Kiosk CC Reader, Add CVV Input to Kiosk CC Reader

### Key Tasks

- [[406384 - Cybersource 404 transaction rest API BUG|Cybersource 404 Transaction REST API Bug]]

## Cross-References

- Digital payment methods (Google Pay, Apple Pay, Cybersource) are tracked under [[ws-checkout]] ([[ACE2E-30 - AC E2E - Billing|ACE2E-30]] Billing).
- QA test cycle tasks for Payments may exist in the [[ACE2E-296 - ROUND 1- Test Case Cycle Execution for Account Management|ACE2E-296]] to [[ACE2E-322 - ROUND 1- Verify Easy Post|ACE2E-322]] range.
