/**
 * Generates a formatted .xlsx regression tracking spreadsheet
 * from build test results (failed + skipped tests).
 *
 * Matches the structure used in the QA team's Google Sheets tracker:
 *   - Blue header rows with column names
 *   - Grey merged section headers for each platform/type/status group
 *   - Data rows with View, Type, TC URL (hyperlink), Automation Status
 *   - Columns E-I left blank for manual QA entry
 */

import * as XLSX from "xlsx"
import type { FailedTest, SkippedTest } from "@/types"

// ---------- Types ----------

export interface SheetEntry {
  roleKey: string
  platform: string
  type: string
  failed: FailedTest[]
  skipped: SkippedTest[]
}

// ---------- Constants ----------

const ZEPHYR_BASE_URL = "https://lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/LP-"

const HEADER_ROW_1 = ["View", "Type", "TC URL", "Automation", "Manual", "Assign QA", "Task URL (Rework / Bug / Update Test Case task)", "InfoGain Comments", "Corporate Response"]
const HEADER_ROW_2 = ["", "", "", "Execution Status", "Execution Status", "", "", "", ""]

/** Platform order used throughout the spreadsheet. */
const PLATFORMS = ["Windows", "Mac", "iPhone", "Android"] as const

/** Column widths matching the example spreadsheet. */
const COLUMN_WIDTHS = [
  { wch: 10 },  // A: View
  { wch: 12 },  // B: Type
  { wch: 62 },  // C: TC URL
  { wch: 16 },  // D: Automation
  { wch: 16 },  // E: Manual
  { wch: 14 },  // F: Assign QA
  { wch: 50 },  // G: Task URL
  { wch: 50 },  // H: InfoGain Comments
  { wch: 30 },  // I: Corporate Response
]

// ---------- Helpers ----------

/** Extract platform name from a roleKey like "Windows_Functional" or "WarmUp". */
function parsePlatform(roleKey: string): string {
  if (roleKey === "WarmUp") return "Windows"
  return roleKey.split("_")[0]
}

/** Extract type from a roleKey. */
function parseType(roleKey: string): string {
  if (roleKey === "WarmUp") return "Warmup"
  return roleKey.split("_")[1] || "Functional"
}

/** Build the Zephyr test case URL from a test ID. */
function buildTcUrl(testId: string): string {
  return `${ZEPHYR_BASE_URL}${testId}`
}

/** Create a grey merged section header row. */
function makeSectionHeader(title: string): string[] {
  return [title, "", "", "", "", "", "", "", ""]
}

/** Create a data row for a test. */
function makeDataRow(platform: string, type: string, testId: string, status: "Skipped" | "Failed"): string[] {
  return [platform, type, buildTcUrl(testId), status, "", "", "", "", ""]
}

// ---------- Main Export Function ----------

/**
 * Generate an xlsx workbook Blob from collected sheet data.
 *
 * @param releaseName  Tab/sheet name (e.g. "LPv310.0")
 * @param entries      Map of roleKey → SheetEntry with failed/skipped tests
 * @returns            Blob of the .xlsx file ready for download
 */
export function generateSpreadsheet(
  releaseName: string,
  entries: Map<string, SheetEntry>
): Blob {
  const rows: string[][] = []

  // Row 1-2: Headers
  rows.push(HEADER_ROW_1)
  rows.push(HEADER_ROW_2)

  // ---------- Skipped sections ----------

  // Functional Skipped (Windows, Mac, iPhone, Android)
  for (const platform of PLATFORMS) {
    const key = `${platform}_Functional`
    const entry = entries.get(key)
    rows.push(makeSectionHeader(`${platform} Functional Skipped`))
    if (entry) {
      for (const test of entry.skipped) {
        rows.push(makeDataRow(platform, "Functional", test.testId, "Skipped"))
      }
    }
  }

  // Visual Skipped (Windows, Mac, iPhone, Android)
  for (const platform of PLATFORMS) {
    const key = `${platform}_Visual`
    const entry = entries.get(key)
    rows.push(makeSectionHeader(`${platform} Visual Skipped`))
    if (entry) {
      for (const test of entry.skipped) {
        rows.push(makeDataRow(platform, "Visual", test.testId, "Skipped"))
      }
    }
  }

  // ---------- Failed sections ----------

  // Warmup Failures
  const warmupEntry = entries.get("WarmUp")
  rows.push(makeSectionHeader("Automated Functional Warmup Failures"))
  if (warmupEntry) {
    for (const test of warmupEntry.failed) {
      rows.push(makeDataRow("Windows", "Warmup", test.testId, "Failed"))
    }
  }

  // Functional Failed (Windows, Mac, iPhone, Android)
  for (const platform of PLATFORMS) {
    const key = `${platform}_Functional`
    const entry = entries.get(key)
    rows.push(makeSectionHeader(`Automated Functional ${platform} Failures`))
    if (entry) {
      for (const test of entry.failed) {
        rows.push(makeDataRow(platform, "Functional", test.testId, "Failed"))
      }
    }
  }

  // Visual Failed (Windows, Mac, iPhone, Android)
  for (const platform of PLATFORMS) {
    const key = `${platform}_Visual`
    const entry = entries.get(key)
    rows.push(makeSectionHeader(`Automated Visual ${platform} Failed`))
    if (entry) {
      for (const test of entry.failed) {
        rows.push(makeDataRow(platform, "Visual", test.testId, "Failed"))
      }
    }
  }

  // ---------- Unresolved sections (empty placeholders) ----------
  for (const platform of PLATFORMS) {
    rows.push(makeSectionHeader(`Automated ${platform} Unresolved`))
  }

  // ---------- Manual Execution (empty placeholder) ----------
  rows.push(makeSectionHeader("Manual Execution"))

  // ---------- Build workbook ----------

  const worksheet = XLSX.utils.aoa_to_sheet(rows)

  // Column widths
  worksheet["!cols"] = COLUMN_WIDTHS

  // Track which rows are section headers for styling
  const sectionHeaderRows: number[] = []
  let currentRow = 0
  for (const row of rows) {
    if (currentRow >= 2 && row[1] === "" && row[2] === "" && row[0] !== "") {
      sectionHeaderRows.push(currentRow)
    }
    currentRow++
  }

  // Merge section header cells (A:I) and apply styles
  const merges: XLSX.Range[] = [
    // Header merges (row 1-2 column merges for certain columns)
    { s: { r: 0, c: 0 }, e: { r: 1, c: 0 } },  // A1:A2
    { s: { r: 0, c: 1 }, e: { r: 1, c: 1 } },  // B1:B2
    { s: { r: 0, c: 2 }, e: { r: 1, c: 2 } },  // C1:C2
    { s: { r: 0, c: 5 }, e: { r: 1, c: 5 } },  // F1:F2
    { s: { r: 0, c: 6 }, e: { r: 1, c: 6 } },  // G1:G2
    { s: { r: 0, c: 7 }, e: { r: 1, c: 7 } },  // H1:H2
    { s: { r: 0, c: 8 }, e: { r: 1, c: 8 } },  // I1:I2
  ]

  // Merge section header rows (A:I)
  for (const rowIdx of sectionHeaderRows) {
    merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx, c: 8 } })
  }

  worksheet["!merges"] = merges

  // Add hyperlinks to TC URL cells (column C, starting from row 3)
  for (let r = 2; r < rows.length; r++) {
    const cellRef = XLSX.utils.encode_cell({ r, c: 2 })
    const cell = worksheet[cellRef]
    if (cell && typeof cell.v === "string" && cell.v.startsWith("https://")) {
      cell.l = { Target: cell.v, Tooltip: cell.v }
    }
  }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, releaseName || "Regression")

  const arrayBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" })
  return new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
}

/**
 * Trigger a browser download of the spreadsheet blob.
 */
export function downloadSpreadsheet(blob: Blob, releaseName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = `${releaseName || "Regression"}_Results.xlsx`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
