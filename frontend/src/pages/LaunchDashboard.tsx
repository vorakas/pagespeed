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
import type {
  MigrationBlocker,
  MigrationHealthSnapshot,
  MigrationKpis,
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
  const [error, setError] = useState<string | null>(null)

  const [filter, setFilter] = useState<HealthFilter>("all")
  const [activeArea, setActiveArea] = useState<string | null>(null)
  const [streamFilter, setStreamFilter] = useState<IncidentFilter>("all")
  const [sidePanelTarget, setSidePanelTarget] = useState<SidePanelTarget | null>(null)

  const loadAll = useCallback(async () => {
    setError(null)
    try {
      const [h, k, ws, bl, pf, nb, ts, tr, tm, sr] = await Promise.all([
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard")
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
        onRefresh={() => void loadAll()}
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

          <div id="graph" className="panel">
            <h3>Knowledge Graph</h3>
            <p style={{ fontSize: 12, color: "var(--lcc-text-faint)", margin: 0 }}>
              Workstream ↔ blocker ↔ task graph will render here in a later phase.
            </p>
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
