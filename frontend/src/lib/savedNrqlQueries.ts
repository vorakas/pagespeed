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
