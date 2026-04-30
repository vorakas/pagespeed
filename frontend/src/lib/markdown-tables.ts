/**
 * Repair malformed tables produced by Jira / Confluence rich-text
 * exports before they reach the user's eyes.
 *
 * The pattern we see in the wild (e.g. ACE2E-312's "BUG LIST"):
 *
 *     | Col 1 | Col 2 | Col 3 | Col 4 | Col 5 | Col 6 | Col 7 | Col 8 |
 *     | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
 *     | Test Cycle |  | Test case |  | Bugs Logged |  | Summary |  |
 *     | URL1 | URL2 | URL3 | Summary text  |  |  |  |  |
 *
 * Jira's editor allowed the author to draw 4 columns with "merged"
 * header cells; the export to markdown lost the colspan info and
 * doubled every column, so we end up with an 8-column table where
 * the *real* labels sit in odd positions of the first body row and
 * each data row fills only the first 4 cells.
 *
 * This module's :func:`normalizeJiraMergedHeaderTables` detects that
 * pattern in marked output, promotes the alternating-empty row to
 * the header, and trims the trailing empty cells off every data row
 * so the rendered table matches what the author meant.
 *
 * Tables that don't match the pattern pass through untouched.
 */

const COL_HEADER_RE = /^Col\s+\d+$/i

/**
 * Post-process marked-rendered HTML, rewriting any tables whose THEAD
 * contains only generic ``Col N`` placeholders.
 *
 * Falls through if ``DOMParser`` isn't available (e.g. SSR), so the
 * caller should expect the input HTML back unchanged in those
 * environments rather than an error.
 */
export function normalizeJiraMergedHeaderTables(html: string): string {
  if (typeof DOMParser === "undefined") return html
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html")
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return html

  for (const table of Array.from(root.querySelectorAll("table"))) {
    rewriteTable(doc, table)
  }
  return root.innerHTML
}

function rewriteTable(doc: Document, table: HTMLTableElement): void {
  const thead = table.querySelector("thead")
  const tbody = table.querySelector("tbody")
  if (!thead || !tbody) return

  // Header must be a single row of "Col N" placeholders. Anything else
  // (real labels, mixed content, multi-row headers) is left alone.
  const headerRow = thead.querySelector("tr")
  if (!headerRow) return
  const headerCells = Array.from(headerRow.children).filter(
    (el) => el.tagName === "TH" || el.tagName === "TD",
  )
  if (headerCells.length < 4) return
  const allGeneric = headerCells.every((th) =>
    COL_HEADER_RE.test((th.textContent || "").trim()),
  )
  if (!allGeneric) return

  // The first body row should be the "merged" header — alternating
  // non-empty / empty cells. We promote it to the new header. If the
  // first body row doesn't fit that shape, leave the table alone
  // rather than guess wrong.
  const firstBodyRow = tbody.querySelector("tr")
  if (!firstBodyRow) return
  const firstCells = Array.from(firstBodyRow.children).filter(
    (el) => el.tagName === "TD" || el.tagName === "TH",
  )
  if (firstCells.length !== headerCells.length) return

  const labels: string[] = []
  for (const cell of firstCells) {
    const text = (cell.textContent || "").trim()
    if (text) labels.push(text)
  }
  if (labels.length === 0 || labels.length === headerCells.length) {
    // No alternating-empty pattern — bail out so we don't accidentally
    // mangle a table that genuinely has 8 narrow columns.
    return
  }

  // Build a fresh THEAD from the real labels.
  const newHead = doc.createElement("thead")
  const newHeadRow = doc.createElement("tr")
  for (const label of labels) {
    const th = doc.createElement("th")
    th.textContent = label
    newHeadRow.appendChild(th)
  }
  newHead.appendChild(newHeadRow)
  thead.replaceWith(newHead)

  // Drop the merged-header row from the body, then trim every
  // remaining row down to ``labels.length`` leading cells. We keep
  // each cell's existing innerHTML so links inside survive.
  firstBodyRow.remove()
  const realWidth = labels.length
  for (const tr of Array.from(tbody.querySelectorAll("tr"))) {
    const cells = Array.from(tr.children).filter(
      (el) => el.tagName === "TD" || el.tagName === "TH",
    )
    cells.slice(realWidth).forEach((c) => c.remove())
  }
}
