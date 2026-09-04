# Test Case Database Design

## Goal

Add a manual Test Case Database tab for tracking Zephyr test case changes in a searchable, operator-friendly way. The page should make change history easier to search and scan than Zephyr's History tab while preserving direct links back to test cases, bugs, tasks, and supporting attachments.

## Scope

- Add a new `Test Case Database` navigation tab.
- Support manual create, edit, search, and archive for test case change records.
- Store one clickable test case URL per record.
- Store structured `Associated Bugs` links and structured `Associated Tasks` links.
- Support DB-backed attachments with upload, list, download, and delete behavior matching the Knowledge tab.
- Keep Zephyr import or sync out of v1.

## Data Model

New table: `test_case_changes`

- `id`
- `test_case_id`
- `title`
- `test_case_url`
- `change_summary`
- `before_state`
- `after_state`
- `changed_by`
- `change_date`
- `status`
- `tags`
- `created_at`
- `updated_at`
- `archived_at`

New table: `test_case_change_links`

- `id`
- `change_id`
- `link_type`
- `label`
- `url`
- `created_at`

`link_type` is limited to `bug` or `task`. Links cascade when the parent change record is deleted. Archived records keep their links.

New table: `test_case_change_attachments`

- `id`
- `change_id`
- `filename`
- `mime_type`
- `file_size`
- `file_bytes`
- `created_at`

Attachments cascade when the parent change record is deleted. Archived records keep their attachments.

## API

Base route: `/api/test-case-database`

- `GET /changes`
- `POST /changes`
- `GET /changes/<change_id>`
- `PUT /changes/<change_id>`
- `POST /changes/<change_id>/archive`
- `GET /changes/<change_id>/attachments`
- `POST /changes/<change_id>/attachments`
- `GET /changes/<change_id>/attachments/<attachment_id>/file`
- `DELETE /changes/<change_id>/attachments/<attachment_id>`

`GET /changes` accepts search and filter params:

- `q`
- `test_case_id`
- `status`
- `tag`
- `include_archived`

Search covers test case ID, title, test case URL, change summary, before/after text, changed by, tags, associated bug/task labels, and associated bug/task URLs.

## Validation And Errors

- Test case ID cannot be blank.
- Title cannot be blank.
- Change summary cannot be blank.
- Test case URL must be blank or a valid `http`/`https` URL.
- Associated bug and task rows require both `label` and valid `http`/`https` URL.
- Attachment uploads use the same 10 MB per-file limit as Knowledge attachments.
- Validation belongs in a `TestCaseDatabaseService`.
- SQL belongs in a `TestCaseDatabaseRepository`.
- Flask route handlers stay thin and map service results to HTTP responses.

## UI

The page should follow the Knowledge tab's working pattern: searchable record list plus an editor/detail panel. The first screen is the usable database, not a landing page.

Primary controls:

- Keyword search
- Status filter
- Tag filter
- Include archived toggle
- New change button
- Refresh button

Record list:

- Test case ID
- Title
- Status
- Changed date
- Changed by
- Bug link count
- Task link count
- Attachment count

Editor fields:

- Test Case ID
- Title
- Test Case URL
- Change Summary
- Before
- After
- Changed By
- Change Date
- Status
- Tags
- Associated Bugs structured rows: `label` + `url`
- Associated Tasks structured rows: `label` + `url`
- Attachments

Links render with the saved label as clickable text and open in a new tab. Long URLs should not stretch the layout; show the label first and keep the URL visible as muted secondary text where space allows.

For new records, attachments are disabled until the record is saved because uploads need a `change_id`.

## Frontend Files

- `frontend/src/pages/TestCaseDatabase.tsx`
- `frontend/src/components/test-case-database/TestCaseChangeFilters.tsx`
- `frontend/src/components/test-case-database/TestCaseChangeList.tsx`
- `frontend/src/components/test-case-database/TestCaseChangeEditor.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/types/index.ts`
- `frontend/src/App.tsx`
- `frontend/src/components/layout/AppSidebar.tsx`

## Backend Files

- `data_access/connection.py`
- `data_access/test_case_database_repository.py`
- `data_access/__init__.py`
- `services/test_case_database_service.py`
- `services/__init__.py`
- `routes/test_case_database_api.py`
- `routes/__init__.py`
- `app.py`

## Testing

- Repository tests for create, update, archive, search, link persistence, and attachment metadata.
- Service tests for required fields, URL validation, link validation, and oversized attachment validation.
- API tests for change CRUD, search params, archive behavior, upload/list/download/delete attachment flow.
- Frontend build check for typed API and page integration.

## Out Of Scope

- Zephyr API import, webhook sync, or polling.
- Diff parsing from Zephyr history.
- User permissions beyond existing Pharos access.
- Full text search engine outside the existing database.
