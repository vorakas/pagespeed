---
type: decision
date: 2025-03-12
status: accepted
---

# Decision: Search Engine — Bloomreach

**Date:** 2025-03-12 (finalized)
**Status:** Accepted

## Context
Search vendor selection was a critical-path decision that delayed the project timeline. Original due date was January 2025; selection was finalized March 12, 2025.

## Decision
Bloomreach selected as the search engine vendor. Contracts signed March 31, 2025.

## Implementation Timeline
- Bloomreach workstreams began: April 7, 2025
- Product feed sent: May 2, 2025
- Available in production: ~May 16, 2025
- Search platform implementation: 16 weeks (~late August 2025)
- RTS implementation: 12 weeks (~August 2025)

## Impact
- Selection delay cascaded into [[blocker-project-timeline]]
- App Builder middleware connects EDS to Bloomreach: [[ws-app-builder]]
- Bloomreach feed generation: [[ws-bloomreach-feed]]

## Cross-References
- [[blocker-search-vendor]]
- [[ws-plp]]
- [[ws-app-builder]]
- [[ws-bloomreach-feed]]
