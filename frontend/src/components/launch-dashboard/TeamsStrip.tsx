import type { MigrationTeam } from "@/types"

interface TeamsStripProps {
  rows: MigrationTeam[]
}

/** 2-column grid of team cards with assignment-rate progress bar. */
export function TeamsStrip({ rows }: TeamsStripProps) {
  if (rows.length === 0) {
    return (
      <div className="panel">
        <h3>Teams</h3>
        <p style={{ color: "var(--lcc-text-faint)", fontSize: 12 }}>No team records.</p>
      </div>
    )
  }
  return (
    <div className="panel">
      <h3>
        Teams<span className="count">{rows.length}</span>
      </h3>
      <div className="lcc-teams-list">
        {rows.map((t) => {
          const rate = t.unassignedRate ?? 0
          const risk = rate >= 50 ? "high" : rate >= 20 ? "med" : "low"
          const pct = t.totalTasks
            ? Math.round(((t.assignedTasks ?? 0) / t.totalTasks) * 100)
            : 0
          return (
            <div key={t.id} className="lcc-team-item" data-risk={risk}>
              <div className="ti-top">
                <span className="ti-name">{t.name}</span>
                {t.unassignedRate != null && (
                  <span className="ti-unassigned">{t.unassignedRate}% open</span>
                )}
              </div>
              <div className="ti-lead">
                {t.lead ?? "—"}
                {t.qaLead ? ` · QA ${t.qaLead}` : ""}
              </div>
              {t.totalTasks != null && (
                <div className="ti-bar">
                  <span style={{ width: `${pct}%` }} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
