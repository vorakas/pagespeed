# Custom NerdGraph Query — Saved Queries Design

**Date:** 2026-06-17
**Status:** Approved
**Scope:** Frontend only. No backend changes.

## Problem

The New Relic → Custom NRQL Query feature lets users type and run a query, but
there is no way to save a query for reuse. Users want to name queries, save
them, and pick a saved query from a dropdown.

## Goal

Let users name and save NRQL queries to a flat, global list (shared across both
sites), select a saved query from a dropdown to load it into the editor, and
delete saved queries. Built-in sample queries fold into the same dropdown.

## Precedent

The IIS Logs `KqlQueryPanel.tsx` already implements saved queries in
localStorage (`kqlProfiles`) with a combined preset/saved `<select>`, a name
input, Save, and Delete. This design mirrors that pattern, minus the profile
grouping (a flat global list, per the chosen scope).

## Decisions

- **Scope:** Global (shared across LampsPlus / Adobe Commerce). The query text is
  site-agnostic; the site is chosen separately at run time.
- **Structure:** Flat named list (no profiles).
- **Storage:** localStorage, consistent with all credentials/config being
  client-side.
- **Samples:** The two existing sample buttons (APM, Browser) are folded into
  the dropdown as built-in presets and removed as standalone buttons.

## Architecture

### `frontend/src/lib/savedNrqlQueries.ts` (new)

A thin localStorage layer plus pure list operations. localStorage key:
`nrSavedQueries`.

```ts
export interface SavedQuery {
  name: string
  query: string
}
```

- `loadSavedQueries(): SavedQuery[]` — read and JSON-parse the key. Tolerate a
  missing key or corrupt/invalid JSON by returning `[]`. Ignore entries that are
  not `{ name, query }` shaped.
- `saveSavedQueries(list: SavedQuery[]): void` — JSON-stringify and persist.
- `upsertQuery(list, name, query): SavedQuery[]` — return a new list with the
  query added, or overwritten when an entry with the same (trimmed) name already
  exists. Name is stored trimmed. Does not mutate the input.
- `removeQuery(list, name): SavedQuery[]` — return a new list without the entry
  matching `name`. Does not mutate the input.

Pure functions (`upsertQuery`, `removeQuery`) and the parse tolerance of
`loadSavedQueries` are unit-tested.

### `frontend/src/components/newrelic/CustomQuery.tsx` (modified)

New state:
- `savedQueries: SavedQuery[]` — seeded from `loadSavedQueries()`.
- `selected: string` — the dropdown's current value (`""`, `preset:<key>`, or
  `saved:<name>`).
- `queryName: string` — the name input value.

New UI, placed between the site toggle and the NRQL editor (replacing the two
sample buttons):

- A `<select className="aurora-select">` with a default `""` → "Load a query…"
  option, then the built-in presets (`preset:apm`, `preset:browser`), then —
  only when `savedQueries` is non-empty — a disabled `-- Saved --` separator
  option followed by one `saved:<name>` option per saved query.
- On change: if value is `preset:<key>`, set `query` to that sample; if
  `saved:<name>`, set `query` to that saved query's text; if `""`, leave the
  editor unchanged. Store the value in `selected`.
- An `aurora-input` bound to `queryName` (placeholder "Query name…").
- A **Save** button (`Save` lucide icon), disabled unless both `queryName.trim()`
  and `query.trim()` are non-empty. On click: `upsertQuery` → `saveSavedQueries`
  → refresh `savedQueries` state from `loadSavedQueries()`; set `selected` to
  `saved:<trimmedName>`.
- A **Delete** button (destructive, `Trash2` icon) shown only when `selected`
  starts with `saved:`. On click: `removeQuery` for the selected name →
  `saveSavedQueries` → refresh state; reset `selected` to `""`.

The existing query-running, result table/JSON toggle, and CSV export are
unchanged.

## Data Flow

All state is client-side. Save/Delete call the pure helpers, persist via
`saveSavedQueries`, then re-read with `loadSavedQueries()` into `savedQueries`
state so the dropdown reflects the change. No server calls.

## Error Handling

| Case | Behavior |
|------|----------|
| localStorage key missing | `loadSavedQueries` returns `[]`. |
| Corrupt / non-array / wrong-shape JSON | `loadSavedQueries` returns `[]` (and drops bad entries). |
| Empty name or empty query | Save button disabled. |
| Re-saving an existing name | Overwrites that entry (no duplicates). |
| Selecting the blank "Load a query…" option | Editor left unchanged. |

## Out of Scope (YAGNI)

- Profiles / grouping.
- Per-site scoping.
- Import/export of saved queries.
- Rename UI (re-saving under a new name + deleting the old is sufficient).
- Backend persistence or sync across browsers.
- Confirmation dialog on delete.

## Testing

Unit (Vitest), `frontend/src/lib/savedNrqlQueries.test.ts`:
1. `loadSavedQueries` returns `[]` when the key is absent.
2. `loadSavedQueries` returns `[]` on corrupt JSON and on a non-array value.
3. `loadSavedQueries` drops entries missing `name` or `query`.
4. `upsertQuery` appends a new entry (name trimmed).
5. `upsertQuery` overwrites an existing same-name entry without adding a
   duplicate.
6. `removeQuery` removes the named entry and leaves others.
7. `upsertQuery` / `removeQuery` do not mutate the input list.

Manual (no DOM harness): in the New Relic page — save a named query, confirm it
appears in the dropdown and survives reload; select it to load the editor;
re-save the same name to overwrite; delete it; confirm presets still load.
