import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Header } from "@/components/layout/Header"
import { DevOpsConfigPanel } from "@/components/builds/DevOpsConfigPanel"
import { PipelineMapper } from "@/components/builds/PipelineMapper"
import { OrchestratorPanel } from "@/components/builds/OrchestratorPanel"
import { BuildGrid } from "@/components/builds/BuildGrid"
import { BuildResultsPanel, type PanelMode } from "@/components/builds/BuildResultsPanel"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { useLocalConfig } from "@/hooks/use-local-config"
import { api, RateLimitError } from "@/services/api"
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

const POLL_INTERVAL_MS = 30_000
const MAX_POLL_INTERVAL_MS = 120_000

export function Builds() {
  const [config, setConfig] = useLocalConfig<DevOpsConfig>("devOpsConfig", DEFAULT_DEVOPS_CONFIG)
  const [connected, setConnected] = useState(false)
  const [autoConnecting, setAutoConnecting] = useState(false)
  const [recentBuilds, setRecentBuilds] = useState<Record<string, DevOpsBuild[]>>({})
  const [buildOverrides, setBuildOverrides] = useState<Record<string, number>>({})
  const [effectiveByBuildId, setEffectiveByBuildId] = useState<Record<number, { effectiveResult: string; hasRerun: boolean }>>({})
  const [triggeringKeys, setTriggeringKeys] = useState<Set<string>>(new Set())
  const [triggerErrors, setTriggerErrors] = useState<Record<string, string>>({})
  const [cancellingKeys, setCancellingKeys] = useState<Set<string>>(new Set())
  const [confirmStopKey, setConfirmStopKey] = useState<string | null>(null)
  const [branches, setBranches] = useState<string[]>([])
  const [branch, setBranch] = useState("master")
  const [targetInstance, setTargetInstance] = useState("A")
  const [stagingInstance, setStagingInstance] = useState("C")
  const [overrides, setOverrides] = useState<Record<string, { branch?: string; targetInstance?: string; stagingInstance?: string }>>({})
  const [selectedBuild, setSelectedBuild] = useState<DevOpsBuild | null>(null)
  const [panelMode, setPanelMode] = useState<PanelMode>("failed")
  const [failedTestsCache, setFailedTestsCache] = useState<Record<number, FailedTest[]>>({})
  const [skippedTestsCache, setSkippedTestsCache] = useState<Record<number, SkippedTest[]>>({})
  const prefetchedIdsRef = useRef<Set<number>>(new Set())
  const prefetchedSkippedIdsRef = useRef<Set<number>>(new Set())
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollIntervalRef = useRef(POLL_INTERVAL_MS)
  const inFlightRef = useRef(false)
  const [rateLimited, setRateLimited] = useState(false)
  const [sheetData, setSheetData] = useState<Map<string, SheetEntry>>(new Map())
  const [prefetchingTests, setPrefetchingTests] = useState(false)
  // Epoch ms until which polling runs even when no child build is
  // currently active. The orchestrator itself is a build in a separate
  // pipeline (261) that isn't tracked here, and it queues the 9 child
  // builds on a delay (~30s–several minutes depending on agent start-
  // up). Without this, `anyRunning` stays false after a trigger and
  // the poll loop never starts, so the cards don't update until the
  // user manually refreshes.
  const [forcePollUntil, setForcePollUntil] = useState(0)

  const definitionIds = useMemo(
    () => Object.values(config.pipelineMap).filter(Boolean),
    [config.pipelineMap],
  )

  // Displayed build per role: user-selected override, else most recent.
  // Falls back to latest if the pinned build id has aged out of the top-5 list.
  const builds = useMemo(() => {
    const map: Record<string, DevOpsBuild | null> = {}
    for (const key of ALL_ROLE_KEYS) {
      const list = recentBuilds[key] ?? []
      const overrideId = buildOverrides[key]
      const pinned = overrideId ? list.find((b) => b.id === overrideId) : undefined
      map[key] = pinned ?? list[0] ?? null
    }
    return map
  }, [recentBuilds, buildOverrides])

  const effectiveResults = useMemo(() => {
    const map: Record<string, { effectiveResult: string; hasRerun: boolean }> = {}
    for (const key of ALL_ROLE_KEYS) {
      const b = builds[key]
      const e = b ? effectiveByBuildId[b.id] : undefined
      if (e) map[key] = e
    }
    return map
  }, [builds, effectiveByBuildId])

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

  const applyBackoff = useCallback((retryAfter?: number) => {
    const floor = retryAfter ? retryAfter * 1000 : pollIntervalRef.current * 2
    pollIntervalRef.current = Math.min(floor, MAX_POLL_INTERVAL_MS)
    setRateLimited(true)
  }, [])

  const resetBackoff = useCallback(() => {
    if (pollIntervalRef.current !== POLL_INTERVAL_MS) {
      pollIntervalRef.current = POLL_INTERVAL_MS
      setRateLimited(false)
    }
  }, [])

  const fetchBuilds = useCallback(async () => {
    if (!connected || definitionIds.length === 0) return
    if (inFlightRef.current) return
    inFlightRef.current = true
    try {
      // Bumped from 50 → 100 to make the "last 5 per definition" window
      // robust when one pipeline is much more active than others.
      const result = await api.getDevOpsBuilds(config, definitionIds, 100)
      if (!result.success) return

      const recent: Record<string, DevOpsBuild[]> = {}
      for (const key of ALL_ROLE_KEYS) {
        const defId = config.pipelineMap[key]
        if (!defId) {
          recent[key] = []
          continue
        }
        recent[key] = result.builds
          .filter((b) => b.definitionId === defId)
          .slice(0, 5)
      }
      setRecentBuilds(recent)

      // Compute the currently displayed build per role using the same
      // rules as the render-time memo — we cannot read `builds` here
      // since it reflects the previous render.
      const displayed: Record<string, DevOpsBuild | null> = {}
      for (const key of ALL_ROLE_KEYS) {
        const list = recent[key]
        const overrideId = buildOverrides[key]
        const pinned = overrideId ? list.find((b) => b.id === overrideId) : undefined
        displayed[key] = pinned ?? list[0] ?? null
      }

      // Fetch effective status sequentially to reduce API pressure
      for (const key of ALL_ROLE_KEYS) {
        const build = displayed[key]
        if (
          build &&
          build.status === "completed" &&
          build.result !== "succeeded" &&
          build.result !== null
        ) {
          try {
            const res = await api.getDevOpsEffectiveStatus(config, build.id)
            if (res.success) {
              setEffectiveByBuildId((prev) => ({
                ...prev,
                [build.id]: { effectiveResult: res.effectiveResult, hasRerun: res.hasRerun },
              }))
            }
          } catch (err) {
            if (err instanceof RateLimitError) { applyBackoff(err.retryAfter); return }
          }
        }
      }

      // Prefetch failed tests sequentially to avoid overwhelming Azure DevOps
      const toPrefetch = ALL_ROLE_KEYS
        .map((key) => displayed[key])
        .filter((b): b is DevOpsBuild =>
          b !== null && b.status === "completed" && !prefetchedIdsRef.current.has(b.id)
        )

      if (toPrefetch.length > 0) {
        // Run in background — don't block fetchBuilds
        setPrefetchingTests(true)
        ;(async () => {
          for (const build of toPrefetch) {
            prefetchedIdsRef.current.add(build.id)
            try {
              const res = await api.getDevOpsFailedTests(config, build.id)
              if (res.success) {
                setFailedTestsCache((prev) => ({ ...prev, [build.id]: res.failedTests }))
              }
            } catch (err) {
              prefetchedIdsRef.current.delete(build.id)
              if (err instanceof RateLimitError) { applyBackoff(err.retryAfter); break }
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
            } catch (err) {
              prefetchedSkippedIdsRef.current.delete(build.id)
              if (err instanceof RateLimitError) { applyBackoff(err.retryAfter); break }
            }
          }
          setPrefetchingTests(false)
        })()
      }

      // Successful cycle — restore normal interval
      resetBackoff()
    } catch (err) {
      if (err instanceof RateLimitError) { applyBackoff(err.retryAfter); return }
      // Silent fail — will retry on next poll
    } finally {
      inFlightRef.current = false
    }
  }, [connected, config, definitionIds, buildOverrides, applyBackoff, resetBackoff])

  // Initial builds fetch on connect (re-fires when fetchBuilds identity changes)
  useEffect(() => {
    if (connected) fetchBuilds()
  }, [connected, fetchBuilds])

  // Fetch branches once per connect — isolated from fetchBuilds so a changing
  // fetchBuilds identity can't retrigger it. Intentionally omits `config` from
  // deps: reconnecting with a different PAT re-runs via the `connected` edge.
  useEffect(() => {
    if (!connected) return
    let cancelled = false
    api.getDevOpsBranches(config)
      .then((res) => { if (!cancelled && res.success) setBranches(res.branches) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [connected]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll while any LATEST build is running (regardless of which build the
  // user is viewing per card) — polling should track active work.
  const anyRunning = ALL_ROLE_KEYS.some((key) => {
    const latest = recentBuilds[key]?.[0]
    return latest?.status === "inProgress" || latest?.status === "notStarted"
  })

  useEffect(() => {
    if (!connected) {
      if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }
      return
    }
    // Keep polling while either:
    //   - something is actually running (normal case), or
    //   - we're inside the post-trigger force-poll window (catches
    //     orchestrator children that haven't been queued yet).
    // Evaluated fresh on each tick so expiry of forcePollUntil stops
    // the loop without needing another state change to re-trigger.
    const shouldKeepPolling = () => anyRunning || Date.now() < forcePollUntil
    if (!shouldKeepPolling()) {
      if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }
      return
    }
    const tick = () => {
      fetchBuilds().finally(() => {
        if (shouldKeepPolling()) {
          pollRef.current = setTimeout(tick, pollIntervalRef.current)
        } else {
          pollRef.current = null
        }
      })
    }
    pollRef.current = setTimeout(tick, pollIntervalRef.current)
    return () => {
      if (pollRef.current) { clearTimeout(pollRef.current); pollRef.current = null }
    }
  }, [anyRunning, connected, fetchBuilds, forcePollUntil])

  const handleTriggerSingle = async (roleKey: string) => {
    setTriggerErrors((prev) => {
      if (!(roleKey in prev)) return prev
      const next = { ...prev }
      delete next[roleKey]
      return next
    })
    const defId = config.pipelineMap[roleKey]
    if (!defId) {
      setTriggerErrors((prev) => ({
        ...prev,
        [roleKey]: `No pipeline mapped for ${roleKey}. Set one in Pipeline Mapping (advanced).`,
      }))
      return
    }
    const cardOverride = overrides[roleKey]
    const effectiveBranch = cardOverride?.branch || branch
    const effectiveProd = cardOverride?.targetInstance || targetInstance
    const effectiveStaging = cardOverride?.stagingInstance || stagingInstance
    const isVisual = roleKey.endsWith("_Visual")
    const effectiveInstance = isVisual
      ? `${effectiveProd}.${effectiveStaging}`
      : effectiveProd
    setTriggeringKeys((prev) => new Set(prev).add(roleKey))
    try {
      await api.triggerDevOpsPipeline(config, defId, effectiveBranch, {
        variables: { TargetInstance: effectiveInstance },
      })
      setTimeout(fetchBuilds, 2000)
    } catch (err) {
      setTriggerErrors((prev) => ({
        ...prev,
        [roleKey]: err instanceof Error ? err.message : "Trigger failed",
      }))
    } finally {
      setTriggeringKeys((prev) => {
        const next = new Set(prev)
        next.delete(roleKey)
        return next
      })
    }
  }

  const handleOverrideChange = (
    roleKey: string,
    field: "branch" | "targetInstance" | "stagingInstance",
    value: string,
  ) => {
    setOverrides((prev) => ({
      ...prev,
      [roleKey]: { ...prev[roleKey], [field]: value || undefined },
    }))
  }

  const handleOrchestratorTriggered = () => {
    // Orchestrator (pipeline 261) queues child builds on a delay, so
    // keep polling for 20 min regardless of whether anything is
    // currently visible as "running" — that window covers agent
    // start-up plus the full WarmUp + at least one Functional step.
    setForcePollUntil(Date.now() + 20 * 60 * 1000)
    setTimeout(fetchBuilds, 2000)
  }

  const handleRequestStop = (roleKey: string) => {
    setConfirmStopKey(roleKey)
  }

  const cancelBuildForKey = useCallback(async (roleKey: string) => {
    const build = builds[roleKey]
    if (!build) return
    setCancellingKeys((prev) => new Set(prev).add(roleKey))
    try {
      await api.cancelDevOpsBuild(config, build.id)
      setTimeout(fetchBuilds, 1500)
    } catch {
      setCancellingKeys((prev) => {
        const next = new Set(prev)
        next.delete(roleKey)
        return next
      })
    }
  }, [builds, config, fetchBuilds])

  // "Active" is computed against the LATEST build per role, not the one
  // the user is currently viewing, so Stop All targets real in-flight work.
  const activeRoleKeys = ALL_ROLE_KEYS.filter((key) => {
    const latest = recentBuilds[key]?.[0]
    return latest?.status === "inProgress" || latest?.status === "notStarted"
  })

  const handleSelectBuild = useCallback((roleKey: string, buildId: number | null) => {
    setBuildOverrides((prev) => {
      const next = { ...prev }
      if (buildId === null) delete next[roleKey]
      else next[roleKey] = buildId
      return next
    })
  }, [])

  const handleStopAll = useCallback(async () => {
    const targets = activeRoleKeys
    if (targets.length === 0) return
    setCancellingKeys((prev) => {
      const next = new Set(prev)
      targets.forEach((k) => next.add(k))
      return next
    })
    const jobs = targets.map((roleKey) => {
      const latest = recentBuilds[roleKey]?.[0]
      if (!latest) return Promise.resolve()
      return api.cancelDevOpsBuild(config, latest.id).catch(() => {
        setCancellingKeys((prev) => {
          const next = new Set(prev)
          next.delete(roleKey)
          return next
        })
      })
    })
    await Promise.allSettled(jobs)
    setTimeout(fetchBuilds, 1500)
  }, [activeRoleKeys, recentBuilds, config, fetchBuilds])

  // Clear optimistic `cancelling` flags once the server confirms
  // (status transitions to `cancelling` or the build is no longer active).
  useEffect(() => {
    setCancellingKeys((prev) => {
      if (prev.size === 0) return prev
      const next = new Set(prev)
      for (const key of prev) {
        const b = builds[key]
        if (!b) continue
        const stillActive = b.status === "inProgress" || b.status === "notStarted"
        if (!stillActive) next.delete(key)
      }
      return next.size === prev.size ? prev : next
    })
  }, [builds])

  const handleAddToSheet = useCallback(async (roleKey: string) => {
    const build = builds[roleKey]
    if (!build) return
    const platform = roleKey === "WarmUp" ? "Windows" : roleKey.split("_")[0]
    const type = roleKey === "WarmUp" ? "Warmup" : roleKey.split("_")[1] || "Functional"

    // Use cached data or fetch on demand
    let failed = failedTestsCache[build.id] ?? []
    let skipped = skippedTestsCache[build.id] ?? []

    if (!failedTestsCache[build.id]) {
      try {
        const res = await api.getDevOpsFailedTests(config, build.id)
        if (res.success) {
          failed = res.failedTests
          setFailedTestsCache((prev) => ({ ...prev, [build.id]: failed }))
        }
      } catch { /* use empty array */ }
    }

    if (!skippedTestsCache[build.id]) {
      try {
        const res = await api.getDevOpsSkippedTests(config, build.id)
        if (res.success) {
          skipped = res.skippedTests
          setSkippedTestsCache((prev) => ({ ...prev, [build.id]: skipped }))
        }
      } catch { /* use empty array */ }
    }

    // Filter out Visual Target tests that only failed because their Baseline failed
    const filteredFailed = failed.filter((t) =>
      !t.errorMessage?.includes("Baseline visual test failed and comparison test shouldn't be executed")
    )

    setSheetData((prev) => {
      const next = new Map(prev)
      next.set(roleKey, { roleKey, platform, type, failed: filteredFailed, skipped })
      return next
    })
  }, [builds, config, failedTestsCache, skippedTestsCache])

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

        {rateLimited && (
          <div className="mx-6 mt-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm text-yellow-300">
            Azure DevOps rate limit reached — polling slowed to {Math.round(pollIntervalRef.current / 1000)}s.
            It will resume normal speed automatically.
          </div>
        )}

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
                  stagingInstance={stagingInstance}
                  onBranchChange={setBranch}
                  onTargetInstanceChange={setTargetInstance}
                  onStagingInstanceChange={setStagingInstance}
                  onTriggered={handleOrchestratorTriggered}
                  activeBuildCount={activeRoleKeys.length}
                  onStopAll={handleStopAll}
                  warmUpBuild={builds["WarmUp"]}
                  warmUpEffective={effectiveResults["WarmUp"]}
                />
                <BuildGrid
                  builds={builds}
                  recentBuilds={recentBuilds}
                  buildOverrides={buildOverrides}
                  onSelectBuild={handleSelectBuild}
                  effectiveResults={effectiveResults}
                  branches={branches}
                  globalBranch={branch}
                  globalTargetInstance={targetInstance}
                  globalStagingInstance={stagingInstance}
                  overrides={overrides}
                  onOverrideChange={handleOverrideChange}
                  onTrigger={handleTriggerSingle}
                  onStop={handleRequestStop}
                  onShowResults={(build) => { setSelectedBuild(build); setPanelMode("failed") }}
                  onShowSkipped={(build) => { setSelectedBuild(build); setPanelMode("skipped") }}
                  onAddToSheet={handleAddToSheet}
                  sheetData={sheetData}
                  onSheetClear={handleSheetClear}
                  prefetchingTests={prefetchingTests}
                  triggeringKeys={triggeringKeys}
                  triggerErrors={triggerErrors}
                  cancellingKeys={cancellingKeys}
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

      <ConfirmDialog
        open={confirmStopKey !== null}
        onOpenChange={(o) => { if (!o) setConfirmStopKey(null) }}
        title="Stop this build?"
        description={
          confirmStopKey
            ? `This will cancel the ${confirmStopKey.replace(/_/g, " ")} build (#${builds[confirmStopKey]?.buildNumber ?? "?"}) in Azure DevOps.`
            : undefined
        }
        confirmLabel="Stop build"
        destructive
        onConfirm={async () => {
          if (confirmStopKey) await cancelBuildForKey(confirmStopKey)
        }}
      />
    </>
  )
}
