import type { MigrationSource } from "@/types"

interface SourcesStripProps {
  rows: MigrationSource[]
}

/** Per-source rollup: total / resolved-pct bar across all Jira + Asana feeds. */
export function SourcesStrip({ rows }: SourcesStripProps) {
  if (rows.length === 0) {
    return (
      <div className="panel">
        <h3>Sources</h3>
        <p style={{ color: "var(--lcc-text-faint)", fontSize: 12 }}>No source records.</p>
      </div>
    )
  }
  return (
    <div className="panel">
      <h3>
        Sources<span className="count">{rows.length}</span>
      </h3>
      <div className="lcc-src-list">
        {rows.map((s) => (
          <div key={s.key} className="lcc-src-item">
            <div className="lcc-src-head">
              <span className="lcc-src-key">{s.key}</span>
              <span className="lcc-src-kind">{s.kind}</span>
              <span className="lcc-src-total">{s.total.toLocaleString()}</span>
            </div>
            <div className="lcc-src-name">{s.name}</div>
            <div className="lcc-src-bar">
              <span style={{ width: `${s.pct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
