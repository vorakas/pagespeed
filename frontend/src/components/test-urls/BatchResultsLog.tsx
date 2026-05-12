import { useState } from "react"
import { CheckCircle2, XCircle, ChevronDown, X } from "lucide-react"
import type { TestProgressEntry } from "./TestProgressPanel"

interface BatchResultsLogProps {
  results: TestProgressEntry[]
  onDismiss: () => void
}

type FilterMode = "all" | "failed" | "passed"

export function BatchResultsLog({ results, onDismiss }: BatchResultsLogProps) {
  const [filter, setFilter] = useState<FilterMode>("all")

  if (results.length === 0) return null

  const failedCount = results.filter((r) => r.status === "failed").length
  const passedCount = results.filter((r) => r.status === "success").length

  const filtered = filter === "all"
    ? results
    : results.filter((r) =>
        filter === "failed" ? r.status === "failed" : r.status === "success"
      )

  const grouped = new Map<string, TestProgressEntry[]>()
  for (const entry of filtered) {
    const site = entry.siteName
    if (!grouped.has(site)) grouped.set(site, [])
    grouped.get(site)!.push(entry)
  }

  for (const [, entries] of grouped) {
    entries.sort((a, b) => {
      if (a.status === "failed" && b.status !== "failed") return -1
      if (a.status !== "failed" && b.status === "failed") return 1
      return 0
    })
  }

  return (
    <details className="aurora-panel group" open={failedCount > 0}>
      <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 select-none list-none [&::-webkit-details-marker]:hidden">
        <ChevronDown className="aurora-text-faint h-4 w-4 shrink-0 transition-transform duration-150 group-open:rotate-180" />
        <span className="aurora-text text-sm font-medium">Batch Results</span>
        <span className="flex items-center gap-3 text-xs tabular-nums">
          <span style={{ color: "var(--lcc-green)" }}>{passedCount} passed</span>
          {failedCount > 0 && (
            <span style={{ color: "var(--lcc-red)" }}>{failedCount} failed</span>
          )}
        </span>
        <button
          onClick={(e) => { e.preventDefault(); onDismiss() }}
          className="aurora-text-faint hover:aurora-text ml-auto rounded p-0.5 transition-colors duration-150"
          aria-label="Dismiss results"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </summary>

      <div className="border-t px-4 pb-3 pt-2" style={{ borderColor: "var(--glass-border)" }}>
        {(failedCount > 0 && passedCount > 0) && (
          <div className="mb-2 flex gap-1">
            {(["all", "failed", "passed"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setFilter(mode)}
                className="rounded px-2 py-0.5 text-xs capitalize transition-colors duration-150"
                style={{
                  background: filter === mode ? "var(--glass-bg)" : "transparent",
                  color: filter === mode ? "var(--lcc-text)" : "var(--lcc-text-muted)",
                }}
              >
                {mode}
                <span className="ml-1 tabular-nums" style={{ color: "var(--lcc-text-faint)" }}>
                  {mode === "all" ? results.length : mode === "failed" ? failedCount : passedCount}
                </span>
              </button>
            ))}
          </div>
        )}

        <div className="max-h-[360px] space-y-3 overflow-y-auto">
          {Array.from(grouped.entries()).map(([siteName, entries]) => (
            <div key={siteName}>
              <div
                className="mb-1 text-[10px] font-medium uppercase tracking-widest"
                style={{ color: "var(--lcc-text-faint)" }}
              >
                {siteName}
              </div>
              <div className="space-y-px">
                {entries.map((entry, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-2 rounded px-2 py-1 text-xs"
                    style={{
                      background: entry.status === "failed" ? "oklch(64% 0.18 25 / 0.06)" : "transparent",
                    }}
                  >
                    {entry.status === "success" ? (
                      <CheckCircle2
                        className="mt-px h-3.5 w-3.5 shrink-0"
                        style={{ color: "var(--lcc-green)" }}
                      />
                    ) : (
                      <XCircle
                        className="mt-px h-3.5 w-3.5 shrink-0"
                        style={{ color: "var(--lcc-red)" }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <span className="aurora-text-dim break-all">{entry.url}</span>
                      {entry.error && (
                        <div className="mt-0.5" style={{ color: "var(--lcc-red)", opacity: 0.8 }}>
                          {entry.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}
