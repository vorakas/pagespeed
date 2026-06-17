# Custom NerdGraph Query — Table View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render Custom NerdGraph (NRQL) query results as a resizable table by default, with a JSON fallback view and a CSV export of the displayed rows.

**Architecture:** Pure, unit-tested helpers (column derivation, cell/CSV formatting, CSV assembly, filename) live in `frontend/src/lib/nerdgraphTable.ts`. A presentational `NerdGraphResultsTable` component renders the table and owns interactive column resizing. `CustomQuery.tsx` orchestrates: it stores the parsed result, owns the Table/JSON toggle (Table default), wires the CSV download, and auto-falls back to JSON when the response is not tabular.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind 4, Aurora CSS tokens, Vitest.

---

## File Structure

- **Create** `frontend/src/lib/nerdgraphTable.ts` — pure helpers + `ResultRow` type. No React.
- **Create** `frontend/src/lib/nerdgraphTable.test.ts` — Vitest unit tests for the helpers.
- **Create** `frontend/src/components/newrelic/NerdGraphResultsTable.tsx` — presentational table with column resizing.
- **Modify** `frontend/src/components/newrelic/CustomQuery.tsx` — view state, toggle, CSV button, auto-fallback.

## Background facts (verified)

- `api.executeNewRelicQuery(config, query)` returns the full envelope `{ success: true, data: { results: [...] } }`. On NRQL rejection the payload is `{ data: { errors: [...] } }`. Rows therefore live at `response.data.results`.
- Existing tables use the `.aurora-table` class (defined in `frontend/src/styles/aurora.css:2202`), which sets `width: 100%; border-collapse: collapse`. For resizing we override to `table-layout: fixed; width: auto` inline and drive widths with a `<colgroup>`.
- Aurora tokens that exist: `--lcc-text`, `--lcc-text-dim`, `--lcc-text-faint`, `--lcc-red`, `--lcc-amber`, `--glass-border`. (There is **no** `--lcc-border` / `--lcc-surface` token — do not use them.)
- Test command (run from `frontend/`): `npm run test`. Build check: `npm run build`.

---

## Task 1: Pure helpers + unit tests

**Files:**
- Create: `frontend/src/lib/nerdgraphTable.ts`
- Test: `frontend/src/lib/nerdgraphTable.test.ts`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/lib/nerdgraphTable.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  buildCsv,
  csvFilename,
  deriveColumns,
  formatCellValue,
  formatCsvValue,
} from "./nerdgraphTable"

describe("deriveColumns", () => {
  it("returns the first-seen union of keys across rows", () => {
    const rows = [{ a: 1, b: 2 }, { b: 3, c: 4 }]
    expect(deriveColumns(rows)).toEqual(["a", "b", "c"])
  })

  it("places facet first when present", () => {
    const rows = [{ count: 9, facet: "home" }]
    expect(deriveColumns(rows)).toEqual(["facet", "count"])
  })

  it("returns an empty array for no rows", () => {
    expect(deriveColumns([])).toEqual([])
  })
})

describe("formatCellValue", () => {
  it("renders primitives as strings", () => {
    expect(formatCellValue(42)).toBe("42")
    expect(formatCellValue("x")).toBe("x")
    expect(formatCellValue(true)).toBe("true")
  })

  it("renders null and undefined as an em dash", () => {
    expect(formatCellValue(null)).toBe("—")
    expect(formatCellValue(undefined)).toBe("—")
  })

  it("stringifies nested objects and arrays", () => {
    expect(formatCellValue({ a: 1 })).toBe('{"a":1}')
    expect(formatCellValue([1, 2])).toBe("[1,2]")
  })
})

describe("formatCsvValue", () => {
  it("renders null and undefined as empty string", () => {
    expect(formatCsvValue(null)).toBe("")
    expect(formatCsvValue(undefined)).toBe("")
  })

  it("stringifies nested values like cells do", () => {
    expect(formatCsvValue({ a: 1 })).toBe('{"a":1}')
  })
})

describe("buildCsv", () => {
  it("builds a header row plus one row per result, CRLF separated", () => {
    const rows = [{ facet: "home", count: 9 }]
    const csv = buildCsv(rows, ["facet", "count"])
    expect(csv).toBe("facet,count\r\nhome,9")
  })

  it("escapes fields containing commas, quotes, and newlines", () => {
    const rows = [{ a: 'x,y', b: 'he said "hi"', c: "line1\nline2" }]
    const csv = buildCsv(rows, ["a", "b", "c"])
    expect(csv).toBe('a,b,c\r\n"x,y","he said ""hi""","line1\nline2"')
  })
})

describe("csvFilename", () => {
  it("formats a zero-padded timestamp", () => {
    const date = new Date(2026, 5, 17, 9, 8, 7) // 2026-06-17 09:08:07 local
    expect(csvFilename(date)).toBe("nerdgraph-results-20260617-090807.csv")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from `frontend/`): `npm run test -- nerdgraphTable`
Expected: FAIL — module `./nerdgraphTable` not found / exports undefined.

- [ ] **Step 3: Write the implementation**

Create `frontend/src/lib/nerdgraphTable.ts`:

```ts
export type ResultRow = Record<string, unknown>

/** Ordered union of keys across all rows (first-seen order); `facet` first if present. */
export function deriveColumns(results: ResultRow[]): string[] {
  const seen = new Set<string>()
  const columns: string[] = []
  for (const row of results) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key)
        columns.push(key)
      }
    }
  }
  if (seen.has("facet")) {
    return ["facet", ...columns.filter((column) => column !== "facet")]
  }
  return columns
}

function stringifyNested(value: unknown): string {
  return typeof value === "object" ? JSON.stringify(value) : String(value)
}

/** Display formatting for a table cell. Null/undefined render as an em dash. */
export function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  return stringifyNested(value)
}

/** CSV formatting for a value. Null/undefined render as empty; nested values match cells. */
export function formatCsvValue(value: unknown): string {
  if (value === null || value === undefined) return ""
  return stringifyNested(value)
}

/** RFC-4180 field escaping: quote fields containing comma, quote, CR, or LF. */
function escapeCsvField(field: string): string {
  if (/[",\r\n]/.test(field)) {
    return `"${field.replace(/"/g, '""')}"`
  }
  return field
}

/** Build a CSV string from rows and an explicit column order. */
export function buildCsv(results: ResultRow[], columns: string[]): string {
  const header = columns.map(escapeCsvField).join(",")
  const lines = results.map((row) =>
    columns.map((column) => escapeCsvField(formatCsvValue(row[column]))).join(","),
  )
  return [header, ...lines].join("\r\n")
}

/** Timestamped download filename, e.g. nerdgraph-results-20260617-090807.csv */
export function csvFilename(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0")
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `nerdgraph-results-${stamp}.csv`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run (from `frontend/`): `npm run test -- nerdgraphTable`
Expected: PASS — all cases green.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/nerdgraphTable.ts frontend/src/lib/nerdgraphTable.test.ts
git commit -m "Add NerdGraph results table helpers"
```

---

## Task 2: NerdGraphResultsTable component

**Files:**
- Create: `frontend/src/components/newrelic/NerdGraphResultsTable.tsx`

Interactive resizing is verified manually (the project has no DOM test harness). Correctness of the pure logic it depends on is already covered by Task 1.

- [ ] **Step 1: Write the component**

Create `frontend/src/components/newrelic/NerdGraphResultsTable.tsx`:

```tsx
import { useEffect, useRef, useState } from "react"

import { deriveColumns, formatCellValue, type ResultRow } from "@/lib/nerdgraphTable"

const DEFAULT_COLUMN_WIDTH = 160
const MIN_COLUMN_WIDTH = 60

interface NerdGraphResultsTableProps {
  results: ResultRow[]
}

export function NerdGraphResultsTable({ results }: NerdGraphResultsTableProps) {
  const columns = deriveColumns(results)
  const columnKey = columns.join("|")
  const [widths, setWidths] = useState<Record<string, number>>({})
  const dragState = useRef<{ column: string; startX: number; startWidth: number } | null>(null)

  // Reset widths whenever the column set changes (a new query shape).
  useEffect(() => {
    setWidths({})
  }, [columnKey])

  // Track drag at the window level so the pointer can leave the handle.
  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const drag = dragState.current
      if (!drag) return
      const next = Math.max(MIN_COLUMN_WIDTH, drag.startWidth + (event.clientX - drag.startX))
      setWidths((prev) => ({ ...prev, [drag.column]: next }))
    }
    const handleUp = () => {
      dragState.current = null
    }
    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
    return () => {
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
    }
  }, [])

  if (results.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--lcc-text-dim)" }}>
        No rows returned.
      </p>
    )
  }

  const widthOf = (column: string) => widths[column] ?? DEFAULT_COLUMN_WIDTH

  const startResize = (column: string, event: React.MouseEvent) => {
    event.preventDefault()
    dragState.current = { column, startX: event.clientX, startWidth: widthOf(column) }
  }

  return (
    <div className="max-h-[300px] overflow-auto">
      <table className="aurora-table" style={{ tableLayout: "fixed", width: "auto" }}>
        <colgroup>
          {columns.map((column) => (
            <col key={column} style={{ width: widthOf(column) }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} className="relative" style={{ overflow: "hidden" }}>
                <span className="block truncate pr-2" title={column}>
                  {column}
                </span>
                <span
                  onMouseDown={(event) => startResize(column, event)}
                  className="absolute right-0 top-0 h-full"
                  style={{ width: 6, cursor: "col-resize", userSelect: "none" }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => {
                const text = formatCellValue(row[column])
                return (
                  <td
                    key={column}
                    title={text}
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {text}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Verify it typechecks and builds**

Run (from `frontend/`): `npm run build`
Expected: PASS — no TypeScript or build errors. (The component is not yet rendered anywhere; this only confirms it compiles.)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/newrelic/NerdGraphResultsTable.tsx
git commit -m "Add NerdGraphResultsTable component"
```

---

## Task 3: Wire table + JSON toggle + CSV export into CustomQuery

**Files:**
- Modify: `frontend/src/components/newrelic/CustomQuery.tsx`

The full current file is reproduced in the final replacement below — apply it as a whole-file rewrite so the imports, state, and JSX stay consistent.

- [ ] **Step 1: Replace the component**

Replace the entire contents of `frontend/src/components/newrelic/CustomQuery.tsx` with:

```tsx
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Play } from "lucide-react"
import { NrqlEditor } from "@/components/newrelic/NrqlEditor"
import { NerdGraphResultsTable } from "@/components/newrelic/NerdGraphResultsTable"
import { buildCsv, csvFilename, deriveColumns, type ResultRow } from "@/lib/nerdgraphTable"
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

const SAMPLE_QUERIES: Record<string, string> = {
  apm: "SELECT average(duration), count(*) FROM Transaction WHERE appName = 'YourApp' FACET name SINCE 1 hour ago",
  browser:
    "SELECT average(pageRenderingDuration), average(domProcessingDuration) FROM PageView SINCE 1 hour ago",
}

/** Pull the row array out of the API envelope, or null when the response is not tabular. */
function extractRows(response: Record<string, unknown>): ResultRow[] | null {
  const payload = (response?.data ?? {}) as { results?: unknown }
  return Array.isArray(payload.results) ? (payload.results as ResultRow[]) : null
}

export function CustomQuery({ configs, activeSite }: CustomQueryProps) {
  const [selectedSite, setSelectedSite] = useState<SiteKey>(activeSite ?? "lampsplus")
  const [query, setQuery] = useState("")
  const [rawResult, setRawResult] = useState<Record<string, unknown> | null>(null)
  const [rows, setRows] = useState<ResultRow[] | null>(null)
  const [view, setView] = useState<ResultView>("table")
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const config = configs[selectedSite]

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
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="xs"
          onClick={() => setQuery(SAMPLE_QUERIES.apm)}
        >
          APM Sample
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={() => setQuery(SAMPLE_QUERIES.browser)}
        >
          Browser Sample
        </Button>
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
Expected: PASS — no TypeScript or build errors.

- [ ] **Step 3: Run the full test suite**

Run (from `frontend/`): `npm run test`
Expected: PASS — Task 1 tests plus all pre-existing tests green.

- [ ] **Step 4: Manual verification in the dev server**

Start the frontend (`npm run dev`), open the New Relic page, configure an API key, and confirm:
  1. Faceted query (use the APM Sample, adjust `appName`) → table renders, `facet` column first.
  2. Aggregate query (no FACET) → single row.
  3. `SELECT * FROM Transaction SINCE 1 hour ago LIMIT 10` → many rows; any nested field shows as stringified JSON.
  4. Empty result → "No rows returned." inside the table view.
  5. Invalid NRQL → view auto-switches to JSON, error/`errors` visible, no broken table.
  6. Toggle Table ↔ JSON → last result preserved in both views.
  7. Drag a column's right edge → width changes, clamps at the 60px minimum; run a new query with a different shape → widths reset.
  8. Download CSV → file opens in a spreadsheet with correct columns; values containing commas/quotes are intact.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/newrelic/CustomQuery.tsx
git commit -m "Add table view and CSV export to Custom NerdGraph query"
```

---

## Self-Review

**Spec coverage:**
- Table default + JSON fallback → Task 3 (`view` defaults to `"table"`; JSON via `<pre>`). ✓
- Column derivation (union, facet-first) → Task 1 `deriveColumns`. ✓
- Cell formatting (primitives / null em dash / nested stringified) → Task 1 `formatCellValue`. ✓
- Column resizing (fixed layout, min clamp, reset on shape change, per-session) → Task 2. ✓
- CSV export (displayed rows, RFC-4180 escaping, Blob download, timestamped filename) → Task 1 `buildCsv`/`csvFilename` + Task 3 `handleDownloadCsv`. ✓
- Empty / errors / non-tabular fallbacks → Task 2 empty state + Task 3 `extractRows`/`setView`. ✓
- Aurora styling + horizontal/vertical scroll → Task 2 (`aurora-table`, `overflow-auto`, `max-h-[300px]`). ✓
- Backend untouched → no backend files in plan. ✓

**Placeholder scan:** none — every code step is complete.

**Type consistency:** `ResultRow` defined in Task 1, imported in Tasks 2–3. Helper names (`deriveColumns`, `formatCellValue`, `formatCsvValue`, `buildCsv`, `csvFilename`) consistent across tasks. `extractRows` returns `ResultRow[] | null`, matching `rows` state and `NerdGraphResultsTable`'s `results: ResultRow[]` prop (only rendered when `rows` is non-null).
