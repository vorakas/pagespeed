import { describe, expect, it } from "vitest"

import { databaseMappings } from "@/data/databaseMappings"
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

  it("includes Customers mappings from the workbook", () => {
    const customerRows = filterDatabaseMappings(databaseMappings, "", "Customers")

    expect(customerRows).toHaveLength(54)
    expect(customerRows[0]?.sheet).toBe("Customers")
  })
})
