export type ResultRow = Record<string, unknown>

/**
 * The real faceted-attribute keys when NerdGraph's `facet` field merely
 * duplicates them. NerdGraph returns a convenience `facet` value alongside the
 * actual attribute column(s) (e.g. `request.uri`); the New Relic UI hides the
 * duplicate. Returns the attribute key(s) only when the `facet` value is
 * reproduced by other column(s) in every faceted row — otherwise empty, so the
 * `facet` column is kept (e.g. `FACET` on a function, where nothing reproduces it).
 */
function redundantFacetAttributeKeys(results: ResultRow[]): string[] {
  const faceted = results.filter((row) => "facet" in row)
  if (faceted.length === 0) return []

  const first = faceted[0]
  const firstValues = Array.isArray(first.facet) ? first.facet : [first.facet]
  const candidates: string[] = []
  for (const value of firstValues) {
    const key = Object.keys(first).find(
      (candidate) =>
        candidate !== "facet" && !candidates.includes(candidate) && first[candidate] === value,
    )
    if (!key) return [] // facet value not reproduced — keep the facet column
    candidates.push(key)
  }

  for (const row of faceted) {
    const values = Array.isArray(row.facet) ? row.facet : [row.facet]
    if (values.length !== candidates.length) return []
    if (!candidates.every((key, index) => row[key] === values[index])) return []
  }
  return candidates
}

/**
 * Ordered union of keys across all rows (first-seen order). When NerdGraph's
 * `facet` field duplicates the real attribute column(s), the `facet` column is
 * dropped and those attribute(s) lead, matching the New Relic UI. Otherwise a
 * lone `facet` column is placed first.
 */
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

  const facetAttrs = redundantFacetAttributeKeys(results)
  if (facetAttrs.length > 0) {
    const rest = columns.filter((column) => column !== "facet" && !facetAttrs.includes(column))
    return [...facetAttrs, ...rest]
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
