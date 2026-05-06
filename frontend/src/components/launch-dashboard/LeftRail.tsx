import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { formatPacificDate } from "@/lib/datetime"
import { useDashboardLinks } from "@/lib/dashboard-links"
import type {
  MigrationBlocker,
  MigrationSource,
  MigrationWorkstream,
  RawTaskRecord,
} from "@/types"

interface LeftRailProps {
  sources: MigrationSource[] | null
  workstreams: MigrationWorkstream[] | null
  blockers: MigrationBlocker[] | null
  prodFailures: RawTaskRecord[] | null
  vaultLastSynced: string | null
  activeProjectKey?: string | null
}

/**
 * Sticky left rail: a Projects list (primary nav) + top workstreams.
 *
 * The KPI summary that used to sit at the top now lives in the hero
 * strip, freeing this rail to act as a pure project navigator. Each
 * project row carries a red/amber/green status dot derived from its
 * incident footprint (prod fail → red, open blocker → amber, else
 * green) so health is readable without opening the project.
 */
export function LeftRail({
  sources,
  workstreams,
  blockers,
  prodFailures,
  vaultLastSynced,
  activeProjectKey = null,
}: LeftRailProps) {
  const navigate = useNavigate()
  const links = useDashboardLinks()

  const sortedProjects = useMemo(() => {
    if (!sources) return []
    return [...sources].sort((a, b) => b.total - a.total)
  }, [sources])

  const projectStatus = useMemo(
    () => buildProjectStatusMap(sortedProjects, blockers, prodFailures),
    [sortedProjects, blockers, prodFailures],
  )

  const topWorkstreams = useMemo(() => {
    if (!workstreams) return []
    const scored = workstreams
      .map((ws) => ({ ws, score: attentionScore(ws) }))
    scored.sort((a, b) => b.score - a.score || a.ws.name.localeCompare(b.ws.name))
    return scored.slice(0, 5)
  }, [workstreams])

  return (
    <aside className="lcc-left-rail">
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
              tone={projectStatus[src.key] ?? "green"}
              active={src.key === activeProjectKey}
              onOpen={() => navigate(links.projectPath(src.key))}
            />
          ))
        )}
      </div>

      <div className="lcc-lr-section">
        <div className="lcc-lr-label">
          WORKSTREAMS
          {topWorkstreams.length > 0 && (
            <span className="lcc-lr-label-count">{topWorkstreams.length}</span>
          )}
        </div>
        {topWorkstreams.length === 0 ? (
          <div className="lcc-lr-empty">No workstreams found.</div>
        ) : (
          topWorkstreams.map(({ ws }) => (
            <WorkstreamRow
              key={ws.id}
              workstream={ws}
              onOpen={() => navigate(links.workstreamPath(ws.id))}
            />
          ))
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
  tone: ProjectTone
  active?: boolean
  onOpen: () => void
}

function ProjectRow({ source, tone, active = false, onOpen }: ProjectRowProps) {
  return (
    <button
      type="button"
      className={`lcc-lr-area${active ? " active" : ""}`}
      onClick={onOpen}
      title={`${source.name} — ${source.total.toLocaleString()} tasks`}
    >
      <span className="lcc-lr-dot" data-tone={tone} aria-hidden />
      <span className="lcc-lr-area-name">{source.key}</span>
      <span className="lcc-lr-area-meta">
        <span className="lcc-lr-area-count">
          {source.total.toLocaleString()}
        </span>
      </span>
    </button>
  )
}

interface WorkstreamRowProps {
  workstream: MigrationWorkstream
  onOpen: () => void
}

function WorkstreamRow({ workstream: ws, onOpen }: WorkstreamRowProps) {
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

type ProjectTone = "red" | "amber" | "green"

function buildProjectStatusMap(
  projects: MigrationSource[],
  blockers: MigrationBlocker[] | null,
  prodFailures: RawTaskRecord[] | null,
): Record<string, ProjectTone> {
  const out: Record<string, ProjectTone> = {}
  for (const p of projects) {
    const upper = p.key.toUpperCase()
    const hasProdFail = (prodFailures ?? []).some(
      (t) =>
        t.project?.toUpperCase() === upper ||
        t.key?.toUpperCase().startsWith(`${upper}-`),
    )
    if (hasProdFail) {
      out[p.key] = "red"
      continue
    }
    const hasBlocker = (blockers ?? []).some(
      (b) =>
        b.id?.toUpperCase().startsWith(`${upper}-`) ||
        b.affects?.some((a) => a?.toUpperCase().includes(upper)),
    )
    out[p.key] = hasBlocker ? "amber" : "green"
  }
  return out
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
