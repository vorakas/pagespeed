# Saved NRQL Queries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users name, save, select, and delete NRQL queries in the New Relic Custom Query feature via a dropdown, persisted in localStorage.

**Architecture:** A pure + thin-wrapper storage module (`savedNrqlQueries.ts`) holds the localStorage contract and pure list operations (parse/upsert/remove). `CustomQuery.tsx` wires a combined preset+saved `<select>`, a name input, a Save button, and a Delete button, mirroring the existing IIS Logs `KqlQueryPanel`. Flat global list, frontend-only.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind 4, Aurora CSS tokens, Vitest.

---

## File Structure

- **Create** `frontend/src/lib/savedNrqlQueries.ts` — `SavedQuery` type, pure `parseSavedQueries`/`upsertQuery`/`removeQuery`, thin `loadSavedQueries`/`saveSavedQueries` localStorage wrappers.
- **Create** `frontend/src/lib/savedNrqlQueries.test.ts` — Vitest tests for the pure functions.
- **Modify** `frontend/src/components/newrelic/CustomQuery.tsx` — add the saved-query UI; fold the two sample buttons into the dropdown.

## Background facts (verified)

- Vitest runs in the default **node** environment (no `localStorage` global), so unit tests target only the pure functions (`parseSavedQueries`, `upsertQuery`, `removeQuery`). The localStorage wrappers (`loadSavedQueries`, `saveSavedQueries`) are exercised manually in the browser.
- The sibling `frontend/src/components/iis-logs/KqlQueryPanel.tsx` already implements this exact pattern (`aurora-select`, `aurora-input`, `Save`/`Trash2` icons, a `preset:`/`saved:` valued `<select>` with a disabled separator option). Match it.
- Aurora classes `aurora-select` and `aurora-input` exist in `frontend/src/styles/aurora.css`. `Button` supports `variant="outline" | "destructive"` and `size="xs" | "sm"`.
- Test command (from `frontend/`): `npm run test`. Build: `npm run build`.

---

## Task 1: Saved-query storage module + unit tests

**Files:**
- Create: `frontend/src/lib/savedNrqlQueries.ts`
- Test: `frontend/src/lib/savedNrqlQueries.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/savedNrqlQueries.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  parseSavedQueries,
  removeQuery,
  upsertQuery,
  type SavedQuery,
} from "./savedNrqlQueries"

describe("parseSavedQueries", () => {
  it("returns an empty list for null or empty input", () => {
    expect(parseSavedQueries(null)).toEqual([])
    expect(parseSavedQueries("")).toEqual([])
  })

  it("returns an empty list for corrupt JSON", () => {
    expect(parseSavedQueries("{not json")).toEqual([])
  })

  it("returns an empty list for non-array JSON", () => {
    expect(parseSavedQueries('{"name":"x","query":"y"}')).toEqual([])
  })

  it("drops entries that are not name+query shaped", () => {
    const raw = JSON.stringify([
      { name: "ok", query: "SELECT 1" },
      { name: "missing query" },
      { query: "missing name" },
      null,
      "a string",
    ])
    expect(parseSavedQueries(raw)).toEqual([{ name: "ok", query: "SELECT 1" }])
  })
})

describe("upsertQuery", () => {
  it("appends a new entry with a trimmed name", () => {
    expect(upsertQuery([], "  My Query  ", "SELECT 1")).toEqual([
      { name: "My Query", query: "SELECT 1" },
    ])
  })

  it("overwrites an existing same-name entry without duplicating", () => {
    const list: SavedQuery[] = [{ name: "A", query: "old" }]
    expect(upsertQuery(list, "A", "new")).toEqual([{ name: "A", query: "new" }])
  })

  it("does not mutate the input list", () => {
    const list: SavedQuery[] = [{ name: "A", query: "old" }]
    upsertQuery(list, "B", "x")
    expect(list).toEqual([{ name: "A", query: "old" }])
  })
})

describe("removeQuery", () => {
  it("removes the named entry and keeps the others", () => {
    const list: SavedQuery[] = [
      { name: "A", query: "1" },
      { name: "B", query: "2" },
    ]
    expect(removeQuery(list, "A")).toEqual([{ name: "B", query: "2" }])
  })

  it("does not mutate the input list", () => {
    const list: SavedQuery[] = [{ name: "A", query: "1" }]
    removeQuery(list, "A")
    expect(list).toEqual([{ name: "A", query: "1" }])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `npm run test -- savedNrqlQueries`
Expected: FAIL — module `./savedNrqlQueries` not found.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/savedNrqlQueries.ts`:

```ts
const STORAGE_KEY = "nrSavedQueries"

export interface SavedQuery {
  name: string
  query: string
}

/** Parse stored JSON into a clean SavedQuery list; tolerate missing/corrupt data. */
export function parseSavedQueries(raw: string | null): SavedQuery[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed.filter(
    (entry): entry is SavedQuery =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as SavedQuery).name === "string" &&
      typeof (entry as SavedQuery).query === "string",
  )
}

/** Add a query, or overwrite the existing entry with the same (trimmed) name. */
export function upsertQuery(list: SavedQuery[], name: string, query: string): SavedQuery[] {
  const trimmed = name.trim()
  const entry: SavedQuery = { name: trimmed, query }
  const index = list.findIndex((item) => item.name === trimmed)
  if (index === -1) return [...list, entry]
  const next = list.slice()
  next[index] = entry
  return next
}

/** Remove the entry matching the given name. */
export function removeQuery(list: SavedQuery[], name: string): SavedQuery[] {
  return list.filter((item) => item.name !== name)
}

/** Read saved queries from localStorage. */
export function loadSavedQueries(): SavedQuery[] {
  return parseSavedQueries(localStorage.getItem(STORAGE_KEY))
}

/** Persist saved queries to localStorage. */
export function saveSavedQueries(list: SavedQuery[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `frontend/`): `npm run test -- savedNrqlQueries`
Expected: PASS — all cases green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/savedNrqlQueries.ts frontend/src/lib/savedNrqlQueries.test.ts
git commit -m "Add saved NRQL query storage helpers"
```

Include the trailer in the commit body: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`

---

## Task 2: Wire saved-query UI into CustomQuery

**Files:**
- Modify: `frontend/src/components/newrelic/CustomQuery.tsx`

Apply as a whole-file replacement so imports, state, handlers, and JSX stay consistent.

- [ ] **Step 1: Replace the component**

Replace the entire contents of `frontend/src/components/newrelic/CustomQuery.tsx` with:

```tsx
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Play, Save, Trash2 } from "lucide-react"
import { NrqlEditor } from "@/components/newrelic/NrqlEditor"
import { NerdGraphResultsTable } from "@/components/newrelic/NerdGraphResultsTable"
import { buildCsv, csvFilename, deriveColumns, type ResultRow } from "@/lib/nerdgraphTable"
import {
  loadSavedQueries,
  removeQuery,
  saveSavedQueries,
  upsertQuery,
  type SavedQuery,
} from "@/lib/savedNrqlQueries"
import { api } from "@/services/api"
import type { NewRelicConfig } from "@/types"

type SiteKey = "lampsplus" | "adobe"
type ResultView = "table" | "json"

const SITE_LABELS: Record<SiteKey, string> = {
  lampsplus: "LampsPlus",
  adobe: "Adobe Commerce",
}

interface CustomQueryProps {
  configs: Record<SiteKey, NewRelicConfig>
  activeSite?: SiteKey
}

const SAMPLE_QUERIES: Record<string, { label: string; query: string }> = {
  apm: {
    label: "APM Sample",
    query:
      "SELECT average(duration), count(*) FROM Transaction WHERE appName = 'YourApp' FACET name SINCE 1 hour ago",
  },
  browser: {
    label: "Browser Sample",
    query:
      "SELECT average(pageRenderingDuration), average(domProcessingDuration) FROM PageView SINCE 1 hour ago",
  },
}

/** Pull the row array out of the API envelope, or null when the response is not tabular. */
function extractRows(response: Record<string, unknown>): ResultRow[] | null {
  const payload = (response?.data ?? {}) as { results?: unknown }
  return Array.isArray(payload.results) ? (payload.results as ResultRow[]) : null
}

export function CustomQuery({ configs, activeSite }: CustomQueryProps) {
  const [selectedSite, setSelectedSite] = useState<SiteKey>(activeSite ?? "lampsplus")
  const [query, setQuery] = useState("")
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>(loadSavedQueries)
  const [selected, setSelected] = useState("")
  const [queryName, setQueryName] = useState("")
  const [rawResult, setRawResult] = useState<Record<string, unknown> | null>(null)
  const [rows, setRows] = useState<ResultRow[] | null>(null)
  const [view, setView] = useState<ResultView>("table")
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const config = configs[selectedSite]

  const handleSelectChange = (value: string) => {
    setSelected(value)
    if (value.startsWith("preset:")) {
      const preset = SAMPLE_QUERIES[value.slice("preset:".length)]
      if (preset) setQuery(preset.query)
    } else if (value.startsWith("saved:")) {
      const name = value.slice("saved:".length)
      const saved = savedQueries.find((item) => item.name === name)
      if (saved) setQuery(saved.query)
    }
  }

  const handleSaveQuery = () => {
    const name = queryName.trim()
    if (!name || !query.trim()) return
    const next = upsertQuery(savedQueries, name, query)
    saveSavedQueries(next)
    setSavedQueries(loadSavedQueries())
    setSelected(`saved:${name}`)
  }

  const handleDeleteQuery = () => {
    if (!selected.startsWith("saved:")) return
    const name = selected.slice("saved:".length)
    const next = removeQuery(savedQueries, name)
    saveSavedQueries(next)
    setSavedQueries(loadSavedQueries())
    setSelected("")
  }

  const handleRun = async () => {
    if (!query.trim()) return
    if (!config.apiKey) {
      setError(`Configure ${SITE_LABELS[selectedSite]} API key first`)
      return
    }
    setRunning(true)
    setError(null)
    setRawResult(null)
    setRows(null)
    try {
      const response = await api.executeNewRelicQuery(config, query.trim())
      setRawResult(response)
      const extracted = extractRows(response)
      setRows(extracted)
      // Non-tabular responses (e.g. NRQL errors) fall back to the JSON view.
      setView(extracted ? "table" : "json")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed")
    } finally {
      setRunning(false)
    }
  }

  const handleDownloadCsv = () => {
    if (!rows || rows.length === 0) return
    const csv = buildCsv(rows, deriveColumns(rows))
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = csvFilename(new Date())
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const hasRows = !!rows && rows.length > 0

  return (
    <div className="aurora-panel space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="aurora-text text-sm font-semibold">Custom NRQL Query</h3>
        <div className="inline-flex gap-1.5">
          {(["lampsplus", "adobe"] as const).map((site) => (
            <button
              key={site}
              className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
              style={{
                border: `1px solid ${selectedSite === site ? "var(--lcc-amber)" : "var(--glass-border)"}`,
                backgroundColor: selectedSite === site ? "var(--lcc-amber)" : "transparent",
                color: selectedSite === site ? "#000" : "var(--lcc-text-dim)",
              }}
              onClick={() => setSelectedSite(site)}
            >
              {SITE_LABELS[site]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <select
          className="aurora-select min-w-[200px] flex-1"
          value={selected}
          onChange={(e) => handleSelectChange(e.target.value)}
        >
          <option value="">Load a query...</option>
          {Object.entries(SAMPLE_QUERIES).map(([key, preset]) => (
            <option key={key} value={`preset:${key}`}>
              {preset.label}
            </option>
          ))}
          {savedQueries.length > 0 && (
            <>
              <option value="" disabled>
                -- Saved --
              </option>
              {savedQueries.map((saved) => (
                <option key={saved.name} value={`saved:${saved.name}`}>
                  {saved.name}
                </option>
              ))}
            </>
          )}
        </select>
        <input
          className="aurora-input w-40"
          value={queryName}
          onChange={(e) => setQueryName(e.target.value)}
          placeholder="Query name..."
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleSaveQuery}
          disabled={!queryName.trim() || !query.trim()}
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </Button>
        {selected.startsWith("saved:") && (
          <Button variant="destructive" size="sm" onClick={handleDeleteQuery}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>
      <div className="space-y-1.5">
        <label className="aurora-label block">NRQL Query</label>
        <NrqlEditor
          value={query}
          onChange={setQuery}
          placeholder="SELECT ... FROM ... SINCE ..."
        />
      </div>
      <Button onClick={handleRun} disabled={running || !query.trim()} style={{ color: "#000" }}>
        <Play className="h-4 w-4" />
        {running ? "Running..." : "Run Query"}
      </Button>
      {error && <p className="text-sm" style={{ color: "var(--lcc-red)" }}>{error}</p>}

      {rawResult && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="inline-flex gap-1.5">
              {(["table", "json"] as const).map((mode) => (
                <button
                  key={mode}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                  style={{
                    border: `1px solid ${view === mode ? "var(--lcc-amber)" : "var(--glass-border)"}`,
                    backgroundColor: view === mode ? "var(--lcc-amber)" : "transparent",
                    color: view === mode ? "#000" : "var(--lcc-text-dim)",
                  }}
                  onClick={() => setView(mode)}
                >
                  {mode === "table" ? "Table" : "JSON"}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={handleDownloadCsv}
              disabled={!hasRows}
            >
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          </div>

          {view === "table" && rows ? (
            <NerdGraphResultsTable results={rows} />
          ) : (
            <pre className="aurora-pre max-h-[300px]">
              {JSON.stringify(rawResult, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify it typechecks and builds**

Run (from `frontend/`): `npm run build`
Expected: PASS — no TypeScript or build errors. Confirms `Save`/`Trash2` are valid `lucide-react` exports and `Button` accepts `variant="destructive"` / `size="sm"`.

- [ ] **Step 3: Run the full test suite**

Run (from `frontend/`): `npm run test`
Expected: PASS — Task 1 tests plus all pre-existing tests green. (Three pre-existing empty-`.mjs` "No test suite found" failures are unrelated and may appear; no new failures.)

- [ ] **Step 4: Manual verification in the dev server**

This flow needs no New Relic API key (saving/loading is local). Start the frontend (`npm run dev`), open the New Relic page, find the Custom NRQL Query panel, and confirm:
  1. The dropdown shows "Load a query...", "APM Sample", "Browser Sample" (the old buttons are gone).
  2. Selecting "APM Sample" populates the editor.
  3. Type a name, click **Save** → the name appears under a "-- Saved --" separator in the dropdown.
  4. Reload the page → the saved query is still in the dropdown (localStorage persisted).
  5. Select the saved query → editor loads its text; a **Delete** button appears.
  6. Re-type the editor, **Save** under the same name → no duplicate; selecting it loads the new text.
  7. Click **Delete** → it disappears from the dropdown and the Delete button hides.
  8. Save button is disabled when the name field or the editor is empty.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/newrelic/CustomQuery.tsx
git commit -m "Add saved-query dropdown to Custom NerdGraph query"
```

Include the trailer in the commit body: `Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>`

---

## Self-Review

**Spec coverage:**
- Global flat list in localStorage `nrSavedQueries` → Task 1 (`STORAGE_KEY`, `SavedQuery[]`). ✓
- `loadSavedQueries` tolerant of missing/corrupt/wrong-shape → Task 1 `parseSavedQueries` (+ wrapper). ✓
- `upsertQuery` add/overwrite-by-trimmed-name, no mutation → Task 1. ✓
- `removeQuery` no mutation → Task 1. ✓
- Combined preset+saved `<select>` with disabled separator; presets replace the two sample buttons → Task 2. ✓
- Name input + Save (disabled unless name & query non-empty) → Task 2. ✓
- Delete shown only for `saved:` selection → Task 2. ✓
- Selecting blank option leaves editor unchanged → Task 2 (`handleSelectChange` only sets query for `preset:`/`saved:`). ✓
- No backend changes → no backend files. ✓

**Placeholder scan:** none — every step has complete code.

**Type consistency:** `SavedQuery { name, query }` defined in Task 1, imported in Task 2. Helper names (`parseSavedQueries`, `upsertQuery`, `removeQuery`, `loadSavedQueries`, `saveSavedQueries`) consistent across tasks. `selected` value scheme (`""` / `preset:<key>` / `saved:<name>`) used consistently in `handleSelectChange`, `handleSaveQuery`, `handleDeleteQuery`, and the `<select>`/Delete JSX.
