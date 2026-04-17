import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Rocket, Square } from "lucide-react"
import { api } from "@/services/api"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import type { DevOpsConfig } from "@/types"

const TARGET_INSTANCES = ["A", "B", "C", "D", "E", "F", "G", "H", "I"]

interface OrchestratorPanelProps {
  config: DevOpsConfig
  branches: string[]
  branch: string
  targetInstance: string
  stagingInstance: string
  onBranchChange: (branch: string) => void
  onTargetInstanceChange: (instance: string) => void
  onStagingInstanceChange: (instance: string) => void
  onTriggered: () => void
  activeBuildCount: number
  onStopAll: () => Promise<void>
}

export function OrchestratorPanel({
  config, branches, branch, targetInstance, stagingInstance,
  onBranchChange, onTargetInstanceChange, onStagingInstanceChange, onTriggered,
  activeBuildCount, onStopAll,
}: OrchestratorPanelProps) {
  const [confirmStopAll, setConfirmStopAll] = useState(false)
  const [runWarmUp, setRunWarmUp] = useState(true)
  const [runFunctional, setRunFunctional] = useState(true)
  const [runVisual, setRunVisual] = useState(true)
  const [runWindows, setRunWindows] = useState(true)
  const [runMac, setRunMac] = useState(true)
  const [runIPhone, setRunIPhone] = useState(true)
  const [runAndroid, setRunAndroid] = useState(true)
  const [triggering, setTriggering] = useState(false)
  const [status, setStatus] = useState<{ message: string; type: "success" | "error" } | null>(null)

  const handleTrigger = async () => {
    if (!config.orchestratorPipelineId) {
      setStatus({ message: "No orchestrator pipeline mapped. Configure it in Pipeline Mapping above.", type: "error" })
      return
    }
    setTriggering(true)
    setStatus(null)
    try {
      const result = await api.triggerDevOpsOrchestrator(config, {
        pipelineId: config.orchestratorPipelineId,
        branch,
        targetInstance,
        stagingInstance,
        runWarmUp,
        runFunctional,
        runVisual,
        runWindows,
        runMac,
        runIPhone,
        runAndroid,
      })
      if (result.success) {
        setStatus({ message: `Orchestrator queued: #${result.build.buildNumber}`, type: "success" })
        onTriggered()
      } else {
        setStatus({ message: "Failed to trigger orchestrator", type: "error" })
      }
    } catch (err) {
      setStatus({
        message: err instanceof Error ? err.message : "Trigger failed",
        type: "error",
      })
    } finally {
      setTriggering(false)
    }
  }

  return (
    <Card className="max-w-4xl">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Run All Builds</h3>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              onClick={() => setConfirmStopAll(true)}
              disabled={activeBuildCount === 0}
              title={
                activeBuildCount === 0
                  ? "No active builds to stop"
                  : `Stop ${activeBuildCount} active build${activeBuildCount === 1 ? "" : "s"}`
              }
            >
              <Square className="h-4 w-4 fill-current" /> Stop All
              {activeBuildCount > 0 && ` (${activeBuildCount})`}
            </Button>
            <Button onClick={handleTrigger} disabled={triggering}>
              {triggering ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Triggering...</>
              ) : (
                <><Rocket className="h-4 w-4" /> Run Orchestrator</>
              )}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Build Types</p>
            <div className="flex flex-wrap gap-3">
              <CheckboxOption label="WarmUp" checked={runWarmUp} onChange={setRunWarmUp} />
              <CheckboxOption label="Functional" checked={runFunctional} onChange={setRunFunctional} />
              <CheckboxOption label="Visual" checked={runVisual} onChange={setRunVisual} />
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Platforms</p>
            <div className="flex flex-wrap gap-3">
              <CheckboxOption label="Windows" checked={runWindows} onChange={setRunWindows} />
              <CheckboxOption label="Mac" checked={runMac} onChange={setRunMac} />
              <CheckboxOption label="iPhone" checked={runIPhone} onChange={setRunIPhone} />
              <CheckboxOption label="Android" checked={runAndroid} onChange={setRunAndroid} />
            </div>
          </div>
        </div>

        <div className="flex gap-x-6 gap-y-2">
          <div className="space-y-1.5 flex-1">
            <p className="text-xs font-medium text-muted-foreground">Branch</p>
            <select
              value={branch}
              onChange={(e) => onBranchChange(e.target.value)}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
            >
              {branches.length === 0 && <option value="master">master</option>}
              {branches.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">PROD Instance</p>
            <select
              value={targetInstance}
              onChange={(e) => onTargetInstanceChange(e.target.value)}
              className="h-8 w-14 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
            >
              {TARGET_INSTANCES.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <p
              className="text-xs font-medium text-muted-foreground"
              title="Applied only to Visual builds; WarmUp and Functional ignore this."
            >
              PPE Instance
            </p>
            <select
              value={stagingInstance}
              onChange={(e) => onStagingInstanceChange(e.target.value)}
              className="h-8 w-14 rounded-md border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-sidebar-primary"
            >
              {TARGET_INSTANCES.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
        </div>

        {status && (
          <p className={`text-sm ${status.type === "success" ? "text-score-good" : "text-score-poor"}`}>
            {status.message}
          </p>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmStopAll}
        onOpenChange={setConfirmStopAll}
        title="Stop all active builds?"
        description={`This will request cancellation for ${activeBuildCount} active automation build${activeBuildCount === 1 ? "" : "s"} in Azure DevOps.`}
        confirmLabel={`Stop ${activeBuildCount} build${activeBuildCount === 1 ? "" : "s"}`}
        destructive
        onConfirm={onStopAll}
      />
    </Card>
  )
}

function CheckboxOption({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded border-muted-foreground/40"
      />
      <span className="text-xs text-foreground">{label}</span>
    </label>
  )
}
