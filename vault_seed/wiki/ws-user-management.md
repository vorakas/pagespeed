---
type: workstream
epics: ["[[ACE2E-32 - AC E2E - User Session Management|ACE2E-32]]", "[[ACE2E-33 - AC E2E - Account Management|ACE2E-33]]"]
status: not-started
task_count: 17
closed_count: 0
failed_qa_count: 0
groomed_count: 17
in_progress_count: 0
blocked_count: 0
---

# Workstream: User Management (Session & Account)

## Description

This workstream covers user session management and account features, including login/logout, subscription management, profile editing, CCPA compliance, session handling, and employee tracking/commission.

## Scope

- **[[ACE2E-32 - AC E2E - User Session Management|ACE2E-32]]: User Session Management** (Evaluated) — Login, session persistence, employee tracking/commission.
- **[[ACE2E-33 - AC E2E - Account Management|ACE2E-33]]: Account Management** (Evaluated) — Profile, subscriptions, CCPA data requests.

## Related Tasks

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACE2E-70 - ROUND1- Subscription Signup and Preferences Management\|ACE2E-70]] | Subscription (task 1) | Groomed | Unassigned |
| [[ACE2E-71 - ROUND1- Customer Profile System -- Profile Conversion to Customer Accounts\|ACE2E-71]] | Subscription (task 2) | Groomed | Unassigned |
| [[ACE2E-72 - ROUND1- Update Reward Number prefix to -2-\|ACE2E-72]] | Subscription (task 3) | Groomed | Unassigned |
| [[ACE2E-73 - ROUND1- Customer Account Customization Support\|ACE2E-73]] | Profile (task 1) | Groomed | Unassigned |
| [[ACE2E-74 - ROUND1- Style Account Pages - Not Logged In\|ACE2E-74]] | Profile (task 2) | Groomed | Unassigned |
| [[ACE2E-75 - ROUND1- Opt-In-Opt-Out Integration Support\|ACE2E-75]] | Profile (task 3) | Groomed | Unassigned |
| [[ACE2E-76 - ROUND1- Style Account Pages - Logged In\|ACE2E-76]] | Session (task 1) | Groomed | Unassigned |
| [ACE2E-77](../raw/ACE2E/Task/ACE2E-77%20-%20ROUND1-%20Style%20Account%20Pages%20-%20Logged%20In%20%5BOrders%5D.md) | Session (task 2) | Groomed | Unassigned |
| [[ACE2E-78 - ROUND1- Install CCPA Module\|ACE2E-78]] | Session (task 3) | Groomed | Unassigned |
| [[ACE2E-79 - ROUND1- CCPA Form\|ACE2E-79]] | CCPA (task 1) | Groomed | Unassigned |
| [[ACE2E-80 - ROUND1- CCPA Module Update for IP Addresses\|ACE2E-80]] | CCPA (task 2) | Groomed | Unassigned |
| [[ACE2E-81 - ROUND1- Updated Login Flow Styling\|ACE2E-81]] | Login (task 1) | Groomed | Unassigned |
| [[ACE2E-82 - ROUND1- Session Manager and Link Account-Import Cart Enhancement - Session Management\|ACE2E-82]] | Login (task 2) | Groomed | Unassigned |
| [[ACE2E-83 - ROUND1- Link-Search Account Customer Profile Form\|ACE2E-83]] | Login (task 3) | Groomed | Unassigned |
| [[ACE2E-84 - ROUND1- Store Modifier Extension\|ACE2E-84]] | Account feature (task 1) | Groomed | Unassigned |
| [[ACE2E-85 - ROUND1- Session Manager - Professional cart linking online lookup\|ACE2E-85]] | Account feature (task 2) | Groomed | Unassigned |
| [[ACE2E-194 - ROUND1- Employee Tracking for Orders Enhancement (Commission Logic)\|ACE2E-194]] | Employee tracking/commission | Groomed | Unassigned |

### Status Summary

- Groomed: 17

## Bugs

- **[[ACE2E-22 - Profile Data Not Retained After Customer Account Conversion|ACE2E-22]]**: Profile data not retained after conversion (Closed)
- **[[ACE2E-23 - Customer Profile Not Created From Checkout Data for Guest Orders|ACE2E-23]]**: Customer profile not created from checkout (Cancelled)

### New Asana Bug (2026-04-08)

| ID | Summary | Priority | Assignee | Status |
|----|---------|----------|----------|--------|
| [[LAMPSPLUS-1461 - Bug - Duplicate Company Assignment Causing Customer Role Conflict\|LAMPSPLUS-1461]] | Duplicate Company Assignment Causing Customer Role Conflict | High | Unassigned | Open — Ready For UAT In Stage, Not Ready To Test (100% complete, awaiting tester) |

## Asana Coverage (LAMPSPLUS + LPWE)
**LAMPSPLUS Implementation:** ~126 tasks (User/Account Management — 2nd largest)
- Examples: Configure B2B Admin Settings, CCPA Form, Logged-in Session Management, Import Customer Groups & Company Attributes, Style Account Pages, Customer Account Security
- Key: B2B setup foundational, session manager (user state), CCPA compliance

**LPWE (Post-Launch):** 12 tasks (6 open)
- Open: Adding 2FA to Site Login, Update Frontend Account Sign-in, Update Employee Generated Account Flow, Updated Login Flow BE (Pro), Login Solution Additional Scope, Google One Tap Storefront Logic
- Completed: Improved Guest User Order Status Flow, Updated Login Flow Styling, Do Away With Commission Employee Numbers

### Key Tasks

- [[LPWE-151 - Adding 2FA to Site Login|LPWE-151: Adding 2FA to Site Login]] (Open)
- [[LPWE-146 - Update Frontend Account Sign-in Screen Content and Forgot-Set Password Email|LPWE-146: Update Frontend Account Sign-in]] (Open)
- [[LPWE-119 - Updated Login Flow BE (Pro Flow)|LPWE-119: Updated Login Flow BE (Pro)]] (Open)
- [[LPWE-39 - Google One Tap Storefront Logic|LPWE-39: Google One Tap Storefront Logic]] (Open)
- [[LAMPSPLUS-101 - Configure B2B Admin Settings|LAMPSPLUS-101: Configure B2B Admin Settings]]
- [[LAMPSPLUS-107 - CCPA Form|LAMPSPLUS-107: CCPA Form]]
- [[LAMPSPLUS-155 - Logged-in Session Management|LAMPSPLUS-155: Logged-in Session Management]]
- [[LAMPSPLUS-419 - 2FA Module for Storefront|LAMPSPLUS-419: 2FA Module for Storefront]]

## Dependencies

- [[ws-checkout]] — Checkout uses logged-in user data (addresses, payment methods).
- [[ws-employee-tools]] — Employee session context shared with employee tools.
- [[ws-privacy-compliance]] — CCPA data requests relate to privacy compliance.
- [[ws-wish-list]] — Wish list requires authenticated session.
- [[ws-email-communications]] — Account-related transactional emails.

## Cross-References

- [[ACE2E-194 - ROUND1- Employee Tracking for Orders Enhancement (Commission Logic)|ACE2E-194]] (employee tracking/commission) bridges with [[ws-employee-tools]].
- QA test cycle tasks for user management may exist in the [[ACE2E-296 - ROUND 1- Test Case Cycle Execution for Account Management|ACE2E-296]] to [[ACE2E-322 - ROUND 1- Verify Easy Post|ACE2E-322]] range.
