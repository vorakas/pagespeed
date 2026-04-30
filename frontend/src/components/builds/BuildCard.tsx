import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, ExternalLink, Loader2, ClipboardList, SkipForward, FileSpreadsheet, Check, Square } from "lucide-react"
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
  recentBuilds: DevOpsBuild[]
  selectedBuildOverrideId: number | null
  onSelectBuild: (buildId: number | null) => void
  effectiveResult?: EffectiveResult
  branches: string[]
  globalBranch: string
  globalTargetInstance: string
  globalStagingInstance: string
  override?: { branch?: string; targetInstance?: string; stagingInstance?: string }
  onOverrideChange: (
    roleKey: string,
    field: "branch" | "targetInstance" | "stagingInstance",
    value: string,
  ) => void
  onTrigger: () => void
  onShowResults?: (build: DevOpsBuild) => void
  onShowSkipped?: (build: DevOpsBuild) => void
  onAddToSheet?: (roleKey: string) => void
  addedToSheet?: boolean
  triggering: boolean
  triggerError?: string
  onStop?: () => void
  cancelling?: boolean
  selected?: boolean
  /** Applitools batch id for this Visual card — passed through to the
   * sheet export. Ignored for non-Visual cards. Cleared per run. */
  applitoolsBatchId?: string
  onApplitoolsBatchIdChange?: (roleKey: string, value: string) => void
  /** Recent helper-uploaded batches surfaced as autocomplete options
   * in the batch-id input so QA can pick instead of retyping. */
  recentApplitoolsBatches?: Array<{
    batchId: string
    fetchedAt: string
    uploadedAt: number
    testCount: number
  }>
}

function statusTextColor(status: BuildStatus, result: BuildResult): string {
  if (status === "inProgress") return "text-blue-400"
  if (status !== "completed") return "text-muted-foreground"
  switch (result) {
    case "succeeded": return "text-score-good"
    case "partiallySucceeded": return "text-score-average"
    case "failed": return "text-score-poor"
    case "canceled": return "text-muted-foreground"
    default: return "text-muted-foreground"
  }
}

function statusLabel(status: BuildStatus, result: BuildResult): string {
  if (status === "inProgress") return "RUNNING"
  if (status === "notStarted") return "QUEUED"
  if (status !== "completed") return status.toUpperCase()
  switch (result) {
    case "succeeded": return "PASSED"
    case "partiallySucceeded": return "PARTIAL"
    case "failed": return "FAILED"
    case "canceled": return "CANCELED"
    default: return "UNKNOWN"
  }
}

function typeBadgeLabel(type: "WarmUp" | "Functional" | "Visual"): string {
  return type === "WarmUp" ? "warmup" : type.toLowerCase()
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
  roleKey, roleLabel, typeBadge, build, recentBuilds,
  selectedBuildOverrideId, onSelectBuild, effectiveResult,
  branches, globalBranch, globalTargetInstance, globalStagingInstance, override, onOverrideChange,
  onTrigger, onShowResults, onShowSkipped, onAddToSheet, addedToSheet,
  triggering, triggerError, onStop, cancelling, selected,
  applitoolsBatchId, onApplitoolsBatchIdChange, recentApplitoolsBatches,
}: BuildCardProps) {
  const isServerCancelling = build?.status === "cancelling"
  const showCancelling = cancelling || isServerCancelling
  const isRunning = build?.status === "inProgress" || build?.status === "notStarted"
  const isCompleted = build?.status === "completed"

  // Use effective result when available (accounts for re-run passes)
  const displayResult: BuildResult = effectiveResult
    ? (effectiveResult.effectiveResult as BuildResult)
    : build?.result ?? null
  const displayStatus = build?.status ?? "none"
  const hasRerun = effectiveResult?.hasRerun ?? false

  const isVisual = typeBadge === "Visual"
  const hasOverride =
    override?.branch ||
    override?.targetInstance ||
    (isVisual && override?.stagingInstance)

  const selectedBuild = selectedBuildOverrideId
    ? recentBuilds.find((b) => b.id === selectedBuildOverrideId)
    : null
  const hasBuildOverride = !!selectedBuild

  const dotPulse = isRunning || showCancelling
  const dotColorClass = showCancelling ? "text-amber-500" : statusTextColor(displayStatus, displayResult)

  return (
    <Card className={`relative overflow-hidden transition-colors ${selected ? "is-selected" : ""}`}>
      <CardContent className="p-3 space-y-2 overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm beacon-headline truncate">{roleLabel}</p>
            <span className="beacon-typebadge mt-1">
              {typeBadgeLabel(typeBadge)}
            </span>
          </div>
          {build && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span
                className={`beacon-dot ${dotColorClass} ${dotPulse ? "beacon-dot--pulse" : ""}`}
                aria-label={showCancelling ? "Cancelling" : statusLabel(displayStatus, displayResult)}
                role="img"
              />
              <span className={`beacon-status ${dotColorClass}`}>
                {showCancelling ? "CANCELLING" : statusLabel(displayStatus, displayResult)}
                {hasRerun && displayResult === "succeeded" && " (RR)"}
              </span>
            </div>
          )}
        </div>

        {build ? (
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span className="beacon-mono">#{build.buildNumber}</span>
              <span className="beacon-mono">{formatDuration(build.startTime, build.finishTime)}</span>
            </div>
            <div className="flex justify-between">
              <span className="beacon-mono">{formatTimeAgo(build.startTime)}</span>
              {build.webUrl && (
                <a
                  href={build.webUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-0.5 hover:underline"
                  style={{ color: "var(--beacon-amber)" }}
                >
                  View <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground beacon-mono">No recent builds</p>
        )}

        {/* Per-card overrides */}
        <details className="group">
          <summary
            className={`beacon-summary cursor-pointer hover:text-foreground ${hasOverride ? "" : "text-muted-foreground"}`}
            style={hasOverride ? { color: "var(--beacon-amber)" } : undefined}
          >
            {hasOverride
              ? "OVERRIDE ACTIVE"
              : isVisual
                ? "OVERRIDE BRANCH / PROD / PPE"
                : "OVERRIDE BRANCH / PROD"}
          </summary>
          <div
            className={`mt-1.5 grid gap-2 ${isVisual ? "grid-cols-[1fr_2.5rem_2.5rem]" : "grid-cols-[1fr_2.5rem]"}`}
          >
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
              title={`PROD Instance (global: ${globalTargetInstance})`}
              className="h-6 w-full rounded border border-border bg-background px-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
            >
              <option value="">{globalTargetInstance}</option>
              {TARGET_INSTANCES.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
            {isVisual && (
              <select
                value={override?.stagingInstance || ""}
                onChange={(e) => onOverrideChange(roleKey, "stagingInstance", e.target.value)}
                title={`PPE Instance (global: ${globalStagingInstance})`}
                className="h-6 w-full rounded border border-border bg-background px-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
              >
                <option value="">{globalStagingInstance}</option>
                {TARGET_INSTANCES.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            )}
          </div>
        </details>

        {recentBuilds.length > 0 && (
          <details className="group">
            <summary
              className={`beacon-summary cursor-pointer hover:text-foreground ${hasBuildOverride ? "" : "text-muted-foreground"}`}
              style={hasBuildOverride ? { color: "var(--beacon-amber)" } : undefined}
            >
              {hasBuildOverride
                ? `VIEWING #${selectedBuild!.buildNumber}`
                : "SELECT BUILD"}
            </summary>
            <div className="mt-1.5">
              <select
                value={selectedBuildOverrideId ? String(selectedBuildOverrideId) : ""}
                onChange={(e) => onSelectBuild(e.target.value ? Number(e.target.value) : null)}
                className="h-6 w-full rounded border border-border bg-background px-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
              >
                <option value="">Latest (auto)</option>
                {recentBuilds.map((b) => (
                  <option key={b.id} value={b.id}>
                    #{b.buildNumber} — {formatTimeAgo(b.startTime)}
                  </option>
                ))}
              </select>
            </div>
          </details>
        )}

        {/* Applitools batch id — Visual cards only. Cleared per run.
            The <datalist> below turns the input into an autocomplete:
            QA either types the id by hand or picks one of the recent
            helper uploads from the dropdown the browser draws. Native
            datalist gives us the popover, filtering, and click-to-fill
            for free, no JS state. */}
        {isVisual && isCompleted && onApplitoolsBatchIdChange && (
          <div className="space-y-0.5">
            <label
              htmlFor={`applitools-batch-${roleKey}`}
              className="beacon-label"
            >
              Applitools Batch ID
              {recentApplitoolsBatches && recentApplitoolsBatches.length > 0 && (
                <span className="ml-1 text-muted-foreground">
                  ({recentApplitoolsBatches.length} uploaded)
                </span>
              )}
            </label>
            <input
              id={`applitools-batch-${roleKey}`}
              type="text"
              list={`applitools-batches-${roleKey}`}
              value={applitoolsBatchId ?? ""}
              onChange={(e) => onApplitoolsBatchIdChange(roleKey, e.target.value)}
              placeholder={
                recentApplitoolsBatches && recentApplitoolsBatches.length > 0
                  ? "Pick from list or paste id"
                  : "Run helper, then paste id"
              }
              className="h-6 w-full rounded border border-border bg-background px-1.5 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
            />
            {recentApplitoolsBatches && recentApplitoolsBatches.length > 0 && (
              <datalist id={`applitools-batches-${roleKey}`}>
                {recentApplitoolsBatches.map((b) => (
                  <option
                    key={b.batchId}
                    value={b.batchId}
                    label={`${b.testCount} row${b.testCount === 1 ? "" : "s"} · ${formatTimeAgo(new Date(b.uploadedAt * 1000).toISOString())}`}
                  />
                ))}
              </datalist>
            )}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={onTrigger}
            disabled={triggering || isRunning || showCancelling}
          >
            {triggering ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Triggering...</>
            ) : isRunning ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Running...</>
            ) : (
              <><Play className="h-3 w-3" /> Run</>
            )}
          </Button>
          {(isRunning || showCancelling) && onStop && build && (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onStop}
              disabled={showCancelling}
              title={showCancelling ? "Cancelling..." : "Stop build"}
              aria-label={showCancelling ? "Cancelling build" : "Stop build"}
            >
              {showCancelling ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Square className="h-3 w-3 fill-current" />
              )}
            </Button>
          )}
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

        {triggerError && (
          <p className="text-[10px] text-score-poor break-words" role="alert">
            {triggerError}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
