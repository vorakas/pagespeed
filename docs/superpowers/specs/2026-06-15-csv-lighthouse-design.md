# CSV Lighthouse Runs Design

## Goal

Add a Test URLs section that lets QA upload the current hand-maintained BlazeMeter TestData CSV files and run Lighthouse checks against the exact pages those CSVs produce. The feature must support LampsPlus production and Adobe Commerce migration targets, default both targets on, and allow one target at a time because BlazeMeter runs are effectively sequential with one available engine.

All URLs for the domain under active BlazeMeter load must finish Lighthouse collection inside the normal BlazeMeter run window, which is 8-9 minutes.

The run focuses only on Lighthouse performance timing metrics:

- First Contentful Paint
- Speed Index
- Largest Contentful Paint
- Total Blocking Time
- Cumulative Layout Shift

## User Workflow

1. QA verifies and updates the current CSV files in the Load Testing tab.
2. QA opens Test URLs and finds a new "CSV Lighthouse Runs" section.
3. QA uploads one or more current `TestData/*.csv` files.
4. Target checkboxes default to both:
   - Adobe Commerce: `mcprod`
   - LampsPlus: `www`
5. QA can uncheck either target to run one environment at a time.
6. QA starts the run.
7. Pharos immediately creates a persisted run and returns a run id.
8. Pharos tests the generated URLs for each target domain with bounded backend concurrency and writes each result as it finishes.
9. QA watches progress while BlazeMeter is running and can leave/reopen the page without losing completed results.
10. QA can reopen saved run results later and download a CSV summary of the Lighthouse metrics.

## URL Construction

Reuse the existing Load Testing CSV URL construction rules in `services/testdata_url_service.py` and `services/testdata_registry.py`.

The feature must not introduce a second mapping table. It should use the same group definitions for:

- `PDP.csv`
- `SFP.csv`
- `MoreLikeThis.csv`
- `SearchBR.csv`
- `SortBR.csv`
- `SearchToSort.csv`
- `SearchToPDP.csv`

Generated URLs use the existing site keys:

- `mcprod`: `https://mcprod.lampsplus.com`
- `www`: `https://www.lampsplus.com`

The CSV column-A value is not a full URL. It is the value inserted into the group route template after the site origin.

For example, a `PDP.csv` row with:

```text
maxim-paramount-16-inchw-natural-aged-brass-led-ceiling-light__0000e/
```

must become:

```text
https://www.lampsplus.com/p/maxim-paramount-16-inchw-natural-aged-brass-led-ceiling-light__0000e/
https://mcprod.lampsplus.com/p/maxim-paramount-16-inchw-natural-aged-brass-led-ceiling-light__0000e/
```

Construction rules:

- `PDP.csv`: `{origin}/p/{column_a_value}`
- `SFP.csv`: `{origin}/sfp/{column_a_value}`
- `MoreLikeThis.csv`: `{origin}/more-like-this/{column_a_value}/`
- `SearchBR.csv`: `{origin}/s/{column_a_value}`
- `SortBR.csv`: `{origin}/s/{column_a_value}`
- `SearchToSort.csv`: `{origin}/s/s_{column_a_value}/?s=1`
- `SearchToPDP.csv`: `{origin}/s/s_{column_a_value}/?s=1`

Normalize column-A values before building URLs:

- trim whitespace
- ignore empty rows
- strip any accidental full origin if a row already contains `https://www.lampsplus.com` or `https://mcprod.lampsplus.com`
- strip one accidental leading slash so templates do not produce double slashes
- preserve meaningful trailing slashes from the CSV value

Unrecognized files are skipped and shown in the UI.

## Timeout Strategy

The feature must not run a large Lighthouse batch inside one browser-held HTTP request.

Implementation should use a persisted backend run:

- Upload/start endpoint parses files, creates a run row and item rows, starts background execution, then returns immediately.
- Background execution uses bounded worker concurrency per target domain, not browser-held requests.
- Each item is saved after completion or failure.
- Frontend polls a run-status endpoint.
- Failed URLs store error text and do not stop the run.
- Runs can be cancelled.

This avoids the current Test URLs batch weakness where the browser holds long synchronous PageSpeed requests and large batches can time out.

Runtime requirements:

- Treat 9 minutes as the default target-domain budget.
- Selected targets should be tracked as separate target phases so Adobe Commerce and LampsPlus can be started or reviewed independently.
- Default worker count should be enough to finish the selected domain inside the budget, capped by a conservative maximum.
- Suggested initial cap: 4 concurrent PageSpeed requests per target domain.
- The UI should show estimated duration before start based on URL count, worker count, and recent average PageSpeed duration.
- If the URL count cannot plausibly finish within 9 minutes at the configured cap, warn before start and show the worker count needed.
- Persist `worker_count`, target budget seconds, started timestamp, finished timestamp, and average item duration on each run or target phase.
- Keep worker concurrency configurable in code or config so it can be tuned after real runs.

## Backend Design

Add a small CSV Lighthouse domain using the existing three-layer pattern:

- `routes/csv_lighthouse_api.py`: HTTP endpoints only.
- `services/csv_lighthouse_service.py`: parsing, dedupe, run orchestration, PageSpeed calls.
- `data_access/csv_lighthouse_repository.py`: SQL for run and item persistence.

Suggested endpoints:

- `POST /api/csv-lighthouse/runs`
  - Multipart files plus selected site keys and strategy.
  - Creates run and item records.
  - Starts background runner.
  - Returns `{ success, run_id }`.
- `GET /api/csv-lighthouse/runs`
  - Returns recent runs.
- `GET /api/csv-lighthouse/runs/<run_id>`
  - Returns run summary, progress, item results.
- `POST /api/csv-lighthouse/runs/<run_id>/cancel`
  - Marks run cancel-requested; background runner stops after current URL.

Run statuses:

- `queued`
- `running`
- `completed`
- `completed_with_failures`
- `cancelled`
- `failed`
- `interrupted`

Item statuses:

- `pending`
- `running`
- `passed`
- `failed`
- `cancelled`

Persist enough item metadata to explain results:

- run id
- run label
- source CSV filename
- group key
- site key
- original column-A value
- generated URL
- strategy
- status
- error message
- FCP
- Speed Index
- LCP
- TBT
- CLS
- started/completed timestamps

Deduplicate by run, site key, generated URL, and strategy so duplicate CSV rows do not waste Lighthouse quota.

Saved result requirements:

- Every run is saved automatically when it is created.
- A user-entered run label is optional; if omitted, use timestamp plus selected targets.
- Recent saved runs remain available from the Test URLs page.
- Run detail endpoint returns all item rows so a saved run can be reopened without rerunning Lighthouse.
- Add a CSV download endpoint or browser-side export for the saved run table.
- Export columns should include run label, run timestamp, target, CSV file, group, original value, generated URL, status, FCP, Speed Index, LCP, TBT, CLS, and error.

## Frontend Design

Add a new section to `frontend/src/pages/TestUrls.tsx`, below the existing site URL batch controls.

Create focused components under `frontend/src/components/test-urls/`:

- `CsvLighthousePanel.tsx`
- `CsvLighthouseRunTable.tsx`
- `CsvLighthouseResultsTable.tsx`

UI controls:

- File input accepting `.csv`, multiple files.
- Optional run label input for saving the run under a human-readable name.
- Target checkboxes for Adobe Commerce and LampsPlus, both selected by default.
- Desktop/mobile strategy selector using the existing `Strategy` type.
- Start button with disabled/loading states.
- Cancel button for active run.
- Recent runs list.
- Results table grouped by target and CSV group.
- Download CSV button for a saved or completed run.

UI columns:

- Target
- CSV group
- CSV value
- URL
- Status
- FCP
- Speed Index
- LCP
- TBT
- CLS
- Error

The UI should remain operational and dense, consistent with the existing Pharos dashboard style. Avoid explanatory marketing copy; use short operational labels and inline error recovery.

## PageSpeed Metric Extraction

Use the existing `PageSpeedClient` where possible. It already extracts the required metrics from Lighthouse results:

- `fcp`
- `speed_index`
- `lcp`
- `tbt`
- `cls`

This feature does not need accessibility, best practices, SEO, opportunities, screenshots, or full detail dialogs.

If using existing `PageSpeedClient.test_url`, do not save these CSV-derived results into the normal `test_results` table because they are not managed site URLs. Save them into CSV Lighthouse item rows.

## Error Handling

Per-item failures should record a readable error and continue.

Expected failures:

- Google PageSpeed timeout
- invalid generated URL
- PageSpeed API quota/rate error
- network failure
- unsupported or unrecognized CSV file

Run-level failure only applies when the run cannot be created or the worker crashes before item processing starts.

If a run remains `running` without heartbeat activity past a configured stale threshold, show it as `interrupted`.

## Testing

Backend tests should cover:

- CSV parsing and URL construction reuse.
- dedupe behavior.
- run creation with both targets.
- run creation with one target.
- worker-count calculation for the 9-minute target-domain budget.
- bounded concurrency never exceeds the configured cap.
- per-item failure does not stop the run.
- cancel request stops after current item.

Frontend verification should cover:

- upload with recognized and unrecognized CSVs.
- default both targets selected.
- one-target run.
- polling progress and final table.
- failure rows display error text without breaking layout.

Manual verification should run a tiny CSV sample before any large batch.

## Out Of Scope

- Editing CSV files inside Pharos.
- Auto-correcting bad product URLs.
- Integrating directly with BlazeMeter execution state.
- Comparing Lighthouse results against thresholds.
- Exporting results to spreadsheet.
