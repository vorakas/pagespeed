---
type: component
workstream: "[[ws-eds]]"
---

# Component: EDS Tealium & Analytics

> Part of [[ws-eds]] | ACE2E counterpart: [[ws-pixels-analytics]]

## Scope

Tealium Universal Tag (utag.js) implementation, utag_data population, GA4 event instrumentation, and observability (New Relic) on EDS pages.

### Tealium Implementation
- **Base Tealium container & scripts** ([[ACEDS-109 - Implement Base Tealium Container and Scripts on EDS Pages|ACEDS-109]]) — Konstantin Minevich
- **Common function for utag.js injection** ([[ACEDS-138 - Create a common function to inject utag.js using config values for the environment-account ID|ACEDS-138]]) — using config for environment/account ID
- **Customer info for utag_data population** ([[ACEDS-139 - Create a common function to get and return customer information for population of utag_data|ACEDS-139]]) — Konstantin Minevich
- **Page initializer pattern for utag_data** ([[ACEDS-140 - Develop a pattern-solution for loading utag.js and defining utag_data via page initializer|ACEDS-140]]) — Konstantin Minevich
- **Populate utag_data.is_pro** ([[ACEDS-358 - Populate utag_data.is_pro on EDS pages|ACEDS-358]]) — Konstantin Minevich
- **Provide kiosk/website_mode in utag_data** ([[ACEDS-302 - Provide kiosk and website_mode information in utag_data|ACEDS-302]]) — Konstantin Minevich
- **Update utag.js profile name** ([[ACEDS-439 - Update utag.js profile name for EDS|ACEDS-439]]) — Calvin Liu
- **First-Party Domain — Update Universal Tag script** ([[ACEDS-535 - First-Party Domain - Update Universal Tag loading script|ACEDS-535]]) — Konstantin Minevich
- **Custom events and attributes** ([[ACEDS-23 - Develop Custom Events and Attributes|ACEDS-23]]) — Tyler Marés

### GA4 Events
- **view_item_list on PLPs** ([[ACEDS-297 - GA4 - Implement view_item_list on PLPs|ACEDS-297]]) — Calvin Liu
- **GA4 infrastructure for product bucket decoration** ([[ACEDS-299 - GA4 - Create infrastructure to decorate product buckets html with product info on PLPs|ACEDS-299]]) — Calvin Liu
- **select_item on PLPs** ([[ACEDS-304 - GA4 - Implement select_item on PLPs|ACEDS-304]]) — Oliver Syson
- **cart_coupon_add & link_coupon_add research** ([[ACEDS-430 - GA4 Research - cart_coupon_add & link_coupon_add functionalities|ACEDS-430]]) — Oliver Syson (Research, Closed)

### Research (Closed)
- [[ACEDS-24 - Research the Base Tealium Container and Scripts Implementation|ACEDS-24]] — Base Tealium Container and Scripts
- [[ACEDS-137 - Research - Page initializer approach for enriching utag_data|ACEDS-137]]/148 — Page initializer approach for utag_data (Parts 1 & 2)

## Active Items

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACEDS-560 - Address ACEDS bug fixes to resolve Tealium issues\|ACEDS-560]] | Address ACEDS bug fixes to resolve Tealium issues | Open | Unassigned |
| [[ACEDS-593 - Correctly populate utag_data_is_production on EDS pages\|ACEDS-593]] | Correctly populate utag_data_is_production on EDS pages | Evaluated | Unassigned |
| [[ACEDS-588 - Update the utag data page type for search results pages\|ACEDS-588]] | Update utag_data page type for search results pages | Code Review | Calvin Liu |
| [[ACEDS-591 - Update the utag data page type for sale pages\|ACEDS-591]] | Update utag_data page type for sale pages | Groomed | Konstantin Minevich |
| [[ACEDS-542 - Install the New Relic Browser Agent\|ACEDS-542]] | Install the New Relic Browser Agent | Groomed | Rupali Deshmukh |
| [[ACEDS-538 - EDS Content-Security-Policy\|ACEDS-538]] | EDS Content-Security-Policy | In Progress | Tyler Marés |

## Notes
- CSP (Content-Security-Policy) work ([[ACEDS-538 - EDS Content-Security-Policy|ACEDS-538]]) is in progress — this affects which external scripts can load
- Tealium bug fix task ([[ACEDS-560 - Address ACEDS bug fixes to resolve Tealium issues|ACEDS-560]]) is open and unassigned — potential blocker for analytics parity
- Duplicate utag cookies issue ([[ACEDS-400 - Duplicate utag Cookies Generated When Navigating from Commerce Pages to Home Page|ACEDS-400]]) and manage cookies banner ([[ACEDS-401 - Manage Cookies Banner Reappears Even After Accepting All Cookies|ACEDS-401]]) were cancelled
