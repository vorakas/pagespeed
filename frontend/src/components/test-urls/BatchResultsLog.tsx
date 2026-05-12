import { useState, useMemo } from "react"
import { CheckCircle2, XCircle, ChevronDown, X, Trash2, Clock, AlertTriangle } from "lucide-react"
import type { TestProgressEntry } from "./TestProgressPanel"
import { type BatchRun, getRepeatFailures } from "@/services/batchHistory"

interface BatchResultsLogProps {
  results: TestProgressEntry[]
  history: BatchRun[]
  onDismiss: () => void
  onDeleteRun: (runId: string) => void
  onClearHistory: () => void
}

type FilterMode = "all" | "failed" | "passed"

export function BatchResultsLog({
  results,
  history,
  onDismiss,
  onDeleteRun,
  onClearHistory,
}: BatchResultsLogProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterMode>("all")

  const repeatFailures = useMemo(() => getRepeatFailures(history), [history])

  const hasLiveResults = results.length > 0
  const selectedRun = selectedRunId ? history.find((r) => r.id === selectedRunId) : null
  const activeResults = selectedRun ? selectedRun.results : results
  const showingHistory = selectedRun !== null

  if (!hasLiveResults && history.length === 0) return null

  const failedCount = activeResults.filter((r) => r.status === "failed").length
  const passedCount = activeResults.filter((r) => r.status === "success").length

  const filtered = filter === "all"
    ? activeResults
    : activeResults.filter((r) =>
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

  function formatTimestamp(iso: string): string {
    const date = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return "just now"
    if (diffMins < 60) return `${diffMins}m ago`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  }

  return (
    <details className="aurora-panel group" open={hasLiveResults ? failedCount > 0 : true}>
      <summary className="flex cursor-pointer items-center gap-3 px-4 py-3 select-none list-none [&::-webkit-details-marker]:hidden">
        <ChevronDown className="aurora-text-faint h-4 w-4 shrink-0 transition-transform duration-150 group-open:rotate-180" />
        <span className="aurora-text text-sm font-medium">
          {showingHistory ? "Run History" : "Batch Results"}
        </span>
        {activeResults.length > 0 && (
          <span className="flex items-center gap-3 text-xs tabular-nums">
            <span style={{ color: "var(--lcc-green)" }}>{passedCount} passed</span>
            {failedCount > 0 && (
              <span style={{ color: "var(--lcc-red)" }}>{failedCount} failed</span>
            )}
          </span>
        )}
        {hasLiveResults && !showingHistory && (
          <button
            onClick={(e) => { e.preventDefault(); onDismiss() }}
            className="aurora-text-faint hover:aurora-text ml-auto rounded p-0.5 transition-colors duration-150"
            aria-label="Dismiss results"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </summary>

      <div className="border-t px-4 pb-3 pt-2" style={{ borderColor: "var(--glass-border)" }}>
        {/* Run selector */}
        {history.length > 0 && (
          <div className="mb-3 flex items-center gap-2">
            <select
              value={selectedRunId ?? ""}
              onChange={(e) => {
                setSelectedRunId(e.target.value || null)
                setFilter("all")
              }}
              className="aurora-input h-7 flex-1 rounded px-2 text-xs"
            >
              {hasLiveResults && <option value="">Current run</option>}
              {!hasLiveResults && <option value="">Select a run...</option>}
              {history.map((run) => (
                <option key={run.id} value={run.id}>
                  {formatTimestamp(run.timestamp)} — {run.strategy} — {run.successful} passed, {run.failed} failed
                </option>
              ))}
            </select>
            {showingHistory && (
              <button
                onClick={() => { onDeleteRun(selectedRun!.id); setSelectedRunId(null) }}
                className="aurora-text-faint hover:aurora-text rounded p-1 transition-colors duration-150"
                title="Delete this run"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            {history.length > 1 && (
              <button
                onClick={() => {
                  if (window.confirm(`Clear all ${history.length} saved runs?`)) {
                    onClearHistory()
                    setSelectedRunId(null)
                  }
                }}
                className="aurora-text-faint hover:aurora-text rounded p-1 transition-colors duration-150"
                title="Clear all history"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {/* No results selected */}
        {!hasLiveResults && !showingHistory && history.length > 0 && (
          <div className="aurora-text-faint flex items-center gap-2 py-4 text-xs">
            <Clock className="h-4 w-4" />
            <span>Select a past run from the dropdown above, or run a new batch test.</span>
          </div>
        )}

        {/* Filter tabs + results */}
        {activeResults.length > 0 && (
          <>
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
                      {mode === "all" ? activeResults.length : mode === "failed" ? failedCount : passedCount}
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
                    {entries.map((entry, index) => {
                      const failCount = repeatFailures.get(entry.url) ?? 0
                      const isRepeatFailure = entry.status === "failed" && failCount >= 2

                      return (
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
                            {isRepeatFailure && (
                              <span
                                className="ml-2 inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-medium"
                                style={{
                                  background: "oklch(78% 0.16 70 / 0.12)",
                                  color: "oklch(78% 0.16 70)",
                                }}
                                title={`Failed in ${failCount} of ${history.length} runs`}
                              >
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {failCount}x
                              </span>
                            )}
                            {entry.error && (
                              <div className="mt-0.5" style={{ color: "var(--lcc-red)", opacity: 0.8 }}>
                                {entry.error}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </details>
  )
}
