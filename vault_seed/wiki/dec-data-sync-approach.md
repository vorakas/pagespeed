---
type: decision
date: 2025-10-20
status: accepted
---

# Decision: Data Sync — Unidirectional Export

**Date:** 2025-10-20
**Status:** Accepted

## Context
Original approach was bidirectional JSON sync between Adobe Commerce and the legacy site. Capacity constraints (~1000 hours needed vs ~500 budgeted) and complexity made the original approach infeasible.

## Decision
Changed from bidirectional JSON sync to unidirectional export from Adobe Commerce to the legacy site.

## Scope Confirmed (10/14/25)
- Cart sync
- Session Manager sync
- Company sync
- Customer sync
- Wishlists: **dropped** (confirmed 10/15/25)

## Rejected Alternatives
- BI connector (Rivery) — rejected per Derek, 10/15/25

## Impact
Simplifies data sync architecture but limits legacy site capabilities during transition period. Rollback strategy adjusted accordingly.

## Cross-References
- [[blocker-data-syncing]]
- [[ws-data-platform]]
- [[ws-cart]]
- [[ws-user-management]]
