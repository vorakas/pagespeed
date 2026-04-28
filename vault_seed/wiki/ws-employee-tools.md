---
type: workstream
epics: ["[[ACE2E-38 - AC E2E - Employee Tools|ACE2E-38]]"]
status: not-started
task_count: 6
closed_count: 0
failed_qa_count: 0
groomed_count: 6
in_progress_count: 0
blocked_count: 0
---

# Workstream: Employee Tools

## Description

This workstream covers internal employee-facing tools and features, including employee search, email tools, print functionality, and other employee-specific utilities used in-store or by support staff.

## Scope

- **[[ACE2E-38 - AC E2E - Employee Tools|ACE2E-38]]: Employee Tools** (Evaluated) — Employee search, email, print, and related internal tools.

## Related Tasks

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACE2E-203 - ROUND1- Set Up Logging for Employee Tools URL - Search Bar\|ACE2E-203]] | Employee tools (task 1) | Groomed | Unassigned |
| [[ACE2E-204 - ROUND1- Employee Tools (Links) and Search - Send Email\|ACE2E-204]] | Employee tools (task 2) | Groomed | Unassigned |
| [[ACE2E-205 - ROUND1- Employee Tools (Links) and Search - Print products\|ACE2E-205]] | Employee search | Groomed | Unassigned |
| [[ACE2E-206 - ROUND1- Employee Order Search\|ACE2E-206]] | Employee email | Groomed | Unassigned |
| [[ACE2E-207 - ROUND1- Find a Saved Asset\|ACE2E-207]] | Employee print | Groomed | Unassigned |
| [[ACE2E-208 - ROUND1- Employee Tools (Links) and Search\|ACE2E-208]] | Employee tools (task 3) | Groomed | Unassigned |

### Status Summary

- Groomed: 6

## Bugs

No bugs associated with this workstream.

## Dependencies

- [[ws-user-management]] — Employee session/authentication context.
- [[ws-cart]] — Employee cart features.
- [[ws-payments]] — Card swipe/kiosk for in-store employee transactions.

## Asana Coverage (LAMPSPLUS + LPWE)
**LAMPSPLUS Implementation:** ~22 tasks (Employee search, order management, discounts, tools)
- Key: Commission logic tracking, quick order form

**LPWE (Post-Launch):** 9 tasks (4 open)
- Open: Employee Self-Service Restriction, Set Up Logging for Employee Tools URL, Conditional Logic for MP Row in PDP Employee Details, Force Remove Scenarios (Employee)
- Completed: Employee Session Linking, Store Switcher, EDS Sales Rep Compatibility, Kiosk Detection

### Key Tasks

- [[LPWE-6 - Employee Self-Service Restriction|Employee Self-Service Restriction]]
- [[LPWE-64 - Set Up Logging for Employee Tools URL - Search Bar|Set Up Logging for Employee Tools URL]]
- [[LPWE-93 - Force Remove Scenarios (Employee)|Force Remove Scenarios (Employee)]]
- [[LPWE-23 - Kiosk Detection Using IP Range|Kiosk Detection Using IP Range]]

## Cross-References

- [[ACE2E-194 - ROUND1- Employee Tracking for Orders Enhancement (Commission Logic)|ACE2E-194]] (employee tracking/commission) in [[ws-user-management]] bridges with this workstream.
- QA test cycle tasks for Employee Tools may exist in the [[ACE2E-296 - ROUND 1- Test Case Cycle Execution for Account Management|ACE2E-296]] to [[ACE2E-322 - ROUND 1- Verify Easy Post|ACE2E-322]] range.
