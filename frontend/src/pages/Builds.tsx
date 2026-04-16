import { useState, useEffect, useCallback, useRef } from "react"
import { Header } from "@/components/layout/Header"
import { DevOpsConfigPanel } from "@/components/builds/DevOpsConfigPanel"
import { PipelineMapper } from "@/components/builds/PipelineMapper"
import { OrchestratorPanel } from "@/components/builds/OrchestratorPanel"
import { BuildGrid } from "@/components/builds/BuildGrid"
import { BuildResultsPanel, type PanelMode } from "@/components/builds/BuildResultsPanel"
import { useLocalConfig } from "@/hooks/use-local-config"
import { api } from "@/services/api"
import type { DevOpsConfig, DevOpsBuild, FailedTest, SkippedTest } from "@/types"
import type { SheetEntry } from "@/services/spreadsheetExport"

const DEFAULT_DEVOPS_CONFIG: DevOpsConfig = {
  pat: "",
  organization: "LampsPlus",
  project: "TestAutomation",
  orchestratorPipelineId: null,
  pipelineMap: {
    WarmUp: 219,
    Windows_Functional: 167,
    Mac_Functional: 217,
    iPhone_Functional: 169,
    Android_Functional: 248,
    Windows_Visual: 170,
    Mac_Visual: 218,
    iPhone_Visual: 215,
    Android_Visual: 249,
  },
}

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

const POLL_INTERVAL_MS = 10_000

export function Builds() {
  const [config, setConfig] = useLocalConfig<DevOpsConfig>("devOpsConfig", DEFAULT_DEVOPS_CONFIG)
  const [connected, setConnected] = useState(false)
  const [autoConnecting, setAutoConnecting] = useState(false)
  const [builds, setBuilds] = useState<Record<string, DevOpsBuild | null>>({})
  const [effectiveResults, setEffectiveResults] = useState<Record<string, { effectiveResult: string; hasRerun: boolean }>>({})
  const [triggeringKeys, setTriggeringKeys] = useState<Set<string>>(new Set())
  const [branches, setBranches] = useState<string[]>([])
  const [branch, setBranch] = useState("master")
  const [targetInstance, setTargetInstance] = useState("A")
  const [overrides, setOverrides] = useState<Record<string, { branch?: string; targetInstance?: string }>>({})
  const [selectedBuild, setSelectedBuild] = useState<DevOpsBuild | null>(null)
  const [panelMode, setPanelMode] = useState<PanelMode>("failed")
  const [failedTestsCache, setFailedTestsCache] = useState<Record<number, FailedTest[]>>({})
  const [skippedTestsCache, setSkippedTestsCache] = useState<Record<number, SkippedTest[]>>({})
  const prefetchedIdsRef = useRef<Set<number>>(new Set())
  const prefetchedSkippedIdsRef = useRef<Set<number>>(new Set())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [sheetData, setSheetData] = useState<Map<string, SheetEntry>>(new Map())

  const definitionIds = Object.values(config.pipelineMap).filter(Boolean)

  // Auto-connect on page load if PAT is saved
  useEffect(() => {
    if (connected || !config.pat) return
    setAutoConnecting(true)
    api.testDevOpsConnection(config)
      .then((result) => {
        if (result.success) setConnected(true)
      })
      .catch(() => {})
      .finally(() => setAutoConnecting(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBuilds = useCallback(async () => {
    if (!connected || definitionIds.length === 0) return
    try {
      const result = await api.getDevOpsBuilds(config, definitionIds, 50)
      if (!result.success) return

      const buildMap: Record<string, DevOpsBuild | null> = {}
      for (const key of ALL_ROLE_KEYS) {
        const defId = config.pipelineMap[key]
        if (!defId) {
          buildMap[key] = null
          continue
        }
        const latest = result.builds.find((b) => b.definitionId === defId)
        buildMap[key] = latest ?? null
      }
      setBuilds(buildMap)

      // Fetch effective status for completed non-succeeded builds
      const statusChecks: Promise<void>[] = []
      for (const key of ALL_ROLE_KEYS) {
        const build = buildMap[key]
        if (
          build &&
          build.status === "completed" &&
          build.result !== "succeeded" &&
          build.result !== null
        ) {
          statusChecks.push(
            api.getDevOpsEffectiveStatus(config, build.id)
              .then((res) => {
                if (res.success) {
                  setEffectiveResults((prev) => ({
                    ...prev,
                    [key]: { effectiveResult: res.effectiveResult, hasRerun: res.hasRerun },
                  }))
                }
              })
              .catch(() => {})
          )
        }
      }
      await Promise.all(statusChecks)

      // Prefetch failed tests sequentially to avoid overwhelming Azure DevOps
      const toPrefetch = ALL_ROLE_KEYS
        .map((key) => buildMap[key])
        .filter((b): b is DevOpsBuild =>
          b !== null && b.status === "completed" && !prefetchedIdsRef.current.has(b.id)
        )

      if (toPrefetch.length > 0) {
        // Run in background — don't block fetchBuilds
        ;(async () => {
          for (const build of toPrefetch) {
            prefetchedIdsRef.current.add(build.id)
            try {
              const res = await api.getDevOpsFailedTests(config, build.id)
              if (res.success) {
                setFailedTestsCache((prev) => ({ ...prev, [build.id]: res.failedTests }))
              }
            } catch {
              prefetchedIdsRef.current.delete(build.id)
            }
          }
          // Then prefetch skipped tests (lower priority, after failed tests finish)
          for (const build of toPrefetch) {
            if (prefetchedSkippedIdsRef.current.has(build.id)) continue
            prefetchedSkippedIdsRef.current.add(build.id)
            try {
              const res = await api.getDevOpsSkippedTests(config, build.id)
              if (res.success) {
                setSkippedTestsCache((prev) => ({ ...prev, [build.id]: res.skippedTests }))
              }
            } catch {
              prefetchedSkippedIdsRef.current.delete(build.id)
            }
          }
        })()
      }
    } catch {
      // Silent fail — will retry on next poll
    }
  }, [connected, config, definitionIds])

  // Initial fetch on connect
  useEffect(() => {
    if (connected) {
      fetchBuilds()
      // Fetch available branches once
      api.getDevOpsBranches(config)
        .then((res) => { if (res.success) setBranches(res.branches) })
        .catch(() => {})
    }
  }, [connected, fetchBuilds]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll while any build is running
  const anyRunning = Object.values(builds).some(
    (b) => b?.status === "inProgress" || b?.status === "notStarted"
  )

  useEffect(() => {
    if (anyRunning && connected) {
      pollRef.current = setInterval(fetchBuilds, POLL_INTERVAL_MS)
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [anyRunning, connected, fetchBuilds])

  const handleTriggerSingle = async (roleKey: string) => {
    const defId = config.pipelineMap[roleKey]
    if (!defId) return
    const cardOverride = overrides[roleKey]
    const effectiveBranch = cardOverride?.branch || branch
    const effectiveInstance = cardOverride?.targetInstance || targetInstance
    setTriggeringKeys((prev) => new Set(prev).add(roleKey))
    try {
      await api.triggerDevOpsPipeline(config, defId, effectiveBranch, {
        TargetInstance: effectiveInstance,
      })
      setTimeout(fetchBuilds, 2000)
    } catch {
      // User sees it via status not changing
    } finally {
      setTriggeringKeys((prev) => {
        const next = new Set(prev)
        next.delete(roleKey)
        return next
      })
    }
  }

  const handleOverrideChange = (roleKey: string, field: "branch" | "targetInstance", value: string) => {
    setOverrides((prev) => ({
      ...prev,
      [roleKey]: { ...prev[roleKey], [field]: value || undefined },
    }))
  }

  const handleOrchestratorTriggered = () => {
    setTimeout(fetchBuilds, 2000)
  }

  const handleAddToSheet = useCallback((roleKey: string) => {
    const build = builds[roleKey]
    if (!build) return
    const platform = roleKey === "WarmUp" ? "Windows" : roleKey.split("_")[0]
    const type = roleKey === "WarmUp" ? "Warmup" : roleKey.split("_")[1] || "Functional"
    const failed = failedTestsCache[build.id] ?? []
    const skipped = skippedTestsCache[build.id] ?? []
    setSheetData((prev) => {
      const next = new Map(prev)
      next.set(roleKey, { roleKey, platform, type, failed, skipped })
      return next
    })
  }, [builds, failedTestsCache, skippedTestsCache])

  const handleSheetClear = useCallback(() => {
    setSheetData(new Map())
  }, [])

  return (
    <>
      <Header
        title="Automation Builds"
        description="Trigger and monitor Azure DevOps automation builds"
      />

      <div className="space-y-6 p-6">
        {/* Config */}
        <DevOpsConfigPanel
          config={config}
          onConfigChange={setConfig}
          onConnected={() => setConnected(true)}
        />

        {connected && (
          <>
            {/* Pipeline mapping — collapsed by default, rarely needed */}
            <details className="rounded-lg border border-border bg-card shadow-sm">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-muted-foreground hover:text-foreground">
                Pipeline Mapping (advanced)
              </summary>
              <div className="px-4 pb-4">
                <PipelineMapper config={config} onConfigChange={setConfig} />
              </div>
            </details>

            {/* Orchestrator + Build grid with side panel */}
            <div className="flex gap-6 items-start">
              <div className="max-w-4xl space-y-6">
                <OrchestratorPanel
                  config={config}
                  branches={branches}
                  branch={branch}
                  targetInstance={targetInstance}
                  onBranchChange={setBranch}
                  onTargetInstanceChange={setTargetInstance}
                  onTriggered={handleOrchestratorTriggered}
                />
                <BuildGrid
                  builds={builds}
                  effectiveResults={effectiveResults}
                  branches={branches}
                  globalBranch={branch}
                  globalTargetInstance={targetInstance}
                  overrides={overrides}
                  onOverrideChange={handleOverrideChange}
                  onTrigger={handleTriggerSingle}
                  onShowResults={(build) => { setSelectedBuild(build); setPanelMode("failed") }}
                  onShowSkipped={(build) => { setSelectedBuild(build); setPanelMode("skipped") }}
                  onAddToSheet={handleAddToSheet}
                  sheetData={sheetData}
                  onSheetClear={handleSheetClear}
                  triggeringKeys={triggeringKeys}
                  selectedBuildId={selectedBuild?.id}
                />
              </div>

              {/* Results panel — fills remaining space to the right */}
              {selectedBuild && (
                <div className="flex-1 sticky top-6 self-start h-[calc(100vh-7rem)] rounded-lg border border-border bg-card shadow-sm overflow-hidden">
                  <BuildResultsPanel
                    config={config}
                    build={selectedBuild}
                    mode={panelMode}
                    prefetchedFailedTests={failedTestsCache[selectedBuild.id]}
                    prefetchedSkippedTests={skippedTestsCache[selectedBuild.id]}
                    onClose={() => setSelectedBuild(null)}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}
