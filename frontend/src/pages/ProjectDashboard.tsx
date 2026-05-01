import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { ArrowLeft, ChevronDown, ChevronRight, ExternalLink, Loader2 } from "lucide-react"
import { marked } from "marked"
import { api } from "@/services/api"
import { repairJiraMarkdownSource } from "@/lib/markdown-source"
import { normalizeJiraMergedHeaderTables } from "@/lib/markdown-tables"
import { shortenLinksInHtml } from "@/lib/url-shortening"
import { useDashboardLinks } from "@/lib/dashboard-links"
import { LaunchShell } from "@/components/launch-dashboard/LaunchShell"
import type {
  MigrationBlocker,
  MigrationProjectTasks,
  MigrationSource,
  MigrationTaskDetail,
  MigrationTaskStatusRow,
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
/**
 * Body of the per-project dashboard. The route key
 * (`/dashboard/projects/:key`) maps 1:1 to a `MigrationSource.key`.
 * Wraps in `LaunchShell` so all `.launch-dashboard .lcc-*` and `--lcc-*`
 * token references resolve. The Aurora prototype at
 * `/prototype/dashboard-project/aurora/:key` mounts this body inside
 * `BeaconLayout`; production renders it directly under `AppLayout`.
 * No internal logic changed during the extraction.
 */
export function ProjectDashboardBody() {
  const { key: rawKey } = useParams<{ key: string }>()
  const projectKey = rawKey ? decodeURIComponent(rawKey) : ""

  const [sources, setSources] = useState<MigrationSource[] | null>(null)
  const [workstreams, setWorkstreams] = useState<MigrationWorkstream[] | null>(null)
  const [blockers, setBlockers] = useState<MigrationBlocker[] | null>(null)
  const [prodFailures, setProdFailures] = useState<RawTaskRecord[] | null>(null)
  const [newBugs, setNewBugs] = useState<RawTaskRecord[] | null>(null)
  const [projectTasks, setProjectTasks] = useState<MigrationProjectTasks | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(async () => {
    if (!projectKey) return
    setError(null)
    setLoading(true)
    try {
      const [src, ws, bl, pf, nb, pt] = await Promise.all([
        api.getMigrationSources(),
        api.getMigrationWorkstreams(),
        api.getMigrationBlockers(),
        api.getMigrationProductionFailures(),
        api.getMigrationNewBugs(),
        api.getMigrationProjectTasks(projectKey),
      ])
      setSources(src)
      setWorkstreams(ws)
      setBlockers(bl)
      setProdFailures(pf)
      setNewBugs(nb)
      setProjectTasks(pt)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project")
    } finally {
      setLoading(false)
    }
  }, [projectKey])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // Drop the status filter when the project key changes so a stale
  // filter from one project's status set doesn't carry over.
  useEffect(() => {
    setStatusFilter(null)
  }, [projectKey])

  const filteredTasks = useMemo(() => {
    const all = projectTasks?.tasks ?? []
    if (!statusFilter) return all
    return all.filter((t) => (t.status ?? t.taskStatus ?? "") === statusFilter)
  }, [projectTasks, statusFilter])

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
        {projectTasks && (
          <>
            <StatusBreakdownPanel
              rows={projectTasks.statusCounts}
              total={projectTasks.total}
              selected={statusFilter}
              onSelect={(status) =>
                setStatusFilter((prev) => (prev === status ? null : status))
              }
            />
            <TicketsPanel
              tasks={filteredTasks}
              total={projectTasks.total}
              activeStatus={statusFilter}
              onClearStatus={() => setStatusFilter(null)}
            />
          </>
        )}
      </PageFrame>
    </LaunchShell>
  )
}

/**
 * Production export — renders `ProjectDashboardBody` as-is. Kept as a
 * separate export so `App.tsx` continues to import `{ ProjectDashboard }`
 * unchanged.
 */
export function ProjectDashboard() {
  return <ProjectDashboardBody />
}

// ── Layout frame ───────────────────────────────────────────────────────

function PageFrame({
  projectKey,
  children,
}: {
  projectKey: string
  children: React.ReactNode
}) {
  const links = useDashboardLinks()
  return (
    <div style={{ padding: 18 }}>
      <Link
        to={links.launchDashboardPath()}
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

// `MigrationSource.name` is the H1 of the editorial source-summary doc
// (e.g. "Source Summary: Jira ACE2E (2026-04-23)"). The trailing
// "(YYYY-MM-DD)" is the ingested date the orchestrator stamped when it
// last regenerated that doc — and that document gets refreshed far less
// often than the raw ticket data this page actually shows. Surfacing it
// in the hero reads as a stale-data warning when the tickets themselves
// are current, so we strip the suffix.
const INGESTED_DATE_SUFFIX = /\s*\(\d{4}-\d{2}-\d{2}\)\s*$/

function stripIngestedDateSuffix(name: string): string {
  return name.replace(INGESTED_DATE_SUFFIX, "")
}

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
          {stripIngestedDateSuffix(project.name)}
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
  const links = useDashboardLinks()
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
                to={links.workstreamPath(ws.id)}
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

// ── Status breakdown ───────────────────────────────────────────────────

const STATUS_TONE: Record<string, string> = {
  green: "var(--lcc-green)",
  red: "var(--lcc-red)",
  amber: "var(--lcc-amber)",
  blue: "var(--lcc-blue)",
  neutral: "var(--lcc-text-faint)",
}

interface StatusBreakdownPanelProps {
  rows: MigrationTaskStatusRow[]
  total: number
  selected: string | null
  onSelect: (status: string) => void
}

function StatusBreakdownPanel({
  rows,
  total,
  selected,
  onSelect,
}: StatusBreakdownPanelProps) {
  if (rows.length === 0) return null
  return (
    <div className="panel" style={{ padding: "14px 18px" }}>
      <h3>
        Status breakdown<span className="count">{rows.length}</span>
        <span
          style={{
            marginLeft: "auto",
            fontSize: 10,
            textTransform: "none",
            letterSpacing: 0,
            fontWeight: 400,
            color: "var(--lcc-text-faint)",
          }}
        >
          click a status to filter the table below
        </span>
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 10,
        }}
      >
        {rows.map((row) => {
          const pct = total > 0 ? Math.round((row.count / total) * 100) : 0
          const tone = STATUS_TONE[row.color] ?? STATUS_TONE.neutral
          const isActive = selected === row.status
          return (
            <button
              key={row.status}
              type="button"
              onClick={() => onSelect(row.status)}
              aria-pressed={isActive}
              title={
                isActive
                  ? `Click again to clear filter`
                  : `Filter tickets to "${row.status}"`
              }
              style={{
                appearance: "none",
                textAlign: "left",
                cursor: "pointer",
                padding: "10px 12px",
                background: isActive
                  ? "rgba(255,255,255,0.08)"
                  : "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
                borderRadius: 6,
                borderTop: 0,
                borderRight: 0,
                borderBottom: 0,
                borderLeft: `3px solid ${tone}`,
                outline: isActive ? `1px solid ${tone}` : "none",
                outlineOffset: 0,
                color: "inherit",
                font: "inherit",
                transition: "background 120ms ease",
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: tone,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {row.count}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "var(--lcc-text)",
                  marginTop: 1,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {row.status}
              </div>
              <div style={{ fontSize: 10, color: "var(--lcc-text-faint)", marginTop: 1 }}>
                {pct}%
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Tickets table ──────────────────────────────────────────────────────

const TICKET_PAGE_SIZE = 50

interface TicketsPanelProps {
  tasks: RawTaskRecord[]
  total: number
  activeStatus: string | null
  onClearStatus: () => void
}

type DetailState =
  | { kind: "loading" }
  | { kind: "loaded"; data: MigrationTaskDetail }
  | { kind: "error"; message: string }

function TicketsPanel({
  tasks,
  total,
  activeStatus,
  onClearStatus,
}: TicketsPanelProps) {
  const [showAll, setShowAll] = useState(false)
  const [expandedRel, setExpandedRel] = useState<string | null>(null)
  // Cache one DetailState per relPath. Keep the data after the row
  // collapses so reopening the same ticket is instant; we never refetch
  // unless the user explicitly retries on an error.
  const [details, setDetails] = useState<Record<string, DetailState>>({})

  // Reset pagination + collapse any open drawer when the filter changes.
  useEffect(() => {
    setShowAll(false)
    setExpandedRel(null)
  }, [activeStatus])

  const handleToggle = useCallback(
    (relPath: string) => {
      setExpandedRel((prev) => {
        if (prev === relPath) return null
        // Lazy-fetch the detail if we haven't loaded it yet.
        setDetails((d) => {
          if (d[relPath]?.kind === "loaded") return d
          return { ...d, [relPath]: { kind: "loading" } }
        })
        api
          .getMigrationTaskDetail(relPath)
          .then((data) =>
            setDetails((d) => ({ ...d, [relPath]: { kind: "loaded", data } })),
          )
          .catch((err: unknown) => {
            const message = err instanceof Error ? err.message : "failed to load"
            setDetails((d) => ({
              ...d,
              [relPath]: { kind: "error", message },
            }))
          })
        return relPath
      })
    },
    [],
  )

  const visible = showAll ? tasks : tasks.slice(0, TICKET_PAGE_SIZE)
  const isFiltered = activeStatus !== null

  if (total === 0) {
    return (
      <div className="panel" style={{ padding: "14px 18px" }}>
        <h3>Tickets</h3>
        <p style={{ color: "var(--lcc-text-faint)", fontSize: 12, margin: 0 }}>
          No tickets synced for this project.
        </p>
      </div>
    )
  }

  return (
    <div className="panel" style={{ padding: "14px 18px" }}>
      <h3>
        Tickets
        <span className="count">
          {isFiltered
            ? `${tasks.length.toLocaleString()} / ${total.toLocaleString()}`
            : total.toLocaleString()}
        </span>
        {isFiltered && (
          <span style={filterChipStyle}>
            <span style={{ color: "var(--lcc-text-faint)", marginRight: 4 }}>
              status:
            </span>
            <span style={{ color: "var(--lcc-text)" }}>{activeStatus}</span>
            <button
              type="button"
              onClick={onClearStatus}
              aria-label="Clear status filter"
              title="Clear status filter"
              style={filterChipClearStyle}
            >
              ×
            </button>
          </span>
        )}
      </h3>
      {isFiltered && tasks.length === 0 && (
        <p style={{ color: "var(--lcc-text-faint)", fontSize: 12, margin: "0 0 8px" }}>
          No tickets match this filter.
        </p>
      )}
      <div style={{ overflowX: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
          }}
        >
          <thead>
            <tr style={{ textAlign: "left", color: "var(--lcc-text-faint)" }}>
              <Th>Key</Th>
              <Th>Summary</Th>
              <Th>Status</Th>
              <Th>Priority</Th>
              <Th>Assignee</Th>
              <Th>Updated</Th>
            </tr>
          </thead>
          <tbody>
            {visible.map((t) => {
              const rel = t.relPath || t.key
              const isExpanded = expandedRel === rel
              return (
                <TicketRow
                  // Use relPath, not key — multiple raw files can share
                  // the same Jira key (rename ghosts) and React leaves
                  // stale rows mounted when a previous render had
                  // duplicate <tr key=…>.
                  key={rel}
                  task={t}
                  expanded={isExpanded}
                  detail={isExpanded ? details[rel] ?? null : null}
                  onToggle={() => handleToggle(rel)}
                />
              )
            })}
          </tbody>
        </table>
      </div>
      {tasks.length > TICKET_PAGE_SIZE && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            justifyContent: "center",
            gap: 8,
            fontSize: 11,
            color: "var(--lcc-text-faint)",
          }}
        >
          {showAll ? (
            <>
              <span>Showing all {tasks.length.toLocaleString()} tickets</span>
              <button
                type="button"
                onClick={() => setShowAll(false)}
                style={linkButtonStyle}
              >
                show first {TICKET_PAGE_SIZE}
              </button>
            </>
          ) : (
            <>
              <span>
                Showing first {TICKET_PAGE_SIZE} of {tasks.length.toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() => setShowAll(true)}
                style={linkButtonStyle}
              >
                show all
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Ticket row + drawer ───────────────────────────────────────────────

interface TicketRowProps {
  task: RawTaskRecord
  expanded: boolean
  detail: DetailState | null
  onToggle: () => void
}

const TICKET_TABLE_COLSPAN = 6

function TicketRow({ task, expanded, detail, onToggle }: TicketRowProps) {
  return (
    <>
      <tr
        style={{
          borderTop: "1px solid var(--lcc-border-faint)",
          background: expanded ? "rgba(255,255,255,0.04)" : undefined,
        }}
      >
        <Td>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            title={expanded ? "Hide details" : "Show details"}
            style={ticketKeyButtonStyle}
          >
            {expanded ? (
              <ChevronDown size={11} aria-hidden />
            ) : (
              <ChevronRight size={11} aria-hidden />
            )}
            <span>{task.key}</span>
          </button>
        </Td>
        <Td>
          <span style={{ color: "var(--lcc-text)" }}>{task.summary ?? "—"}</span>
        </Td>
        <Td>
          <span style={{ color: "var(--lcc-text-dim)", whiteSpace: "nowrap" }}>
            {task.status ?? task.taskStatus ?? "—"}
          </span>
        </Td>
        <Td>
          <span style={{ color: "var(--lcc-text-dim)", whiteSpace: "nowrap" }}>
            {task.priority ?? "—"}
          </span>
        </Td>
        <Td>
          <span style={{ color: "var(--lcc-text-dim)", whiteSpace: "nowrap" }}>
            {task.assignee ?? "—"}
          </span>
        </Td>
        <Td>
          <span
            style={{
              color: "var(--lcc-text-faint)",
              fontFamily: "monospace",
              whiteSpace: "nowrap",
            }}
          >
            {task.updated ?? "—"}
          </span>
        </Td>
      </tr>
      {expanded && (
        <tr style={{ background: "rgba(255,255,255,0.02)" }}>
          <td colSpan={TICKET_TABLE_COLSPAN} style={{ padding: 0 }}>
            <TicketDrawer task={task} detail={detail} />
          </td>
        </tr>
      )}
    </>
  )
}

interface TicketDrawerProps {
  task: RawTaskRecord
  detail: DetailState | null
}

function TicketDrawer({ task, detail }: TicketDrawerProps) {
  const bodyHtml = useMemo(() => {
    if (detail?.kind !== "loaded") return ""
    const body = detail.data.body ?? ""
    if (!body.trim()) return ""
    // Pipeline:
    //   raw → repair source-level Jira quirks (doubled link syntax,
    //         non-breaking spaces) → marked.parse → normalize Jira
    //         "Col N" tables → shorten Lampstrack/Asana URLs.
    // Source-level repairs run first so marked sees correctly-formed
    // markdown; HTML-level cleanup runs after so it can use DOM
    // structure (table cells, anchor tags) as anchors.
    const repaired = repairJiraMarkdownSource(body)
    const raw = marked.parse(repaired, { async: false }) as string
    return shortenLinksInHtml(normalizeJiraMergedHeaderTables(raw))
  }, [detail])

  return (
    <div style={drawerStyle}>
      <div style={drawerMetaGridStyle}>
        <DrawerField label="Key" value={task.key} mono />
        <DrawerField label="Type" value={task.type ?? "—"} />
        <DrawerField label="Source" value={task.source ?? "—"} />
        <DrawerField label="Project" value={task.project ?? "—"} />
        <DrawerField label="Status" value={task.status ?? task.taskStatus ?? "—"} />
        <DrawerField label="Priority" value={task.priority ?? "—"} />
        <DrawerField label="Assignee" value={task.assignee ?? "—"} />
        <DrawerField label="Created" value={task.created ?? "—"} mono />
        <DrawerField label="Updated" value={task.updated ?? "—"} mono />
        <DrawerField label="Resolved" value={task.resolved ?? "—"} mono />
        {task.uatStatus && <DrawerField label="UAT" value={task.uatStatus} />}
        {task.completion && <DrawerField label="Completion" value={task.completion} />}
      </div>

      <div style={drawerBodyHeaderStyle}>
        <span>Description</span>
        {task.url && (
          <a
            href={task.url}
            target="_blank"
            rel="noopener noreferrer"
            style={drawerExternalLinkStyle}
          >
            <ExternalLink size={11} /> Open in {task.source === "asana" ? "Asana" : "Jira"}
          </a>
        )}
      </div>
      <div style={drawerBodyStyle}>
        {detail === null || detail.kind === "loading" ? (
          <span style={{ color: "var(--lcc-text-faint)", fontStyle: "italic" }}>
            <Loader2 size={11} className="animate-spin" /> Loading description…
          </span>
        ) : detail.kind === "error" ? (
          <span style={{ color: "var(--lcc-red)" }}>Failed to load: {detail.message}</span>
        ) : !bodyHtml ? (
          <span style={{ color: "var(--lcc-text-faint)", fontStyle: "italic" }}>
            (No description in the synced markdown.)
          </span>
        ) : (
          <div
            className="lcc-markdown"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        )}
      </div>
    </div>
  )
}

function DrawerField({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <div style={drawerFieldLabelStyle}>{label}</div>
      <div
        style={{
          fontSize: 12,
          color: "var(--lcc-text)",
          fontFamily: mono ? "var(--font-mono, monospace)" : undefined,
          wordBreak: "break-word",
        }}
      >
        {value}
      </div>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        fontSize: 10,
        padding: "6px 8px",
      }}
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{ padding: "6px 8px", verticalAlign: "top" }}>{children}</td>
  )
}

const linkButtonStyle: React.CSSProperties = {
  background: "transparent",
  border: 0,
  color: "var(--lcc-blue)",
  cursor: "pointer",
  fontSize: 11,
  padding: 0,
  textDecoration: "underline",
}

const filterChipStyle: React.CSSProperties = {
  marginLeft: 10,
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: "2px 4px 2px 8px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid var(--lcc-border-faint, rgba(255,255,255,0.12))",
  fontSize: 10.5,
  textTransform: "none",
  letterSpacing: 0,
  fontWeight: 500,
}

const filterChipClearStyle: React.CSSProperties = {
  appearance: "none",
  background: "transparent",
  border: 0,
  color: "var(--lcc-text-faint)",
  cursor: "pointer",
  padding: "0 4px",
  fontSize: 12,
  lineHeight: 1,
}

const ticketKeyButtonStyle: React.CSSProperties = {
  appearance: "none",
  background: "transparent",
  border: 0,
  padding: 0,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontFamily: "monospace",
  fontSize: 12,
  color: "var(--lcc-blue)",
  whiteSpace: "nowrap",
}

const drawerStyle: React.CSSProperties = {
  padding: "14px 18px",
  borderTop: "1px solid var(--lcc-border-faint)",
  display: "flex",
  flexDirection: "column",
  gap: 12,
}

const drawerMetaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: 10,
  padding: "8px 10px",
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  borderRadius: 6,
}

const drawerFieldLabelStyle: React.CSSProperties = {
  fontSize: 9.5,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--lcc-text-faint)",
  marginBottom: 2,
  fontFamily: "var(--font-mono, monospace)",
}

const drawerBodyHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  fontSize: 10,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--lcc-text-faint)",
  fontWeight: 600,
}

const drawerExternalLinkStyle: React.CSSProperties = {
  marginLeft: "auto",
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  fontSize: 10,
  letterSpacing: "0.06em",
  color: "var(--lcc-blue)",
  textDecoration: "none",
  textTransform: "none",
  fontWeight: 500,
}

const drawerBodyStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--lcc-text)",
  lineHeight: 1.55,
  padding: "10px 12px",
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  borderRadius: 6,
  maxHeight: 480,
  overflow: "auto",
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
