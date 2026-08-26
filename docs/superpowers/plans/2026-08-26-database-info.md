# Database Info Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Migration page that displays the ACLP database mapping spreadsheet in Pharos with search by database, table, column, or sheet.

**Architecture:** Convert the workbook to a committed typed data asset, keep filtering in a pure TypeScript helper, and render a frontend-only page using the existing AppLayout and sidebar conventions. No Flask route or persistence change is required.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, lucide-react, existing Pharos UI components.

---

### Task 1: Search Helper

**Files:**
- Create: `frontend/src/lib/databaseInfo.ts`
- Test: `frontend/src/lib/databaseInfo.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest"
import { filterDatabaseMappings, type DatabaseMappingRow } from "./databaseInfo"

const rows: DatabaseMappingRow[] = [
  {
    sheet: "Orders",
    legacyDatabase: "DomExportOrder",
    legacyTable: "tblDomExportOrderHeader",
    legacyColumn: "OrderId",
    acDataDatabase: "ACData",
    acDataTable: "OrderHeaderData",
    acDataColumn: "order_id",
    commerceTable: "sales_order",
    commerceColumn: "increment_id",
  },
  {
    sheet: "Company",
    legacyDatabase: "UserProfile",
    legacyTable: "tblCompany",
    legacyColumn: "CompanyName",
    acDataDatabase: "ACData",
    acDataTable: "CompanyData",
    acDataColumn: "company_name",
    commerceTable: "company",
    commerceColumn: "company_name",
  },
]

describe("filterDatabaseMappings", () => {
  it("returns all rows for an empty query and all sheet scope", () => {
    expect(filterDatabaseMappings(rows, "", "All")).toEqual(rows)
  })

  it("matches database, table, column, and sheet text", () => {
    expect(filterDatabaseMappings(rows, "increment", "All")).toEqual([rows[0]])
    expect(filterDatabaseMappings(rows, "tblcompany", "All")).toEqual([rows[1]])
    expect(filterDatabaseMappings(rows, "UserProfile", "All")).toEqual([rows[1]])
    expect(filterDatabaseMappings(rows, "orders", "All")).toEqual([rows[0]])
  })

  it("applies sheet scope before query matching", () => {
    expect(filterDatabaseMappings(rows, "ACData", "Company")).toEqual([rows[1]])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/databaseInfo.test.ts`
Expected: FAIL because `frontend/src/lib/databaseInfo.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `DatabaseMappingRow`, `DatabaseSheetFilter`, and `filterDatabaseMappings()`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/databaseInfo.test.ts`
Expected: PASS.

### Task 2: Workbook Data Asset

**Files:**
- Create: `frontend/src/data/databaseMappings.ts`

- [ ] **Step 1: Convert workbook**

Use SheetJS from `frontend/node_modules` to read `C:/Users/AdamB/Documents/ACLPDatabaseMappings.xlsx`, skip the first two rows, map columns A-H to the row shape, and write a typed TypeScript module.

- [ ] **Step 2: Verify generated data**

Print only sheet counts and total row count. Expected sheets: Orders, Customers, Cart, Company.

### Task 3: Page and Route

**Files:**
- Create: `frontend/src/pages/DatabaseInfo.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/AppSidebar.tsx`

- [ ] **Step 1: Add page**

Import the typed data and helper, render search, sheet tabs, summary counts, table, and empty state.

- [ ] **Step 2: Add route**

Lazy-load `DatabaseInfo` in `App.tsx` and add `<Route path="database-info" element={<DatabaseInfo />} />`.

- [ ] **Step 3: Add nav item**

Add `Database Info` to the Migration group in `AppSidebar.tsx`.

### Task 4: Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run focused test**

Run: `npm test -- src/lib/databaseInfo.test.ts`
Expected: PASS.

- [ ] **Step 2: Run full frontend verification**

Run: `npm run typecheck`, `npm run build`, and `npm test`.
Expected: each exits 0.
