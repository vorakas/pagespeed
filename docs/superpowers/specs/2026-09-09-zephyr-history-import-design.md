# Zephyr History Import Design

## Goal

Backfill and refresh the Test Case Database from Zephyr Scale's own change history, so operators read change history in Pharos instead of Zephyr's History tab. The import turns each Zephyr save into one Pharos change record with real before/after field diffs.

## Scope

- Add a re-runnable "Import from Zephyr" action to the Test Case Database page.
- Import history for all test cases in one folder tree of one project (default: project key `TC`, folder `/Data Sync`, ~157 test cases). Both values are editable in the import dialog.
- Deduplicate on Zephyr's own history entry id so re-runs insert only unseen changes.
- No scheduler, no webhooks, no automatic polling.

## Zephyr Endpoints

- **Official** `GET /rest/atm/1.0/testcase/search?query=projectKey = "<key>"` — enumerates test cases in the project; returns `key`, `name`, `folder` in bulk. The folder subtree is filtered client-side because the ATM `folder` clause matches a folder exactly (not its subtree) and `projectId` is not a recognized query field. Same query pattern as `QaTestingReportService` ([services/qa_testing_service.py:1044](../../services/qa_testing_service.py)).
- **Internal (unsupported)** `GET /rest/tests/1.0/testcase/{key}/allVersions?fields=id` — resolves a test case key to its numeric id, if the search response does not already include it. Verified working against lampstrack.
- **Internal (unsupported)** `GET /rest/tests/1.0/testcase/{numericId}/history` — returns history entries: `id`, `historyDate`, `userKey`, `type` (`CREATE`/`UPDATE`), and `changeHistoryItems` of `{fieldName, originalValue, newValue}` with HTML values. Verified working against lampstrack (TC-T14481).

All `/rest/tests/1.0` calls live in one dedicated client class so a Zephyr upgrade breaking the unsupported API is contained to one file.

Auth is the existing server-side `JIRA_PAT` bearer token, exactly as `QaTestingReportService` uses it. No client-side credentials.

## Transformation Rules

One Zephyr history entry (one save) becomes one `test_case_changes` record:

- `test_case_id`: Zephyr key (e.g. `TC-T14481`).
- `test_case_url`: direct lampstrack test case link.
- `title`: the test case's current name from the search response.
- `change_summary`: auto-composed from the surviving field items, e.g. `Updated Precondition; rewrote steps 1-6 (4 steps removed); moved folder`.
- `before_state` / `after_state`: one section per surviving field item — a `**Heading**` line plus the field value converted from Zephyr HTML to the frontend's rich-text markup dialect (`- `/`1. ` list lines, `**bold**`, `*italic*`, `<u>`, blank-line paragraph breaks), sections separated by blank lines; a missing side renders `—`. Raw HTML is never stored: the frontend's `renderRichTextHtml` escapes HTML, so imported records use the same markup dialect as manually written ones (and inherit its XSS-safe escaping).
- `changed_by`: `userKey`. `change_date`: `historyDate`.
- `status`: `Imported`. `tags`: `zephyr-import`.
- `zephyr_history_id`: the entry's `id` (dedupe key).

Field name prettification:

- `PRECONDITION` → `Precondition`; other SCREAMING names title-cased.
- `TEST_SCRIPT.STEP.DESCRIPTION {"step":3}` → `Step 3 — Description` (same for `EXPECTED_RESULT`, `TEST_DATA`).
- Custom fields (e.g. `User Role`) keep their name as-is.

Noise filtering (agreed):

1. Decode HTML entities on both sides before comparing; drop items where decoded values are equal (kills `&mdash;` vs `—` diffs).
2. Drop `TEST_SCRIPT.STEP.TEST_DATA` items whose decoded value is only the `{User Roles} {Operating System} {Browser}` boilerplate placeholders.
3. `TEST_SCRIPT.STEP.ADDED` / `TEST_SCRIPT.STEP.REMOVED` markers (value `-`) do not become before/after sections; they are folded into the change summary as `Step N added` / `Steps N-M removed`.
4. If every item in a save is filtered out, no record is created for that save.

`CREATE` entries (no `changeHistoryItems`) become a record with summary `Test case created` and empty before/after, so each test case's timeline is complete.

## Data Model

`test_case_changes` gains one nullable column:

- `zephyr_history_id` (integer, unique index)

Manual records leave it null. Added through the existing schema-init path in `data_access/connection.py`; additive, no data migration.

## Status Enum

Add `Imported` to `VALID_STATUSES` and `WRITABLE_STATUSES` in `TestCaseDatabaseService`, and to the frontend status filter options. Imported records are otherwise fully editable like manual records.

## API

- `POST /api/test-case-database/import`
  - Body: `{ "projectKey": "TC", "folder": "/Data Sync" }`
  - Runs synchronously; history fetches are parallelized with a thread pool (pattern from `QaTestingReportService`).
  - Response: `{ "testCases": n, "recordsCreated": n, "skippedExisting": n, "skippedEmpty": n, "failures": [{ "key", "error" }] }`
  - Per-test-case failures are collected, not fatal; the run continues.

## Error Handling

- `JIRA_PAT` not configured → 503.
- Jira/Zephyr HTTP failure on enumeration → 502 with detail (same mapping as `routes/requirements_api.py`).
- Duplicate `zephyr_history_id` on insert → counted as `skippedExisting` (the service checks before insert; the unique index is the backstop).

## UI

- "Import from Zephyr" button in the Test Case Database page header.
- Dialog: project key and folder inputs (prefilled `TC` / `/Data Sync`), Run button with in-flight state, then the result summary (created / skipped / failures).
- After a successful run the change list refreshes.

## Components

New:

- `services/zephyr_history_client.py` — the only file touching `/rest/tests/1.0`; resolves ids, fetches history.
- `services/zephyr_import_service.py` — enumerates test cases, transforms history entries, inserts via the repository, returns the run summary.
- `frontend/src/components/test-case-database/ZephyrImportDialog.tsx`

Modified:

- `data_access/connection.py` — new column + unique index.
- `data_access/test_case_database_repository.py` — persist/read `zephyr_history_id`, existence check by history id.
- `services/test_case_database_service.py` — `Imported` status.
- `routes/test_case_database_api.py` — import endpoint.
- `app.py` — wire `ZephyrImportService` with `JIRA_PAT`.
- `frontend/src/pages/TestCaseDatabase.tsx`, `frontend/src/services/api.ts`, `frontend/src/types/index.ts` — button, dialog, typed API, status filter option.

## Testing

- Transformer unit tests using the real TC-T14481 history payload as a fixture: save grouping, all three noise filters, empty-save skip, summary composition, heading prettification, CREATE handling.
- Service tests: dedupe by `zephyr_history_id`, failure collection, summary counts.
- API test with a mocked Zephyr client: success, missing PAT (503), upstream failure (502).
- Repository tests: column round-trip, unique index, existence check.
- Frontend build check for typed API and dialog integration.

## Resolved Implementation Check

The import always resolves numeric ids via `allVersions?fields=id` and fetches history per version id, merged by entry id — correct whether Zephyr hangs history off the latest version or each version, at the cost of one cheap extra call per test case.

## Out of Scope

- Scheduled or webhook-driven sync.
- Importing folders outside the chosen tree, or multiple projects per run.
- Editing imported content during import (records are editable afterward like any record).
- Attachments from Zephyr.
