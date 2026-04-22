import { useMemo } from "react"
import type { MigrationBlocker, RawTaskRecord } from "@/types"

export type IncidentFilter = "all" | "prod" | "blocker" | "bug"

export interface IncidentItem {
  kind: "prod" | "blocker" | "bug"
  id: string
  title: string
  note: string | null
  severity: string | null
  meta: string | null
  time: string | null
  raw: MigrationBlocker | RawTaskRecord
}

interface IncidentStreamProps {
  blockers: MigrationBlocker[] | null
  prodFailures: RawTaskRecord[] | null
  newBugs: RawTaskRecord[] | null
  filter: IncidentFilter
  onFilterChange: (next: IncidentFilter) => void
  onPick: (item: IncidentItem) => void
}

const SEV_ORDER: Record<string, number> = {
  critical: 0,
  blocker: 0,
  high: 1,
  medium: 2,
  low: 3,
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
  const items = useMemo<IncidentItem[]>(() => {
    const out: IncidentItem[] = []
    for (const p of prodFailures ?? []) {
      out.push({
        kind: "prod",
        id: p.key,
        title: p.summary ?? "(no summary)",
        note: p.uatStatus ?? p.status,
        severity: (p.priority ?? "").toLowerCase() || "medium",
        meta: p.assignee,
        time: "active",
        raw: p,
      })
    }
    for (const b of blockers ?? []) {
      out.push({
        kind: "blocker",
        id: b.id,
        title: b.name,
        note: b.note,
        severity: (b.severity ?? "").toLowerCase() || "medium",
        meta: b.affects.join(", "),
        time: b.status || null,
        raw: b,
      })
    }
    for (const n of newBugs ?? []) {
      out.push({
        kind: "bug",
        id: n.key,
        title: n.summary ?? "(no summary)",
        note: n.assignee ? `@${n.assignee}` : "UNASSIGNED",
        severity: (n.priority ?? "").toLowerCase() || "medium",
        meta: n.project,
        time: n.created ? `filed ${n.created}` : null,
        raw: n,
      })
    }
    return out
      .filter((i) => filter === "all" || i.kind === filter)
      .sort((a, b) => (SEV_ORDER[a.severity ?? "medium"] ?? 9) - (SEV_ORDER[b.severity ?? "medium"] ?? 9))
  }, [blockers, prodFailures, newBugs, filter])

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
