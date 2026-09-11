# Test URLs Tab Analysis - 2026-09-11

## Scope

Active surface is the React `/test` route. Legacy Flask templates/static files are archived and should not be changed.

The tab has two distinct Lighthouse workflows:

- Standard monitored URL testing: runs PageSpeed against URLs stored under Sites, writes to `test_results`, and feeds Dashboard/Metrics.
- CSV Lighthouse testing: uploads or selects current CSV inputs, creates a saved run, lets users edit/save files, starts an explicit run, stores results in CSV Lighthouse tables, and supports CSV export. This does not feed Dashboard/Metrics directly.

## Standard Test URLs Flow

Frontend entry:

- `frontend/src/pages/TestUrls.tsx`
- Imports `TestResultsTable`, `TestProgressPanel`, `BatchResultsLog`, `TestDetailDialog`, and `CsvLighthousePanel`.
- Owns `strategy`, `activeSiteId`, latest result rows, and detail-dialog state.
- Loads latest rows with `api.getLatestResults(siteId, strategy)`.
- `Test All URLs` calls `startBatchTest(sites, strategy)`.
- Single-row retest calls `api.testUrl(urlId, url, strategy)`, then reloads latest rows.
- Detail dialog calls `api.getTestDetails(urlId)`.
- Delete URL calls `api.deleteUrl(urlId)`, then refreshes Sites context and latest rows.

Batch context:

- `frontend/src/context/BatchTestContext.tsx`
- Persists batch run history in localStorage.
- Iterates Sites/URLs client-side and calls `api.testUrl(urlData.id, urlData.url, strategy)` per URL.
- Maintains progress, recent results, all results, and history for `TestProgressPanel`/`BatchResultsLog`.

API client:

- `frontend/src/services/api.ts`
- Standard write APIs:
  - `testUrl(urlId, url, strategy)` -> `POST /api/test-url`
  - `testSite(siteId, strategy)` -> `POST /api/test-site/<site_id>`
  - `testAll(strategy)` -> `POST /api/test-all`
- Standard read APIs:
  - `getLatestResults(siteId, strategy)` -> `GET /api/sites/<site_id>/latest-results`
  - `getUrlHistory(urlId, strategy, days)` -> `GET /api/urls/<url_id>/history`
  - `getTestDetails(testId)` -> `GET /api/test-details/<id>`
  - `getWorstPerforming(strategy, limit)` -> `GET /api/worst-performing`
  - `compareSites(site1Id, site2Id, strategy)` -> `GET /api/comparison`
  - `compareUrls(url1Id, url2Id)` -> `GET /api/comparison/urls`

Backend write path:

- `routes/testing_api.py`
- `POST /api/test-url` validates URL text, accepts `url_id` and `strategy`, then calls `TestingService.test_single_url`.
- `POST /api/test-url-async` starts a thread and returns immediately. It exists but the React Test URLs page currently uses the synchronous `testUrl` API.
- `POST /api/test-site/<site_id>` and `POST /api/test-all` exist, but the React page's visible `Test All URLs` flow uses the client-side batch context and repeated `/api/test-url` calls.
- `services/testing_service.py` calls `PageSpeedClient.test_url(url, strategy)` and saves via `TestResultRepository.save(url_id, result, strategy)`.
- Batch service methods sleep between URLs via `REQUEST_DELAY_SECONDS`.

Storage:

- `data_access/test_result_repository.py`
- `save()` writes scores, Core Web Vitals, raw Lighthouse JSON, `strategy`, and `tested_at`.
- `get_latest_by_site(site_id, strategy)` returns latest result per URL for a selected strategy.
- `get_history(url_id, days, strategy)` returns time-series rows filtered by strategy.
- `get_worst_performing(limit_per_site, strategy)` returns latest per URL for a selected strategy, ranked by `performance_score`.

## CSV Lighthouse Flow

Frontend entry:

- `frontend/src/components/test-urls/CsvLighthousePanel.tsx`
- Receives the active `strategy` from `TestUrls`.
- Can start only when there are uploaded files or library files, at least one selected target site, and no start request is already in progress.
- Lists prior runs, loads run details, polls active runs, deletes runs, cancels runs, downloads export CSVs, and renders:
  - `CsvLibraryPanel`
  - `CsvLighthouseFilesPanel`
  - `CsvLighthouseResultsTable`

API client:

- `frontend/src/services/api.ts`
- `createCsvLighthouseRun()` posts multipart form data to `/api/csv-lighthouse/runs`, including `files`, `site_keys`, `strategy`, `samples_per_url`, and optional `label`.
- Other methods list runs, read run detail, update/delete files, start runs, cancel runs, delete runs, manage library files, build TestData URLs, and build export URLs.

Backend:

- `routes/csv_lighthouse_api.py`
- Exposes run create/read/list/start/cancel/delete, file list/get/update/delete, library operations, TestData URL build, and export endpoints.
- `services/csv_lighthouse_service.py` creates pending runs, reads uploaded CSVs with limits, maps CSV values to target URLs, starts work explicitly, records item status/sample metrics, tracks cancellation, and recovers interrupted runs.
- `data_access/csv_lighthouse_repository.py` stores run/file/item/sample state in CSV-specific tables.

Important prior constraint from memory:

- Keep CSV uploads in the Lighthouse/Test URLs page.
- Preserve editability before execution.
- Keep separate `Save CSVs` and `Run Lighthouse` actions.
- Average rows are calculated from passed rows only.

## Downstream Consumers

Dashboard:

- `frontend/src/pages/Dashboard.tsx`
- Uses `api.getWorstPerforming(selectedStrategy, 5)`.
- Data comes from `test_results`, not CSV Lighthouse tables.
- UI renders `WorstPerformersSection`, Core Web Vitals reference, and Lighthouse explanation.

Metrics:

- `frontend/src/pages/Metrics.tsx`
- Owns a desktop/mobile strategy toggle.
- Passes strategy to `HistoricalChart`.
- Renders `PageComparison`.

HistoricalChart:

- `frontend/src/components/metrics/HistoricalChart.tsx`
- Calls `api.getUrlHistory(selectedUrlId, strategy, dateRange)`.
- Uses `test_results` time-series values.

PageComparison:

- `frontend/src/components/metrics/PageComparison.tsx`
- Site comparison path uses `compareSites(site1Id, site2Id, strategy)` according to API client support.
- URL comparison path calls `compareUrls(url1Id, url2Id)`, whose API/client path currently has no strategy parameter.

Setup:

- Setup owns Sites/URLs and scheduled triggers.
- Deleting URLs/sites affects Test URLs and downstream performance history because repositories cascade `test_results` cleanup.
- Scheduled triggers also create `test_results` through the same `TestingService`.

## Impact/Risk Notes

- `strategy` consistency matters. Latest rows, history, and worst performers are strategy-filtered. Detail dialog and URL comparison currently use the shared `_LATEST_JOIN`, which is explicitly "latest test result per URL (no strategy filter)"; those can show desktop/mobile-mismatched detail/comparison when both strategies exist.
- Standard Test URLs results are shared system data. Any schema or response-shape change can affect Dashboard, Metrics, scheduled triggers, and API consumers.
- CSV Lighthouse is colocated on the Test URLs page but persists separately. Changes to it should not be assumed to affect Dashboard/Metrics unless we intentionally bridge data into `test_results`.
- Visible `Test All URLs` is client-orchestrated. Backend `/api/test-all` and `/api/test-site` exist, but the active page path does not rely on them for the main button.
- CSV run UX depends on pending -> editable files -> saved files -> explicit start. Avoid auto-starting uploaded CSVs.
- CSV export/averages have existing focused tests; if touched, run frontend CSV result tests and backend CSV service/API/repository tests.

## Likely Verification Before Shipping Changes

- Frontend build: `npm run build` in `frontend/`.
- Focused frontend tests for Test URLs/CSV components when changed.
- Focused backend tests:
  - `tests/test_csv_lighthouse_service.py`
  - `tests/test_csv_lighthouse_repository.py`
  - `tests/test_csv_lighthouse_api.py`
- Manual or local smoke for `/test`, plus Dashboard `/` and Metrics `/metrics` if standard result shape/query behavior changes.
