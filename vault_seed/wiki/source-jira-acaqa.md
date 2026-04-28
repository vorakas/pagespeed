---
type: source-summary
source_file: raw/ACAQA/
ingested: 2026-04-10
task_count: 16
---

# Source Summary: ACAQA (Jira) — 2026-04-10

Ingested from `raw/ACAQA/` on 2026-04-10. Data exported via `JiraToObsidia.py`.

## Issue Counts

| Type | Count |
|------|-------|
| Epic | 1 |
| Task | 14 |
| Bug | 1 |
| **Total** | **16** |

## Status Distribution

| Status | Count |
|--------|-------|
| Cancelled | 15 |
| In Progress | 1 |

## Active vs Resolved

- **Resolved (Cancelled):** 15 (94%)
- **Active:** 1 (6%) — the epic itself

All 16 issues are unassigned.

## Epic

1. **ACAQA-2** — Accessibility Audit 8 — EDS MCPROD (`In Progress`, Unassigned)
   - Goal: Prepare Adobe Commerce site for WCAG 2.2 AA compliance prior to go-live
   - Scope: Automated accessibility audits on mcprod.lampsplus.com
   - Success criteria: mcprod.lampsplus.com meets WCAG 2.2 AA standards

## Key Findings

- **Effectively empty**: 15 of 16 issues cancelled. The epic is "In Progress" but has no active tasks.
- **AQA issues migrated to ACEDS**: The cancelled tasks here (form labels, alt attributes, empty links, background colors) match the pattern of AQA issues actively tracked in [[comp-eds-accessibility]].
- **Test artifacts**: ACAQA-25 ("TEST BUG"), ACAQA-26/27 ("Test Task") appear to be project setup tests.
- This project appears to have been superseded by the AQA tracking within the ACEDS project.

## Related Wiki Pages

- [[comp-eds-accessibility]] — Active AQA issues are tracked here (14 groomed items)
- [[ws-privacy-compliance]] — ACE2E accessibility/UsableNet workstream
