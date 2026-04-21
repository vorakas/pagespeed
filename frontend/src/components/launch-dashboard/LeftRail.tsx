import { useMemo } from "react"
import type { MigrationKpis, MigrationWorkstream } from "@/types"

interface LeftRailProps {
  kpis: MigrationKpis | null
  workstreams: MigrationWorkstream[] | null
  activeArea: string | null
  onPickArea: (area: string | null) => void
  vaultLastSynced: string | null
}

/**
 * Sticky left rail: at-a-glance KPIs + workstream picker grouped by area.
 *
 * The area list comes from the workstream payload itself (grouped by
 * `ws.area`), with workstreams whose area wasn't set by the status page
 * bucketed under "Unsorted" so nothing disappears.
 */
export function LeftRail({
  kpis,
  workstreams,
  activeArea,
  onPickArea,
  vaultLastSynced,
}: LeftRailProps) {
  const grouped = useMemo(() => {
    const groups: Record<string, MigrationWorkstream[]> = {}
    for (const ws of workstreams ?? []) {
      const key = ws.area && ws.area.trim() ? ws.area : "Unsorted"
      ;(groups[key] ||= []).push(ws)
    }
    return groups
  }, [workstreams])

  const areaEntries = useMemo(
    () => Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)),
    [grouped],
  )

  return (
    <aside className="lcc-left-rail">
      <div className="lcc-lr-section">
        <div className="lcc-lr-label">At a glance</div>
        <div className="lcc-lr-stat">
          <div className="lcc-lr-stat-num">{fmt(kpis?.combinedUnique)}</div>
          <div className="lcc-lr-stat-sub">Combined unique tasks</div>
        </div>
        <div className="lcc-lr-stat-row">
          <div className="lcc-lr-stat-mini" data-tone="green">
            <div className="v">{kpis?.resolvedPct ?? "—"}%</div>
            <div className="l">Resolved</div>
          </div>
          <div className="lcc-lr-stat-mini" data-tone="red">
            <div className="v">{fmt(kpis?.productionFailures)}</div>
            <div className="l">Prod fail</div>
          </div>
        </div>
        <div className="lcc-lr-stat-row">
          <div className="lcc-lr-stat-mini" data-tone="amber">
            <div className="v">{fmt(kpis?.openBlockers)}</div>
            <div className="l">Blockers</div>
          </div>
          <div className="lcc-lr-stat-mini" data-tone="red">
            <div className="v">{fmt(kpis?.newBugs24h)}</div>
            <div className="l">New / 24h</div>
          </div>
        </div>
      </div>

      <div className="lcc-lr-section">
        <div className="lcc-lr-label">Areas</div>
        <button
          type="button"
          className={`lcc-lr-area${activeArea === null ? " active" : ""}`}
          onClick={() => onPickArea(null)}
        >
          <span className="lcc-lr-area-name">All areas</span>
          <span className="lcc-lr-area-meta">
            <span className="lcc-lr-area-count">{workstreams?.length ?? 0}</span>
          </span>
        </button>
        {areaEntries.map(([area, list]) => {
          const risky = list.filter((w) => w.status === "at-risk" || w.status === "blocked").length
          return (
            <button
              key={area}
              type="button"
              className={`lcc-lr-area${activeArea === area ? " active" : ""}`}
              onClick={() => onPickArea(area)}
            >
              <span className="lcc-lr-area-name">{area}</span>
              <span className="lcc-lr-area-meta">
                {risky > 0 && <span className="lcc-lr-area-risk">{risky}</span>}
                <span className="lcc-lr-area-count">{list.length}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="lcc-lr-section">
        <div className="lcc-lr-label">Source</div>
        <div className="lcc-lr-crumb">obsidian-vault</div>
        <div className="lcc-lr-crumb">└ /api/dashboard</div>
        <div className="lcc-lr-crumb">
          └ {vaultLastSynced ? `synced ${new Date(vaultLastSynced).toLocaleDateString()}` : "not synced"}
        </div>
      </div>
    </aside>
  )
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—"
  return Number(n).toLocaleString()
}
