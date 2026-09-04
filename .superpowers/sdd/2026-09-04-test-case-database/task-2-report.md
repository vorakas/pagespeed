## 2026-09-04 Task 2

- status: DONE_WITH_CONCERNS
- files changed:
  - `data_access/connection.py`
  - `services/__init__.py`
  - `services/test_case_database_service.py`
  - `tests/test_test_case_database_service.py`
- commits made:
  - `Add test case database service`
- tests run with result:
  - `python -m pytest tests/test_test_case_database_service.py -q` -> `9 passed`
  - `python -m pytest tests/test_test_case_database_repository.py tests/test_test_case_database_service.py -q` -> `11 passed`
- self-review notes:
  - Added the service API and normalization/validation rules from the task brief.
  - Kept repository behavior untouched; service remains the validation boundary.
  - Normalized attachment `memoryview` payloads to `bytes` for Postgres compatibility on reads.
- concerns:
  - The brief's test fixture uses `ConnectionManager(str(path))`, but this worktree's existing `ConnectionManager` treated any string as a Postgres DSN. I added narrow SQLite-path detection in `data_access/connection.py` so the required fixture works unchanged.

## 2026-09-04 Task 2 Fix Round 1

- status: DONE
- files changed:
  - `services/test_case_database_service.py`
  - `tests/test_test_case_database_service.py`
- commits made:
  - `Harden test case database service validation`
- tests run with result:
  - `python -m pytest tests/test_test_case_database_service.py -q` -> `10 passed`
  - `python -m pytest tests/test_test_case_database_repository.py tests/test_test_case_database_service.py -q` -> `12 passed`
- self-review notes:
  - Split writable statuses from searchable statuses so `search_changes(..., status="Archived")` remains valid, while `create_change()` and `update_change()` reject direct archived writes.
  - Matched Knowledge attachment behavior for empty file rejection and fallback MIME type normalization.
- concerns:
  - No new concerns from this fix round.
