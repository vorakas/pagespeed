---
type: source-summary
source_file: raw/ACCMS/
ingested: 2026-04-10
task_count: 9
---

# Source Summary: ACCMS (Jira) — 2026-04-10

Ingested from `raw/ACCMS/` on 2026-04-10. Data exported via `JiraToObsidia.py`.

## Issue Counts

| Type | Count |
|------|-------|
| Epic | 1 |
| Task | 5 |
| Sub-task | 2 |
| Bug | 1 |
| **Total** | **9** |

## Status Distribution

| Status | Count |
|--------|-------|
| Closed | 5 |
| Open | 3 |
| In Progress | 1 |

## Active vs Resolved

- **Resolved (Closed):** 5 (56%)
- **Active:** 4 (44%) — 1 epic + 3 open tasks

## Epic

1. **[[ACCMS-1 - AC Implementation - Content Management System (CMS)|ACCMS-1]]** — Content Management System (CMS) (`In Progress`, Unassigned)
   - Goal: Implement content through the Adobe Commerce CMS
   - Scope: Help & Policies pages, Blog
   - Links to: ACM-4 (Commerce Implementation)

## All Tasks

| Key | Summary | Status | Assignee |
|-----|---------|--------|----------|
| [[ACCMS-2 - Discrepancies and UI Inconsistencies on Adobe Sitemap Compared to LP Site\|ACCMS-2]] | Sitemap discrepancies and UI inconsistencies | Closed | Seth Wilde |
| [[ACCMS-4 - Update Catalog Request Success Message\|ACCMS-4]] | Update Catalog Request Success Message | Closed | Seth Wilde |
| [[ACCMS-5 - Update the Email Us Messaging\|ACCMS-5]] | Update the Email Us Messaging | Open | Unassigned |
| [[ACCMS-7 - Update PDD link on Employee Tools\|ACCMS-7]] | Update PDD link on Employee Tools | Closed | Seth Wilde |
| [[ACCMS-8 - Ensure that All Images on CMS Pages Have Alt Text\|ACCMS-8]] | Ensure All Images on CMS Pages Have Alt Text | Open | Seth Wilde |
| [[ACCMS-9 - Ensure that All Images in CMS Blocks Have Alt Text\|ACCMS-9]] | Ensure All Images in CMS Blocks Have Alt Text | Open | Seth Wilde |

## Key Findings

- **Small, PM-driven project**: Seth Wilde directly owns 5 of 9 issues — this is content management work, not developer-heavy
- **Active alt text work**: [[ACCMS-8 - Ensure that All Images on CMS Pages Have Alt Text|ACCMS-8]] and [[ACCMS-9 - Ensure that All Images in CMS Blocks Have Alt Text|ACCMS-9]] are open accessibility tasks for CMS image alt text
- **Cross-references ACE2E**: CMS pages (Help & Policies, Blog) overlap with [[ws-other-pages]] (ACE2E-34)
- **References ACM project**: Epic links to ACM-4 — a parent Commerce Implementation project not yet ingested

## Related Wiki Pages

- [[ws-cms]] — CMS workstream page
- [[ws-other-pages]] — ACE2E CMS/blog/landing pages workstream
