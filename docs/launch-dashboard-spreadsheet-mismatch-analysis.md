# Launch Dashboard vs Spreadsheet Mismatch Analysis

Date: 2026-05-27

Workbook inspected: `C:\Users\AdamB\Downloads\Adobe Commerce - Path to Launch (1).xlsx`

Production API inspected: `https://pagespeed-production.up.railway.app/api/dashboard/launch-report`

## Clarified Intent

Pharos should not match the whole workbook. It should keep real-time parity for the workbook's Lamps Plus Development and E2E Testing sections only.

That still does not match the current implementation: the current dashboard tables use those section names, but not those section formulas.

## Finding

The Launch Dashboard numbers do not match the intended spreadsheet sections because the two systems are not calculating the same rollups.

## Evidence

### 1. Target spreadsheet sections group by reporting area, resource queue, and phase

The workbook `Reportv2` formulas read directly from the exported sheets:

- Lamps Plus Development formulas use `SUMIFS('LP DATA'!..., 'LP DATA'!C:C, Area, 'LP DATA'!V:V, Resource Queue, 'LP DATA'!B:B, Phase)`.
- E2E Testing formulas also use `LP DATA` by `Reporting Area`, `Resource Queue`, and `Phase`, plus `TC DATA` by `Area` and `Phase`.

So the spreadsheet is area-based:

- `Phase`
- `Reporting Area`
- `Resource Queue`
- `Status`
- `TC DATA`

### 2. Dashboard launch report groups by Jira epic chain

Dashboard endpoint: `/api/dashboard/launch-report`.

Backend path:

- `routes/dashboard_api.py`
- `services/migration_dashboard_service.py`
- `services/launch_report.py`

The dashboard:

- Builds rows from fixed `DEVELOPMENT_GROUPINGS` and `E2E_GROUPINGS`.
- Resolves each issue through `epic_link` or `parent_key`.
- Uses the parent epic summary as the report grouping.
- Counts only non-epic tasks with label `AC-P1`.
- Puts tasks without resolvable epic grouping into diagnostics, not visible row totals.

Relevant behavior in `services/launch_report.py`:

- `_report_grouping()` returns `missingEpicLinkCount` when no epic/parent chain resolves.
- `_report_grouping()` returns `unresolvedEpicNameCount` when epic link exists but the epic record is not present.
- `_partition_counted()` counts only non-epic tasks containing `AC-P1`.

### 3. Production dashboard is excluding many spreadsheet Phase 1 rows

Workbook `LP DATA`:

- Non-epic rows: 5,556
- Phase 1 rows: 5,245
- Rows with `AC-P1`: 5,245
- Phase 1 rows missing `AC-P1`: 0

Production dashboard diagnostics:

- LampsPlus Development counted issues: 1,622
- LampsPlus Development missing epic link: 2,594
- LampsPlus Development unresolved epic name: 32
- E2E counted issues: 296
- E2E missing epic link: 16

So label filtering is not the main mismatch. Epic-chain grouping is.

### 4. CNX is not the intended parity target

Workbook `Reportv2` top summary includes CNX remaining hours, but that is outside the clarified target.

Production `/api/dashboard/launch-report` has `cnxOk: null` for E2E rows and no CNX development rollup equivalent. That part is fine if Pharos only needs Lamps Plus Development and E2E Testing.

Workbook top summary totals:

- Areas: 27
- Ready: 1
- LP remaining: 2,484
- CNX remaining: 2,928
- QA remaining: 6,760

Production launch report totals:

- Development remaining: 420
- E2E remaining: 1,093

Those totals are not expected to match because the dashboard omits CNX and uses epic-group rows rather than area rows.

### 5. Several visible workbook sections are marked inaccurate

`Reportv2` contains rows labeled:

`DO NOT USE. DATA IS NOT ACCURATE!`

Those sections still contain detailed per-area numbers and can be mistaken for dashboard parity targets.

## Concrete Examples

| Area | Spreadsheet top summary | Dashboard E2E row |
| --- | --- | --- |
| PLP | LP 330, CNX 20, QA 543 remaining | Passed 5, failed 8, completed 323, remaining 120 |
| ATP | LP 48, CNX 86, QA 131.67 remaining | Passed 1, failed 1, completed 82, remaining 56 |
| PDP | LP 61, CNX 73, QA 448.77 remaining | Passed 18, failed 10, completed 486, remaining 59 |
| Financial Calculator | LP 40, CNX 189, QA 392 remaining | Passed 7, failed 2, completed 0, remaining 225 |

## Root Cause

Fresh Jira pull updates source issue data, but it cannot make the numbers match because the dashboard parity logic is based on a different reporting contract:

- Intended spreadsheet sections: `Reporting Area` + `Resource Queue` + phase, plus E2E test case totals.
- Current dashboard: canonical epic summaries + `AC-P1` label + resolvable epic/parent chain.

## Recommended Fix Direction

If the Launch Dashboard must match the intended Lamps Plus Development and E2E Testing sections, add a spreadsheet-parity endpoint or replace the current launch report rollup with area-based logic:

1. Group LP rows by `Reporting Area`, `Resource Queue`, and phase.
2. For Lamps Plus Development, calculate development complete/remaining from non-QA resource queue rows.
3. For E2E Testing, calculate QA complete/remaining from QA resource queue rows and TC totals from the latest cached QA Testing service report.
4. Preserve the current epic-chain diagnostics separately, because they still expose data hygiene issues.

## Follow-Up Implemented

Pharos now reads latest cached QA Testing report data for E2E TC totals, passed count, and failed count. E2E hours still come from live Jira `QA` resource queue work.
