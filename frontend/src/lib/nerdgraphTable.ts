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
