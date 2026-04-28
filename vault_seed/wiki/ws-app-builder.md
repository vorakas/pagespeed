---
type: workstream
status: in-progress
task_count: 283
blocked_count: 0
---

# Workstream: App Builder / Bloomreach Integration

> Jira Project: **ACAB** | Epic: [[ACAB-1 - AC Implementation - App Builder Integration|ACAB-1]] | Lead: Eilat Vardi
> Source: [[source-jira-acab]]

## Overview

The ACAB project implements the **App Builder middleware** that connects Adobe Commerce and EDS to **Bloomreach** — the search and merchandising engine powering product listing pages. App Builder is Adobe's serverless extension framework; it hosts the API endpoints that EDS calls for search, sort, facets, suggest, and product data.

### Architecture

```
EDS (Frontend) → App Builder (Middleware) → Bloomreach API (Search Engine)
                      ↓
              Adobe Commerce (Product Data, Auth)
```

### Scope

- **Search API** — Query Bloomreach, transform response for EDS consumption
- **Suggest API** — Autocomplete/autosuggest endpoint ([[ACAB-205 - Create Suggest API End Point|ACAB-205]])
- **Facet/Filter handling** — Transform Bloomreach facet data into LP's filter structure
- **Sort logic** — Sort by price, rating, relevance with correct pricing for specials
- **Pricing** — Product pricing, grouping SKUs, sale/clearance/open box callouts
- **URL handling** — Canonical URL order, ID-based URLs, redirect logic
- **Authentication** — Guest token, customer group headers, origin-based auth
- **VIP/Pro support** — Pro Specials facet, employee pricing, kiosk mode

## Progress Summary

| Metric | Count |
|--------|-------|
| Total issues | 283 |
| Closed | 135 (48%) |
| Cancelled | 137 (48%) |
| Active | 11 (4%) |

This project is **96% resolved**. The high cancellation rate reflects early bugs that became obsolete as the Bloomreach integration stabilized.

## Components

- [[comp-ab-search-facets]] — Search API, facets, filters, sort, pricing, URL logic
- [[comp-ab-suggest-auth]] — Suggest API, authentication, developer support

## Active Work (as of 2026-04-13)

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACAB-338 - Update Authentication Call To Use New Origin Header\|ACAB-338]] | Update Authentication Call To Use New Origin Header | Code Review | Naga Ambarish Chigurala |
| [[ACAB-339 - QA- Update Authentication Call To Use New Origin Header\|ACAB-339]] | QA: Update Authentication Call To Use New Origin Header | Groomed | Unassigned |
| [[ACAB-331 - Applying All Filters under Specials Returns 404 Page\|ACAB-331]] | Applying All Filters under Specials Returns 404 Page | Deployment - PPE | Naga Ambarish Chigurala |
| [[ACAB-134 - Special Callouts is Not Displaying on The Sort Page\|ACAB-134]] | Special Callouts is Not Displaying on The Sort Page | Stakeholder Test | Naga Ambarish Chigurala |
| [[ACAB-325 - Component SKU Search Redirects to PDP Instead of Sort Page\|ACAB-325]] | Component SKU Search Redirects to PDP Instead of Sort Page | Stakeholder Test | Naga Ambarish Chigurala |
| [[ACAB-343 - Make VIP Attribute Data Available at the Product Level on PLPs\|ACAB-343]] | Make VIP Attribute Data Available at the Product Level on PLPs | Open | Unassigned |
| [[ACAB-15 - EDS Bloomreach A-B sorting Integration Support\|ACAB-15]] | EDS Bloomreach A/B sorting Integration Support | Open | Unassigned |
| [[ACAB-16 - PLP Ads (included in listing)\|ACAB-16]] | PLP Ads (included in listing) | Open | Unassigned |
| [[ACAB-340 - AC- URLs With Multiple Categories Are Not Loading\|ACAB-340]] | URLs With Multiple Categories Are Not Loading | Groomed | Unassigned |

## Cross-References

| ACAB Area | Related Workstream |
|-----------|--------------------|
| Search/facet output consumed by EDS | [[ws-eds]], [[comp-eds-plp-search]] |
| Suggest API consumed by EDS search bar | [[comp-eds-plp-search]] |
| Product pricing feeds PLP display | [[ws-plp]], [[ws-financial-calculators]] |
| Auth token integration | [[comp-eds-header-nav]] |
| Bloomreach A/B testing | [[ws-integrations]] |

## Key Decisions & Notes

- **Bloomreach is the search engine** — not Adobe Commerce's native search. App Builder acts as the translation layer.
- **Bloomreach timeout env vars required** — `BR_SEARCH_TIMEOUT=8000` and `BR_SUGGEST_TIMEOUT=4000` must exist on all environments with no fallback. Deployment risk if missing.
- Room Scenes / Shop By Room research was done ([[ACAB-21 - EDS Shop By Room Research and Category Landing Page|ACAB-21]]) but room scenes were dropped from EDS scope
- Research phase complete — 20/20 research tasks closed, including developer onboarding/pairing tasks
- Naga Ambarish Chigurala is the primary active developer (35 issues assigned, all active items)

## Team

See [[team-acab]] for full roster.
