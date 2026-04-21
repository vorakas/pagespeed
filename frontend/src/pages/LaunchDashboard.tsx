import { useCallback, useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { api } from "@/services/api"
import { LaunchShell } from "@/components/launch-dashboard/LaunchShell"
import { TopBar, type HealthFilter } from "@/components/launch-dashboard/TopBar"
import { LeftRail } from "@/components/launch-dashboard/LeftRail"
import { HeroStrip } from "@/components/launch-dashboard/HeroStrip"
import { ReadinessWall } from "@/components/launch-dashboard/ReadinessWall"
import type {
  MigrationBlocker,
  MigrationHealthSnapshot,
  MigrationKpis,
  MigrationWorkstream,
  RawTaskRecord,
} from "@/types"

export function LaunchDashboard() {
  const [health, setHealth] = useState<MigrationHealthSnapshot | null>(null)
  const [kpis, setKpis] = useState<MigrationKpis | null>(null)
  const [workstreams, setWorkstreams] = useState<MigrationWorkstream[] | null>(null)
  const [blockers, setBlockers] = useState<MigrationBlocker[] | null>(null)
  const [prodFailures, setProdFailures] = useState<RawTaskRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [filter, setFilter] = useState<HealthFilter>("all")
  const [activeArea, setActiveArea] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setError(null)
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
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  if (error) {
    return (
      <LaunchShell>
        <div style={{ padding: 24 }}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Launch Command Center</h1>
          <div className="panel" style={{ marginTop: 16, padding: "12px 16px", color: "var(--lcc-red)" }}>
            {error}
          </div>
        </div>
      </LaunchShell>
    )
  }

  if (!health || !kpis || !workstreams) {
    return (
      <LaunchShell>
        <div style={{ padding: 24, display: "flex", alignItems: "center", gap: 8, color: "var(--lcc-text-dim)", fontSize: 13 }}>
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
            onPick={() => {
              /* phase d: opens side panel */
            }}
            areaFilter={activeArea}
            healthFilter={filter}
          />

          <div id="incidents" className="panel" style={{ padding: "18px 20px" }}>
            <h3 style={{ margin: 0, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lcc-text-faint)", fontWeight: 600 }}>
              Blockers &amp; Production Failures
            </h3>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
              {blockers?.map((b) => (
                <div key={b.id} style={{ display: "flex", alignItems: "baseline", gap: 8, fontSize: 12 }}>
                  <span className="lcc-chip" data-severity={b.severity ?? undefined}>
                    {b.severity ?? "—"}
                  </span>
                  <strong>{b.name}</strong>
                  {b.note && <span style={{ color: "var(--lcc-text-dim)" }}>— {b.note}</span>}
                </div>
              ))}
              {prodFailures && prodFailures.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", textTransform: "uppercase", letterSpacing: "0.12em", color: "var(--lcc-text-faint)" }}>
                    Production failures · {prodFailures.length}
                  </div>
                  {prodFailures.map((t) => (
                    <div key={t.relPath} style={{ display: "flex", gap: 8, fontSize: 12, marginTop: 4 }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--lcc-text-faint)" }}>
                        {t.key}
                      </span>
                      <span>{t.summary ?? "(no summary)"}</span>
                      {t.assignee && <span style={{ color: "var(--lcc-text-dim)" }}>— {t.assignee}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div id="graph" className="panel" style={{ padding: "18px 20px" }}>
            <h3 style={{ margin: 0, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lcc-text-faint)", fontWeight: 600 }}>
              Knowledge Graph
            </h3>
            <p style={{ fontSize: 12, color: "var(--lcc-text-faint)", marginTop: 6 }}>
              Workstream ↔ blocker ↔ task graph will render here in a later phase.
            </p>
          </div>
        </main>

        <aside className="lcc-incident-stream" style={{ padding: "16px 18px" }}>
          <h3 style={{ margin: 0, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--lcc-text-faint)", fontWeight: 600 }}>
            Incidents <span style={{ float: "right", fontFamily: "var(--font-mono)", color: "var(--lcc-text-dim)", letterSpacing: 0, textTransform: "none" }}>{(blockers?.length ?? 0) + (prodFailures?.length ?? 0)}</span>
          </h3>
          <p style={{ fontSize: 12, color: "var(--lcc-text-faint)", marginTop: 8 }}>
            Unified blockers / prod / bugs stream lands in phase (c4).
          </p>
        </aside>
      </div>
    </LaunchShell>
  )
}
