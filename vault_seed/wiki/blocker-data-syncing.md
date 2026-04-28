---
type: blocker
status: open
affects: ["[[ws-data-platform]]", "[[ws-cart]]", "[[ws-user-management]]"]
---

# Data Syncing Workstream Risk

**Source:** LAMPSPLUS Risks section (Asana) — 5 related risk items
**Status:** Open | **Priority:** Critical

## Description
Full data syncing workstream at risk for launch completion. Scope includes Cart, Session Manager, Company, and Customer Sync. Wishlists confirmed dropped. Key decision (10/20/25): changed approach from bidirectional JSON sync to unidirectional export from Adobe Commerce to legacy site.

## Sub-Risks
- **Company Mapping:** Multiple review cycles; Rewards Number concern raised 8/13; reassigned for review 8/25
- **Customer Mapping:** Reward Number + Email are critical identifiers for bidirectional sync. Multiple iterations with LP to clarify scope
- **Session Mapping:** Waiting on internal LP coordination; partial work completed

## Capacity
- ~500 hours budgeted but likely consumed
- Enhancement work adds ~526 hours
- Total ~1000 hours needed — timeline deemed "not achievable" with current workload

## Mitigation
- Scope narrowed to Cart, Session Manager, Company, Customer Sync
- Changed from bidirectional to unidirectional export
- BI connector (Rivery) rejected
- Cart syncing POC marked as critical

## Impact
Soft launch at risk if data syncing slips. Real-time syncing requirement adds complexity.

## Cross-References
- [[blocker-project-timeline]]
- [[ws-data-platform]]
- [[ws-cart]]
- [[ws-user-management]]
