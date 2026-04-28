import { useMemo } from "react"
import type { MigrationWorkstream } from "@/types"

interface ReadinessWallProps {
  rows: MigrationWorkstream[]
  onPick: (workstream: MigrationWorkstream) => void
  areaFilter: string | null
  healthFilter: string
}

const LEGEND: Array<{ key: string; label: string }> = [
  { key: "blocked", label: "blocked" },
  { key: "at-risk", label: "at risk" },
  { key: "in-progress", label: "in progress" },
  { key: "near-complete", label: "near complete" },
]

/**
 * The migration's centerpiece: one glass card per workstream, grouped
 * by area. Cards use data-status for the left-edge color strip and
 * progress-bar gradient tint.
 */
export function ReadinessWall({ rows, onPick, areaFilter, healthFilter }: ReadinessWallProps) {
  const filtered = useMemo(
    () =>
      rows.filter((w) => {
        if (areaFilter && (w.area ?? "Unsorted") !== areaFilter) return false
        if (healthFilter !== "all" && w.status !== healthFilter) return false
        return true
      }),
    [rows, areaFilter, healthFilter],
  )

  const grouped = useMemo(() => {
    const g: Record<string, MigrationWorkstream[]> = {}
    for (const w of filtered) {
      const key = w.area && w.area.trim() ? w.area : "Unsorted"
      ;(g[key] ||= []).push(w)
    }
    return g
  }, [filtered])

  const groupEntries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div id="workstreams" className="panel lcc-wall-panel" style={{ scrollMarginTop: 16 }}>
      <div className="lcc-wall-head">
        <h3>
          Launch readiness
          <span className="count">
            {filtered.length} / {rows.length} workstreams
          </span>
        </h3>
        <div className="lcc-wall-legend">
          {LEGEND.map((l) => (
            <span key={l.key} className="lg-item">
              <span className="d" data-health={l.key} />
              {l.label}
            </span>
          ))}
        </div>
      </div>

      <div className="lcc-wall-body">
        {groupEntries.length === 0 && (
          <div className="lcc-wall-empty">No workstreams match current filters</div>
        )}
        {groupEntries.map(([area, list]) => (
          <div key={area}>
            <div className="lcc-wall-group-head">
              <span>{area}</span>
              <span className="lcc-wall-group-sep" />
              <span className="lcc-wall-group-count">{list.length}</span>
            </div>
            <div className="lcc-wall-cells">
              {list.map((w) => {
                const pct = w.tasks ? Math.round((w.closed / w.tasks) * 100) : 0
                return (
                  <button
                    key={w.id}
                    type="button"
                    className="lcc-wall-cell"
                    data-status={w.status ?? undefined}
                    onClick={() => onPick(w)}
                  >
                    <div className="lcc-wc-top">
                      <span className="lcc-wc-id">{w.id}</span>
                      {w.blockers.length > 0 && (
                        <span className="lcc-wc-block">⚠ {w.blockers.length}</span>
                      )}
                    </div>
                    <div className="lcc-wc-name">{w.name}</div>
                    <div className="lcc-wc-progress">
                      <div className="lcc-wc-progress-bar">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                      <div className="lcc-wc-progress-pct">{pct}%</div>
                    </div>
                    <div className="lcc-wc-meta">
                      {w.tasks > 0 && (
                        <span>
                          {w.closed}/{w.tasks}
                        </span>
                      )}
                      {w.failedQa > 0 && <span className="red">{w.failedQa} QA fail</span>}
                      {w.inProgress > 0 && <span className="green">{w.inProgress} in prog</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
