---
type: workstream
epics: ["[[ACE2E-36 - AC E2E - Pixels|ACE2E-36]]"]
status: not-started
task_count: 10
closed_count: 0
failed_qa_count: 0
groomed_count: 10
in_progress_count: 0
blocked_count: 0
---

# Workstream: Pixels & Analytics

## Description

This workstream covers all tracking pixels, analytics integrations, and review solicitation platforms. It includes the Tealium tag management system and multiple third-party review/survey platforms.

## Scope

- **[[ACE2E-36 - AC E2E - Pixels|ACE2E-36]]: Pixels/Tealium** (Evaluated) — Tealium integration, BBB, Consumer Affairs, Trustpilot, SiteJabber, Reseller Ratings, Bizrate, Google Surveys, and review solicitation.

## Related Tasks

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACE2E-189 - ROUND1- Configure Tealium\|ACE2E-189]] | Tealium integration | Groomed | Unassigned |
| [[ACE2E-195 - ROUND1- BBB Script\|ACE2E-195]] | BBB tracking | Groomed | Unassigned |
| [[ACE2E-196 - ROUND1- Consumer Affairs Integration\|ACE2E-196]] | Consumer Affairs | Groomed | Unassigned |
| [[ACE2E-197 - ROUND1- TrustPilot Integration (js script)\|ACE2E-197]] | Trustpilot | Groomed | Unassigned |
| [[ACE2E-198 - ROUND1- Sitejabber Integration\|ACE2E-198]] | SiteJabber | Groomed | Unassigned |
| [[ACE2E-199 - ROUND1- Reseller Ratings (js script)\|ACE2E-199]] | Reseller Ratings | Groomed | Unassigned |
| [[ACE2E-200 - ROUND1- Bizrate Integration (js script)\|ACE2E-200]] | Bizrate | Groomed | Unassigned |
| [[ACE2E-201 - ROUND1- Google (Surveys) (js script)\|ACE2E-201]] | Google Surveys | Groomed | Unassigned |
| [[ACE2E-202 - ROUND1- Review Solicitation Module\|ACE2E-202]] | Review solicitation | Groomed | Unassigned |
| *(additional pixel tasks may exist)* | | | |

### Status Summary

- Groomed: 10

## Bugs

No bugs associated with this workstream.

## Dependencies

- [[ws-privacy-compliance]] — Cookie consent gates pixel firing; GDPR/CCPA compliance.
- [[ws-checkout]] — Conversion tracking on order confirmation page.
- [[ws-pdp]] — Product view tracking.
- [[ws-plp]] — Product impression tracking on listing pages.
- [[ws-integrations]] — Some tracking platforms overlap with review integrations (Turn To).

## Asana Coverage (LAMPSPLUS + LPWE)
**LAMPSPLUS Implementation:** ~13 tasks (GA4, Tealium, Dynamic Yield, Quantum Metric)

**LPWE (Post-Launch):** 15 tasks (3 open)
- Open: Tealium Refactor (Performance), DY Widget Image Logic Update, Tealium Custom Extension
- Completed: Full Tealium configuration and training suite (Configure Tealium, Tealium Manager Training, Tracking customizations for item list/navigation/search/user attributes/site mode), ITP cookie config for DY, Update utag.js profile

### Key Tasks

- [[LPWE-140 - -PERFORMANCE- Tealium Refactor|Tealium Refactor (Performance)]]
- [[LPWE-143 - Dynamic Yield (DY) Widget Image Logic Update|DY Widget Image Logic Update]]
- [[LPWE-110 - Tealium Custom Extension|Tealium Custom Extension]]

## Cross-References

- QA test cycle tasks for Pixels/Tealium may exist in the [[ACE2E-296 - ROUND 1- Test Case Cycle Execution for Account Management|ACE2E-296]] to [[ACE2E-322 - ROUND 1- Verify Easy Post|ACE2E-322]] range.
