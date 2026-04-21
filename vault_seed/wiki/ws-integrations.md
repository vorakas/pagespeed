---
type: workstream
epics: ["[[ACE2E-41 - AC E2E - Dynamic Yield|ACE2E-41]]", "[[ACE2E-42 - AC E2E - Service Broker|ACE2E-42]]", "[[ACE2E-46 - AC E2E - Turn To|ACE2E-46]]"]
status: in-progress
task_count: 7
closed_count: 0
failed_qa_count: 0
groomed_count: 5
in_progress_count: 2
blocked_count: 0
---

# Workstream: Third-Party Integrations

## Description

This workstream covers third-party platform integrations: Dynamic Yield for personalization, Service Broker for backend service orchestration, and Turn To for user-generated content (reviews, Q&A, ratings).

## Scope

- **[[ACE2E-41 - AC E2E - Dynamic Yield|ACE2E-41]]: Dynamic Yield** (Evaluated) — Personalization engine widgets and A/B testing integration.
- **[[ACE2E-42 - AC E2E - Service Broker|ACE2E-42]]: Service Broker** (Evaluated) — Backend service orchestration layer.
- **[[ACE2E-46 - AC E2E - Turn To|ACE2E-46]]: Turn To** (In Progress) — Reviews, ratings, Q&A, opt-in, and user-generated content.

## Related Tasks

### Dynamic Yield ([[ACE2E-41 - AC E2E - Dynamic Yield|ACE2E-41]])

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACE2E-111 - ROUND1- EDS - DY More Like This Page\|ACE2E-111]] | DY widgets (task 1) | Groomed | Unassigned |
| [ACE2E-112](../raw/ACE2E/Task/ACE2E-112%20-%20ROUND1-%20DY%20Widgets%20%5BEDS%5D%20-%20Category%20Landing,%20Footer,%20Homepage,%20More%20Like%20This%20&%20Recently%20Viewed.md) | DY widgets (task 2) | Groomed | Unassigned |

### Turn To / Reviews ([[ACE2E-46 - AC E2E - Turn To|ACE2E-46]])

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACE2E-90 - ROUND1- Opt-In-Opt-Out Integration Support\|ACE2E-90]] | Opt-in (task 1) | Groomed | Unassigned |
| [[ACE2E-91 - ROUND1- Subscription Signup and Preferences Management\|ACE2E-91]] | Opt-in (task 2) | Groomed | Unassigned |
| [[ACE2E-92 - ROUND1- Product Review Confirmation Modal\|ACE2E-92]] | Reviews (task 1) | Groomed | Unassigned |
| [[ACE2E-93 - ROUND1- Reviews Page\|ACE2E-93]] | Reviews (task 2) | Groomed | Unassigned |
| [[ACE2E-94 - ROUND1- Product Reviews Integration (3rd party)\|ACE2E-94]] | Reviews (task 3) | Groomed | Unassigned |

### Service Broker ([[ACE2E-42 - AC E2E - Service Broker|ACE2E-42]])

No individual tasks mapped. Service Broker is an infrastructure integration consumed by other workstreams.

### Status Summary

- Groomed: 7
- Epic In Progress: [[ACE2E-46 - AC E2E - Turn To|ACE2E-46]] (Turn To)

## Bugs

No bugs associated with this workstream.

## Dependencies

- [[ws-pdp]] — Turn To reviews and DY recommendations displayed on PDP.
- [[ws-plp]] — DY personalization on listing pages.
- [[ws-homepage-navigation]] — DY widgets on homepage.
- [[ws-pixels-analytics]] — Overlap with review solicitation platforms.
- [[ws-privacy-compliance]] — Cookie consent may affect DY and Turn To script loading.

## Asana Coverage (LAMPSPLUS + LPWE)
**LAMPSPLUS Implementation:** ~49 tasks (Extensions, APIs, third-party modules, recommendations)
- Key: Kiosk mode, Dynamic Yield integration

**LPWE (Post-Launch):** 14 tasks (6 open)
- Open: Add Platform Info to MAO Call, Set Avalara API Timeout, Send Import Cart Source to MAO, Google API Shipping Improvements, Wunderkind Integration (Remove Coupon Modal + Promotion Rule + Tealium), Post-launch SDK Wunderkind
- Completed: Wunderkind Integration, ROKT Post Purchase Offers, Avalara Tax Retail Fee, Capture payment_network_transaction_id

### Key Tasks

- [[LPWE-152 - Add Platform Information to the MAO Call|Add Platform Info to MAO Call]]
- [[LPWE-153 - Set Avalara API Timeout|Set Avalara API Timeout]]
- [[239645 - Google API Shipping Improvements|Google API Shipping Improvements]]
- [[LPWE-106 - Wunderkind Integration - Remove Coupon modal|Wunderkind Integration - Remove Coupon Modal]]
- [[LPWE-105 - Wunderkind Integration - Promotion Rule Setup|Wunderkind Integration - Promotion Rule Setup]]
- [[LPWE-104 - Wunderkind Integration - Teallium support|Wunderkind Integration - Tealium Support]]
- [[270886 - Post launch - SDK Wunderkind Integration|Post-Launch SDK Wunderkind Integration]]

## Cross-References

- QA test cycle tasks for integrations may exist in the [[ACE2E-296 - ROUND 1- Test Case Cycle Execution for Account Management|ACE2E-296]] to [[ACE2E-322 - ROUND 1- Verify Easy Post|ACE2E-322]] range.
