import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { api } from "@/services/api"
import { LaunchShell } from "@/components/launch-dashboard/LaunchShell"
import { TopBar, type HealthFilter } from "@/components/launch-dashboard/TopBar"
import { LeftRail } from "@/components/launch-dashboard/LeftRail"
import { HeroStrip } from "@/components/launch-dashboard/HeroStrip"
import { ReadinessWall } from "@/components/launch-dashboard/ReadinessWall"
import { TrendChart } from "@/components/launch-dashboard/TrendChart"
import { TaskStatusStrip } from "@/components/launch-dashboard/TaskStatusStrip"
import { TeamsStrip } from "@/components/launch-dashboard/TeamsStrip"
import { SourcesStrip } from "@/components/launch-dashboard/SourcesStrip"
import {
  IncidentStream,
  type IncidentFilter,
  type IncidentItem,
} from "@/components/launch-dashboard/IncidentStream"
import { SidePanel, type SidePanelTarget } from "@/components/launch-dashboard/SidePanel"
import { WhatChangedToday } from "@/components/launch-dashboard/WhatChangedToday"
import { DailyStatusSummary } from "@/components/launch-dashboard/DailyStatusSummary"
import type {
  MigrationBlocker,
  MigrationHealthSnapshot,
  MigrationKpis,
  MigrationSnapshotDiffResponse,
  MigrationSource,
  MigrationTaskStatusRow,
  MigrationTeam,
  MigrationTrendPoint,
  MigrationWorkstream,
  RawTaskRecord,
} from "@/types"

export function LaunchDashboard() {
  const [health, setHealth] = useState<MigrationHealthSnapshot | null>(null)
  const [kpis, setKpis] = useState<MigrationKpis | null>(null)
  const [workstreams, setWorkstreams] = useState<MigrationWorkstream[] | null>(null)
  const [blockers, setBlockers] = useState<MigrationBlocker[] | null>(null)
  const [prodFailures, setProdFailures] = useState<RawTaskRecord[] | null>(null)
  const [newBugs, setNewBugs] = useState<RawTaskRecord[] | null>(null)
  const [taskStatus, setTaskStatus] = useState<MigrationTaskStatusRow[] | null>(null)
  const [trend, setTrend] = useState<MigrationTrendPoint[] | null>(null)
  const [teams, setTeams] = useState<MigrationTeam[] | null>(null)
  const [sources, setSources] = useState<MigrationSource[] | null>(null)
  const [snapshotDiff, setSnapshotDiff] = useState<MigrationSnapshotDiffResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [filter, setFilter] = useState<HealthFilter>("all")
  const [activeArea, setActiveArea] = useState<string | null>(null)
  const [streamFilter, setStreamFilter] = useState<IncidentFilter>("all")
  const [sidePanelTarget, setSidePanelTarget] = useState<SidePanelTarget | null>(null)

  const loadAll = useCallback(async (force: boolean = false) => {
    setError(null)
    if (force) setRefreshing(true)
    try {
      if (force) {
        // Kick off a full vault sync (Jira + Asana → disk) and wait for
        // completion. If a sync is already running we skip the start and
        // just poll. Errors swallowed — if sync fails (no creds, network,
        // etc.) we still want to re-parse whatever's on disk.
        try {
          const start = await api
            .startObsidianSync({ source: "both", fullRefresh: true })
            .catch(() => null)
          if (start?.success || start === null) {
            for (let i = 0; i < 180; i++) {
              await new Promise((r) => setTimeout(r, 2_000))
              const active = await api.getObsidianActiveSync().catch(() => ({ active: null }))
              if (!active.active) break
            }
          }
        } catch {
          // Non-fatal; fall through to local refresh.
        }
        // Drop the in-process service cache and re-parse status files so
        // the next reads hit the vault fresh.
        await fetch("/api/dashboard/cache/invalidate", { method: "POST" }).catch(() => null)
        await fetch("/api/dashboard/snapshots/reingest", { method: "POST" }).catch(() => null)
      }
      const [h, k, ws, bl, pf, nb, ts, tr, tm, sr, sd] = await Promise.all([
        api.getMigrationHealth(),
        api.getMigrationKpis(),
        api.getMigrationWorkstreams(),
        api.getMigrationBlockers(),
        api.getMigrationProductionFailures(),
        api.getMigrationNewBugs(),
        api.getMigrationTaskStatus(),
        api.getMigrationTrend(),
        api.getMigrationTeams(),
        api.getMigrationSources(),
        // Snapshots may be empty on a fresh DB — swallow 503/404 and keep the rest.
        api.getMigrationSnapshotDiff().catch(() => null),
      ])
      setHealth(h)
      setKpis(k)
      setWorkstreams(ws)
      setBlockers(bl)
      setProdFailures(pf)
      setNewBugs(nb)
      setTaskStatus(ts)
      setTrend(tr)
      setTeams(tm)
      setSources(sr)
      setSnapshotDiff(sd)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard")
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const openIncident = useCallback((item: IncidentItem) => {
    if (item.kind === "blocker") {
      setSidePanelTarget({ kind: "blocker", blocker: item.raw as MigrationBlocker })
    } else {
      setSidePanelTarget({ kind: "task", task: item.raw as RawTaskRecord })
    }
  }, [])

  if (error) {
    return (
      <LaunchShell>
        <div style={{ padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Launch Command Center</h1>
          <div
            className="panel"
            style={{ marginTop: 16, padding: "12px 16px", color: "var(--lcc-red)" }}
          >
            {error}
          </div>
        </div>
      </LaunchShell>
    )
  }

  if (!health || !kpis || !workstreams) {
    return (
      <LaunchShell>
        <div
          style={{
            padding: 24,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "var(--lcc-text-dim)",
            fontSize: 13,
          }}
        >
          <Loader2 size={14} className="animate-spin" />
          Loading vault data…
        </div>
      </LaunchShell>
    )
  }

  return (
    <LaunchShell>
      <TopBar
        health={health}
        filter={filter}
        onFilterChange={setFilter}
        onRefresh={() => void loadAll(true)}
        refreshing={refreshing}
      />
      <div className="lcc-shell">
        <LeftRail
          kpis={kpis}
          workstreams={workstreams}
          activeArea={activeArea}
          onPickArea={setActiveArea}
          vaultLastSynced={health.lastSynced}
        />

        <main className="lcc-main">
          <HeroStrip health={health} />

          {snapshotDiff?.latest && snapshotDiff.diff && (
            <WhatChangedToday latest={snapshotDiff.latest} diff={snapshotDiff.diff} />
          )}

          {snapshotDiff?.latest && <DailyStatusSummary snapshot={snapshotDiff.latest} />}

          <ReadinessWall
            rows={workstreams}
            onPick={(ws) => setSidePanelTarget({ kind: "workstream", workstream: ws })}
            areaFilter={activeArea}
            healthFilter={filter}
          />

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1fr",
              gap: 14,
            }}
          >
            {trend && <TrendChart rows={trend} />}
            {taskStatus && <TaskStatusStrip rows={taskStatus} />}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {teams && <TeamsStrip rows={teams} />}
            {sources && <SourcesStrip rows={sources} />}
          </div>
        </main>

        <IncidentStream
          blockers={blockers}
          prodFailures={prodFailures}
          newBugs={newBugs}
          filter={streamFilter}
          onFilterChange={setStreamFilter}
          onPick={openIncident}
        />
      </div>

      <SidePanel target={sidePanelTarget} onClose={() => setSidePanelTarget(null)} />
    </LaunchShell>
  )
}
