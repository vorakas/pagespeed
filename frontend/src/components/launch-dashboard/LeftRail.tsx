import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import type { MigrationKpis, MigrationWorkstream } from "@/types"

interface LeftRailProps {
  kpis: MigrationKpis | null
  workstreams: MigrationWorkstream[] | null
  vaultLastSynced: string | null
}

/**
 * Sticky left rail: at-a-glance KPIs + a ranked "Needs attention" shortlist.
 *
 * The shortlist replaces the old Areas filter — most workstreams fell under
 * "Unsorted" because the status page's Project Health by Area table only
 * categorized ~8 of 34, and the Workstreams picker rail already covers
 * per-area navigation. This surfaces the top handful of workstreams with
 * open blockers / failed QA / risky status so the dashboard gives an
 * actionable triage queue instead of a cold filter list.
 */
export function LeftRail({
  kpis,
  workstreams,
  vaultLastSynced,
}: LeftRailProps) {
  const navigate = useNavigate()

  const needsAttention = useMemo(() => {
    if (!workstreams) return []
    const scored = workstreams
      .map((ws) => ({ ws, score: attentionScore(ws) }))
      .filter(({ score }) => score > 0)
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, 7)
  }, [workstreams])

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
        <div className="lcc-lr-label">
          Needs attention
          {needsAttention.length > 0 && (
            <span className="lcc-lr-label-count">{needsAttention.length}</span>
          )}
        </div>
        {needsAttention.length === 0 ? (
          <div className="lcc-lr-empty">No open blockers or at-risk streams.</div>
        ) : (
          needsAttention.map(({ ws }) => (
            <button
              key={ws.id}
              type="button"
              className="lcc-lr-area"
              onClick={() => navigate(`/dashboard/workstreams/${ws.id}`)}
              title={ws.name}
            >
              <span
                className="lcc-lr-dot"
                data-tone={toneForStatus(ws.status)}
                aria-hidden
              />
              <span className="lcc-lr-area-name">{ws.name}</span>
              <span className="lcc-lr-area-meta">
                {ws.blockedCount > 0 && (
                  <span className="lcc-lr-area-risk" title={`${ws.blockedCount} blocker(s)`}>
                    {ws.blockedCount}
                  </span>
                )}
                {ws.failedQa > 0 && (
                  <span
                    className="lcc-lr-area-count"
                    data-tone="amber"
                    title={`${ws.failedQa} failed QA`}
                  >
                    {ws.failedQa}
                  </span>
                )}
              </span>
            </button>
          ))
        )}
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

function attentionScore(ws: MigrationWorkstream): number {
  let score = 0
  if (ws.status === "blocked") score += 100
  if (ws.status === "at-risk") score += 40
  score += (ws.blockedCount ?? 0) * 10
  score += (ws.failedQa ?? 0) * 2
  return score
}

function toneForStatus(status: MigrationWorkstream["status"]): string {
  if (status === "blocked") return "red"
  if (status === "at-risk") return "amber"
  if (status === "on-track") return "green"
  return "muted"
}
