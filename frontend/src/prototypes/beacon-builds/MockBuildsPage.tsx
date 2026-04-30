import { useState, useCallback, useMemo, useEffect } from "react"
import { OrchestratorPanel } from "@/components/builds/OrchestratorPanel"
import { BuildGrid } from "@/components/builds/BuildGrid"
import { BuildResultsPanel, type PanelMode } from "@/components/builds/BuildResultsPanel"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import type { DevOpsBuild } from "@/types"
import type { SheetEntry } from "@/services/spreadsheetExport"
import {
  FIXTURE_BUILDS,
  FIXTURE_RECENT_BUILDS,
  FIXTURE_EFFECTIVE_RESULTS,
  FIXTURE_FAILED_TESTS,
  FIXTURE_SKIPPED_TESTS,
  FIXTURE_UNRESOLVED_TESTS,
  FIXTURE_BRANCHES,
  FIXTURE_DEVOPS_CONFIG,
} from "./fixtures"

const ALL_ROLE_KEYS = [
  "WarmUp",
  "Windows_Functional",
  "Mac_Functional",
  "iPhone_Functional",
  "Android_Functional",
  "Windows_Visual",
  "Mac_Visual",
  "iPhone_Visual",
  "Android_Visual",
]

interface MockBuildsPageProps {
  /** Lift status up to the layout so the header can show polling state. */
  onPollingChange: (polling: boolean) => void
  onActiveCountChange: (count: number) => void
  onLastSyncChange: (d: Date) => void
}

/**
 * Mock Builds page — same components, fabricated data. Used by the
 * Beacon prototype layout so the page can render fully populated
 * without backend or DevOps PAT.
 */
export function MockBuildsPage({
  onPollingChange,
  onActiveCountChange,
  onLastSyncChange,
}: MockBuildsPageProps) {
  const [builds] = useState(FIXTURE_BUILDS)
  const [recentBuilds] = useState(FIXTURE_RECENT_BUILDS)
  const [effectiveResults] = useState(FIXTURE_EFFECTIVE_RESULTS)
  const [buildOverrides, setBuildOverrides] = useState<Record<string, number>>({})
  const [overrides, setOverrides] = useState<
    Record<string, { branch?: string; targetInstance?: string; stagingInstance?: string }>
  >({})
  const [branch, setBranch] = useState("master")
  const [targetInstance, setTargetInstance] = useState("A")
  const [stagingInstance, setStagingInstance] = useState("C")
  const [applitoolsBatchIds, setApplitoolsBatchIds] = useState<Record<string, string>>({
    iPhone_Visual: "demo-batch-id-iphone-visual",
  })

  const [triggeringKeys, setTriggeringKeys] = useState<Set<string>>(new Set())
  const [triggerErrors] = useState<Record<string, string>>({})
  const [cancellingKeys, setCancellingKeys] = useState<Set<string>>(new Set())
  const [confirmStopKey, setConfirmStopKey] = useState<string | null>(null)

  const [selectedBuild, setSelectedBuild] = useState<DevOpsBuild | null>(null)
  const [panelMode, setPanelMode] = useState<PanelMode>("failed")
  const [sheetData, setSheetData] = useState<Map<string, SheetEntry>>(new Map())

  // Active build count derived from fixtures — Android_Functional is
  // running, Android_Visual is queued.
  const activeBuildCount = useMemo(
    () =>
      ALL_ROLE_KEYS.filter((k) => {
        const b = builds[k]
        return b?.status === "inProgress" || b?.status === "notStarted"
      }).length,
    [builds],
  )

  // Polling is "live" whenever there's something running. Same logic as
  // the production page; here it just drives the header indicators.
  const polling = activeBuildCount > 0

  const [lastSync, setLastSync] = useState(() => new Date())

  useEffect(() => {
    onPollingChange(polling)
    onActiveCountChange(activeBuildCount)
  }, [polling, activeBuildCount, onPollingChange, onActiveCountChange])

  // Simulate a polling tick every 30s so the "last sync" stat stays
  // realistic to a real polling cadence.
  useEffect(() => {
    if (!polling) return
    const id = setInterval(() => {
      const next = new Date()
      setLastSync(next)
      onLastSyncChange(next)
    }, 30_000)
    return () => clearInterval(id)
  }, [polling, onLastSyncChange])

  useEffect(() => {
    onLastSyncChange(lastSync)
  }, [lastSync, onLastSyncChange])

  // ----- Handlers (visual-only state transitions) -----

  const handleTrigger = useCallback((roleKey: string) => {
    setTriggeringKeys((prev) => new Set(prev).add(roleKey))
    setTimeout(() => {
      setTriggeringKeys((prev) => {
        const next = new Set(prev)
        next.delete(roleKey)
        return next
      })
    }, 1500)
  }, [])

  const handleStop = useCallback((roleKey: string) => {
    setConfirmStopKey(roleKey)
  }, [])

  const handleStopAll = useCallback(async () => {
    const targets = ALL_ROLE_KEYS.filter((k) => {
      const b = builds[k]
      return b?.status === "inProgress" || b?.status === "notStarted"
    })
    setCancellingKeys(new Set(targets))
    setTimeout(() => setCancellingKeys(new Set()), 2000)
  }, [builds])

  const handleOrchestratorTriggered = useCallback(() => {
    // Visually flag every role as triggering for ~1.5s.
    setTriggeringKeys(new Set(ALL_ROLE_KEYS))
    setTimeout(() => setTriggeringKeys(new Set()), 1500)
  }, [])

  const handleOverrideChange = useCallback(
    (
      roleKey: string,
      field: "branch" | "targetInstance" | "stagingInstance",
      value: string,
    ) => {
      setOverrides((prev) => ({
        ...prev,
        [roleKey]: { ...prev[roleKey], [field]: value || undefined },
      }))
    },
    [],
  )

  const handleSelectBuild = useCallback((roleKey: string, buildId: number | null) => {
    setBuildOverrides((prev) => {
      const next = { ...prev }
      if (buildId === null) delete next[roleKey]
      else next[roleKey] = buildId
      return next
    })
  }, [])

  const handleAddToSheet = useCallback(
    (roleKey: string) => {
      const build = builds[roleKey]
      if (!build) return
      const platform = roleKey === "WarmUp" ? "Windows" : roleKey.split("_")[0]
      const type = roleKey === "WarmUp" ? "Warmup" : roleKey.split("_")[1] || "Functional"
      const failed = FIXTURE_FAILED_TESTS[build.id] ?? []
      const skipped = FIXTURE_SKIPPED_TESTS[build.id] ?? []
      const unresolved = FIXTURE_UNRESOLVED_TESTS[roleKey] ?? []
      setSheetData((prev) => {
        const next = new Map(prev)
        next.set(roleKey, { roleKey, platform, type, failed, skipped, unresolved })
        return next
      })
    },
    [builds],
  )

  const handleSheetClear = useCallback(() => setSheetData(new Map()), [])

  const handleApplitoolsBatchIdChange = useCallback((roleKey: string, value: string) => {
    setApplitoolsBatchIds((prev) => ({ ...prev, [roleKey]: value }))
  }, [])

  return (
    <div className="space-y-6 p-6">
      {/* Prototype banner */}
      <div className="beacon-banner">
        <span>
          <span className="beacon-mono uppercase tracking-wider text-xs">Prototype</span>
          {" — "}
          all data is fabricated. Run / Stop / + Sheet are interactive but
          do not call Azure DevOps.
        </span>
      </div>

      {/* Orchestrator + grid */}
      <div className="flex gap-6 items-start">
        <div className="max-w-4xl space-y-6">
          <OrchestratorPanel
            config={FIXTURE_DEVOPS_CONFIG}
            branches={FIXTURE_BRANCHES}
            branch={branch}
            targetInstance={targetInstance}
            stagingInstance={stagingInstance}
            onBranchChange={setBranch}
            onTargetInstanceChange={setTargetInstance}
            onStagingInstanceChange={setStagingInstance}
            onTriggered={handleOrchestratorTriggered}
            activeBuildCount={activeBuildCount}
            onStopAll={handleStopAll}
            warmUpBuild={builds.WarmUp ?? null}
            warmUpEffective={effectiveResults.WarmUp}
          />

          <BuildGrid
            builds={builds}
            recentBuilds={recentBuilds}
            buildOverrides={buildOverrides}
            onSelectBuild={handleSelectBuild}
            effectiveResults={effectiveResults}
            branches={FIXTURE_BRANCHES}
            globalBranch={branch}
            globalTargetInstance={targetInstance}
            globalStagingInstance={stagingInstance}
            overrides={overrides}
            onOverrideChange={handleOverrideChange}
            onTrigger={handleTrigger}
            onStop={handleStop}
            onShowResults={(b) => {
              setSelectedBuild(b)
              setPanelMode("failed")
            }}
            onShowSkipped={(b) => {
              setSelectedBuild(b)
              setPanelMode("skipped")
            }}
            onAddToSheet={handleAddToSheet}
            sheetData={sheetData}
            onSheetClear={handleSheetClear}
            prefetchingTests={false}
            triggeringKeys={triggeringKeys}
            triggerErrors={triggerErrors}
            cancellingKeys={cancellingKeys}
            selectedBuildId={selectedBuild?.id}
            applitoolsBatchIds={applitoolsBatchIds}
            onApplitoolsBatchIdChange={handleApplitoolsBatchIdChange}
            recentApplitoolsBatches={[]}
          />
        </div>

        {selectedBuild && (
          <div
            className="flex-1 sticky top-[5.5rem] self-start rounded border bg-card overflow-hidden"
            style={{
              borderColor: "var(--beacon-border)",
              height: "calc(100vh - 7.5rem)",
            }}
          >
            <BuildResultsPanel
              config={FIXTURE_DEVOPS_CONFIG}
              build={selectedBuild}
              mode={panelMode}
              prefetchedFailedTests={FIXTURE_FAILED_TESTS[selectedBuild.id] ?? []}
              prefetchedSkippedTests={FIXTURE_SKIPPED_TESTS[selectedBuild.id] ?? []}
              onClose={() => setSelectedBuild(null)}
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmStopKey !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmStopKey(null)
        }}
        title="Stop this build?"
        description={
          confirmStopKey
            ? `This would cancel the ${confirmStopKey.replace(/_/g, " ")} build (#${
                builds[confirmStopKey]?.buildNumber ?? "?"
              }) in Azure DevOps. (Prototype — no real call.)`
            : undefined
        }
        confirmLabel="Stop build"
        destructive
        onConfirm={async () => {
          if (!confirmStopKey) return
          setCancellingKeys((prev) => new Set(prev).add(confirmStopKey))
          setTimeout(() => {
            setCancellingKeys((prev) => {
              const next = new Set(prev)
              next.delete(confirmStopKey)
              return next
            })
          }, 1500)
        }}
      />
    </div>
  )
}
