---
type: workstream
epics: ["[[ACE2E-26 - AC E2E - PLP|ACE2E-26]]"]
status: not-started
task_count: 17
closed_count: 0
failed_qa_count: 0
groomed_count: 17
in_progress_count: 0
blocked_count: 0
---

# Workstream: Product Listing Page (PLP)

## Description

This workstream covers the Product Listing Page (PLP) functionality, including category pages, search results, filtering, sorting, pagination, and specialized PLP variants such as Open Box and Room Scene views.

## Scope

- **[[ACE2E-26 - AC E2E - PLP|ACE2E-26]]: PLP** (Evaluated) — All product listing, search results, and category landing page features.

## Related Tasks

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACE2E-172 - ROUND1- EDS - PLP Schema Updates\|ACE2E-172]] | PLP schema | Groomed | Unassigned |
| [[ACE2E-173 - ROUND1- EDS Add Review Ratings to PLP Product Results\|ACE2E-173]] | Review ratings on PLP | Groomed | Unassigned |
| [[ACE2E-174 - ROUND1- Commerce Update Desktop Search Box & Autofill Functionality\|ACE2E-174]] | Search (task 1) | Groomed | Unassigned |
| [[ACE2E-175 - ROUND1- EDS -Looking for something specific- on a Multi-Select Category PLP\|ACE2E-175]] | Search (task 2) | Groomed | Unassigned |
| [[ACE2E-176 - ROUND1- EDS - PLP Pagination and Result Number Display\|ACE2E-176]] | Search (task 3) | Groomed | Unassigned |
| [[ACE2E-177 - ROUND1- EDS - Style Search Bar & Auto Complete\|ACE2E-177]] | Pagination (task 1) | Groomed | Unassigned |
| [[ACE2E-178 - ROUND1- EDS - Open Box Additional SKU Support - PLP\|ACE2E-178]] | Pagination (task 2) | Groomed | Unassigned |
| [[ACE2E-179 - ROUND1- EDS - Room Scene Backend Support\|ACE2E-179]] | Open box PLP (task 1) | Groomed | Unassigned |
| [[ACE2E-180 - ROUND1- Paid Listing Ad (PLA) Layout Support\|ACE2E-180]] | Open box PLP (task 2) | Groomed | Unassigned |
| [[ACE2E-181 - ROUND1- Cart and Line Item Employee Discounts Extension\|ACE2E-181]] | Room scene (task 1) | Groomed | Unassigned |
| [[ACE2E-182 - ROUND1- EDS - Style Room Scene Page\|ACE2E-182]] | Room scene (task 2) | Groomed | Unassigned |
| [[ACE2E-183 - ROUND1- EDS - Style Search Results Page\|ACE2E-183]] | Category landing (task 1) | Groomed | Unassigned |
| [[ACE2E-184 - ROUND1- EDS - PLP Product Flags\|ACE2E-184]] | Category landing (task 2) | Groomed | Unassigned |
| [[ACE2E-185 - ROUND1- EDS - Color Plus Customization\|ACE2E-185]] | Category landing (task 3) | Groomed | Unassigned |
| [[ACE2E-186 - ROUND1- EDS Style Category Landing Page\|ACE2E-186]] | PLP feature (task 1) | Groomed | Unassigned |
| [[ACE2E-187 - ROUND1- EDS Style Catalog Listing Page\|ACE2E-187]] | PLP feature (task 2) | Groomed | Unassigned |
| [[ACE2E-188 - ROUND1- EDS - Style Search Bar & Auto Complete\|ACE2E-188]] | PLP feature (task 3) | Groomed | Unassigned |

### Status Summary

- Groomed: 17

## Bugs

No bugs associated with this workstream.

## Asana Coverage (LAMPSPLUS + LPWE)
**LAMPSPLUS Implementation:** ~122 tasks (PLP/Search area)
- Examples: EDS Style Category Landing Page, EDS Style Search Results Page, EDS Style Search Bar & Auto Complete, Bloomreach A/B Sorting Integration, Filter for "Available at this Location"
- Key: EDS search integration (multiple tasks), filter configuration critical

**LPWE (Post-Launch):** 11 tasks (1 open)
- Open: EDS/Commerce Update Desktop Search Box & Autofill Functionality
- Completed: EDS Add Review Ratings to PLP, Extend Collections for Filtered Pages, PLP Schema Updates, Reduce PLP Page Results to 48

### Key Tasks

- [[LPWE-37 - EDS-Commerce Update Desktop Search Box & Autofill Functionality|LPWE-37: EDS/Commerce Update Desktop Search Box & Autofill]] (Open)
- [[LAMPSPLUS-185 - EDS Style Category Landing Page|LAMPSPLUS-185: EDS Style Category Landing Page]]
- [[LAMPSPLUS-220 - EDS - Style Search Results Page|LAMPSPLUS-220: EDS Style Search Results Page]]
- [[LAMPSPLUS-172 - EDS - Style Search Bar & Auto Complete|LAMPSPLUS-172: EDS Style Search Bar & Auto Complete]]
- [[LAMPSPLUS-198 - EDS Bloomreach A-B sorting Integration Support|LAMPSPLUS-198: EDS Bloomreach A/B Sorting Integration]]
- [[LAMPSPLUS-315 - EDS - -Available at this Location- Filter for Stores-Kiosks|LAMPSPLUS-315: EDS "Available at this Location" Filter]]

## Dependencies

- [[ws-pdp]] — PLP links to PDP; shared product data structures.
- [[ws-seo]] — PLP pages require SEO metadata, structured data (JSON-LD).
- [[ws-pixels-analytics]] — Product impression tracking on listing pages.
- [[ws-integrations]] — Dynamic Yield may personalize PLP content.

## Cross-References

- QA test cycle tasks for PLP may exist in the [[ACE2E-296 - ROUND 1- Test Case Cycle Execution for Account Management|ACE2E-296]] to [[ACE2E-322 - ROUND 1- Verify Easy Post|ACE2E-322]] range.
