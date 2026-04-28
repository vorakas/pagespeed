---
type: component
workstream: "[[ws-app-builder]]"
---

# Component: App Builder Suggest API & Authentication

> Part of [[ws-app-builder]] | Consumed by [[comp-eds-plp-search]], [[comp-eds-header-nav]]

## Scope

Autosuggest endpoint and authentication/authorization for App Builder API calls.

### Suggest API
- **Create Suggest API Endpoint** ([[ACAB-205 - Create Suggest API End Point|ACAB-205]]) — Alex Tadevosyan, Closed
- **Secure guest search via header token** ([[ACAB-297 - Secure Guest Search Parameter Via Header Token|ACAB-297]]) — Alex Tadevosyan, Closed
- EDS consumes this endpoint for the search box autocomplete (see [[comp-eds-plp-search]])

### Authentication
- **Update Authentication Call To Use New Origin Header** ([[ACAB-338 - Update Authentication Call To Use New Origin Header|ACAB-338]]) — `Code Review`, Naga Ambarish Chigurala
  - QA sub-task: [[ACAB-339 - QA- Update Authentication Call To Use New Origin Header|ACAB-339]] (Groomed, Unassigned)

### Developer Support / Onboarding (Research — All Closed)
Support tasks used for pairing and knowledge transfer during App Builder ramp-up:

| Task | Developer | Parts |
|------|-----------|-------|
| [[ACAB-17 - App Builder Support For Akim\|ACAB-17]], 31, 35, 39 | Akim Malkov | 4 parts |
| [[ACAB-20 - EDS SUPPORT (Part 1)\|ACAB-20]], 18, 19, 32, 33, 34, 47 | Alex Tadevosyan | 7 parts (EDS Support) |
| [[ACAB-138 - App Builder Support For Alex\|ACAB-138]] | Alex Tadevosyan | App Builder Support |
| [[ACAB-38 - App Builder Support For Aarthi\|ACAB-38]], 50 | Aarthi Natarajan | 2 parts |
| [[ACAB-40 - App Builder Support For Naga\|ACAB-40]] | Naga Ambarish Chigurala | 1 part |

### Other Research (Closed)
- [[ACAB-58 - Research How PDP URLs are Being Generated On PLPs for AC|ACAB-58]] — Research How PDP URLs are Being Generated On PLPs for AC
- [[ACAB-194 - “Free Shipping” Attribute Displayed under “Specials” Filter on Open Box Sort Page|ACAB-194]] — "Free Shipping" Attribute under Specials on Open Box Sort Page
- [[ACAB-200 - Research Cause of Difference Between WUP and AC For Specials Facet Display Logic|ACAB-200]] — Research Cause of Difference for Specials Facet Display Logic
- [[ACAB-217 - SKU Search Returns PLP With 1 Result|ACAB-217]] — SKU Search Returns PLP With 1 Result
- [[ACAB-277 - Research Root Cause Of Pros Specials! Facet Not Loading for pt2–pt5 Users|ACAB-277]] — Root Cause Of Pros Specials Facet Not Loading for pt2–pt5 Users

## Active Items

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACAB-338 - Update Authentication Call To Use New Origin Header\|ACAB-338]] | Update Authentication Call To Use New Origin Header | Code Review | Naga Ambarish Chigurala |
| [[ACAB-15 - EDS Bloomreach A-B sorting Integration Support\|ACAB-15]] | EDS Bloomreach A/B sorting Integration Support | Open | Unassigned |

## Notes
- A/B sorting support ([[ACAB-15 - EDS Bloomreach A-B sorting Integration Support|ACAB-15]]) is open and unassigned — would enable Bloomreach-driven A/B testing of sort algorithms
- All developer onboarding is complete — the team is self-sufficient on App Builder
