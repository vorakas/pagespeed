# Custom NerdGraph Query — Table View Design

**Date:** 2026-06-17
**Status:** Approved
**Scope:** Frontend only. No backend changes.

## Problem

The New Relic → Custom NRQL Query feature renders results only as pretty-printed
JSON in a `<pre>` block ([CustomQuery.tsx:104](../../../frontend/src/components/newrelic/CustomQuery.tsx)).
New Relic's own UI shows query results in a table. Users want the same tabular
view here, with JSON kept as a fallback.

## Goal

Render `results` as a resizable table by default, with a toggle back to the raw
JSON view and a CSV export of the displayed rows.

## Data Shape

The backend returns `{ results: [...] }` (see
[newrelic_client.py:108](../../../services/newrelic_client.py)). `executeNewRelicQuery`
resolves to this object. Each item in `results` is one row.

- Faceted query (`FACET name`) → `{ facet: "...", "average.duration": 12, count: 99 }`
- Aggregate (no facet) → a single object → one row
- Raw events (`SELECT * FROM Transaction`) → one object per event
- NerdGraph rejection → response carries `errors` instead of `results`

## Components

### `NerdGraphResultsTable.tsx` (new)

Single purpose: take a `results` array and render an HTML table.

- **Props:** `results: Record<string, unknown>[]`
- **Columns:** ordered union of keys across all `results` objects, first-seen
  order. If a `facet` key exists, it is placed first.
- **Cell formatting:**
  - primitives (string/number/boolean) → rendered as-is
  - `null` / `undefined` → em dash (`—`)
  - objects/arrays → `JSON.stringify(value)` (stringify in-cell)
- **Column resizing:**
  - `table-layout: fixed`; explicit per-column widths honored.
  - Each `<th>` has a drag handle on its right edge. Mousedown tracks pointer
    delta and updates that column's width in a `widths` state map keyed by
    column name.
  - Default width per column on first render. Min width clamp (~60px).
  - Widths reset when the column set changes (i.e., a new query shape).
  - Persistence: per-session component state only; not saved to localStorage.
- **Empty state:** `results` empty → "No rows returned."
- **Styling:** Aurora tokens (`--lcc-border`, `--lcc-text-dim`, etc.), matching
  existing tables. Horizontal scroll wrapper for wide result sets. Reuse the
  `max-h-[300px]` scroll constraint for vertical overflow.

### `CustomQuery.tsx` (modified)

Owns view state, the parsed result, the toggle, and the CSV export button.

- Keep the parsed result object in state (in addition to / instead of the
  stringified form) so the table can consume `results` directly.
- **View toggle:** small `Table | JSON` segmented control in the panel header.
  **Table is the default.** JSON view reuses the existing `<pre>` block.
- **Auto-fallback:** if the response has no `results` array (non-tabular or
  `errors` present), show the JSON/error view instead of an empty table.
- **CSV export:** "Download CSV" button in the panel header, enabled only when
  there are rows.

## CSV Export

Frontend-only. Scope = current result set as displayed (no re-query).

- Built from the same columns + rows the table uses; nested values stringified
  identically to cells.
- RFC-4180 escaping: fields containing `,`, `"`, or newlines are wrapped in
  double quotes; interior `"` doubled.
- Download via Blob + object URL. Filename: `nerdgraph-results-<yyyymmdd-hhmmss>.csv`.

## Error / Edge Handling

| Case | Behavior |
|------|----------|
| `results` empty array | Table shows "No rows returned." |
| Response has `errors` | Show error text (existing `error` path). |
| Non-array / non-tabular data | Auto-fallback to JSON view. |
| Nested object/array cell | Stringified JSON in-cell. |
| Wide table | Horizontal scroll wrapper. |

## Out of Scope (YAGNI)

- Sorting
- Pagination
- Column reordering
- Persisting column widths across sessions
- Backend changes
- Numeric/unit formatting beyond raw values

## Testing

Manual (project has no automated suite). Verify against the local frontend with
sample queries:

1. Faceted query → multiple columns, `facet` first, rows render.
2. Aggregate query → single row.
3. `SELECT *` → many rows, nested fields stringified.
4. Empty result → "No rows returned."
5. Invalid NRQL → error text, no broken table.
6. Toggle Table ↔ JSON preserves the last result.
7. Drag a column border → width changes, clamps at min, resets on new query.
8. Download CSV → file opens in a spreadsheet with correct columns, escaping
   intact for values containing commas/quotes.
