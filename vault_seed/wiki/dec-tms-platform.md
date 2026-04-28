---
type: decision
date: 2025-05-19
status: accepted
---

# Decision: TMS Platform — Tealium (Changed from GTM)

**Date:** 2025-05-19 (finalized)
**Status:** Accepted

## Context
The original project scope was built against Google Tag Manager (GTM). On 5/6/25, LP decided to change the TMS platform to Tealium. Decision was finalized 5/19/25.

## Decision
Switch from GTM to Tealium as the Tag Management System.

## Impact
- All GTM-scoped analytics work required rework for Tealium
- Tealium module had never been implemented with Adobe Commerce/EDS before
- Caused significant performance and compatibility issues: [[blocker-tealium-instability]]
- Analytics workstream delivery timeline directly impacted: [[blocker-analytics-delay]]

## Cross-References
- [[blocker-tms-decision]]
- [[blocker-analytics-delay]]
- [[blocker-tealium-instability]]
- [[ws-pixels-analytics]]
- [[ws-tealium-tags]]
