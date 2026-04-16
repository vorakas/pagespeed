import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, ExternalLink, Loader2, ClipboardList, SkipForward, FileSpreadsheet, Check } from "lucide-react"
import type { DevOpsBuild, BuildResult, BuildStatus } from "@/types"

const TARGET_INSTANCES = ["A", "B", "C", "D", "E", "F", "G", "H", "I"]

interface EffectiveResult {
  effectiveResult: string
  hasRerun: boolean
}

interface BuildCardProps {
  roleKey: string
  roleLabel: string
  typeBadge: "WarmUp" | "Functional" | "Visual"
  build: DevOpsBuild | null
  effectiveResult?: EffectiveResult
  branches: string[]
  globalBranch: string
  globalTargetInstance: string
  override?: { branch?: string; targetInstance?: string }
  onOverrideChange: (roleKey: string, field: "branch" | "targetInstance", value: string) => void
  onTrigger: () => void
  onShowResults?: (build: DevOpsBuild) => void
  onShowSkipped?: (build: DevOpsBuild) => void
  onAddToSheet?: (roleKey: string) => void
  addedToSheet?: boolean
  triggering: boolean
  selected?: boolean
}

function statusColor(status: BuildStatus, result: BuildResult): string {
  if (status === "inProgress") return "bg-blue-500"
  if (status !== "completed") return "bg-muted"
  switch (result) {
    case "succeeded": return "bg-score-good"
    case "partiallySucceeded": return "bg-score-average"
    case "failed": return "bg-score-poor"
    case "canceled": return "bg-muted"
    default: return "bg-muted"
  }
}

function statusLabel(status: BuildStatus, result: BuildResult): string {
  if (status === "inProgress") return "Running"
  if (status === "notStarted") return "Queued"
  if (status !== "completed") return status
  switch (result) {
    case "succeeded": return "Passed"
    case "partiallySucceeded": return "Partial"
    case "failed": return "Failed"
    case "canceled": return "Canceled"
    default: return "Unknown"
  }
}

function typeBadgeColor(type: "WarmUp" | "Functional" | "Visual"): string {
  switch (type) {
    case "WarmUp": return "bg-purple-500/15 text-purple-600 dark:text-purple-400"
    case "Functional": return "bg-blue-500/15 text-blue-600 dark:text-blue-400"
    case "Visual": return "bg-amber-500/15 text-amber-600 dark:text-amber-400"
  }
}

function formatDuration(startTime: string | null, finishTime: string | null): string {
  if (!startTime) return "-"
  const start = new Date(startTime)
  const end = finishTime ? new Date(finishTime) : new Date()
  const diffMs = end.getTime() - start.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}h ${remainingMinutes}m`
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never"
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function BuildCard({
  roleKey, roleLabel, typeBadge, build, effectiveResult,
  branches, globalBranch, globalTargetInstance, override, onOverrideChange,
  onTrigger, onShowResults, onShowSkipped, onAddToSheet, addedToSheet,
  triggering, selected,
}: BuildCardProps) {
  const isRunning = build?.status === "inProgress" || build?.status === "notStarted"
  const isCompleted = build?.status === "completed"

  // Use effective result when available (accounts for re-run passes)
  const displayResult: BuildResult = effectiveResult
    ? (effectiveResult.effectiveResult as BuildResult)
    : build?.result ?? null
  const displayStatus = build?.status ?? "none"
  const hasRerun = effectiveResult?.hasRerun ?? false

  const hasOverride = override?.branch || override?.targetInstance

  return (
    <Card className={`relative overflow-hidden transition-colors ${selected ? "ring-1 ring-sidebar-primary" : ""}`}>
      <CardContent className="p-3 space-y-2 overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{roleLabel}</p>
            <span className={`inline-block mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${typeBadgeColor(typeBadge)}`}>
              {typeBadge}
            </span>
          </div>
          {build && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`h-2 w-2 rounded-full ${statusColor(displayStatus, displayResult)} ${isRunning ? "animate-pulse" : ""}`} />
              <span className="text-xs text-muted-foreground">
                {statusLabel(displayStatus, displayResult)}
                {hasRerun && displayResult === "succeeded" && " (Re-runs)"}
              </span>
            </div>
          )}
        </div>

        {build ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>#{build.buildNumber}</span>
              <span>{formatDuration(build.startTime, build.finishTime)}</span>
            </div>
            <div className="flex justify-between">
              <span>{formatTimeAgo(build.startTime)}</span>
              {build.webUrl && (
                <a
                  href={build.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-0.5 text-sidebar-primary hover:underline"
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No recent builds</p>
        )}

        {/* Per-card overrides */}
        <details className="group">
          <summary className={`text-[10px] cursor-pointer hover:text-foreground ${hasOverride ? "text-sidebar-primary" : "text-muted-foreground"}`}>
            {hasOverride ? "Override active" : "Override branch / env"}
          </summary>
          <div className="mt-1.5 grid grid-cols-[1fr_2.5rem] gap-2">
            <select
              value={override?.branch || ""}
              onChange={(e) => onOverrideChange(roleKey, "branch", e.target.value)}
              title={override?.branch || `Global: ${globalBranch}`}
              className="h-6 w-full truncate rounded border border-border bg-background px-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
            >
              <option value="">Global: {globalBranch}</option>
              {branches.map((b) => (
                <option key={b} value={b} title={b}>{b}</option>
              ))}
            </select>
            <select
              value={override?.targetInstance || ""}
              onChange={(e) => onOverrideChange(roleKey, "targetInstance", e.target.value)}
              className="h-6 w-full rounded border border-border bg-background px-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
            >
              <option value="">{globalTargetInstance}</option>
              {TARGET_INSTANCES.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
        </details>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onTrigger}
            disabled={triggering || isRunning}
          >
            {triggering ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Triggering...</>
            ) : isRunning ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Running...</>
            ) : (
              <><Play className="h-3 w-3" /> Run</>
            )}
          </Button>
          {isCompleted && build && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onShowResults?.(build)}
              >
                <ClipboardList className="h-3 w-3" /> Results
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onShowSkipped?.(build)}
              >
                <SkipForward className="h-3 w-3" /> Skipped
              </Button>
              {onAddToSheet && (
                <Button
                  variant="outline"
                  size="sm"
                  className={`h-7 text-xs ${addedToSheet ? "border-score-good text-score-good" : ""}`}
                  onClick={() => onAddToSheet(roleKey)}
                  disabled={addedToSheet}
                  title={addedToSheet ? "Added to spreadsheet" : "Add failed & skipped tests to spreadsheet"}
                >
                  {addedToSheet ? (
                    <><Check className="h-3 w-3" /> Sheet</>
                  ) : (
                    <><FileSpreadsheet className="h-3 w-3" /> + Sheet</>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
