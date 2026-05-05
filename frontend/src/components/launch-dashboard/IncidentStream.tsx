import { useMemo } from "react"
import type { MigrationBlocker, RawTaskRecord } from "@/types"
import { buildIncidentItems, type IncidentFilter, type IncidentItem } from "./incidentItems"

interface IncidentStreamProps {
  blockers: MigrationBlocker[] | null
  prodFailures: RawTaskRecord[] | null
  newBugs: RawTaskRecord[] | null
  filter: IncidentFilter
  onFilterChange: (next: IncidentFilter) => void
  onPick: (item: IncidentItem) => void
}

/**
 * Unified sticky stream on the right: blockers, prod failures, and new
 * bugs collapsed into one sorted-by-severity list with tab filters.
 * Click a row to open the SidePanel with that item's detail.
 */
export function IncidentStream({
  blockers,
  prodFailures,
  newBugs,
  filter,
  onFilterChange,
  onPick,
}: IncidentStreamProps) {
  const items = useMemo<IncidentItem[]>(
    () => buildIncidentItems({ blockers, prodFailures, newBugs, filter }),
    [blockers, prodFailures, newBugs, filter],
  )

  const total = (blockers?.length ?? 0) + (prodFailures?.length ?? 0) + (newBugs?.length ?? 0)

  return (
    <aside id="incidents" className="lcc-incident-stream" style={{ scrollMarginTop: 16 }}>
      <div className="lcc-is-head">
        <h3>
          Incidents <span className="count">{items.length}</span>
        </h3>
        <div className="lcc-is-tabs">
          {(
            [
              { k: "all", l: "All", n: total },
              { k: "prod", l: "Prod", n: prodFailures?.length ?? 0 },
              { k: "blocker", l: "Blockers", n: blockers?.length ?? 0 },
              { k: "bug", l: "Bugs", n: newBugs?.length ?? 0 },
            ] as const
          ).map((t) => (
            <button
              key={t.k}
              type="button"
              className={`lcc-is-tab${filter === t.k ? " active" : ""}`}
              onClick={() => onFilterChange(t.k)}
            >
              {t.l}
              <span>{t.n}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="lcc-is-body">
        {items.length === 0 && <div className="lcc-is-empty">Nothing here. Take a breath.</div>}
        {items.map((item, idx) => (
          <div
            key={`${item.kind}-${item.id}-${idx}`}
            className="lcc-is-item"
            data-kind={item.kind}
            role="button"
            tabIndex={0}
            onClick={() => onPick(item)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onPick(item)
              }
            }}
          >
            <div className="lcc-is-kind">
              <span className="lcc-is-dot" data-severity={item.severity ?? undefined} />
              <span className="lcc-is-kind-label">{item.kind}</span>
              <span className="lcc-is-id">{item.id}</span>
            </div>
            <div className="lcc-is-title">{item.title}</div>
            {item.note && <div className="lcc-is-note">{item.note}</div>}
            <div className="lcc-is-foot">
              <span className="lcc-chip" data-severity={item.severity ?? undefined}>
                {item.severity ?? "—"}
              </span>
              {item.meta && <span className="lcc-is-meta">{item.meta}</span>}
              {item.time && <span className="lcc-is-time">{item.time}</span>}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
