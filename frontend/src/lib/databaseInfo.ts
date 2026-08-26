export type DatabaseSheetFilter = "All" | string

export interface DatabaseMappingRow {
  sheet: string
  legacyDatabase: string
  legacyTable: string
  legacyColumn: string
  acDataDatabase: string
  acDataTable: string
  acDataColumn: string
  commerceTable: string
  commerceColumn: string
}

const searchableFields: Array<keyof DatabaseMappingRow> = [
  "sheet",
  "legacyDatabase",
  "legacyTable",
  "legacyColumn",
  "acDataDatabase",
  "acDataTable",
  "acDataColumn",
  "commerceTable",
  "commerceColumn",
]

export function filterDatabaseMappings(
  rows: readonly DatabaseMappingRow[],
  query: string,
  sheet: DatabaseSheetFilter,
): DatabaseMappingRow[] {
  const normalizedQuery = query.trim().toLowerCase()

  return rows.filter((row) => {
    if (sheet !== "All" && row.sheet !== sheet) {
      return false
    }

    if (!normalizedQuery) {
      return true
    }

    return searchableFields.some((field) => row[field].toLowerCase().includes(normalizedQuery))
  })
}
