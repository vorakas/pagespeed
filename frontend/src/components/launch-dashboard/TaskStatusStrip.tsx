import type { MigrationTaskStatusRow } from "@/types"

interface TaskStatusStripProps {
  rows: MigrationTaskStatusRow[]
}

/**
 * Horizontal stacked-bar breakdown of ACE2E task statuses.
 * Widths are computed as a % of the project total.
 */
export function TaskStatusStrip({ rows }: TaskStatusStripProps) {
  if (rows.length === 0) {
    return (
      <div className="panel lcc-ts-panel">
        <h3>ACE2E status</h3>
        <p style={{ color: "var(--lcc-text-faint)", fontSize: 12 }}>No tasks.</p>
      </div>
    )
  }
  const total = rows.reduce((s, r) => s + r.count, 0) || 1
  return (
    <div className="panel lcc-ts-panel">
      <h3>
        ACE2E status
        <span className="count">{total.toLocaleString()}</span>
      </h3>
      <div className="lcc-ts-stack">
        {rows.map((r) => (
          <div key={r.status} className="lcc-ts-row">
            <span className="lcc-sdot" data-color={r.color} />
            <span className="lcc-ts-label" title={r.status}>
              {r.status}
            </span>
            <div className="lcc-ts-track">
              <span
                className="lcc-ts-fill"
                data-color={r.color}
                style={{ width: `${(r.count / total) * 100}%` }}
              />
            </div>
            <span className="lcc-ts-num">{r.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
