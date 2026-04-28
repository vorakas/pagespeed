---
type: workstream
epics: ["[[ACE2E-39 - AC E2E - Wish List|ACE2E-39]]"]
status: not-started
task_count: 2
closed_count: 0
failed_qa_count: 0
groomed_count: 2
in_progress_count: 0
blocked_count: 0
---

# Workstream: Wish List

## Description

This workstream covers the customer wish list functionality, including the core wish list feature and wish list extensions (sharing, notifications).

## Scope

- **[[ACE2E-39 - AC E2E - Wish List|ACE2E-39]]: Wish List** (Evaluated) — Wish list creation, management, and extensions.

## Related Tasks

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACE2E-109 - ROUND1- Customize Wishlist for Guests\|ACE2E-109]] | Wishlist | Groomed | Unassigned |
| [[ACE2E-209 - ROUND1- Session Manager - Wishlist Extensions\|ACE2E-209]] | Wishlist extensions | Groomed | Unassigned |

### Status Summary

- Groomed: 2

## Bugs

### Failed - Production

| Key | Summary | Status | Assignee | Notes |
|-----|---------|--------|----------|-------|
| [[LAMPSPLUS-224 - Data Syncing - -Private Link- Wishlist Push\|LAMPSPLUS-224]] | Data Syncing — Private Link Wishlist Push | Failed - Production | Héctor Omar Tello Avellaneda | 3 open issues: qty update not persisting, PDP multi-wishlist UX (internal bug being fixed), wishlist load order (sent to LP design) |

**Detail (as of 2026-04-13):**
- **Issue 1 (Enhancement):** Wishlist quantity update resets to 1 on navigation. AC uses qty checkbox on add-to-cart; wishlist qty update is a separate enhancement — sent to LP design team.
- **Issue 2 (Internal Bug):** On PDP with multiple wishlists, clicking the heart icon shows "+Add new Wish List" before existing lists. CNX confirmed internal bug; fix in progress.
- **Issue 3 (Enhancement):** First wishlist in list always loads, regardless of which was last active. Sent to LP design team for review.
- Max 3 public wishlists is intentional (configurable via Admin → max_number_of_wishlists).

## Dependencies

- [[ws-user-management]] — Wish list requires authenticated user session.
- [[ws-pdp]] — "Add to wish list" action on PDP.
- [[ws-email-communications]] — Wish list sharing via email.

## Asana Coverage (LAMPSPLUS + LPWE)
**LAMPSPLUS Implementation:** ~4 tasks (Wishlist, data sync, guest wishlists)

**LPWE (Post-Launch):** 3 tasks (2 open)
- Open: Support Wish Lists Across Both Platforms for Anonymous Users, Support Wish Lists Across Both Platforms for Logged Users
- Completed: Employee Wishlist After Linking to Customer with Existing Wishlist

### Key Tasks

- [[LPWE-161 - Support Wish Lists Across Both Platforms for Anonymous Users|Wish Lists Across Both Platforms (Anonymous Users)]]
- [[LPWE-160 - Support Wish Lists Across Both Platforms for Logged Users|Wish Lists Across Both Platforms (Logged Users)]]

## Cross-References

- QA test cycle tasks for Wish List may exist in the [[ACE2E-296 - ROUND 1- Test Case Cycle Execution for Account Management|ACE2E-296]] to [[ACE2E-322 - ROUND 1- Verify Easy Post|ACE2E-322]] range.
