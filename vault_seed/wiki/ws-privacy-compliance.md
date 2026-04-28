---
type: workstream
epics: ["[[ACE2E-48 - AC E2E - Cookie Consent|ACE2E-48]]", "[[ACE2E-49 - AC E2E - Catalog Opt Out|ACE2E-49]]", "[[ACE2E-53 - AC E2E - Accessibility|ACE2E-53]]"]
status: not-started
task_count: 5
closed_count: 0
failed_qa_count: 0
groomed_count: 5
in_progress_count: 0
blocked_count: 0
---

# Workstream: Privacy & Compliance

## Description

This workstream covers privacy, consent, and accessibility compliance requirements, including cookie consent management, catalog opt-out functionality, and WCAG accessibility standards.

## Scope

- **[[ACE2E-48 - AC E2E - Cookie Consent|ACE2E-48]]: Cookie Consent** (Evaluated) — Cookie consent banner, preference management, conditional script loading.
- **[[ACE2E-49 - AC E2E - Catalog Opt Out|ACE2E-49]]: Catalog Opt Out** (Evaluated) — Catalog mailing opt-out form.
- **[[ACE2E-53 - AC E2E - Accessibility|ACE2E-53]]: Accessibility** (Evaluated) — WCAG compliance, screen reader support, keyboard navigation.

## Related Tasks

### Cookie Consent ([[ACE2E-48 - AC E2E - Cookie Consent|ACE2E-48]])

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACE2E-98 - ROUND1- UsableNet Pixel\|ACE2E-98]] | Cookie consent (task 1) | Groomed | Unassigned |
| [[ACE2E-99 - ROUND1- Install & Configure Cookie Consent Script\|ACE2E-99]] | Cookie consent (task 2) | Groomed | Unassigned |
| [[ACE2E-100 - ROUND1- EDS - implement Cookie consent JS\|ACE2E-100]] | Cookie consent (task 3) | Groomed | Unassigned |

### Catalog Opt Out ([[ACE2E-49 - AC E2E - Catalog Opt Out|ACE2E-49]])

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACE2E-89 - ROUND1- Request a Catalog Form and The Mail Group Integration\|ACE2E-89]] | Catalog opt-out form | Groomed | Unassigned |

### Accessibility ([[ACE2E-53 - AC E2E - Accessibility|ACE2E-53]])

No individual tasks mapped yet. Accessibility requirements likely apply across all workstreams.

### Status Summary

- Groomed: 4
- Accessibility tasks pending creation

## Bugs

- **[[ACE2E-20 - Cookie ASPXIDENT is NOT Displaying on Adobe Site|ACE2E-20]]**: Cookie ASPXIDENT not displaying (Closed)
- **[[ACE2E-21 - Opt-Out Value in the Database is Incorrect|ACE2E-21]]**: Opt-out value incorrect (Closed)

## Dependencies

- [[ws-pixels-analytics]] — Cookie consent gates pixel/tracking script execution.
- [[ws-integrations]] — Cookie consent affects Dynamic Yield and Turn To script loading.
- [[ws-user-management]] — CCPA data requests overlap with privacy compliance.
- All workstreams — Accessibility requirements are cross-cutting.

## Asana Coverage (LAMPSPLUS + LPWE)
**LAMPSPLUS Implementation:** ~2 tasks (Cookie management, accessibility)

**LAMPSPLUS Pre-Launch:** 3 open compliance tasks
- ADA Compliance Updates (due 2026-04-22), PCI Compliance Updates, PCI Compliance Audit Result Review

**LPWE (Post-Launch):** 7 tasks (3 open)
- Open: CCPA on My Account Dashboard, Ability to Fall Back to reCAPTCHA v2, Configure OneTrust Blocking Triggers on Tealium
- Completed: CCPA Module Update for IP Addresses, reCAPTCHA for Launch, Privacy & Security Page Styling

### Key Tasks

- [[LPWE-171 - -Post Launch- CCPA on My Account Dahsboard|CCPA on My Account Dashboard]]
- [[LPWE-61 - Ability to Fall Back to v2 of reCAPTCHA When v3 Fails|Ability to Fall Back to reCAPTCHA v2]]
- [[LPWE-69 - Configure OneTrust Blocking Triggers on Tealium|Configure OneTrust Blocking Triggers on Tealium]]
- [[LAMPSPLUS-479 - ADA Compliance Updates (in response to audit results)|ADA Compliance Updates]]
- [[LAMPSPLUS-384 - PCI Compliance Updates (in response to results)|PCI Compliance Updates]]
- [[LAMPSPLUS-480 - PCI Compliance Audit Result Review|PCI Compliance Audit Result Review]]

## Cross-References

- QA test cycle tasks for Privacy/Compliance may exist in the [[ACE2E-296 - ROUND 1- Test Case Cycle Execution for Account Management|ACE2E-296]] to [[ACE2E-322 - ROUND 1- Verify Easy Post|ACE2E-322]] range.
