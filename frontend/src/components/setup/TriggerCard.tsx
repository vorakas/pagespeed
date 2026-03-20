import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Play, Pencil, Trash2, Clock, Monitor, Link } from "lucide-react"
import { describeCron } from "@/lib/utils"
import { api } from "@/services/api"
import type { Trigger } from "@/types"

interface TriggerCardProps {
  trigger: Trigger
  onEdit: (trigger: Trigger) => void
  onDeleted: () => void
  onToggled: () => void
}

function formatRelativeTime(isoString: string): string {
  const normalized = isoString.endsWith("Z") ? isoString : isoString + "Z"
  const date = new Date(normalized)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHr / 24)

  if (diffSec < 60) return "Just now"
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? "s" : ""} ago`
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? "s" : ""} ago`
  if (diffDays === 1) return "Yesterday"
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const statusStyles: Record<string, { label: string; className: string }> = {
  success: { label: "Success", className: "text-score-good" },
  partial: { label: "Partial", className: "text-score-average" },
  failed: { label: "Failed", className: "text-score-poor" },
  running: { label: "Running...", className: "text-primary" },
}

export function TriggerCard({ trigger, onEdit, onDeleted, onToggled }: TriggerCardProps) {
  const [toggling, setToggling] = useState(false)
  const [running, setRunning] = useState(false)

  const strategyLabel = trigger.strategy === "both"
    ? "Desktop & Mobile"
    : trigger.strategy.charAt(0).toUpperCase() + trigger.strategy.slice(1)

  const urlCount = trigger.url_ids?.length ?? 0
  const cronDesc = describeCron(trigger.schedule_value)

  const handleToggle = async (enabled: boolean) => {
    setToggling(true)
    try {
      await api.toggleTrigger(trigger.id, enabled)
      onToggled()
    } catch {
      // Error
    } finally {
      setToggling(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm("Delete this trigger?")) return
    try {
      await api.deleteTrigger(trigger.id)
      onDeleted()
    } catch {
      // Error
    }
  }

  const handleRun = async () => {
    setRunning(true)
    try {
      await api.runTrigger(trigger.id)
      onToggled() // Refresh to show running state
    } catch {
      // Error
    } finally {
      setRunning(false)
    }
  }

  const lastRunStatus = trigger.last_run_status
  const statusConfig = lastRunStatus ? statusStyles[lastRunStatus] : null

  return (
    <Card className={`${trigger.enabled ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-4 p-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <h4 className="text-sm font-semibold text-foreground">{trigger.name}</h4>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {trigger.schedule_label || cronDesc}
            </span>
            <span className="flex items-center gap-1">
              <Monitor className="h-3.5 w-3.5" />
              {strategyLabel}
            </span>
            <span className="flex items-center gap-1">
              <Link className="h-3.5 w-3.5" />
              {urlCount} URL{urlCount !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Runs: {cronDesc} (UTC)
          </p>
          {/* Last run status */}
          <p className="text-xs text-muted-foreground">
            Last run:{" "}
            {trigger.last_run_at ? (
              <>
                {formatRelativeTime(trigger.last_run_at)}
                {statusConfig && (
                  <span className={`ml-1 ${statusConfig.className}`}>
                    — {statusConfig.label}
                  </span>
                )}
              </>
            ) : (
              "Never"
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Switch
            checked={trigger.enabled}
            onCheckedChange={handleToggle}
            disabled={toggling}
            aria-label={trigger.enabled ? "Enabled" : "Disabled"}
          />
          <Button
            variant="ghost"
            size="icon-xs"
            title="Run Now"
            onClick={handleRun}
            disabled={running || trigger.last_run_status === "running"}
          >
            <Play className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            title="Edit"
            onClick={() => onEdit(trigger)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            title="Delete"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
