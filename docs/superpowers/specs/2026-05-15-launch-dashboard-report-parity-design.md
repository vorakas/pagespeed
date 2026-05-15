# Launch Dashboard Report Parity Design

Date: 2026-05-15

## Goal

Redesign the Launch Dashboard data foundation so Pharos can mirror the spreadsheet's Phase 1 "LampsPlus Development" and "E2E Testing" report sections with trusted numbers, while preserving the existing operational Launch Dashboard panels.

This is a parity-first design. UI replica work should wait until the report data contract can explain its row totals and diagnostics.

## Approved Decisions

- Use the spreadsheet's fixed Phase 1 row list as the initial report contract.
- Treat the spreadsheet `LP DATA` tab's `Grouping` value as Jira Epic Link display name.
- Treat Jira label `AC-P1` as the Phase 1 membership signal.
- Keep existing operational dashboard data separate from report parity data.
- Preserve current Blockers, What Changed, Daily Status, and Incidents sidebar behavior.

## Current Evidence

The spreadsheet `Report` tab does not calculate the two sections from visible rows alone. It rolls up hidden/export tab data:

- Development completed hours: `SUMIFS('LP DATA'!R:R, 'LP DATA'!A:A, grouping) / 3600`
- Development remaining hours: `SUMIFS('LP DATA'!S:S, 'LP DATA'!A:A, grouping) / 3600`
- E2E passed test cases: `COUNTIFS('LP DATA'!M:M, "Closed", 'LP DATA'!A:A, grouping)`
- E2E failed test cases: `COUNTIFS('LP DATA'!M:M, "Failed QA", 'LP DATA'!A:A, grouping)`
- E2E completed and remaining hours use the same time columns as Development.

The spreadsheet therefore cares about `Grouping`, not the issue key prefix. Multiple WPM issues can count under one grouping when their Epic Link maps to that grouping.

Production Pharos currently has Jira sync configured for:

- Jira projects: `ACE2E`, `ACEDS`, `ACAB`, `ACAQA`, `ACCMS`, `ACM`
- WPM JQL feed: `WPM-4610`, its child issues, and subtasks of those issues, excluding `Cancelled` standard issue types

Pharos already stores Jira fields such as issue key, status, labels, parent key, Epic Link, time spent, remaining estimate, and resource fields in Vault raw frontmatter. The new report layer should use those fields through a purpose-built contract.

## Data Model

Add a new report parity model independent from the existing generic epic-progress payload.

### Launch Report Response

`GET /api/dashboard/launch-report`

Top-level shape:

```json
{
  "phase": "AC-P1",
  "generatedAt": "2026-05-15T00:00:00Z",
  "lampsPlusDevelopment": {
    "rows": [
      { "reportGrouping": "AC Implementation - Commerce Implementation" }
    ],
    "totals": {},
    "diagnostics": {}
  },
  "e2eTesting": {
    "rows": [
      { "reportGrouping": "AC E2E - Account Management" }
    ],
    "totals": {},
    "diagnostics": {}
  }
}
```

### Development Row

Each row should include:

- `reportGrouping`: Epic Link display name, matching spreadsheet row text
- `epicKey`: resolved Jira Epic Link key when available
- `phaseLabel`: `AC-P1`
- `status`: spreadsheet-style complete/pending state
- `completedHours`: rounded-up sum of `time_spent_seconds / 3600`
- `remainingHours`: rounded-up sum of `remaining_estimate_seconds / 3600`
- `progressPercent`: `completedHours / (completedHours + remainingHours)`
- `issueKeys`: counted issue keys
- `diagnostics`: row-level diagnostic counts

### E2E Row

Each row should include:

- `reportGrouping`
- `epicKey`
- `phaseLabel`: `AC-P1`
- `cnxOk`: value if derivable from Jira/Vault, otherwise null with diagnostics
- `passedTc`: count of matched issues with status `Closed`
- `failedTc`: count of matched issues with status `Failed QA`
- `completedHours`
- `remainingHours`
- `progressPercent`
- `doneCount`: value if derivable, otherwise 0 or null with diagnostics
- `issueKeys`
- `diagnostics`

## Backend Flow

1. Define canonical Phase 1 report rows in code or a small data fixture:
   - LampsPlus Development row names and order from the spreadsheet
   - E2E Testing row names and order from the spreadsheet

2. Load canonical raw Jira/Vault tasks through the existing raw scanner and dedupe policy.

3. Resolve each task's report grouping:
   - Prefer Epic Link display name if available.
   - If only Epic Link key is available, resolve key to the epic's summary.
   - If an issue lacks Epic Link, keep it out of row totals and expose it through diagnostics.

4. For each canonical row:
   - Find tasks whose resolved report grouping equals the row name.
   - Prefer or require tasks with label `AC-P1` for Phase 1 totals.
   - Count tasks missing `AC-P1` separately so parity gaps are visible.

5. Compute spreadsheet-style metrics:
   - Development completed and remaining hours from time fields.
   - E2E passed/failed test case counts from Jira status.
   - E2E completed and remaining hours from time fields.
   - Progress from completed and remaining hours.

6. Return row diagnostics:
   - `missingEpicLinkCount`
   - `unresolvedEpicNameCount`
   - `missingPhaseLabelCount`
   - `missingEstimateCount`
   - `countedIssueCount`
   - `excludedIssueCount`

## Existing Dashboard Data

Do not replace the operational Launch Dashboard feeds with report parity data.

These should continue using their existing sources:

- Blockers
- What Changed
- Daily Status
- Incidents sidebar
- production failures
- source/sync health
- snapshot/diff views

The new report sections should sit beside or above those panels, but not change their data semantics.

## Validation

Create a local validation path that parses the workbook `Adobe Commerce - Path to Launch.xlsx` and compares the Pharos launch-report response row by row.

The spreadsheet is not a continuously fresh source. It is updated roughly once or twice per day, while Pharos pulls Jira/Vault data hourly. Validation must therefore be timestamp-aware: a mismatch is only a parity defect when the compared data windows are aligned or when the delta cannot be explained by spreadsheet staleness.

Validation should report:

- exact row matches
- completed-hour deltas
- remaining-hour deltas
- passed/failed TC deltas
- rows missing from Pharos
- rows with Jira data that cannot be explained by Epic Link or `AC-P1`
- spreadsheet snapshot timestamp when available
- Pharos sync timestamp
- freshness delta between spreadsheet and Pharos data

The workbook is a validation fixture, not a production data source.

Validation output should classify deltas as:

- `matched`: values align
- `freshness-drift`: Pharos is newer than the spreadsheet and the difference may be expected
- `mapping-gap`: Epic Link, label, or row membership cannot explain the difference
- `data-gap`: expected Jira fields are missing or unresolved

## UI Design

After backend parity is credible, add two report replica sections to the Launch Dashboard:

- Phase 1 LampsPlus Development
- Phase 1 E2E Testing

Both sections should:

- preserve spreadsheet row order
- use dense dashboard tables, not marketing cards
- show row diagnostics through a compact icon or status marker
- allow expanding a row to inspect counted issue keys and exclusions
- keep existing operational panels visible in the page flow

## Error States

- If the launch-report endpoint cannot resolve Epic Link names, show rows with zero totals and diagnostics.
- If labels are missing, show row totals according to configured policy and flag missing `AC-P1`.
- If time fields are missing, treat values as zero for math and flag missing estimates.
- If sync is unavailable, show the existing sync/source health state and avoid stale confidence language.

## Open Items For Implementation

- Confirm whether Jira sync currently stores labels reliably for all relevant WPM and ACE2E issues.
- Confirm whether Epic Link frontmatter stores key only, display name only, or both.
- Decide whether `AC-P1` is strictly required for totals or only diagnostic during first parity pass.
- Determine source for `cnxOk` and `doneCount`; if not present in Jira, keep null with diagnostics until mapped.
