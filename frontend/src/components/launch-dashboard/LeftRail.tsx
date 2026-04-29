import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown, ChevronRight } from "lucide-react"
import { formatPacificDate } from "@/lib/datetime"
import type {
  MigrationKpis,
  MigrationSource,
  MigrationWorkstream,
} from "@/types"

interface LeftRailProps {
  kpis: MigrationKpis | null
  sources: MigrationSource[] | null
  workstreams: MigrationWorkstream[] | null
  vaultLastSynced: string | null
}

/**
 * Sticky left rail: at-a-glance KPIs + a Projects list (primary nav) +
 * a collapsed Rollups section (workstreams, demoted).
 *
 * Projects come from the per-source counts (`MigrationSource`), which roll
 * up directly from `raw/<project>/` folders — every number on a project row
 * traces back to a Jira/Asana feed without an editorial layer in between.
 *
 * Workstreams remain reachable via the "Rollups" section, but they're no
 * longer the front door: the user clicks a project to see project-scoped
 * data, and only opens a rollup when they want a cross-project view.
 */
export function LeftRail({
  kpis,
  sources,
  workstreams,
  vaultLastSynced,
}: LeftRailProps) {
  const navigate = useNavigate()
  const [rollupsOpen, setRollupsOpen] = useState(false)

  const sortedProjects = useMemo(() => {
    if (!sources) return []
    return [...sources].sort((a, b) => b.total - a.total)
  }, [sources])

  const needsAttention = useMemo(() => {
    if (!workstreams) return []
    const scored = workstreams
      .map((ws) => ({ ws, score: attentionScore(ws) }))
      .filter(({ score }) => score > 0)
    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, 5)
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
          Projects
          {sortedProjects.length > 0 && (
            <span className="lcc-lr-label-count">{sortedProjects.length}</span>
          )}
        </div>
        {sortedProjects.length === 0 ? (
          <div className="lcc-lr-empty">No source feeds.</div>
        ) : (
          sortedProjects.map((src) => (
            <ProjectRow
              key={src.key}
              source={src}
              onOpen={() => navigate(`/dashboard/projects/${encodeURIComponent(src.key)}`)}
            />
          ))
        )}
      </div>

      <div className="lcc-lr-section">
        <button
          type="button"
          className="lcc-lr-label"
          onClick={() => setRollupsOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            background: "transparent",
            border: 0,
            padding: 0,
            cursor: "pointer",
            color: "inherit",
            font: "inherit",
            width: "100%",
          }}
          aria-expanded={rollupsOpen}
        >
          {rollupsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Rollups
          {needsAttention.length > 0 && (
            <span className="lcc-lr-label-count">{needsAttention.length}</span>
          )}
        </button>
        {rollupsOpen && (
          <>
            {needsAttention.length === 0 ? (
              <div className="lcc-lr-empty">No at-risk rollups.</div>
            ) : (
              needsAttention.map(({ ws }) => (
                <RollupRow
                  key={ws.id}
                  workstream={ws}
                  onOpen={() => navigate(`/dashboard/workstreams/${ws.id}`)}
                />
              ))
            )}
            <div
              className="lcc-lr-empty"
              style={{ marginTop: 6, fontStyle: "italic" }}
            >
              Workstreams are an editorial cross-project view. Numbers here
              aggregate the project feeds above.
            </div>
          </>
        )}
      </div>

      <div className="lcc-lr-section">
        <div className="lcc-lr-label">Source</div>
        <div className="lcc-lr-crumb">obsidian-vault</div>
        <div className="lcc-lr-crumb">└ /api/dashboard</div>
        <div className="lcc-lr-crumb">
          └ {vaultLastSynced ? `synced ${formatPacificDate(vaultLastSynced)}` : "not synced"}
        </div>
      </div>
    </aside>
  )
}

interface ProjectRowProps {
  source: MigrationSource
  onOpen: () => void
}

function ProjectRow({ source, onOpen }: ProjectRowProps) {
  const pct = Math.max(0, Math.min(100, Math.round(source.pct ?? 0)))
  return (
    <button
      type="button"
      className="lcc-lr-area"
      onClick={onOpen}
      title={`${source.name} — ${source.total.toLocaleString()} tasks`}
      style={{ flexDirection: "column", alignItems: "stretch", gap: 4 }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span
          className="lcc-src-kind"
          style={{ fontSize: 9, textTransform: "uppercase", opacity: 0.7 }}
        >
          {source.kind}
        </span>
        <span className="lcc-lr-area-name" style={{ fontWeight: 600 }}>
          {source.key}
        </span>
        <span className="lcc-lr-area-meta" style={{ marginLeft: "auto" }}>
          <span className="lcc-lr-area-count">
            {source.total.toLocaleString()}
          </span>
        </span>
      </div>
      <div className="lcc-src-bar" style={{ height: 3 }}>
        <span style={{ width: `${pct}%` }} />
      </div>
      <div
        style={{
          fontSize: 10,
          color: "var(--lcc-text-faint)",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>{pct}% closed</span>
        <span>{source.active.toLocaleString()} active</span>
      </div>
    </button>
  )
}

interface RollupRowProps {
  workstream: MigrationWorkstream
  onOpen: () => void
}

function RollupRow({ workstream: ws, onOpen }: RollupRowProps) {
  return (
    <button
      type="button"
      className="lcc-lr-area"
      onClick={onOpen}
      title={ws.name}
    >
      <span className="lcc-lr-dot" data-tone={toneForStatus(ws.status)} aria-hidden />
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
