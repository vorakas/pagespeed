import { useEffect, useRef, useState } from "react"

import { deriveColumns, formatCellValue, type ResultRow } from "@/lib/nerdgraphTable"

const DEFAULT_COLUMN_WIDTH = 160
const MIN_COLUMN_WIDTH = 60

interface NerdGraphResultsTableProps {
  results: ResultRow[]
}

export function NerdGraphResultsTable({ results }: NerdGraphResultsTableProps) {
  const columns = deriveColumns(results)
  const columnKey = columns.join("|")
  const [widths, setWidths] = useState<Record<string, number>>({})
  const dragState = useRef<{ column: string; startX: number; startWidth: number } | null>(null)

  // Reset widths whenever the column set changes (a new query shape).
  useEffect(() => {
    setWidths({})
  }, [columnKey])

  // Track drag at the window level so the pointer can leave the handle.
  useEffect(() => {
    const handleMove = (event: MouseEvent) => {
      const drag = dragState.current
      if (!drag) return
      const next = Math.max(MIN_COLUMN_WIDTH, drag.startWidth + (event.clientX - drag.startX))
      setWidths((prev) => ({ ...prev, [drag.column]: next }))
    }
    const handleUp = () => {
      dragState.current = null
    }
    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleUp)
    return () => {
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleUp)
    }
  }, [])

  if (results.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--lcc-text-dim)" }}>
        No rows returned.
      </p>
    )
  }

  const widthOf = (column: string) => widths[column] ?? DEFAULT_COLUMN_WIDTH

  const startResize = (column: string, event: React.MouseEvent) => {
    event.preventDefault()
    dragState.current = { column, startX: event.clientX, startWidth: widthOf(column) }
  }

  return (
    <div className="max-h-[300px] overflow-auto">
      <table className="aurora-table" style={{ tableLayout: "fixed", width: "auto" }}>
        <colgroup>
          {columns.map((column) => (
            <col key={column} style={{ width: widthOf(column) }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column} className="relative" style={{ overflow: "hidden" }}>
                <span className="block truncate pr-2" title={column}>
                  {column}
                </span>
                <span
                  onMouseDown={(event) => startResize(column, event)}
                  className="absolute right-0 top-0 h-full"
                  style={{ width: 6, cursor: "col-resize", userSelect: "none" }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {results.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => {
                const text = formatCellValue(row[column])
                return (
                  <td
                    key={column}
                    title={text}
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {text}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
