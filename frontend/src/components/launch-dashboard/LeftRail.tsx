import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ChevronDown, ChevronRight } from "lucide-react"
import { formatPacificDate } from "@/lib/datetime"
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
}

/**
 * Sticky left rail: a Projects list (primary nav) + a collapsed
 * Rollups section (workstreams, demoted).
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
}: LeftRailProps) {
  const navigate = useNavigate()
  const [rollupsOpen, setRollupsOpen] = useState(false)

  const sortedProjects = useMemo(() => {
    if (!sources) return []
    return [...sources].sort((a, b) => b.total - a.total)
  }, [sources])

  const projectStatus = useMemo(
    () => buildProjectStatusMap(sortedProjects, blockers, prodFailures),
    [sortedProjects, blockers, prodFailures],
  )

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
  tone: ProjectTone
  onOpen: () => void
}

function ProjectRow({ source, tone, onOpen }: ProjectRowProps) {
  return (
    <button
      type="button"
      className="lcc-lr-area"
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
