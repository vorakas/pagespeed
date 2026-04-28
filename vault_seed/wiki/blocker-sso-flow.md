---
type: blocker
status: open
affects: ["[[ws-user-management]]"]
---

# SSO Flow Risk

**Source:** LAMPSPLUS Risks section (Asana)
**Status:** Open

## Description
SSO flow logic incorrectly appends @lampsplus.com during employee login. Main risk: logic applies to any user missing an email (not just employees), potentially creating misleading internal email addresses for customers. Impacts identity resolution and downstream data syncing.

## Mitigation
Multiple review sessions scheduled (July-August 2025). LP SSO working session held; test scenarios provided 8/19. Ongoing review and testing.

## Cross-References
- [[blocker-data-syncing]]
- [[ws-user-management]]
