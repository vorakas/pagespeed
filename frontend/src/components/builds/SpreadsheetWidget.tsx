import { useState, useMemo, useCallback } from "react"
import { Download, Trash2, FileSpreadsheet, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { generateSpreadsheet, downloadSpreadsheet } from "@/services/spreadsheetExport"
import type { SheetEntry } from "@/services/spreadsheetExport"

interface SpreadsheetWidgetProps {
  sheetData: Map<string, SheetEntry>
  onClear: () => void
  prefetchingTests: boolean
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

export function SpreadsheetWidget({ sheetData, onClear, prefetchingTests }: SpreadsheetWidgetProps) {
  const [releaseName, setReleaseName] = useState("")

  const hasData = sheetData.size > 0

  const totals = useMemo(() => {
    let failed = 0
    let skipped = 0
    sheetData.forEach((entry) => {
      failed += entry.failed.length
      skipped += entry.skipped.length
    })
    return { failed, skipped }
  }, [sheetData])

  const handleDownload = useCallback(() => {
    const blob = generateSpreadsheet(releaseName, sheetData)
    downloadSpreadsheet(blob, releaseName)
  }, [releaseName, sheetData])

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <FileSpreadsheet className="h-4 w-4 text-score-good" />
          <p className="text-sm font-medium text-foreground">Spreadsheet Export</p>
          {prefetchingTests && (
            <span className="flex items-center gap-1 ml-auto text-[10px] text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Loading data...
            </span>
          )}
        </div>

        {/* Release name input */}
        <div>
          <label className="text-[10px] text-muted-foreground" htmlFor="release-name">
            Release / Tab Name
          </label>
          <input
            id="release-name"
            type="text"
            placeholder="e.g. LPv310.0"
            value={releaseName}
            onChange={(e) => setReleaseName(e.target.value)}
            className="mt-0.5 h-7 w-full rounded border border-border bg-background px-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
          />
        </div>

        {/* Breakdown table */}
        {hasData ? (
          <div className="rounded border border-border overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-2 py-1 text-left font-medium text-muted-foreground">Build</th>
                  <th className="px-2 py-1 text-right font-medium text-muted-foreground">Failed</th>
                  <th className="px-2 py-1 text-right font-medium text-muted-foreground">Skipped</th>
                </tr>
              </thead>
              <tbody>
                {DISPLAY_ORDER.filter((d) => sheetData.has(d.key)).map((d) => {
                  const entry = sheetData.get(d.key)!
                  return (
                    <tr key={d.key} className="border-t border-border">
                      <td className="px-2 py-0.5 text-foreground">{d.label}</td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {entry.failed.length > 0 ? (
                          <span className="text-score-poor">{entry.failed.length}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-2 py-0.5 text-right tabular-nums">
                        {entry.skipped.length > 0 ? (
                          <span className="text-amber-500">{entry.skipped.length}</span>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {/* Totals row */}
                <tr className="border-t border-border bg-muted/50 font-medium">
                  <td className="px-2 py-1 text-foreground">Total</td>
                  <td className="px-2 py-1 text-right tabular-nums text-score-poor">{totals.failed}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-amber-500">{totals.skipped}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground py-2">
            {prefetchingTests
              ? "Test data is loading. You can click + Sheet once loading completes."
              : <>Click <span className="font-medium">+ Sheet</span> on a completed build card to add its results.</>
            }
          </p>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs flex-1"
            disabled={!hasData || !releaseName.trim()}
            onClick={handleDownload}
          >
            <Download className="h-3 w-3" />
            {!releaseName.trim() && hasData ? "Enter release name" : "Download .xlsx"}
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
