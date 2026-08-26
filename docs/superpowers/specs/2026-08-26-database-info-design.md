# Database Info Design

## Goal

Add a Migration navigation page named Database Info that lets Pharos users browse the ACLP database mapping spreadsheet without opening Excel.

## Scope

- Add a `/database-info` React route under the Migration sidebar group.
- Convert `C:/Users/AdamB/Documents/ACLPDatabaseMappings.xlsx` into an app-owned typed data module.
- Display mapping rows from all workbook sheets: Orders, Customers, Cart, Company.
- Filter rows by database, table, column, or sheet/category with one search field.
- Keep the feature frontend-only. No backend endpoint or database migration is needed.

## Data Shape

Each row represents one mapping line:

- `sheet`
- `legacyDatabase`
- `legacyTable`
- `legacyColumn`
- `acDataDatabase`
- `acDataTable`
- `acDataColumn`
- `commerceTable`
- `commerceColumn`

Workbook row 1 contains grouped headings, row 2 contains per-column labels, and data starts on row 3.

## UI

The page uses the existing Pharos product UI register: dense, calm, table-first.

- Header: `Database Info`, with a concise description.
- Action area: total rows, visible rows, and active sheet count.
- Search: a full-width search input with a clear button.
- Sheet tabs: All, Orders, Customers, Cart, Company.
- Table: three mapping groups (WUP, ACData, Adobe Commerce) with database/table/column values.
- Empty state: shown when search and sheet filters match no rows.

## Testing

Add unit coverage for the pure search/filter helper:

- Empty query returns all scoped rows.
- Query matches database, table, column, and sheet values.
- Sheet filter limits results before search matching.
