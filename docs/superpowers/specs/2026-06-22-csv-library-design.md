# CSV Library — Reusable CSV Files for Lighthouse Runs

**Date:** 2026-06-22
**Status:** Approved (design)
**Area:** Test URLs → CSV Lighthouse

## Problem

Every CSV Lighthouse run requires re-uploading the same ~7 named CSV files
(`PLP.csv`, `Search.csv`, `PDP.csv`, `SFP.csv`, `SearchToPLP.csv`,
`SearchToPDP.csv`, `MoreLikeThis.csv`). The filenames never change; only the
contents change occasionally (products going out of stock). Re-uploading the
full set every run is tedious and error-prone.

## Goal

Upload the CSVs once into a persistent **CSV Library**. Runs draw from the
library automatically. Update individual files when content changes. Allow an
optional ad-hoc upload for rare one-offs.

## Decisions (from brainstorming)

1. **One global library** — a single shared set of files (not multiple named
   sets, not per-user).
2. **Library is the default source** for a run; ad-hoc upload is optional and
   supplements it.
3. **Ad-hoc same-filename overrides** the library copy *for that run only* — it
   does not permanently modify the library.
4. **Per-file update** — the library is managed with per-file Replace / Remove
   plus an Add-files input (no bulk-overwrite drop zone).
5. **Recognized-name rule is enforced** — a library upload whose filename is not
   a known group is **rejected with a clear error**, never silently dropped.
6. **Snapshot semantics** — a run copies library content into its own
   `csv_lighthouse_files` rows at creation time. Editing the library later never
   alters historical runs.

## Data model

New table `csv_lighthouse_library`, added to both the Postgres and SQLite schema
blocks in `data_access/connection.py`. Independent of any run.

| Column      | Type      | Notes                                  |
|-------------|-----------|----------------------------------------|
| id          | serial/int PK |                                    |
| filename    | TEXT, UNIQUE | one row per file; upsert key        |
| group_key   | TEXT      | resolved via `group_for_filename`      |
| csv_text    | TEXT      | normalized, newline-joined values      |
| row_count   | INTEGER   |                                        |
| created_at  | TIMESTAMP | default now                            |
| updated_at  | TIMESTAMP | default now, bumped on upsert          |

UNIQUE(filename) makes re-saving a file update in place.

## Repository (`data_access/csv_lighthouse_repository.py`)

- `list_library() -> list[dict]` — all rows ordered by filename.
- `upsert_library_file(filename, group_key, csv_text, row_count) -> None` —
  insert or update by filename. SQLite: `INSERT ... ON CONFLICT(filename) DO
  UPDATE`; Postgres: same. (Both dialects support `ON CONFLICT`; the existing
  `ConnectionManager` placeholder/returning helpers are reused.)
- `delete_library_file(filename) -> None`.

## Service (`services/csv_lighthouse_service.py`)

Library management:
- `list_library()` → repository passthrough.
- `save_library_files(files)` — for each `(filename, handle)`: resolve group via
  `group_for_filename` (raise `ValidationError` if unrecognized), read with the
  existing size limit, `parse_column_a`, apply `group.max_rows`, then
  `upsert_library_file`. Returns the updated library list.
- `delete_library_file(filename)`.

Run creation — refactor `create_run`:
- Build a `dict[filename -> file_record]` from the library (`list_library`
  already stores normalized `csv_text`; reuse the same record shape as
  `_read_file_records`, deriving `values` from `csv_text`).
- Overlay ad-hoc uploads via `_read_file_records(files)`, keyed by filename, so
  same-named uploads replace the library copy.
- Validate the merged set is non-empty → else
  `ValidationError("No CSV files available — add files to the library or upload some")`.
- Proceed exactly as today (items, worker count, create_run, create_file per
  merged record, create_items).

This means uploads become optional at the API/route layer.

## API routes (`routes/csv_lighthouse_api.py`)

- `GET  /api/csv-lighthouse/library` → `{success, files}`.
- `POST /api/csv-lighthouse/library` → multipart, 1..N files (reuses the
  per-file size check and `CSV_LIGHTHOUSE_MAX_FILES` guard), upserts, returns
  `{success, files}`.
- `DELETE /api/csv-lighthouse/library/<path:filename>` → `{success}`.
- `POST /api/csv-lighthouse/runs` — drop the "at least one CSV file is required"
  hard error; allow zero uploaded files (service merges with library). Keep the
  content-length and per-file size guards.

## Frontend

`frontend/src/services/api.ts`:
- `listCsvLighthouseLibrary()`, `uploadCsvLighthouseLibrary(files)`,
  `deleteCsvLighthouseLibraryFile(filename)`.

`frontend/src/components/test-urls/CsvLighthousePanel.tsx`:
- New **CSV Library** section (likely a small sibling component
  `CsvLibraryPanel.tsx` to keep the file focused): lists stored files
  (filename · group · rows · updated), each with **Replace** (single-file input)
  and **Remove**; an **Add files** input for new ones. Errors (e.g. unrecognized
  name) surfaced inline.
- Run form: file input relabeled **"Additional CSVs (optional)"**; helper text
  *"Using N library files"*. `canStart` no longer requires
  `files.length > 0` — it requires `libraryCount + files.length > 0` and at
  least one target.
- After save, the library list and the new run both refresh.

## Error handling

- Unrecognized library filename → `ValidationError` → 400 with message naming the
  file and the accepted names.
- Empty source (no library, no upload) → `ValidationError` with actionable text.
- Library delete of a non-existent filename → no-op success (idempotent).
- Existing per-file size / row-count / content-length limits apply unchanged.

## Testing

No automated suite project-wide; manual verification is primary. Extend
`tests/test_csv_lighthouse_service.py` (which already uses a fake/SQLite repo):
- library upsert replaces by filename (row count updates, no duplicate row);
- `create_run` with no uploads builds items from the library;
- ad-hoc upload with a library filename overrides that file's values for the run;
- ad-hoc upload with a new recognized name adds to the run without touching the
  library;
- empty library + no upload raises `ValidationError`;
- unrecognized library upload raises `ValidationError`.

Manual: upload library, start a run with no upload, confirm 7 files; change one
file via Replace, confirm only that file's rows change; run with an ad-hoc
override.

## Out of scope

- Multiple named libraries.
- Per-user / per-strategy libraries.
- Editing library CSV text inline (Replace = re-upload the file).
- Versioning / history of library contents.
