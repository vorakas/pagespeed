import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { api } from "@/services/api"
import type {
  MigrationHealthSnapshot,
  MigrationKpis,
  MigrationWorkstream,
  MigrationBlocker,
  RawTaskRecord,
} from "@/types"

/**
 * Launch Command Center — phase (b) placeholder.
 *
 * Phase (c) will replace this with the full Aurora Glass layout: TopBar,
 * LeftRail, HeroStrip, ReadinessWall, TrendChart, TaskStatusStrip,
 * TeamsStrip, SourcesStrip, and IncidentStream. Anchor markers
 * (#graph, #workstreams, #incidents) are placed here so the sidebar
 * hash links already scroll to meaningful sections.
 */
export function LaunchDashboard() {
  const [health, setHealth] = useState<MigrationHealthSnapshot | null>(null)
  const [kpis, setKpis] = useState<MigrationKpis | null>(null)
  const [workstreams, setWorkstreams] = useState<MigrationWorkstream[] | null>(null)
  const [blockers, setBlockers] = useState<MigrationBlocker[] | null>(null)
  const [prodFailures, setProdFailures] = useState<RawTaskRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [h, k, ws, bl, pf] = await Promise.all([
          api.getMigrationHealth(),
          api.getMigrationKpis(),
          api.getMigrationWorkstreams(),
          api.getMigrationBlockers(),
          api.getMigrationProductionFailures(),
        ])
        setHealth(h)
        setKpis(k)
        setWorkstreams(ws)
        setBlockers(bl)
        setProdFailures(pf)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard")
      }
    })()
  }, [])

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Launch Command Center</h1>
        <div className="mt-4 rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      </div>
    )
  }

  if (!health || !kpis || !workstreams) {
    return (
      <div className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={14} className="animate-spin" />
        Loading vault data…
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Launch Command Center</h1>
        <p className="text-sm text-muted-foreground">
          Executive view of the LP → Adobe Commerce migration. Redesign coming next.
        </p>
      </header>

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Health
        </h2>
        <p className="text-sm">
          Overall: <strong className="font-semibold">{health.overall ?? "—"}</strong>
          {health.launchWindow && (
            <>
              {" · "}Launch window {health.launchWindow.start}
              {health.launchWindow.end ? ` → ${health.launchWindow.end}` : ""}
            </>
          )}
          {health.lastSynced && (
            <span className="text-muted-foreground"> · synced {new Date(health.lastSynced).toLocaleString()}</span>
          )}
        </p>
        {health.headline && <p className="mt-2 text-sm">{health.headline}</p>}
        {health.reasons.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-sm space-y-0.5">
            {health.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Kpi label="Combined Unique" value={kpis.combinedUnique} />
        <Kpi label="Resolved" value={`${kpis.combinedResolved} (${kpis.resolvedPct}%)`} />
        <Kpi label="Production Failures" value={kpis.productionFailures} tone="red" />
        <Kpi label="Open Blockers" value={kpis.openBlockers} tone="amber" sub={`${kpis.criticalBlockers} critical`} />
        <Kpi label="New Bugs / 24h" value={kpis.newBugs24h} tone="red" />
      </section>

      <section id="workstreams" className="rounded-lg border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Workstreams ({workstreams.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {workstreams.map((ws) => (
            <div key={ws.id} className="rounded border p-2">
              <div className="flex items-baseline justify-between gap-2">
                <div className="font-medium text-sm truncate">{ws.name}</div>
                <span className="text-[10px] font-mono uppercase text-muted-foreground">
                  {ws.status ?? "—"}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {ws.area ?? "unsorted"} · {ws.closed}/{ws.tasks} closed
                {ws.blockers.length > 0 && ` · ${ws.blockers.length} blocker${ws.blockers.length === 1 ? "" : "s"}`}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="incidents" className="rounded-lg border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Blockers & Production Failures
        </h2>
        {blockers && blockers.length > 0 && (
          <div>
            <p className="text-xs font-semibold mt-1 mb-1">Blockers ({blockers.length})</p>
            <ul className="space-y-1 text-sm">
              {blockers.map((b) => (
                <li key={b.id} className="text-sm">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground mr-2">
                    {b.severity ?? "—"}
                  </span>
                  <strong>{b.name}</strong>
                  {b.note && <span className="text-muted-foreground"> — {b.note}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        {prodFailures && prodFailures.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold mb-1">Production Failures ({prodFailures.length})</p>
            <ul className="space-y-1 text-sm">
              {prodFailures.map((t) => (
                <li key={t.relPath}>
                  <span className="font-mono text-[11px] text-muted-foreground mr-2">{t.key}</span>
                  {t.summary ?? "(no summary)"}
                  {t.assignee && <span className="text-muted-foreground"> — {t.assignee}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section id="graph" className="rounded-lg border bg-card p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
          Knowledge Graph
        </h2>
        <p className="text-xs text-muted-foreground">
          Workstream ↔ blocker ↔ task graph will render here.
        </p>
      </section>
    </div>
  )
}

function Kpi({ label, value, sub, tone }: { label: string; value: string | number; sub?: string; tone?: "red" | "amber" | "green" }) {
  const toneClass =
    tone === "red" ? "text-red-500" : tone === "amber" ? "text-amber-500" : tone === "green" ? "text-emerald-500" : ""
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  )
}
