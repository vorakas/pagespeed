---
type: blocker
status: open
affects: ["[[ws-tealium-tags]]", "[[ws-pixels-analytics]]"]
---

# Tealium Module Instability

**Source:** LAMPSPLUS Risks section (Asana)
**Status:** Open | **Priority:** Critical

## Description
Tealium module shows significant performance and compatibility issues with Adobe Commerce/EDS. Container creation delayed from 8/13 to 9/12. Module has never been implemented with this platform stack before.

## Issues
- Slowness, AJAX/JavaScript breaking, event observer problems
- Module incompatibility with Hyva theme
- Caching/Redis issues
- Poor optimization and debugger problems
- Module still unstable as of 3/31/26

## Mitigation
- Tealium support contacted 10/29; module reinstalled 11/17
- Custom extension under development (approved by LP)
- Module merged to staging 12/9
- Ongoing compatibility and optimization work

## Cross-References
- [[blocker-analytics-delay]]
- [[ws-tealium-tags]]
- [[ws-pixels-analytics]]
