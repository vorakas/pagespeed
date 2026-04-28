---
type: workstream
epics: ["[[ACE2E-35 - AC E2E - SEO|ACE2E-35]]"]
status: not-started
task_count: 5
closed_count: 0
failed_qa_count: 0
groomed_count: 5
in_progress_count: 0
blocked_count: 0
---

# Workstream: SEO

## Description

This workstream covers search engine optimization for the Adobe Commerce migration, including sitemap generation, robots.txt configuration, and SEO metadata management across the site.

## Scope

- **[[ACE2E-35 - AC E2E - SEO|ACE2E-35]]: SEO** (Evaluated) — Technical SEO infrastructure: sitemaps, robots.txt, meta tags, structured data.

## Related Tasks

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACE2E-158 - ROUND1- Store Locator XML Sitemap Support\|ACE2E-158]] | Sitemap (task 1) | Groomed | Unassigned |
| [[ACE2E-159 - ROUND1- Sitemap Video Generation\|ACE2E-159]] | Sitemap (task 2) | Groomed | Unassigned |
| [[ACE2E-160 - ROUND1- Prepare Robots.txt File for Launch\|ACE2E-160]] | Robots.txt | Groomed | Unassigned |
| [[ACE2E-161 - ROUND1- Sitemap Generation & Configuration\|ACE2E-161]] | SEO (task 1) | Groomed | Unassigned |
| [[ACE2E-162 - ROUND1- Install and Configure SEO Extension\|ACE2E-162]] | SEO (task 2) | Groomed | Unassigned |

### Status Summary

- Groomed: 5

## Bugs

No bugs associated with this workstream.

## Dependencies

- [[ws-homepage-navigation]] — Homepage and navigation SEO (breadcrumbs, structured nav).
- [[ws-plp]] — Category page SEO, structured data for product lists.
- [[ws-pdp]] — Product page SEO, JSON-LD product schema.
- [[ws-other-pages]] — CMS page meta tags and canonical URLs.

## Asana Coverage (LAMPSPLUS + LPWE)
**LAMPSPLUS Implementation:** ~14 tasks (Sitemaps, URL structure, meta tags, schema markup)

**LAMPSPLUS Pre-Launch:** 10 open SEO tasks
- Configure SEO Admin Settings, Canonical/Meta Robots/Pagination Tags, Redirect Mapping, Prepare Robots.txt for Launch, General SEO Support, Live Page Redirect Strategy, Import Meta Data to Products/Categories/CMS Pages, SEO Launch Prep

### Key Tasks

- [[LAMPSPLUS-112 - Configure SEO Admin Settings|Configure SEO Admin Settings]]
- [[LAMPSPLUS-467 - Canonical & Meta Robots, and Pagination Tags|Canonical & Meta Robots and Pagination Tags]]
- [[LAMPSPLUS-470 - Redirect Mapping|Redirect Mapping]]
- [[LAMPSPLUS-466 - Prepare Robots.txt File for Launch|Prepare Robots.txt for Launch]]
- [[LAMPSPLUS-468 - Import Meta Data to Products, Categories and CMS Pages|Import Meta Data to Products/Categories/CMS Pages]]

## Cross-References

- QA test cycle tasks for SEO may exist in the [[ACE2E-296 - ROUND 1- Test Case Cycle Execution for Account Management|ACE2E-296]] to [[ACE2E-322 - ROUND 1- Verify Easy Post|ACE2E-322]] range.
- Bugs [[ACE2E-104 - Missing VideoObject on lampsplus PDP for SKU 552y9|ACE2E-104]], [[ACE2E-106 - Missing JSON-LD schemas on mcprod PDP for SKU y4644|ACE2E-106]], [[ACE2E-107 - Missing JSON-LD schemas on mcprod PDP for SKU y4644|ACE2E-107]] (missing JSON-LD/Video schemas) were Cancelled but relate to SEO structured data concerns.
