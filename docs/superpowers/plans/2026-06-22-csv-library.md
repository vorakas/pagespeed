# CSV Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist a reusable global set of named CSVs so Lighthouse runs draw from a library instead of re-uploading every time, with optional per-run ad-hoc uploads.

**Architecture:** New `csv_lighthouse_library` table (one row per filename) feeds `create_run`, which merges library files with optional ad-hoc uploads (same filename overrides). Library is managed with per-file replace/remove/add. Runs still snapshot content into `csv_lighthouse_files` at creation, so history is immutable.

**Tech Stack:** Python/Flask 3-layer (routes → service → repository), SQLite (dev) / Postgres (prod) via `ConnectionManager`, React 19 + TS + Tailwind frontend.

Spec: `docs/superpowers/specs/2026-06-22-csv-library-design.md`

Backend tests run with: `python -m pytest tests/test_csv_lighthouse_service.py -v` (from `C:/pagespeed-monitor`). The suite uses a real SQLite DB via `ConnectionManager(db_url=None)` + `init_schema()`.

---

### Task 1: Library table in schema

**Files:**
- Modify: `data_access/connection.py` (Postgres block after the `csv_lighthouse_files` CREATE near line 389; SQLite block after the `csv_lighthouse_files` CREATE near line 723)
- Test: `tests/test_csv_lighthouse_repository.py`

- [ ] **Step 1: Write the failing test**

Add to `tests/test_csv_lighthouse_repository.py` (mirror its existing setUp that builds `ConnectionManager(db_url=None)` + `init_schema()` + `CsvLighthouseRepository`):

```python
def test_list_library_is_empty_on_fresh_schema(self):
    self.assertEqual(self.repo.list_library(), [])
```

- [ ] **Step 2: Run test, verify it fails**

Run: `python -m pytest tests/test_csv_lighthouse_repository.py -k library -v`
Expected: FAIL — `AttributeError: 'CsvLighthouseRepository' object has no attribute 'list_library'` (and, once the method exists in Task 2, a missing-table error until this task's schema is added).

- [ ] **Step 3: Add the Postgres table**

In the Postgres schema method, after the `csv_lighthouse_files` block (~line 389), add:

```python
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS csv_lighthouse_library (
                id SERIAL PRIMARY KEY,
                filename TEXT NOT NULL UNIQUE,
                group_key TEXT NOT NULL,
                csv_text TEXT NOT NULL,
                row_count INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
```

- [ ] **Step 4: Add the SQLite table**

In the SQLite schema method, after the `csv_lighthouse_files` block (~line 723), add:

```python
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS csv_lighthouse_library (
                id INTEGER PRIMARY KEY,
                filename TEXT NOT NULL UNIQUE,
                group_key TEXT NOT NULL,
                csv_text TEXT NOT NULL,
                row_count INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
```

(Task 2 adds `list_library`; this task is verified together with Task 2's run. Commit after Task 2.)

---

### Task 2: Repository library methods

**Files:**
- Modify: `data_access/csv_lighthouse_repository.py`
- Test: `tests/test_csv_lighthouse_repository.py`

- [ ] **Step 1: Write the failing tests**

```python
def test_upsert_library_file_inserts_then_updates_by_filename(self):
    self.repo.upsert_library_file("PLP.csv", "PLP", "a/\nb/\n", 2)
    self.repo.upsert_library_file("PLP.csv", "PLP", "c/\n", 1)
    library = self.repo.list_library()
    self.assertEqual(len(library), 1)
    self.assertEqual(library[0]["filename"], "PLP.csv")
    self.assertEqual(library[0]["row_count"], 1)
    self.assertEqual(library[0]["csv_text"], "c/\n")

def test_delete_library_file_removes_row(self):
    self.repo.upsert_library_file("PLP.csv", "PLP", "a/\n", 1)
    self.repo.delete_library_file("PLP.csv")
    self.assertEqual(self.repo.list_library(), [])
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `python -m pytest tests/test_csv_lighthouse_repository.py -k library -v`
Expected: FAIL — missing `upsert_library_file` / `list_library`.

- [ ] **Step 3: Implement the methods**

Add to `CsvLighthouseRepository` (after `delete_run`):

```python
    def list_library(self) -> list[dict]:
        with self._cm.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM csv_lighthouse_library ORDER BY filename"
            )
            return self._cm.rows_to_dicts(cursor)

    def upsert_library_file(
        self, filename: str, group_key: str, csv_text: str, row_count: int
    ) -> None:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                conn.cursor().execute(
                    f"""
                    INSERT INTO csv_lighthouse_library (
                        filename, group_key, csv_text, row_count
                    )
                    VALUES ({ph}, {ph}, {ph}, {ph})
                    ON CONFLICT(filename) DO UPDATE SET
                        group_key = excluded.group_key,
                        csv_text = excluded.csv_text,
                        row_count = excluded.row_count,
                        updated_at = CURRENT_TIMESTAMP
                    """,
                    (filename, group_key, csv_text, row_count),
                )
        except Exception as exc:
            raise DatabaseError(
                f"Failed to save CSV library file {filename}: {exc}"
            ) from exc

    def delete_library_file(self, filename: str) -> None:
        ph = self._cm.placeholder()
        try:
            with self._cm.get_connection() as conn:
                conn.cursor().execute(
                    f"DELETE FROM csv_lighthouse_library WHERE filename = {ph}",
                    (filename,),
                )
        except Exception as exc:
            raise DatabaseError(
                f"Failed to delete CSV library file {filename}: {exc}"
            ) from exc
```

`ON CONFLICT(filename)` works on both SQLite (≥3.24) and Postgres given the `UNIQUE` column from Task 1; `excluded` is valid in both dialects.

- [ ] **Step 4: Run tests, verify they pass**

Run: `python -m pytest tests/test_csv_lighthouse_repository.py -k library -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add data_access/connection.py data_access/csv_lighthouse_repository.py tests/test_csv_lighthouse_repository.py
git commit -m "Add csv_lighthouse_library table and repository methods"
```

---

### Task 3: Service library management

**Files:**
- Modify: `services/csv_lighthouse_service.py`
- Test: `tests/test_csv_lighthouse_service.py`

- [ ] **Step 1: Write the failing tests**

```python
def test_save_library_files_upserts_recognized_files(self):
    self.service.save_library_files(
        [("PLP.csv", io.BytesIO(b"brass-lamp/\nfloor-lamp/\n"))]
    )
    library = self.service.list_library()
    self.assertEqual(len(library), 1)
    self.assertEqual(library[0]["filename"], "PLP.csv")
    self.assertEqual(library[0]["group_key"], "PLP")
    self.assertEqual(library[0]["row_count"], 2)

def test_save_library_files_rejects_unrecognized_filename(self):
    with self.assertRaisesRegex(ValidationError, "Unrecognized CSV filename"):
        self.service.save_library_files(
            [("Unknown.csv", io.BytesIO(b"brass-lamp/\n"))]
        )
    self.assertEqual(self.service.list_library(), [])

def test_delete_library_file_removes_it(self):
    self.service.save_library_files([("PLP.csv", io.BytesIO(b"brass-lamp/\n"))])
    self.service.delete_library_file("PLP.csv")
    self.assertEqual(self.service.list_library(), [])
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `python -m pytest tests/test_csv_lighthouse_service.py -k library -v`
Expected: FAIL — missing `save_library_files` / `list_library` / `delete_library_file`.

- [ ] **Step 3: Implement the methods**

Add `from services.testdata_registry import GROUPS` to the existing registry import line (it currently imports `SITES, group_for_filename, open_url`). Then add these methods to `CsvLighthouseService` (place near `list_files`):

```python
    def list_library(self) -> list[dict]:
        return self.repository.list_library()

    def save_library_files(self, files) -> list[dict]:
        if not files:
            raise ValidationError("No CSV files provided")
        for filename, handle in files:
            group = group_for_filename(filename)
            if group is None:
                accepted = ", ".join(g.csv_filename for g in GROUPS.values())
                raise ValidationError(
                    f"Unrecognized CSV filename: {filename}. "
                    f"Expected one of: {accepted}"
                )
            file_bytes = self._read_limited_file(filename, handle)
            rows = parse_column_a(file_bytes, group, filename=filename)
            if group.max_rows is not None:
                rows = rows[: group.max_rows]
            self.repository.upsert_library_file(
                filename,
                group.key,
                self._csv_text_from_values(rows),
                len(rows),
            )
        return self.repository.list_library()

    def delete_library_file(self, filename: str) -> None:
        self.repository.delete_library_file(filename)
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `python -m pytest tests/test_csv_lighthouse_service.py -k library -v`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add services/csv_lighthouse_service.py tests/test_csv_lighthouse_service.py
git commit -m "Add CSV library management to service with recognized-name enforcement"
```

---

### Task 4: Merge library into create_run

**Files:**
- Modify: `services/csv_lighthouse_service.py` (`create_run`, plus a new `_library_file_records` helper)
- Test: `tests/test_csv_lighthouse_service.py`

- [ ] **Step 1: Write the failing tests**

```python
def test_create_run_uses_library_when_no_uploads(self):
    self.service.save_library_files([("PDP.csv", io.BytesIO(b"brass-lamp/\n"))])
    result = self.service.create_run(
        [], site_keys=["www"], strategy="desktop", label="From library"
    )
    detail = self.service.get_run(result["run_id"])
    self.assertEqual(result["total_items"], 1)
    self.assertEqual(
        detail["items"][0]["generated_url"],
        "https://www.lampsplus.com/p/brass-lamp/",
    )

def test_create_run_adhoc_upload_overrides_library_file(self):
    self.service.save_library_files([("PDP.csv", io.BytesIO(b"old-lamp/\n"))])
    result = self.service.create_run(
        [("PDP.csv", io.BytesIO(b"new-lamp/\n"))],
        site_keys=["www"],
        strategy="desktop",
    )
    detail = self.service.get_run(result["run_id"])
    files = self.service.list_files(result["run_id"])
    self.assertEqual([f["filename"] for f in files], ["PDP.csv"])
    self.assertEqual(
        detail["items"][0]["generated_url"],
        "https://www.lampsplus.com/p/new-lamp/",
    )
    # library itself is untouched
    self.assertEqual(self.service.list_library()[0]["csv_text"], "old-lamp/\n")

def test_create_run_adhoc_new_name_adds_without_touching_library(self):
    self.service.save_library_files([("PDP.csv", io.BytesIO(b"brass-lamp/\n"))])
    result = self.service.create_run(
        [("SFP.csv", io.BytesIO(b"swing-arm/\n"))],
        site_keys=["www"],
        strategy="desktop",
    )
    files = sorted(f["filename"] for f in self.service.list_files(result["run_id"]))
    self.assertEqual(files, ["PDP.csv", "SFP.csv"])
    self.assertEqual([f["filename"] for f in self.service.list_library()], ["PDP.csv"])

def test_create_run_empty_library_and_no_upload_raises(self):
    with self.assertRaisesRegex(ValidationError, "No CSV files available"):
        self.service.create_run([], site_keys=["www"], strategy="desktop")
    self.assertEqual(self.repo.list_runs(), [])
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `python -m pytest tests/test_csv_lighthouse_service.py -k "library or no_upload or override or adhoc" -v`
Expected: FAIL — `create_run` still requires uploaded files / does not read the library.

- [ ] **Step 3: Add the library-record helper**

Add to `CsvLighthouseService` (near `_read_file_records`):

```python
    def _library_file_records(self) -> list[dict]:
        records = []
        for file in self.repository.list_library():
            values = [
                line.strip()
                for line in file["csv_text"].splitlines()
                if line.strip()
            ]
            records.append(
                {
                    "filename": file["filename"],
                    "group_key": file["group_key"],
                    "csv_text": file["csv_text"],
                    "row_count": file["row_count"],
                    "values": values,
                }
            )
        return records
```

- [ ] **Step 4: Rewrite the top of `create_run` to merge**

Replace the current lines:

```python
        strategy = self._validate_strategy(strategy)
        site_keys = self._validate_site_keys(site_keys)
        file_records = self._read_file_records(files)
        items = self._build_items_from_file_records(file_records, site_keys, strategy)
        if not items:
            raise ValidationError("Upload did not contain any recognized CSV rows")
```

with:

```python
        strategy = self._validate_strategy(strategy)
        site_keys = self._validate_site_keys(site_keys)

        merged: dict[str, dict] = {
            record["filename"]: record for record in self._library_file_records()
        }
        for record in self._read_file_records(files):
            merged[record["filename"]] = record  # ad-hoc overrides library by filename
        if not merged:
            raise ValidationError(
                "No CSV files available — add files to the library or upload some"
            )
        file_records = list(merged.values())

        items = self._build_items_from_file_records(file_records, site_keys, strategy)
        if not items:
            raise ValidationError("Upload did not contain any recognized CSV rows")
```

The rest of `create_run` (item-count guard, `create_run`, `create_file` loop, `create_items`) is unchanged.

- [ ] **Step 5: Run the full service suite**

Run: `python -m pytest tests/test_csv_lighthouse_service.py -v`
Expected: PASS — the 4 new tests plus all pre-existing tests (existing tests pass uploads, so the library is empty and merge is a no-op for them).

- [ ] **Step 6: Commit**

```bash
git add services/csv_lighthouse_service.py tests/test_csv_lighthouse_service.py
git commit -m "Build runs from CSV library merged with optional ad-hoc uploads"
```

---

### Task 5: API routes for the library

**Files:**
- Modify: `routes/csv_lighthouse_api.py`

- [ ] **Step 1: Relax the run upload requirement**

In `create_run`, replace:

```python
        files = [file for file in request.files.getlist("files") if file.filename]
        if not files:
            raise ValidationError("At least one CSV file is required")
        if len(files) > CSV_LIGHTHOUSE_MAX_FILES:
```

with:

```python
        files = [file for file in request.files.getlist("files") if file.filename]
        if len(files) > CSV_LIGHTHOUSE_MAX_FILES:
```

(Empty `files` is now valid — the service falls back to the library and raises if both are empty.)

- [ ] **Step 2: Add the library endpoints**

Add inside `create_csv_lighthouse_blueprint`, before `return blueprint`:

```python
    @blueprint.route("/library", methods=["GET"])
    def list_library():
        return jsonify({"success": True, "files": service.list_library()})

    @blueprint.route("/library", methods=["POST"])
    def upload_library():
        if (
            request.content_length is not None
            and request.content_length > CSV_LIGHTHOUSE_MAX_CONTENT_LENGTH
        ):
            raise ValidationError(
                f"CSV Lighthouse upload exceeds {CSV_LIGHTHOUSE_MAX_CONTENT_LENGTH} bytes"
            )
        files = [file for file in request.files.getlist("files") if file.filename]
        if not files:
            raise ValidationError("At least one CSV file is required")
        if len(files) > CSV_LIGHTHOUSE_MAX_FILES:
            raise ValidationError(
                f"CSV Lighthouse upload accepts at most {CSV_LIGHTHOUSE_MAX_FILES} files"
            )
        uploaded_files = []
        for file in files:
            size = _stream_size_bytes(file.stream)
            if size > CSV_LIGHTHOUSE_MAX_FILE_BYTES:
                raise ValidationError(
                    f"CSV file {file.filename} exceeds {CSV_LIGHTHOUSE_MAX_FILE_BYTES} bytes"
                )
            uploaded_files.append((file.filename, file.stream))
        return jsonify({"success": True, "files": service.save_library_files(uploaded_files)})

    @blueprint.route("/library/<path:filename>", methods=["DELETE"])
    def delete_library(filename):
        service.delete_library_file(filename)
        return jsonify({"success": True})
```

- [ ] **Step 3: Manual verification (local backend)**

Start the backend (`python app.py` or the project's run command). Then:

```bash
printf 'brass-lamp/\n' > /tmp/PDP.csv
curl -s -X POST http://localhost:5000/api/csv-lighthouse/library -F "files=@/tmp/PDP.csv;type=text/csv"
curl -s http://localhost:5000/api/csv-lighthouse/library
# run with no uploads → uses library
curl -s -X POST http://localhost:5000/api/csv-lighthouse/runs -F "site_keys=www" -F "strategy=desktop"
curl -s -X DELETE http://localhost:5000/api/csv-lighthouse/library/PDP.csv
```

Expected: upload returns the library list with `PDP.csv`; run returns `total_items >= 1`; delete returns `{"success": true}`; final list is empty.

- [ ] **Step 4: Commit**

```bash
git add routes/csv_lighthouse_api.py
git commit -m "Add CSV library API endpoints and make run uploads optional"
```

---

### Task 6: Frontend API client

**Files:**
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: Locate the CSV Lighthouse client functions**

Find the existing `createCsvLighthouseRun` / `listCsvLighthouseRuns` block in `api.ts` and the existing `CsvLighthouseFile` type usage in `frontend/src/types`. Reuse the same `fetch` + base-URL + error-handling pattern those functions use (read 2–3 of them first to copy the exact style — do not invent a new helper).

- [ ] **Step 2: Add three functions**

Add alongside the other CSV Lighthouse functions (match the file's existing return-shape and error handling; the run-list functions return parsed JSON and throw on `!response.ok`):

```ts
async listCsvLighthouseLibrary(): Promise<{ files: CsvLighthouseFile[] }> {
  const response = await fetch(`${API_BASE}/api/csv-lighthouse/library`)
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
},

async uploadCsvLighthouseLibrary(files: File[]): Promise<{ files: CsvLighthouseFile[] }> {
  const form = new FormData()
  files.forEach((file) => form.append("files", file))
  const response = await fetch(`${API_BASE}/api/csv-lighthouse/library`, {
    method: "POST",
    body: form,
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json()
},

async deleteCsvLighthouseLibraryFile(filename: string): Promise<void> {
  const response = await fetch(
    `${API_BASE}/api/csv-lighthouse/library/${encodeURIComponent(filename)}`,
    { method: "DELETE" },
  )
  if (!response.ok) throw new Error(await readError(response))
},
```

NOTE: `API_BASE` and `readError` are placeholders for whatever the surrounding functions actually use (e.g. `api` object method style, a shared `request()` helper, or the existing `createCsvLighthouseRun`'s pattern). Match the real names in the file. `CsvLighthouseFile` is the type already returned by `listCsvLighthouseFiles`.

- [ ] **Step 3: Verify the build typechecks**

Run: `cd frontend && npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/services/api.ts
git commit -m "Add CSV library API client functions"
```

---

### Task 7: Frontend CSV Library panel + run-form integration

**Files:**
- Create: `frontend/src/components/test-urls/CsvLibraryPanel.tsx`
- Modify: `frontend/src/components/test-urls/CsvLighthousePanel.tsx`

- [ ] **Step 1: Create `CsvLibraryPanel.tsx`**

A self-contained panel that loads the library, supports Add (multi-file), per-row Replace (single file), and per-row Remove. It calls `props.onLibraryChanged()` after any mutation so the parent can update the "Using N library files" hint. Match the Aurora styling used in `CsvLighthousePanel.tsx` (`aurora-panel`, `aurora-text`, `aurora-text-dim`, `Button`, `Input`, lucide icons). Skeleton:

```tsx
import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, RefreshCw, Trash2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/services/api"
import type { CsvLighthouseFile } from "@/types"
import { formatDateTime } from "@/lib/utils"

interface CsvLibraryPanelProps {
  onLibraryChanged?: (count: number) => void
}

export function CsvLibraryPanel({ onLibraryChanged }: CsvLibraryPanelProps) {
  const [files, setFiles] = useState<CsvLighthouseFile[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const replaceInputRef = useRef<HTMLInputElement | null>(null)
  const replaceTargetRef = useRef<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.listCsvLighthouseLibrary()
      setFiles(response.files)
      onLibraryChanged?.(response.files.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load CSV library")
    } finally {
      setLoading(false)
    }
  }, [onLibraryChanged])

  useEffect(() => {
    load()
  }, [load])

  const upload = async (selected: File[]) => {
    if (selected.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const response = await api.uploadCsvLighthouseLibrary(selected)
      setFiles(response.files)
      onLibraryChanged?.(response.files.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save CSV library files")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (filename: string) => {
    if (!window.confirm(`Remove ${filename} from the library?`)) return
    setBusy(true)
    setError(null)
    try {
      await api.deleteCsvLighthouseLibraryFile(filename)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove CSV library file")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="aurora-panel space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="aurora-text text-xs font-semibold uppercase tracking-[0.12em]">
          CSV Library
        </h3>
        {loading && <Loader2 className="aurora-text-faint h-3.5 w-3.5 animate-spin" />}
      </div>

      <p className="aurora-text-dim text-xs">
        Stored files are reused for every run. Re-upload a file to update it when stock changes.
      </p>

      {error && (
        <div className="rounded border border-[color:var(--lcc-red)]/40 bg-[color:var(--lcc-red)]/10 px-3 py-2 text-sm text-[color:var(--lcc-red)]">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {files.length === 0 && !loading ? (
          <p className="aurora-text-dim text-sm">No library files yet.</p>
        ) : (
          files.map((file) => (
            <div
              key={file.filename}
              className="flex items-center justify-between gap-2 rounded border border-border/60 p-2"
            >
              <div className="min-w-0">
                <div className="aurora-text truncate text-sm font-medium">{file.filename}</div>
                <div className="aurora-text-faint text-xs">
                  {file.group_key} · {file.row_count} rows · {formatDateTime(file.updated_at)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    replaceTargetRef.current = file.filename
                    replaceInputRef.current?.click()
                  }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Replace
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => remove(file.filename)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-1.5">
        <label className="aurora-text-dim text-xs font-medium" htmlFor="csv-library-add">
          Add files
        </label>
        <Input
          id="csv-library-add"
          type="file"
          accept=".csv,text/csv"
          multiple
          disabled={busy}
          onChange={(event) => {
            void upload(Array.from(event.target.files ?? []))
            event.target.value = ""
          }}
          className="h-9"
        />
      </div>

      <input
        ref={replaceInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? [])
          event.target.value = ""
          if (selected.length === 0) return
          // Replace = upload under the file's existing name. The picked file's
          // own name must still resolve to a known group, so the user should
          // pick a correctly-named CSV; upsert is keyed on that name.
          void upload(selected)
        }}
      />

      {busy && (
        <div className="aurora-text-dim flex items-center gap-2 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
        </div>
      )}
    </section>
  )
}
```

NOTE on Replace: the backend upserts by the uploaded file's own filename. "Replace PLP.csv" therefore requires the user to pick a file also named `PLP.csv`. That is the normal case (they re-export the same file). `replaceTargetRef` is retained for a future rename-on-replace enhancement but is not required for correctness now — if you prefer, drop `replaceTargetRef` and the hidden input and let Replace reuse the same Add input. Keep whichever is simpler; do not add rename logic in this task (out of scope per spec).

- [ ] **Step 2: Integrate into `CsvLighthousePanel.tsx`**

Add state and import:

```tsx
import { CsvLibraryPanel } from "@/components/test-urls/CsvLibraryPanel"
// ...
const [libraryCount, setLibraryCount] = useState(0)
```

Change `canStart` so uploads are optional once a library exists:

```tsx
const canStart = (files.length > 0 || libraryCount > 0) && selectedTargets.length > 0 && !starting
```

Render `<CsvLibraryPanel onLibraryChanged={setLibraryCount} />` in the right column (inside the `<aside>`, above "Recent Runs") OR above the run form in the left column — pick the spot that reads best; the aside is recommended so the run form stays compact.

Relabel the file input and add a hint. Replace the `CSV files` label text with `Additional CSVs (optional)` and add, just under the `<Input ... id="csv-lighthouse-files" />`:

```tsx
<p className="aurora-text-faint text-xs">
  {libraryCount > 0
    ? `Using ${libraryCount} library file${libraryCount === 1 ? "" : "s"}${files.length ? ` + ${files.length} uploaded` : ""}`
    : "No library files yet — upload below or add them to the library."}
</p>
```

- [ ] **Step 3: Build**

Run: `cd frontend && npm run build`
Expected: build succeeds, no TS errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/test-urls/CsvLibraryPanel.tsx frontend/src/components/test-urls/CsvLighthousePanel.tsx
git commit -m "Add CSV Library panel and make run uploads optional in the UI"
```

---

### Task 8: End-to-end verification + deploy

**Files:** none (verification)

- [ ] **Step 1: Full backend suite**

Run: `python -m pytest tests/test_csv_lighthouse_service.py tests/test_csv_lighthouse_repository.py -v`
Expected: all pass.

- [ ] **Step 2: Frontend preview verification**

Start the dev server (preview tools). On the Test URLs page:
- Library panel lists no files initially; add the 7 CSVs → all 7 appear.
- Run form shows "Using 7 library files"; **Save CSVs** with an empty upload input creates a run whose Uploaded CSVs panel lists all 7.
- Replace one file (re-upload same name) → only that file's row count/updated time changes.
- Start a run, confirm an ad-hoc upload of an existing name overrides only that file for the run and the library row is unchanged.

- [ ] **Step 3: Deploy**

Follow `docs/deploy.md`:

```bash
git push
cd /c/pagespeed-monitor && source .env && RAILWAY_API_TOKEN="$RAILWAY_TOKEN" npx @railway/cli up -m "$(git log -1 --pretty=%s)"
```

Then poll the deployment to SUCCESS (GraphQL query in `docs/deploy.md`). The new table is created by `init_schema()` on boot (CREATE TABLE IF NOT EXISTS), so no manual migration is needed on Postgres.

---

## Self-Review Notes

- **Spec coverage:** table (T1), repo (T2), service mgmt + name enforcement (T3), library-merge + override + optional upload + empty error (T4), endpoints + optional run upload (T5), client (T6), UI panel + hint + canStart (T7), tests + deploy (T8). Snapshot semantics preserved (T4 still copies into `csv_lighthouse_files` via unchanged `create_file` loop). All spec sections mapped.
- **Naming consistency:** `list_library`, `upsert_library_file`, `delete_library_file` (repo) and `list_library`, `save_library_files`, `delete_library_file` (service) used identically across tasks; client `listCsvLighthouseLibrary` / `uploadCsvLighthouseLibrary` / `deleteCsvLighthouseLibraryFile` consistent T6↔T7.
- **Known soft spots flagged inline:** `api.ts` helper names (T6) and Replace-by-name semantics (T7) are called out as match-the-existing-code / out-of-scope rather than left as silent assumptions.
