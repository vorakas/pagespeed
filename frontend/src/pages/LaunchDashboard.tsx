import { useCallback, useEffect, useState } from "react"
import { useLocation } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { api } from "@/services/api"
import { LaunchShell } from "@/components/launch-dashboard/LaunchShell"
import { LeftRail } from "@/components/launch-dashboard/LeftRail"
import { HeroStrip, type HeroIssueKpi } from "@/components/launch-dashboard/HeroStrip"
import {
  IncidentStream,
} from "@/components/launch-dashboard/IncidentStream"
import {
  buildIncidentItems,
  type IncidentFilter,
  type IncidentItem,
} from "@/components/launch-dashboard/incidentItems"
import { SidePanel, type SidePanelTarget } from "@/components/launch-dashboard/SidePanel"
import { WhatChangedToday } from "@/components/launch-dashboard/WhatChangedToday"
import { LaunchPriorityDailyStatus } from "@/components/launch-dashboard/LaunchPriorityDailyStatus"
import { LaunchReportSections } from "@/components/launch-dashboard/LaunchReportSections"
import type {
  LaunchReportResponse,
  MigrationLaunchPriorities,
  MigrationBlocker,
  MigrationHealthSnapshot,
  MigrationKpis,
  MigrationSnapshotDiffResponse,
  MigrationSource,
  MigrationWorkstream,
  RawTaskRecord,
} from "@/types"

const ISSUE_PANEL_COPY: Record<
  HeroIssueKpi,
  { title: string; description: string; emptyLabel: string }
> = {
  prod: {
    title: "Production failures",
    description: "Active production failures from the migration task feed, sorted by priority and recency.",
    emptyLabel: "No production failures.",
  },
  blocker: {
    title: "Open blockers",
    description: "Blocking items that affect one or more migration workstreams.",
    emptyLabel: "No open blockers.",
  },
  bug: {
    title: "New bugs in 24h",
    description: "Recently filed bugs from the last 24 hours, sorted by priority and recency.",
    emptyLabel: "No new bugs in 24h.",
  },
}

export function LaunchDashboard() {
  const [health, setHealth] = useState<MigrationHealthSnapshot | null>(null)
  const [kpis, setKpis] = useState<MigrationKpis | null>(null)
  const [workstreams, setWorkstreams] = useState<MigrationWorkstream[] | null>(null)
  const [blockers, setBlockers] = useState<MigrationBlocker[] | null>(null)
  const [prodFailures, setProdFailures] = useState<RawTaskRecord[] | null>(null)
  const [newBugs, setNewBugs] = useState<RawTaskRecord[] | null>(null)
  const [newBugs24h, setNewBugs24h] = useState<RawTaskRecord[] | null>(null)
  const [launchPriorities, setLaunchPriorities] = useState<MigrationLaunchPriorities | null>(null)
  const [sources, setSources] = useState<MigrationSource[] | null>(null)
  const [snapshotDiff, setSnapshotDiff] = useState<MigrationSnapshotDiffResponse | null>(null)
  const [launchReport, setLaunchReport] = useState<LaunchReportResponse | null>(null)
  const [launchReportError, setLaunchReportError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [streamFilter, setStreamFilter] = useState<IncidentFilter>("all")
  const [sidePanelTarget, setSidePanelTarget] = useState<SidePanelTarget | null>(null)

  const location = useLocation()

  useEffect(() => {
    if (!location.hash) return
    if (!workstreams || !blockers) return
    const id = location.hash.slice(1)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [location.hash, location.key, workstreams, blockers])

  const loadAll = useCallback(async (force: boolean = false) => {
    setError(null)
    if (force) setRefreshing(true)
    try {
      if (force) {
        try {
          const start = await api.startObsidianSync({ source: "both" }).catch(() => null)
          if (start?.success || start === null) {
            for (let i = 0; i < 180; i++) {
              await new Promise((resolve) => setTimeout(resolve, 2_000))
              const active = await api.getObsidianActiveSync().catch(() => ({ active: null }))
              if (!active.active) break
            }
          }
        } catch {
          // Non-fatal; fall through to local refresh.
        }
        await fetch("/api/dashboard/cache/invalidate", { method: "POST" }).catch(() => null)
        await fetch("/api/dashboard/snapshots/reingest", { method: "POST" }).catch(() => null)
      }

      const [overview, reportResult] = await Promise.all([
        api.getMigrationOverview(),
        api
          .getLaunchReport()
          .then((data) => ({ data, error: null }))
          .catch((err) => ({
            data: null,
            error: err instanceof Error ? err.message : "Failed to load launch report",
          })),
      ])
      const bugs24h = await api.getMigrationNewBugs(1).catch(() => overview.newBugs)
      setHealth(overview.health)
      setKpis(overview.kpis)
      setWorkstreams(overview.workstreams)
      setBlockers(overview.blockers)
      setProdFailures(overview.productionFailures)
      setNewBugs(overview.newBugs)
      setNewBugs24h(bugs24h)
      setLaunchPriorities(overview.launchPriorities)
      setSources(overview.sources)
      setSnapshotDiff(overview.snapshotDiff)
      setLaunchReport(reportResult.data)
      setLaunchReportError(reportResult.error)
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

  const openIssueSummary = useCallback((kind: HeroIssueKpi) => {
    const copy = ISSUE_PANEL_COPY[kind]
    const panelNewBugs = kind === "bug" ? newBugs24h : newBugs
    setStreamFilter(kind)
    setSidePanelTarget({
      kind: "issue-summary",
      issueKind: kind,
      title: copy.title,
      description: copy.description,
      emptyLabel: copy.emptyLabel,
      items: buildIncidentItems({ blockers, prodFailures, newBugs: panelNewBugs, filter: kind }),
    })
  }, [blockers, prodFailures, newBugs, newBugs24h])

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
          Loading vault data...
        </div>
      </LaunchShell>
    )
  }

  return (
    <LaunchShell>
      <div className="lcc-shell">
        <LeftRail
          sources={sources}
          workstreams={workstreams}
          blockers={blockers}
          prodFailures={prodFailures}
          vaultLastSynced={health.lastSynced}
        />

        <main className="lcc-main">
          <HeroStrip
            health={health}
            kpis={kpis}
            onIssueKpiClick={openIssueSummary}
            onRefresh={() => void loadAll(true)}
            refreshing={refreshing}
          />

          <LaunchReportSections data={launchReport} error={launchReportError} />

          <WhatChangedToday />

          <LaunchPriorityDailyStatus
            snapshot={snapshotDiff?.latest ?? null}
            launchPriorities={launchPriorities}
          />
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

      <SidePanel
        target={sidePanelTarget}
        onClose={() => setSidePanelTarget(null)}
        onPickIssue={openIncident}
      />
    </LaunchShell>
  )
}
