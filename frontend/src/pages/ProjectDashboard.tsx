import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, Loader2 } from "lucide-react"
import { api } from "@/services/api"
import { LaunchShell } from "@/components/launch-dashboard/LaunchShell"
import type {
  MigrationBlocker,
  MigrationSource,
  MigrationWorkstream,
  RawTaskRecord,
} from "@/types"

/**
 * Per-project dashboard. The route key (`/dashboard/projects/:key`) maps
 * 1:1 to a `MigrationSource.key` — i.e. a Jira project code (DBADMIN,
 * WPM, ACAB, …) or the `asana` source.
 *
 * Everything on this page is derived from existing API responses filtered
 * by project key. The "Tickets in this project" section is intentionally
 * a placeholder until we add a backend endpoint that streams a project's
 * raw tasks; today we only have aggregated lists (prod failures, new
 * bugs) which we surface as "Recent activity."
 */
export function ProjectDashboard() {
  const { key: rawKey } = useParams<{ key: string }>()
  const projectKey = rawKey ? decodeURIComponent(rawKey) : ""

  const [sources, setSources] = useState<MigrationSource[] | null>(null)
  const [workstreams, setWorkstreams] = useState<MigrationWorkstream[] | null>(null)
  const [blockers, setBlockers] = useState<MigrationBlocker[] | null>(null)
  const [prodFailures, setProdFailures] = useState<RawTaskRecord[] | null>(null)
  const [newBugs, setNewBugs] = useState<RawTaskRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const [src, ws, bl, pf, nb] = await Promise.all([
        api.getMigrationSources(),
        api.getMigrationWorkstreams(),
        api.getMigrationBlockers(),
        api.getMigrationProductionFailures(),
        api.getMigrationNewBugs(),
      ])
      setSources(src)
      setWorkstreams(ws)
      setBlockers(bl)
      setProdFailures(pf)
      setNewBugs(nb)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const project = useMemo(
    () => sources?.find((s) => s.key === projectKey) ?? null,
    [sources, projectKey],
  )

  const projectBlockers = useMemo(
    () => filterBlockersByProject(blockers, projectKey),
    [blockers, projectKey],
  )

  const projectProdFailures = useMemo(
    () => filterTasksByProject(prodFailures, projectKey),
    [prodFailures, projectKey],
  )

  const projectNewBugs = useMemo(
    () => filterTasksByProject(newBugs, projectKey),
    [newBugs, projectKey],
  )

  const referencedFromRollups = useMemo(
    () => filterWorkstreamsByProject(workstreams, projectKey),
    [workstreams, projectKey],
  )

  if (loading && !sources) {
    return (
      <LaunchShell>
        <PageFrame projectKey={projectKey}>
          <div
            style={{
              padding: 24,
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "var(--lcc-text-dim)",
              fontSize: 13,
            }}
          >
            <Loader2 size={14} className="animate-spin" /> Loading project…
          </div>
        </PageFrame>
      </LaunchShell>
    )
  }

  if (error) {
    return (
      <LaunchShell>
        <PageFrame projectKey={projectKey}>
          <div className="panel" style={{ padding: 16, color: "var(--lcc-red)" }}>
            {error}
          </div>
        </PageFrame>
      </LaunchShell>
    )
  }

  if (!project) {
    return (
      <LaunchShell>
        <PageFrame projectKey={projectKey}>
          <div className="panel" style={{ padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              No source feed found for "{projectKey}"
            </div>
            <div
              style={{ marginTop: 6, color: "var(--lcc-text-faint)", fontSize: 12 }}
            >
              Available keys: {(sources ?? []).map((s) => s.key).join(", ") || "—"}
            </div>
          </div>
        </PageFrame>
      </LaunchShell>
    )
  }

  return (
    <LaunchShell>
      <PageFrame projectKey={projectKey}>
        <ProjectHeader project={project} />
        <StatsPanel project={project} blockerCount={projectBlockers.length} />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr",
            gap: 14,
          }}
        >
          <BlockersPanel blockers={projectBlockers} />
          <RollupsPanel rollups={referencedFromRollups} />
        </div>
        <RecentTasksPanel
          prodFailures={projectProdFailures}
          newBugs={projectNewBugs}
        />
        <TicketsPlaceholder />
      </PageFrame>
    </LaunchShell>
  )
}

// ── Layout frame ───────────────────────────────────────────────────────

function PageFrame({
  projectKey,
  children,
}: {
  projectKey: string
  children: React.ReactNode
}) {
  return (
    <div style={{ padding: 18 }}>
      <Link
        to="/dashboard"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          color: "var(--lcc-text-dim)",
          textDecoration: "none",
        }}
      >
        <ArrowLeft size={12} /> Back to dashboard
      </Link>
      <div style={{ marginTop: 4, fontSize: 11, color: "var(--lcc-text-faint)" }}>
        / dashboard / projects / {projectKey || "—"}
      </div>
      <div style={{ display: "grid", gap: 14, marginTop: 14 }}>{children}</div>
    </div>
  )
}

// ── Header ─────────────────────────────────────────────────────────────

function ProjectHeader({ project }: { project: MigrationSource }) {
  return (
    <div className="panel" style={{ padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <span
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: 0.4,
            color: "var(--lcc-text-faint)",
          }}
        >
          {project.kind}
        </span>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>{project.key}</h1>
        <span style={{ color: "var(--lcc-text-dim)", fontSize: 14 }}>
          {project.name}
        </span>
      </div>
    </div>
  )
}

// ── Stats ──────────────────────────────────────────────────────────────

function StatsPanel({
  project,
  blockerCount,
}: {
  project: MigrationSource
  blockerCount: number
}) {
  const pct = Math.max(0, Math.min(100, Math.round(project.pct ?? 0)))
  return (
    <div className="panel" style={{ padding: "14px 18px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: 14,
        }}
      >
        <Stat label="Total tasks" value={project.total.toLocaleString()} />
        <Stat label="Resolved" value={`${pct}%`} tone="green" />
        <Stat label="Active" value={project.active.toLocaleString()} tone="amber" />
        <Stat
          label="Open blockers"
          value={blockerCount.toLocaleString()}
          tone={blockerCount > 0 ? "red" : "muted"}
        />
      </div>
      <div className="lcc-src-bar" style={{ marginTop: 12, height: 6 }}>
        <span style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "green" | "amber" | "red" | "muted"
}) {
  return (
    <div data-tone={tone}>
      <div style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--lcc-text-faint)", marginTop: 2 }}>
        {label}
      </div>
    </div>
  )
}

// ── Blockers ───────────────────────────────────────────────────────────

function BlockersPanel({ blockers }: { blockers: MigrationBlocker[] }) {
  return (
    <div className="panel" style={{ padding: "14px 18px" }}>
      <h3>
        Blockers<span className="count">{blockers.length}</span>
      </h3>
      {blockers.length === 0 ? (
        <p style={{ color: "var(--lcc-text-faint)", fontSize: 12, margin: 0 }}>
          No open blockers tagged to this project.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {blockers.map((b) => (
            <li
              key={b.id}
              style={{
                display: "flex",
                gap: 8,
                padding: "6px 0",
                borderBottom: "1px solid var(--lcc-border-faint)",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: "var(--lcc-text-dim)",
                  whiteSpace: "nowrap",
                }}
              >
                {b.id}
              </span>
              <span style={{ fontSize: 12, flex: 1 }}>{b.name}</span>
              {b.severity && (
                <span
                  style={{
                    fontSize: 10,
                    textTransform: "uppercase",
                    color: "var(--lcc-text-faint)",
                  }}
                >
                  {b.severity}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Rollups (workstreams) ──────────────────────────────────────────────

function RollupsPanel({ rollups }: { rollups: MigrationWorkstream[] }) {
  return (
    <div className="panel" style={{ padding: "14px 18px" }}>
      <h3>
        Workstream rollups<span className="count">{rollups.length}</span>
      </h3>
      <p
        style={{
          color: "var(--lcc-text-faint)",
          fontSize: 11,
          margin: "0 0 8px",
        }}
      >
        These workstream pages aggregate this project alongside others.
      </p>
      {rollups.length === 0 ? (
        <p style={{ color: "var(--lcc-text-faint)", fontSize: 12, margin: 0 }}>
          This project isn't referenced by any workstream rollup.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {rollups.map((ws) => (
            <li
              key={ws.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 0",
                borderBottom: "1px solid var(--lcc-border-faint)",
              }}
            >
              <Link
                to={`/dashboard/workstreams/${ws.id}`}
                style={{
                  fontSize: 12,
                  flex: 1,
                  color: "var(--lcc-text)",
                  textDecoration: "none",
                }}
              >
                {ws.name}
              </Link>
              <span
                style={{
                  fontSize: 10,
                  color: "var(--lcc-text-faint)",
                }}
              >
                {ws.tasks.toLocaleString()} tasks
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Recent activity ────────────────────────────────────────────────────

function RecentTasksPanel({
  prodFailures,
  newBugs,
}: {
  prodFailures: RawTaskRecord[]
  newBugs: RawTaskRecord[]
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 14,
      }}
    >
      <TaskListPanel title="Production failures" tasks={prodFailures} tone="red" />
      <TaskListPanel title="New bugs (7 days)" tasks={newBugs} tone="amber" />
    </div>
  )
}

function TaskListPanel({
  title,
  tasks,
  tone,
}: {
  title: string
  tasks: RawTaskRecord[]
  tone: "red" | "amber"
}) {
  return (
    <div className="panel" style={{ padding: "14px 18px" }}>
      <h3>
        {title}
        <span className="count" data-tone={tone}>
          {tasks.length}
        </span>
      </h3>
      {tasks.length === 0 ? (
        <p style={{ color: "var(--lcc-text-faint)", fontSize: 12, margin: 0 }}>
          None for this project.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {tasks.slice(0, 8).map((t) => (
            <li
              key={t.key}
              style={{
                display: "flex",
                gap: 8,
                padding: "5px 0",
                borderBottom: "1px solid var(--lcc-border-faint)",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "monospace",
                  color: "var(--lcc-text-dim)",
                  whiteSpace: "nowrap",
                }}
              >
                {t.key}
              </span>
              <span style={{ fontSize: 12, flex: 1 }}>{t.summary ?? "—"}</span>
              {t.status && (
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--lcc-text-faint)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.status}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Tickets placeholder ────────────────────────────────────────────────

function TicketsPlaceholder() {
  return (
    <div
      className="panel"
      style={{
        padding: "14px 18px",
        borderStyle: "dashed",
        color: "var(--lcc-text-faint)",
      }}
    >
      <h3 style={{ marginTop: 0 }}>Tickets</h3>
      <p style={{ fontSize: 12, margin: 0 }}>
        Per-project ticket browsing isn't wired yet — needs a backend
        endpoint that streams `raw/&lt;project&gt;/` tasks. Today only the
        aggregated incident lists above are available.
      </p>
    </div>
  )
}

// ── Filtering helpers ──────────────────────────────────────────────────

/** Match a blocker to a project by checking its `affects` list and id prefix. */
function filterBlockersByProject(
  blockers: MigrationBlocker[] | null,
  projectKey: string,
): MigrationBlocker[] {
  if (!blockers || !projectKey) return []
  const upper = projectKey.toUpperCase()
  return blockers.filter((b) => {
    if (b.id?.toUpperCase().startsWith(`${upper}-`)) return true
    if (b.affects?.some((a) => a?.toUpperCase().includes(upper))) return true
    return false
  })
}

/** Match a raw task to a project by `project` field, falling back to the key prefix. */
function filterTasksByProject(
  tasks: RawTaskRecord[] | null,
  projectKey: string,
): RawTaskRecord[] {
  if (!tasks || !projectKey) return []
  const upper = projectKey.toUpperCase()
  return tasks.filter((t) => {
    if (t.project?.toUpperCase() === upper) return true
    if (t.key?.toUpperCase().startsWith(`${upper}-`)) return true
    return false
  })
}

/**
 * A workstream "references" a project when one of its epic IDs uses this
 * project's prefix (e.g., WPM-4761 → WPM). For the `asana` feed there's
 * no key prefix, so we surface workstreams whose name contains "asana"
 * as a soft match.
 */
function filterWorkstreamsByProject(
  workstreams: MigrationWorkstream[] | null,
  projectKey: string,
): MigrationWorkstream[] {
  if (!workstreams || !projectKey) return []
  const upper = projectKey.toUpperCase()
  if (upper === "ASANA") {
    return workstreams.filter((ws) => ws.name.toLowerCase().includes("asana"))
  }
  return workstreams.filter((ws) =>
    (ws.epics ?? []).some((epic) => epic?.toUpperCase().startsWith(`${upper}-`)),
  )
}
