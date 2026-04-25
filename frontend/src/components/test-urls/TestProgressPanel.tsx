import { Progress } from "@/components/ui/progress"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"

export interface TestProgressEntry {
  url: string
  siteName: string
  status: "pending" | "testing" | "success" | "failed"
  error?: string
}

interface TestProgressPanelProps {
  visible: boolean
  completed: number
  total: number
  successful: number
  failed: number
  currentUrl: string | null
  strategyLabel: string
  finished: boolean
  recentResults: TestProgressEntry[]
}

export function TestProgressPanel({
  visible,
  completed,
  total,
  successful,
  failed,
  currentUrl,
  strategyLabel,
  finished,
  recentResults,
}: TestProgressPanelProps) {
  if (!visible) return null

  const percentage = total > 0 ? (completed / total) * 100 : 0

  return (
    <div className="aurora-panel p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="aurora-text text-sm font-medium">
          {finished ? "Tests Complete!" : `Testing ${strategyLabel}...`}
        </span>
        <span className="aurora-text-dim text-sm tabular-nums">
          {completed} / {total}
        </span>
      </div>

      <Progress value={percentage} className="aurora-progress" />

      {currentUrl && !finished && (
        <div className="aurora-text-dim flex items-center gap-2 text-sm">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="truncate">{currentUrl}</span>
        </div>
      )}

      {finished && (
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1" style={{ color: "var(--lcc-green)" }}>
            <CheckCircle2 className="h-4 w-4" /> {successful} successful
          </span>
          {failed > 0 && (
            <span className="flex items-center gap-1" style={{ color: "var(--lcc-red)" }}>
              <XCircle className="h-4 w-4" /> {failed} failed
            </span>
          )}
        </div>
      )}

      {recentResults.length > 0 && (
        <div className="space-y-1 max-h-[140px] overflow-y-auto">
          {recentResults.map((entry, index) => (
            <div
              key={index}
              className="flex items-center gap-2 text-xs"
            >
              {entry.status === "success" ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--lcc-green)" }} />
              ) : entry.status === "failed" ? (
                <XCircle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--lcc-red)" }} />
              ) : (
                <Loader2 className="aurora-text-faint h-3.5 w-3.5 shrink-0 animate-spin" />
              )}
              <span className="aurora-text-dim truncate">{entry.url}</span>
              {entry.error && (
                <span className="shrink-0" style={{ color: "var(--lcc-red)" }}>{entry.error}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
