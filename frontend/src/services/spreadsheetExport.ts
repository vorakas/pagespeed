/**
 * Generates a styled .xlsx regression tracking spreadsheet from build
 * test results (failed + skipped tests).
 *
 * Colors and layout match docs/Spreadsheet_Template.xlsx:
 *   - Column header rows (1-2): light-blue fill (#8EB4E3), bold
 *   - Section header rows (merged A:I): grey fill (#BFBFBF), bold
 *   - Data rows: no fill, plain
 *   - Every cell carries a thin black border on all sides
 *
 * Switched from the ``xlsx`` (SheetJS CE) library to ``exceljs`` because
 * the former's free edition does not write cell fills.
 */

import ExcelJS from "exceljs"
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

const HEADER_ROW_1 = [
  "View",
  "Type",
  "TC URL",
  "Automation",
  "Manual",
  "Assign QA",
  "Task URL (Rework / Bug / Update Test Case task)",
  "InfoGain Comments",
  "Corporate Response",
]
const HEADER_ROW_2 = ["", "", "", "Execution Status", "Execution Status", "", "", "", ""]

/** Platform order used throughout the spreadsheet. */
const PLATFORMS = ["Windows", "Mac", "iPhone", "Android"] as const

/** Column widths matching the example spreadsheet. */
const COLUMN_WIDTHS = [10, 12, 62, 16, 16, 14, 50, 50, 30]

// Fill / font constants resolved from the template's theme colors.
// Theme index 3 (#1F497D) + tint +0.60 → #8EB4E3 (column header fill)
// Theme index 0 (#FFFFFF) + tint -0.25 → #BFBFBF (section header fill)
const FILL_COLUMN_HEADER = "FF8EB4E3"
const FILL_SECTION_HEADER = "FFBFBFBF"

const FONT_DEFAULT: Partial<ExcelJS.Font> = { name: "Calibri", size: 10 }
const FONT_HEADER: Partial<ExcelJS.Font> = { name: "Calibri", size: 10, bold: true }

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: "thin" },
  left: { style: "thin" },
  bottom: { style: "thin" },
  right: { style: "thin" },
}

// ---------- Helpers ----------

/** Build the Zephyr test case URL from a test ID. */
function buildTcUrl(testId: string): string {
  return `${ZEPHYR_BASE_URL}${testId}`
}

/** Apply header-style fill + font + borders to every cell in the given row. */
function styleHeaderRow(row: ExcelJS.Row, fillArgb: string): void {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: fillArgb },
    }
    cell.font = FONT_HEADER
    cell.border = THIN_BORDER
  })
}

/** Apply plain data-row styling (default font + borders, no fill). */
function styleDataRow(row: ExcelJS.Row): void {
  row.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = FONT_DEFAULT
    cell.border = THIN_BORDER
  })
}

// ---------- Main Export Function ----------

/**
 * Generate an xlsx workbook Blob from collected sheet data.
 *
 * @param releaseName  Tab/sheet name (e.g. "LPv310.0")
 * @param entries      Map of roleKey → SheetEntry with failed/skipped tests
 * @returns            Blob of the .xlsx file ready for download
 */
export async function generateSpreadsheet(
  releaseName: string,
  entries: Map<string, SheetEntry>,
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(releaseName || "Regression")

  sheet.columns = COLUMN_WIDTHS.map((width) => ({ width }))

  // Rows 1-2: column headers
  const headerRow1 = sheet.addRow(HEADER_ROW_1)
  const headerRow2 = sheet.addRow(HEADER_ROW_2)
  styleHeaderRow(headerRow1, FILL_COLUMN_HEADER)
  styleHeaderRow(headerRow2, FILL_COLUMN_HEADER)

  // Merge single-label header columns across rows 1-2 so each column has
  // one visual header cell except D/E which are grouped under "Execution Status".
  sheet.mergeCells("A1:A2")
  sheet.mergeCells("B1:B2")
  sheet.mergeCells("C1:C2")
  sheet.mergeCells("F1:F2")
  sheet.mergeCells("G1:G2")
  sheet.mergeCells("H1:H2")
  sheet.mergeCells("I1:I2")

  // Each section emits a merged grey header row followed by its data rows.
  const addSection = (
    title: string,
    tests: Array<{ testId: string }>,
    platform: string,
    type: string,
    status: "Skipped" | "Failed",
  ) => {
    const headerRow = sheet.addRow([title])
    sheet.mergeCells(headerRow.number, 1, headerRow.number, 9)
    styleHeaderRow(headerRow, FILL_SECTION_HEADER)

    for (const test of tests) {
      const dataRow = sheet.addRow([
        platform,
        type,
        buildTcUrl(test.testId),
        status,
        "",
        "",
        "",
        "",
        "",
      ])
      // Column C: convert the plain URL string to a real hyperlink.
      const urlCell = dataRow.getCell(3)
      urlCell.value = {
        text: String(urlCell.value ?? ""),
        hyperlink: buildTcUrl(test.testId),
        tooltip: buildTcUrl(test.testId),
      }
      styleDataRow(dataRow)
    }

    // Empty sections (especially consecutive Unresolved / Manual
    // Execution placeholders) get a blank unstyled spacer row so
    // their headers don't sit back-to-back.
    if (tests.length === 0) {
      sheet.addRow([])
    }
  }

  // ---------- Skipped sections ----------
  for (const platform of PLATFORMS) {
    const entry = entries.get(`${platform}_Functional`)
    addSection(
      `${platform} Functional Skipped`,
      entry?.skipped ?? [],
      platform,
      "Functional",
      "Skipped",
    )
  }
  for (const platform of PLATFORMS) {
    const entry = entries.get(`${platform}_Visual`)
    addSection(
      `${platform} Visual Skipped`,
      entry?.skipped ?? [],
      platform,
      "Visual",
      "Skipped",
    )
  }

  // ---------- Failed sections ----------
  const warmup = entries.get("WarmUp")
  addSection(
    "Automated Functional Warmup Failures",
    warmup?.failed ?? [],
    "Windows",
    "Warmup",
    "Failed",
  )
  for (const platform of PLATFORMS) {
    const entry = entries.get(`${platform}_Functional`)
    addSection(
      `Automated Functional ${platform} Failures`,
      entry?.failed ?? [],
      platform,
      "Functional",
      "Failed",
    )
  }
  for (const platform of PLATFORMS) {
    const entry = entries.get(`${platform}_Visual`)
    addSection(
      `Automated Visual ${platform} Failed`,
      entry?.failed ?? [],
      platform,
      "Visual",
      "Failed",
    )
  }

  // ---------- Unresolved + Manual Execution placeholders ----------
  for (const platform of PLATFORMS) {
    addSection(`Automated ${platform} Unresolved`, [], platform, "", "Failed")
  }
  addSection("Manual Execution", [], "", "", "Failed")

  const buffer = await workbook.xlsx.writeBuffer()
  return new Blob([buffer], {
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
