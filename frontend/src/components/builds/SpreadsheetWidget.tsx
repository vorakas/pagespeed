import { useState, useMemo, useCallback } from "react"
import { Download, Trash2, FileSpreadsheet } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { SheetEntry } from "@/services/spreadsheetExport"

interface SpreadsheetWidgetProps {
  sheetData: Map<string, SheetEntry>
  onClear: () => void
}

/** Display order for the breakdown table. */
const DISPLAY_ORDER = [
  { key: "WarmUp", label: "Warm Up" },
  { key: "Windows_Functional", label: "Win Func" },
  { key: "Mac_Functional", label: "Mac Func" },
  { key: "iPhone_Functional", label: "iPh Func" },
  { key: "Android_Functional", label: "And Func" },
  { key: "Windows_Visual", label: "Win Vis" },
  { key: "Mac_Visual", label: "Mac Vis" },
  { key: "iPhone_Visual", label: "iPh Vis" },
  { key: "Android_Visual", label: "And Vis" },
]

export function SpreadsheetWidget({ sheetData, onClear }: SpreadsheetWidgetProps) {
  const [releaseName, setReleaseName] = useState("")
  const [downloading, setDownloading] = useState(false)

  const hasData = sheetData.size > 0

  const totals = useMemo(() => {
    let failed = 0
    let skipped = 0
    let unresolved = 0
    sheetData.forEach((entry) => {
      failed += entry.failed.length
      skipped += entry.skipped.length
      unresolved += entry.unresolved.length
    })
    return { failed, skipped, unresolved }
  }, [sheetData])

  const handleDownload = useCallback(async () => {
    setDownloading(true)
    try {
      const { generateSpreadsheet, downloadSpreadsheet } = await import("@/services/spreadsheetExport")
      const blob = await generateSpreadsheet(releaseName, sheetData)
      downloadSpreadsheet(blob, releaseName)
    } finally {
      setDownloading(false)
    }
  }, [releaseName, sheetData])

  return (
    <Card className="overflow-hidden flex flex-col max-h-[22rem]">
      <CardContent className="p-3 flex flex-col flex-1 min-h-0 gap-2">
        {/* Header */}
        <div className="flex items-center gap-1.5 shrink-0">
          <FileSpreadsheet className="h-4 w-4" style={{ color: "var(--beacon-amber)" }} />
          <p className="text-sm beacon-headline">Spreadsheet Export</p>
        </div>

        {/* Release name input */}
        <div className="shrink-0">
          <label className="beacon-label" htmlFor="release-name">
            RELEASE / TAB NAME
          </label>
          <input
            id="release-name"
            type="text"
            placeholder="e.g. LPv310.0"
            value={releaseName}
            onChange={(e) => setReleaseName(e.target.value)}
            className="mt-1 h-7 w-full rounded border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        {/* Scrollable table area.  One table with sticky <thead>/<tfoot>
            keeps the Failed/Skipped columns vertically aligned across
            header, body, and totals — a scrollbar in a separate body
            table would shift its columns inward. */}
        {hasData ? (
          <div className="flex-1 min-h-0 rounded border border-border overflow-y-auto">
            <table className="w-full text-[11px] table-fixed">
              <colgroup>
                <col />
                <col className="w-14" />
                <col className="w-16" />
                <col className="w-16" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-muted/50">
                <tr>
                  <th className="px-2 py-1 text-left beacon-label">BUILD</th>
                  <th className="px-2 py-1 text-right beacon-label">FAIL</th>
                  <th className="px-2 py-1 text-right beacon-label">SKIP</th>
                  <th className="px-2 py-1 text-right beacon-label">UNRES</th>
                </tr>
              </thead>
              <tbody>
                {DISPLAY_ORDER.filter((d) => sheetData.has(d.key)).map((d) => {
                  const entry = sheetData.get(d.key)!
                  const isVisual = d.key.endsWith("_Visual")
                  return (
                    <tr key={d.key} className="border-t border-border">
                      <td className="px-2 py-0.5 text-foreground beacon-mono">{d.label}</td>
                      <td className="px-2 py-0.5 text-right beacon-mono">
                        {entry.failed.length > 0 ? (
                          <span className="text-score-poor">{entry.failed.length}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-2 py-0.5 text-right beacon-mono">
                        {entry.skipped.length > 0 ? (
                          <span className="text-amber-500">{entry.skipped.length}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-2 py-0.5 text-right beacon-mono">
                        {isVisual ? (
                          entry.unresolved.length > 0 ? (
                            <span className="text-blue-500">{entry.unresolved.length}</span>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 bg-muted/50">
                <tr className="border-t font-medium" style={{ borderColor: "var(--beacon-amber-line)" }}>
                  <td className="px-2 py-1 beacon-label">TOTAL</td>
                  <td className="px-2 py-1 text-right beacon-mono text-score-poor">{totals.failed}</td>
                  <td className="px-2 py-1 text-right beacon-mono text-amber-500">{totals.skipped}</td>
                  <td className="px-2 py-1 text-right beacon-mono text-blue-500">{totals.unresolved}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex items-center">
            <p className="text-[11px] text-muted-foreground">
              Click <span className="font-medium">+ Sheet</span> on a completed build card to add its results.
            </p>
          </div>
        )}

        {/* Action buttons — frozen at bottom */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs flex-1"
            disabled={!hasData || !releaseName.trim() || downloading}
            onClick={handleDownload}
          >
            <Download className="h-3 w-3" />
            {downloading
              ? "Preparing..."
              : !releaseName.trim() && hasData
                ? "Enter release name"
                : "Download .xlsx"}
          </Button>
          {hasData && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-score-poor"
              onClick={onClear}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
