---
type: blocker
status: open
affects: ["[[ws-pixels-analytics]]", "[[ws-tealium-tags]]"]
---

# Analytics Workstream Delay

**Source:** LAMPSPLUS Risks section (Asana)
**Status:** Open | **Priority:** Critical

## Description
Analytics workstream off track for January delivery. Caused by TMS Decision Change (GTM to Tealium requiring rework) and Tealium module instability. Analytics team was fully blocked by 10/16/25.

## Key Issues
- First Party Domain creation delayed 10/7 → 10/24 (17 days)
- 60 additional hours needed for Data Layers work
- Tealium module shows significant performance issues (slowness, AJAX/JS breaking, event observer problems)
- Module never previously implemented with Adobe Commerce/EDS

## Mitigation
- Tealium support engaged; module reinstalled 11/17
- Custom extension being developed (approved by LP)
- Module merged to staging 12/9
- Ongoing optimization and compatibility work

## Cross-References
- [[blocker-tms-decision]]
- [[blocker-tealium-instability]]
- [[ws-pixels-analytics]]
- [[ws-tealium-tags]]
