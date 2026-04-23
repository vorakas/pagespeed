import { useCallback, useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { api } from "@/services/api"
import { LaunchShell } from "@/components/launch-dashboard/LaunchShell"
import { WorkstreamRail } from "@/components/launch-dashboard/WorkstreamRail"
import type {
  MigrationBlocker,
  MigrationWorkstream,
  MigrationWorkstreamDetail,
  RawTaskRecord,
  WorkstreamMdActive,
  WorkstreamMdActiveItem,
  WorkstreamMdAsanaCoverage,
  WorkstreamMdAsanaJira,
  WorkstreamMdBurndown,
  WorkstreamMdCriticalBlocker,
  WorkstreamMdCrossDep,
  WorkstreamMdDev,
  WorkstreamMdInternalChain,
  WorkstreamMdPayload,
  WorkstreamMdProgressBucket,
  WorkstreamMdRecent,
  WorkstreamMdRisk,
} from "@/types"

// Matches handoff/design/workstream-md.jsx — full markdown-driven detail
// page with overview, sources, scope, epics, progress, 8-bucket active
// items, key risks, burndown chart, dev workload, recent activity,
// decisions, and cross-refs.

export function WorkstreamDetail() {
  const { id = "" } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<MigrationWorkstreamDetail | null>(null)
  const [workstreams, setWorkstreams] = useState<MigrationWorkstream[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setDetail(await api.getMigrationWorkstreamDetail(id))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load workstream")
    }
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  // Workstream list for the picker rail; loaded once and reused across
  // navigations between workstreams so the rail doesn't flicker on each
  // route change. Silently ignores failure — the rail simply stays empty.
  useEffect(() => {
    let cancelled = false
    api
      .getMigrationWorkstreams()
      .then((list) => {
        if (!cancelled) setWorkstreams(list)
      })
      .catch(() => {
        if (!cancelled) setWorkstreams([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) {
    return (
      <LaunchShell>
        <div style={shellStyle}>
          <WorkstreamRail workstreams={workstreams} activeId={id} />
          <div style={pageStyle}>
                <div className="panel" style={{ marginTop: 16, color: "var(--lcc-red)" }}>{error}</div>
          </div>
        </div>
      </LaunchShell>
    )
  }

  if (!detail) {
    return (
      <LaunchShell>
        <div style={shellStyle}>
          <WorkstreamRail workstreams={workstreams} activeId={id} />
          <div style={loadingStyle}>
            <Loader2 size={14} className="animate-spin" /> Loading workstream…
          </div>
        </div>
      </LaunchShell>
    )
  }

  const md = detail.markdown
  const hasCrossDeps = !!(md?.crossDeps?.length || md?.internalChains?.length || md?.criticalBlocker)
  const hasRightRail = !!(md?.decisions?.length || md?.crossRefs?.length || md?.team?.leads?.length)
  return (
    <LaunchShell>
      <div style={shellStyle}>
        <WorkstreamRail workstreams={workstreams} activeId={id} />
        <div style={pageStyle}>
        <Hero workstream={detail.workstream} md={md} />

        {detail.blockers.length > 0 && <BlockersPanel blockers={detail.blockers} />}

        {md?.progress?.buckets?.length ? <ProgressPanel md={md} /> : null}

        {/* Active Items + Key Risks side-by-side per mockup */}
        {md?.active || md?.keyRisks?.length ? (
          <div style={twoColStyle}>
            {md?.active ? <ActiveItemsPanel active={md.active} /> : <div />}
            {md?.keyRisks?.length ? <KeyRisksPanel md={md} /> : <div />}
          </div>
        ) : null}

        {/* Dev Workload + Epics side-by-side */}
        {md?.devs?.length || md?.epics?.length ? (
          <div style={twoColStyle}>
            {md?.devs?.length ? <DevsPanel md={md} /> : <div />}
            {md?.epics?.length ? <EpicsPanel md={md} /> : <div />}
          </div>
        ) : null}

        {md?.burndown?.length ? <BurndownPanel md={md} /> : null}

        {md?.recentActivity?.length ? <RecentActivityPanel md={md} /> : null}

        {/* Dependencies & Blockers spans two-thirds; Decisions/Related/Team stack right */}
        {hasCrossDeps || hasRightRail ? (
          <div style={twoColStyle}>
            {hasCrossDeps ? (
              <DependenciesPanel
                crossDeps={md?.crossDeps || []}
                chains={md?.internalChains || []}
                critical={md?.criticalBlocker || null}
              />
            ) : (
              <div />
            )}
            {hasRightRail ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {md?.decisions?.length ? <DecisionsPanel md={md} /> : null}
                {md?.crossRefs?.length ? <CrossRefsPanel md={md} /> : null}
                {md?.team?.leads?.length ? <TeamPanel leads={md.team.leads} /> : null}
              </div>
            ) : (
              <div />
            )}
          </div>
        ) : null}

        {md?.asanaJira?.length ? (
          <AsanaJiraPanel rows={md.asanaJira} notes={md.asanaJiraNotes || []} />
        ) : null}

        {md?.asanaCoverage ? <AsanaCoveragePanel coverage={md.asanaCoverage} /> : null}

        <CriticalTasksPanel tasks={detail.criticalTasks} />
        </div>
      </div>
    </LaunchShell>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────

function Hero({ workstream, md }: { workstream: MigrationWorkstream; md: WorkstreamMdPayload | null }) {
  const status = md?.meta.status || workstream.status || ""
  const title = md?.meta.title || workstream.name
  const taskCount = md?.meta.taskCount ?? workstream.tasks
  const blocked = md?.meta.blockedCount ?? workstream.blockedCount
  const hasSourcesOrScope = !!(md?.sources?.length || md?.scope?.length)
  return (
    <section className="panel" style={{ padding: 22 }}>
      <div style={heroTopStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={eyebrowStyle}>
            Workstream · type {md?.meta.type || "workstream"}
            {md?.meta.lastUpdate ? <> · last update {md.meta.lastUpdate}</> : null}
          </div>
          <h1 style={heroTitleStyle}>{title}</h1>
          {md?.overviewParagraph && <p style={heroNoteStyle}>{md.overviewParagraph}</p>}
          {!md?.overviewParagraph && workstream.note && <p style={heroNoteStyle}>{workstream.note}</p>}
        </div>
        <div style={heroRightStyle}>
          {status && (
            <span
              style={{
                ...healthChipStyle,
                color: healthColor(status),
                background: healthBg(status),
                borderColor: healthColor(status),
              }}
            >
              {status.replace("-", " ").toUpperCase()}
            </span>
          )}
          <div style={heroCountsStyle}>
            <div>
              <div style={heroCountValue}>{taskCount ?? "—"}</div>
              <div style={heroCountLabel}>tasks</div>
            </div>
            <div>
              <div
                style={{
                  ...heroCountValue,
                  color: blocked > 0 ? "var(--lcc-red)" : "var(--lcc-text)",
                }}
              >
                {blocked}
              </div>
              <div style={heroCountLabel}>blocked</div>
            </div>
          </div>
        </div>
      </div>
      {hasSourcesOrScope && (
        <div style={heroGridStyle}>
          {md?.sources?.length ? <SourcesPanel md={md} /> : null}
          {md?.scope?.length ? <ScopePanel md={md} /> : null}
        </div>
      )}
    </section>
  )
}

function SourcesPanel({ md }: { md: WorkstreamMdPayload }) {
  return (
    <div>
      <h3 style={subSectionHeadStyle}>Jira / source projects</h3>
      <ul style={listResetStyle}>
        {md.sources.map((s) => (
          <li key={s.key} style={sourceRowStyle}>
            <span
              style={{
                ...kindPill,
                color: s.kind === "jira" ? "var(--lcc-blue)" : "var(--lcc-violet)",
                borderColor: s.kind === "jira" ? "var(--lcc-blue)" : "var(--lcc-violet)",
              }}
            >
              {s.kind}
            </span>
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontWeight: 600 }}>{s.key}</span>
            {s.name && s.name !== s.key && (
              <span style={{ color: "var(--lcc-text-dim)", fontSize: 12 }}>{s.name}</span>
            )}
            <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "var(--lcc-text-faint)" }}>
              {s.issues != null ? `${s.issues} issues` : s.note || ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ScopePanel({ md }: { md: WorkstreamMdPayload }) {
  return (
    <div>
      <h3 style={subSectionHeadStyle}>Scope</h3>
      <ul style={listResetStyle}>
        {md.scope.map((s) => (
          <li key={s.label} style={scopeRowStyle}>
            <span style={scopeLabelStyle}>{s.label}</span>
            <span style={scopeNoteStyle}>{s.note}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Epics ─────────────────────────────────────────────────────────────

function EpicsPanel({ md }: { md: WorkstreamMdPayload }) {
  return (
    <section className="panel">
      <h3 style={panelHeadStyle}>
        Key epics <span style={panelCountStyle}>{md.epics.length} epics</span>
      </h3>
      <div style={epicGridStyle}>
        {md.epics.map((e) => (
          <div key={e.id} style={epicCardStyle}>
            <div style={epicIdStyle}>{e.id}</div>
            <div style={epicTitleStyle}>{e.title}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Progress ──────────────────────────────────────────────────────────

function ProgressPanel({ md }: { md: WorkstreamMdPayload }) {
  const total = md.progress.total ?? md.progress.buckets.reduce((acc, b) => acc + b.count, 0)
  return (
    <section className="panel">
      <h3 style={panelHeadStyle}>
        Progress by status
        <span style={panelCountStyle}>
          {total} tasks{md.progress.completion ? ` · ${md.progress.completion}` : ""}
        </span>
      </h3>
      <div style={progressBarStyle}>
        {md.progress.buckets.map((b, i) => (
          <span
            key={i}
            style={{
              flexGrow: b.count,
              background: toneBg(b.tone),
              color: toneText(b.tone),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: "var(--font-mono, monospace)",
              minWidth: 0,
            }}
            title={`${b.label}: ${b.count}`}
          >
            {b.count / total > 0.04 ? b.count : ""}
          </span>
        ))}
      </div>
      <div style={progressCardsStyle}>
        {md.progress.buckets.map((b, i) => (
          <ProgressBucketCard key={i} bucket={b} />
        ))}
      </div>
    </section>
  )
}

function ProgressBucketCard({ bucket }: { bucket: WorkstreamMdProgressBucket }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
        border: `1px solid ${toneBorder(bucket.tone)}`,
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: toneText(bucket.tone),
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
        }}
      >
        {bucket.count}
      </div>
      <div style={statLabelStyle}>{bucket.label}</div>
    </div>
  )
}

// ── Active items ──────────────────────────────────────────────────────

const ACTIVE_TABS: Array<{
  id: keyof WorkstreamMdActive
  label: string
  tone: string
}> = [
  { id: "blocked", label: "Blocked", tone: "red" },
  { id: "inProgress", label: "In Progress", tone: "blue" },
  { id: "onHold", label: "On Hold", tone: "amber" },
  { id: "approvedReview", label: "Approved CR", tone: "slate" },
  { id: "codeReview", label: "Code Review", tone: "violet" },
  { id: "openUnassigned", label: "Open / Unassigned", tone: "red" },
  { id: "evaluating", label: "Evaluating", tone: "amber" },
  { id: "evaluated", label: "Evaluated", tone: "neutral" },
]

function ActiveItemsPanel({ active }: { active: WorkstreamMdActive }) {
  const firstNonEmpty = ACTIVE_TABS.find((t) => (active[t.id] || []).length > 0)?.id || "blocked"
  const [tab, setTab] = useState<keyof WorkstreamMdActive>(firstNonEmpty)
  const list = active[tab] || []
  return (
    <section className="panel">
      <h3 style={panelHeadStyle}>
        Active items <span style={panelCountStyle}>by state</span>
      </h3>
      <div style={tabsRowStyle}>
        {ACTIVE_TABS.map((t) => {
          const count = (active[t.id] || []).length
          const isActive = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{ ...tabStyle, ...(isActive ? tabActiveStyle : {}) }}
            >
              {t.label}
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 9.5,
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: isActive ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.06)",
                  color: isActive ? "#fff" : "var(--lcc-text-faint)",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
      {list.length === 0 ? (
        <div style={emptyStyle}>Nothing in this bucket.</div>
      ) : (
        <ul style={listResetStyle}>
          {list.map((t, i) => (
            <ActiveRow key={`${t.id}-${i}`} item={t} />
          ))}
        </ul>
      )}
    </section>
  )
}

function ActiveRow({ item }: { item: WorkstreamMdActiveItem }) {
  return (
    <li
      style={{
        ...rowStyle,
        borderLeft: item.overdue
          ? "2px solid var(--lcc-red)"
          : item.isNew
          ? "2px solid var(--lcc-violet)"
          : "2px solid var(--lcc-glass-border, rgba(255,255,255,0.1))",
      }}
    >
      <div style={rowIdStyle}>{item.id}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={rowTitleStyle}>{item.title || "(no title)"}</div>
        <div style={rowMetaStyle}>
          {item.assignee ? (
            <span style={{ color: "var(--lcc-text-dim)" }}>{item.assignee}</span>
          ) : (
            <span style={{ color: "var(--lcc-red)" }}>Unassigned</span>
          )}
          {item.note && (
            <>
              <span style={{ margin: "0 6px", color: "var(--lcc-text-faint)" }}>·</span>
              <span style={{ color: "var(--lcc-text-faint)" }}>{item.note}</span>
            </>
          )}
        </div>
      </div>
      {item.overdue && <span style={{ ...chipStyle, color: "var(--lcc-red)", borderColor: "var(--lcc-red)" }}>overdue</span>}
      {item.isNew && !item.overdue && (
        <span style={{ ...chipStyle, color: "var(--lcc-violet)", borderColor: "var(--lcc-violet)" }}>new</span>
      )}
    </li>
  )
}

// ── Key risks ─────────────────────────────────────────────────────────

function KeyRisksPanel({ md }: { md: WorkstreamMdPayload }) {
  return (
    <section className="panel">
      <h3 style={panelHeadStyle}>
        Key risks <span style={panelCountStyle}>{md.keyRisks.length}</span>
      </h3>
      <ul style={listResetStyle}>
        {md.keyRisks.map((r, i) => (
          <li
            key={i}
            style={{
              ...riskRowStyle,
              borderLeft: `3px solid var(--lcc-${r.tone})`,
            }}
          >
            {r.text}
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Burndown ──────────────────────────────────────────────────────────

function BurndownPanel({ md }: { md: WorkstreamMdPayload }) {
  return (
    <section className="panel">
      <h3 style={panelHeadStyle}>
        Burndown & velocity
        <span style={panelCountStyle}>
          {md.burndown.length} months · {md.burndown[md.burndown.length - 1]?.cum ?? 0} closed
        </span>
      </h3>
      <BurndownChart data={md.burndown} />
      <div style={velocityRowStyle}>
        {md.velocity.q1avg != null && (
          <Stat label="Q1 2026 avg / mo" value={md.velocity.q1avg} />
        )}
        {md.velocity.marRate != null && (
          <Stat label="March 2026 rate" value={`${md.velocity.marRate}/wk`} />
        )}
        {md.velocity.remaining != null && <Stat label="Remaining" value={md.velocity.remaining} />}
        {md.velocity.projection && (
          <div
            style={{
              ...statCardStyle,
              gridColumn: "span 2",
              borderColor: "var(--lcc-amber)",
            }}
          >
            <div style={{ ...statValueStyle, color: "var(--lcc-amber)", fontSize: 15 }}>
              {md.velocity.projection}
            </div>
            <div style={statLabelStyle}>
              {md.velocity.projectionNote || "projection"}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function BurndownChart({ data }: { data: WorkstreamMdBurndown[] }) {
  const W = 720
  const H = 220
  const pad = { l: 42, r: 16, t: 18, b: 34 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const maxCum = useMemo(() => Math.max(...data.map((d) => d.cum)), [data])
  const maxMonth = useMemo(() => Math.max(...data.map((d) => d.closed)), [data])
  const xStep = data.length > 1 ? iw / (data.length - 1) : 0
  const yCum = (v: number) => pad.t + ih - (v / maxCum) * ih
  const xAt = (i: number) => pad.l + i * xStep
  const areaPath = [
    `M ${xAt(0)} ${pad.t + ih}`,
    ...data.map((d, i) => `L ${xAt(i)} ${yCum(d.cum)}`),
    `L ${xAt(data.length - 1)} ${pad.t + ih} Z`,
  ].join(" ")
  const linePath = data.map((d, i) => `${i ? "L" : "M"} ${xAt(i)} ${yCum(d.cum)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ display: "block" }}>
      <defs>
        <linearGradient id="ws-burn-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6ee7a8" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#6ee7a8" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={pad.l}
          x2={W - pad.r}
          y1={pad.t + ih * f}
          y2={pad.t + ih * f}
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="1"
        />
      ))}
      {[0, 0.5, 1].map((f) => (
        <text
          key={f}
          x={pad.l - 6}
          y={pad.t + ih * (1 - f) + 3}
          fill="rgba(255,255,255,0.4)"
          fontSize="10"
          textAnchor="end"
        >
          {Math.round(maxCum * f)}
        </text>
      ))}
      {data.map((d, i) => {
        const bw = Math.max(4, xStep * 0.55)
        const bh = (d.closed / maxMonth) * (ih * 0.4)
        return (
          <rect
            key={i}
            x={xAt(i) - bw / 2}
            y={pad.t + ih - bh}
            width={bw}
            height={bh}
            fill={d.partial ? "rgba(110,199,255,0.35)" : "rgba(110,199,255,0.55)"}
            rx="1"
          />
        )
      })}
      <path d={areaPath} fill="url(#ws-burn-grad)" />
      <path d={linePath} fill="none" stroke="#6ee7a8" strokeWidth="2" />
      {data.map((d, i) => (
        <circle
          key={i}
          cx={xAt(i)}
          cy={yCum(d.cum)}
          r={i === data.length - 1 ? 4 : 2}
          fill="#6ee7a8"
          stroke="#0b0d10"
          strokeWidth="1.5"
        />
      ))}
      {data.map(
        (d, i) =>
          (i % 3 === 0 || i === data.length - 1) && (
            <text
              key={i}
              x={xAt(i)}
              y={H - 14}
              fill="rgba(255,255,255,0.5)"
              fontSize="10"
              textAnchor="middle"
            >
              {d.month.split(" ")[0]} {d.month.slice(-2)}
            </text>
          ),
      )}
    </svg>
  )
}

// ── Devs ──────────────────────────────────────────────────────────────

function DevsPanel({ md }: { md: WorkstreamMdPayload }) {
  const maxTotal = Math.max(...md.devs.map((d) => d.total)) || 1
  return (
    <section className="panel">
      <h3 style={panelHeadStyle}>
        Developer workload <span style={panelCountStyle}>{md.devs.length} contributors</span>
      </h3>
      <div>
        <div
          style={{
            ...devRowStyle,
            fontSize: 9.5,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--lcc-text-faint)",
            fontFamily: "var(--font-mono, monospace)",
          }}
        >
          <span>Developer</span>
          <span style={{ textAlign: "right" }}>InProg</span>
          <span style={{ textAlign: "right" }}>CR</span>
          <span style={{ textAlign: "right" }}>Pipeline</span>
          <span style={{ textAlign: "right" }}>Backlog</span>
          <span style={{ textAlign: "right" }}>Total</span>
          <span>Distribution</span>
        </div>
        {md.devs.map((d) => (
          <DevRow key={d.name} dev={d} maxTotal={maxTotal} />
        ))}
      </div>
      {md.devObservations.length > 0 && (
        <ul style={{ ...listResetStyle, marginTop: 12 }}>
          {md.devObservations.map((o, i) => (
            <li key={i} style={devObservationStyle}>{o}</li>
          ))}
        </ul>
      )}
    </section>
  )
}

function DevRow({ dev, maxTotal }: { dev: WorkstreamMdDev; maxTotal: number }) {
  return (
    <div
      style={{
        ...devRowStyle,
        opacity: dev.unassigned ? 0.7 : 1,
        fontStyle: dev.unassigned ? "italic" : "normal",
        borderBottom: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.08))",
        alignItems: "center",
      }}
    >
      <span style={{ fontSize: 12, color: "var(--lcc-text)" }}>{dev.name}</span>
      <span style={devNumStyle(dev.inProgress ? "var(--lcc-blue)" : undefined)}>{dev.inProgress || "·"}</span>
      <span style={devNumStyle(dev.codeReview ? "var(--lcc-violet)" : undefined)}>{dev.codeReview || "·"}</span>
      <span style={devNumStyle(dev.pipeline ? "var(--lcc-blue)" : undefined)}>{dev.pipeline || "·"}</span>
      <span style={devNumStyle(dev.backlog ? "var(--lcc-amber)" : undefined)}>{dev.backlog || "·"}</span>
      <span style={{ ...devNumStyle(), fontWeight: 700 }}>{dev.total}</span>
      <span
        style={{
          display: "flex",
          height: 6,
          width: `${(dev.total / maxTotal) * 100}%`,
          background: "rgba(255,255,255,0.05)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        {dev.inProgress > 0 && <span style={{ flexGrow: dev.inProgress, background: "var(--lcc-blue)" }} />}
        {dev.codeReview > 0 && <span style={{ flexGrow: dev.codeReview, background: "var(--lcc-violet)" }} />}
        {dev.pipeline > 0 && <span style={{ flexGrow: dev.pipeline, background: "rgba(110,199,255,0.5)" }} />}
        {dev.backlog > 0 && <span style={{ flexGrow: dev.backlog, background: "var(--lcc-amber)" }} />}
      </span>
    </div>
  )
}

// ── Recent activity ───────────────────────────────────────────────────

function RecentActivityPanel({ md }: { md: WorkstreamMdPayload }) {
  return (
    <section className="panel">
      <h3 style={panelHeadStyle}>
        Recent activity
        <span style={panelCountStyle}>{md.recentActivity.length} entries</span>
      </h3>
      {md.activitySummary && <p style={{ color: "var(--lcc-text-dim)", fontSize: 12, marginTop: -4 }}>{md.activitySummary}</p>}
      <ul style={listResetStyle}>
        {md.recentActivity.map((a, i) => (
          <RecentRow key={i} row={a} />
        ))}
      </ul>
    </section>
  )
}

function RecentRow({ row }: { row: WorkstreamMdRecent }) {
  return (
    <li
      style={{
        ...rowStyle,
        borderLeft: row.highlight
          ? "2px solid var(--lcc-amber)"
          : `2px solid ${toneBorder(row.tone)}`,
        background: row.highlight
          ? "rgba(255,196,107,0.06)"
          : "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
      }}
    >
      <div style={{ ...rowIdStyle, flex: "0 0 70px" }}>{row.updated.slice(5)}</div>
      <div style={{ ...rowIdStyle, flex: "0 0 110px" }}>{row.id}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={rowTitleStyle}>{row.title}</div>
      </div>
      <span
        style={{
          ...chipStyle,
          color: toneText(row.tone),
          borderColor: toneBorder(row.tone),
        }}
      >
        {row.status}
      </span>
      <span style={{ fontSize: 11, color: "var(--lcc-text-dim)", minWidth: 130, textAlign: "right" }}>
        {row.assignee}
      </span>
    </li>
  )
}

// ── Decisions ─────────────────────────────────────────────────────────

function DecisionsPanel({ md }: { md: WorkstreamMdPayload }) {
  return (
    <section className="panel">
      <h3 style={panelHeadStyle}>
        Decisions <span style={panelCountStyle}>{md.decisions.length}</span>
      </h3>
      {md.decisionContext && (
        <p style={{ color: "var(--lcc-text-dim)", fontSize: 12, marginTop: -4, marginBottom: 12 }}>
          {md.decisionContext}
        </p>
      )}
      <ul style={listResetStyle}>
        {md.decisions.map((d) => (
          <li key={d.id} style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10.5,
                  color: "var(--lcc-text-faint)",
                  fontFamily: "var(--font-mono, monospace)",
                  marginBottom: 3,
                }}
              >
                {d.date}
              </div>
              <div style={rowTitleStyle}>{d.decision}</div>
              {d.impact && <div style={rowMetaStyle}>Impact: {d.impact}</div>}
            </div>
            <span
              style={{
                ...chipStyle,
                color: d.status.toLowerCase() === "accepted" ? "var(--lcc-green)" : "var(--lcc-amber)",
                borderColor: d.status.toLowerCase() === "accepted" ? "var(--lcc-green)" : "var(--lcc-amber)",
              }}
            >
              {d.status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Cross-refs ────────────────────────────────────────────────────────

function CrossRefsPanel({ md }: { md: WorkstreamMdPayload }) {
  return (
    <section className="panel">
      <h3 style={panelHeadStyle}>
        Related workstreams <span style={panelCountStyle}>{md.crossRefs.length}</span>
      </h3>
      <ul style={listResetStyle}>
        {md.crossRefs.map((x, i) => (
          <li key={`${x.ws}-${i}`} style={crossRefRowStyle}>
            <Link to={`/dashboard/workstreams/${x.ws}`} style={crossRefLinkStyle}>
              {x.ws}
            </Link>
            <span style={{ color: "var(--lcc-text-dim)", fontSize: 12 }}>{x.area}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Dependencies & Blockers ───────────────────────────────────────────

function DependenciesPanel({
  crossDeps,
  chains,
  critical,
}: {
  crossDeps: WorkstreamMdCrossDep[]
  chains: WorkstreamMdInternalChain[]
  critical: WorkstreamMdCriticalBlocker | null
}) {
  return (
    <section className="panel">
      <h3 style={panelHeadStyle}>
        Dependencies & Blockers
        <span style={panelCountStyle}>
          {crossDeps.length} cross-project · {chains.length} internal chains
        </span>
      </h3>
      {crossDeps.length > 0 && (
        <>
          <div style={subSectionHeadStyle}>Cross-project (blocking OUT)</div>
          <ul style={listResetStyle}>
            {crossDeps.map((d, i) => (
              <li key={`${d.from}-${d.to}-${i}`} style={depRowStyle}>
                <span style={depIdStyle}>{d.from}</span>
                {d.fromStatus && <span style={depStatusChipStyle}>{d.fromStatus}</span>}
                <span style={depArrowStyle}>→ blocks →</span>
                <span style={{ ...depIdStyle, color: "var(--lcc-violet)" }}>{d.to}</span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 12,
                    color: "var(--lcc-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={d.toTitle}
                >
                  {d.toTitle}
                </span>
                <span style={depAreaStyle}>{d.area}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {chains.length > 0 && (
        <>
          <div style={{ ...subSectionHeadStyle, marginTop: 16 }}>Internal blocking chains</div>
          <ul style={listResetStyle}>
            {chains.map((c, i) => (
              <li
                key={`${c.blocked}-${c.blockedBy}-${i}`}
                style={{ ...depRowStyle, opacity: c.resolved ? 0.65 : 1 }}
              >
                <span style={depIdStyle}>{c.blocked}</span>
                <span style={{ flex: "0 0 180px", minWidth: 0, fontSize: 12, color: "var(--lcc-text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.blockedTitle}
                </span>
                <span style={depArrowStyle}>blocked by</span>
                <span style={{ ...depIdStyle, color: "var(--lcc-violet)" }}>{c.blockedBy}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: "var(--lcc-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.blockerTitle}
                </span>
                <span style={{ ...depStatusChipStyle, color: c.resolved ? "var(--lcc-green)" : "var(--lcc-text-dim)", borderColor: c.resolved ? "var(--lcc-green)" : "rgba(255,255,255,0.15)" }}>
                  {c.blockerStatus}{c.resolved ? " ✓" : ""}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {critical && (
        <div style={criticalBlockerStyle}>
          <span style={{ ...chipStyle, color: "var(--lcc-red)", borderColor: "var(--lcc-red)" }}>
            critical
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: "var(--lcc-text)", fontWeight: 600, marginBottom: 3 }}>
              {critical.title}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--lcc-text-dim)", lineHeight: 1.45 }}>
              {critical.note}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

// ── Team ──────────────────────────────────────────────────────────────

function TeamPanel({ leads }: { leads: string[] }) {
  return (
    <section className="panel">
      <h3 style={panelHeadStyle}>
        Team <span style={panelCountStyle}>{leads.length} leads</span>
      </h3>
      <div style={teamGridStyle}>
        {leads.map((name) => {
          const initials = name
            .split(/\s+/)
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
          return (
            <div key={name} style={teamAvatarStyle}>
              <div style={avatarCircleStyle}>{initials}</div>
              <div style={avatarNameStyle}>{name}</div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ── Asana ↔ Jira ──────────────────────────────────────────────────────

function AsanaJiraPanel({
  rows,
  notes,
}: {
  rows: WorkstreamMdAsanaJira[]
  notes: WorkstreamMdRisk[]
}) {
  return (
    <section className="panel">
      <h3 style={panelHeadStyle}>
        Asana ↔ Jira cross-references
        <span style={panelCountStyle}>{rows.length} mapped</span>
      </h3>
      <div style={ajHeaderStyle}>
        <span>Asana ID</span>
        <span>Task</span>
        <span>Jira</span>
        <span>Asana status</span>
        <span>Jira status</span>
        <span>Aligned?</span>
      </div>
      {rows.map((r, i) => (
        <div key={`${r.asana}-${i}`} style={ajRowStyle}>
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "var(--lcc-text-faint)" }}>
            {r.asana}
          </span>
          <span style={{ fontSize: 12, color: "var(--lcc-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.asanaTitle}
          </span>
          <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: r.jira ? "var(--lcc-blue)" : "var(--lcc-text-faint)" }}>
            {r.jira || "—"}
          </span>
          <span style={{ fontSize: 11, color: "var(--lcc-text-dim)" }}>{r.asanaStatus || "—"}</span>
          <span style={{ fontSize: 11, color: r.jiraStatus === "Closed" ? "var(--lcc-green)" : "var(--lcc-text-dim)" }}>
            {r.jiraStatus || "—"}
          </span>
          <span>
            {r.aligned === "yes" && (
              <span style={{ ...chipStyle, color: "var(--lcc-green)", borderColor: "var(--lcc-green)" }}>✓</span>
            )}
            {r.aligned === "no" && (
              <span style={{ ...chipStyle, color: "var(--lcc-red)", borderColor: "var(--lcc-red)" }}>misaligned</span>
            )}
            {r.aligned === "no-link" && (
              <span style={{ ...chipStyle, color: "var(--lcc-text-dim)", borderColor: "rgba(255,255,255,0.15)" }}>no jira link</span>
            )}
            {r.aligned === "unknown" && (
              <span style={{ ...chipStyle, color: "var(--lcc-amber)", borderColor: "var(--lcc-amber)" }}>unknown</span>
            )}
          </span>
        </div>
      ))}
      {notes.length > 0 && (
        <ul style={{ ...listResetStyle, marginTop: 12 }}>
          {notes.map((n, i) => (
            <li
              key={i}
              style={{
                ...riskRowStyle,
                borderLeft: `3px solid var(--lcc-${n.tone})`,
              }}
            >
              {n.text}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── Asana Coverage ────────────────────────────────────────────────────

function AsanaCoveragePanel({ coverage }: { coverage: WorkstreamMdAsanaCoverage }) {
  return (
    <section className="panel">
      <h3 style={panelHeadStyle}>
        Asana coverage
        <span style={panelCountStyle}>implementation · action items · LPWE</span>
      </h3>
      <div style={coverageGridStyle}>
        <CoverageCard
          label="Implementation"
          count={coverage.implementation.count}
          note={coverage.implementation.note}
          tone="blue"
        />
        <CoverageCard
          label="Action items"
          count={coverage.actionItems.count}
          note={coverage.actionItems.note}
          tasks={coverage.actionItems.tasks}
          tone="amber"
        />
        <CoverageCard
          label="LPWE"
          count={coverage.lpwe.count}
          note={coverage.lpwe.note}
          tone="green"
        />
      </div>
    </section>
  )
}

function CoverageCard({
  label,
  count,
  note,
  tasks,
  tone,
}: {
  label: string
  count: number
  note: string
  tasks?: string[]
  tone: "blue" | "amber" | "green"
}) {
  const color = `var(--lcc-${tone})`
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 10,
        background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
        border: `1px solid ${color}`,
      }}
    >
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {count}
      </div>
      <div style={{ ...statLabelStyle, marginTop: 6 }}>{label}</div>
      {note && (
        <div style={{ fontSize: 12, color: "var(--lcc-text-dim)", lineHeight: 1.4, marginTop: 8 }}>
          {note}
        </div>
      )}
      {tasks && tasks.length > 0 && (
        <ul style={{ margin: "10px 0 0", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
          {tasks.slice(0, 9).map((t, i) => (
            <li key={i} style={{ fontSize: 11.5, color: "var(--lcc-text-dim)", paddingLeft: 12, position: "relative" }}>
              <span style={{ position: "absolute", left: 0, color }}>•</span>
              {t}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Blockers + Critical tasks ─────────────────────────────────────────

function BlockersPanel({ blockers }: { blockers: MigrationBlocker[] }) {
  return (
    <section className="panel">
      <h3 style={panelHeadStyle}>Blockers</h3>
      <ul style={listResetStyle}>
        {blockers.map((b) => (
          <li key={b.id} style={{ ...rowStyle, borderLeft: `2px solid ${sevColor(b.severity)}` }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={rowIdStyle}>{b.id}</div>
              <div style={rowTitleStyle}>{b.name}</div>
              {b.note && <div style={rowMetaStyle}>{stripEmphasis(b.note)}</div>}
            </div>
            {b.severity && (
              <span style={{ ...chipStyle, color: sevColor(b.severity), borderColor: sevColor(b.severity) }}>
                {b.severity}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function CriticalTasksPanel({ tasks }: { tasks: RawTaskRecord[] }) {
  if (tasks.length === 0) return null
  return (
    <section className="panel">
      <h3 style={panelHeadStyle}>
        Critical tasks (from raw vault) <span style={panelCountStyle}>{tasks.length}</span>
      </h3>
      <ul style={listResetStyle}>
        {tasks.map((t) => (
          <li key={t.key} style={rowStyle}>
            <div style={rowIdStyle}>{t.key}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={rowTitleStyle}>{t.summary || "(no title)"}</div>
              {t.assignee && <div style={rowMetaStyle}>assignee · {t.assignee}</div>}
            </div>
            {t.priority && (
              <span style={{ ...chipStyle, color: sevColor(t.priority), borderColor: sevColor(t.priority) }}>
                {t.priority}
              </span>
            )}
            {t.status && (
              <span style={{ fontSize: 10.5, color: "var(--lcc-text-faint)", fontFamily: "var(--font-mono, monospace)" }}>
                {t.status}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

// ── Shared pieces ─────────────────────────────────────────────────────

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone?: "green" | "red" | "amber" | "blue"
}) {
  const colour = tone ? `var(--lcc-${tone})` : "var(--lcc-text)"
  return (
    <div style={statCardStyle}>
      <div style={{ ...statValueStyle, color: colour }}>{value}</div>
      <div style={statLabelStyle}>{label}</div>
    </div>
  )
}

function stripEmphasis(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1")
}

function healthColor(h: string): string {
  if (h === "on-track" || h === "near-complete" || h === "improving") return "var(--lcc-green)"
  if (h === "at-risk" || h === "in-progress") return "var(--lcc-amber)"
  if (h === "off-track" || h === "blocked") return "var(--lcc-red)"
  return "var(--lcc-text-dim)"
}
function healthBg(h: string): string {
  if (h === "on-track" || h === "near-complete" || h === "improving") return "var(--lcc-green-bg)"
  if (h === "at-risk" || h === "in-progress") return "var(--lcc-amber-bg)"
  if (h === "off-track" || h === "blocked") return "var(--lcc-red-bg)"
  return "rgba(255,255,255,0.05)"
}
function sevColor(sev: string | null | undefined): string {
  const s = (sev ?? "").toLowerCase()
  if (s.includes("critical") || s.includes("blocker")) return "var(--lcc-red)"
  if (s.includes("high")) return "var(--lcc-amber)"
  if (s.includes("medium")) return "var(--lcc-blue)"
  return "var(--lcc-text-dim)"
}
function toneBg(tone: string): string {
  const map: Record<string, string> = {
    green: "rgba(110,231,168,0.32)",
    red: "rgba(255,107,139,0.32)",
    amber: "rgba(255,196,107,0.32)",
    blue: "rgba(110,199,255,0.32)",
    cyan: "rgba(103,232,249,0.30)",
    violet: "rgba(176,140,255,0.32)",
    slate: "rgba(148,163,184,0.30)",
    neutral: "rgba(122,131,168,0.20)",
  }
  return map[tone] || "rgba(122,131,168,0.20)"
}
function toneBorder(tone: string): string {
  const map: Record<string, string> = {
    green: "var(--lcc-green)",
    red: "var(--lcc-red)",
    amber: "var(--lcc-amber)",
    blue: "var(--lcc-blue)",
    cyan: "rgba(103,232,249,0.6)",
    violet: "var(--lcc-violet)",
    slate: "rgba(148,163,184,0.6)",
    neutral: "rgba(255,255,255,0.1)",
  }
  return map[tone] || "rgba(255,255,255,0.1)"
}
function toneText(tone: string): string {
  const map: Record<string, string> = {
    green: "var(--lcc-green)",
    red: "var(--lcc-red)",
    amber: "var(--lcc-amber)",
    blue: "var(--lcc-blue)",
    cyan: "#67e8f9",
    violet: "var(--lcc-violet)",
    slate: "#cbd5e1",
    neutral: "var(--lcc-text-dim)",
  }
  return map[tone] || "var(--lcc-text)"
}

// ── Styles ────────────────────────────────────────────────────────────

const shellStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "260px 1fr",
  gap: 14,
  padding: 14,
  alignItems: "start",
}
const pageStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  minWidth: 0,
  paddingBottom: 24,
}
const loadingStyle: React.CSSProperties = {
  padding: 24,
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "var(--lcc-text-dim)",
}
const backLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  color: "var(--lcc-text-dim)",
  textDecoration: "none",
  fontSize: 12,
}
const heroTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 18,
  alignItems: "flex-start",
}
const heroRightStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-end",
  gap: 14,
}
const heroCountsStyle: React.CSSProperties = {
  display: "flex",
  gap: 18,
}
const heroCountValue: React.CSSProperties = {
  fontSize: 26,
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
}
const heroCountLabel: React.CSSProperties = {
  fontSize: 9.5,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--lcc-text-faint)",
  fontFamily: "var(--font-mono, monospace)",
  marginTop: 2,
}
const eyebrowStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--lcc-text-faint)",
  fontFamily: "var(--font-mono, monospace)",
  marginBottom: 6,
}
const heroTitleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: "-0.02em",
  margin: 0,
  color: "var(--lcc-text)",
  lineHeight: 1.1,
}
const heroNoteStyle: React.CSSProperties = {
  marginTop: 10,
  color: "var(--lcc-text-dim)",
  fontSize: 13,
  lineHeight: 1.5,
  maxWidth: 760,
}
const healthChipStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "4px 10px",
  borderRadius: 999,
  fontSize: 10.5,
  letterSpacing: "0.1em",
  fontWeight: 700,
  border: "1px solid",
}
const twoColStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 14,
}
const panelHeadStyle: React.CSSProperties = {
  margin: "0 0 14px",
  fontSize: 10.5,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--lcc-text-faint)",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: 8,
}
const panelCountStyle: React.CSSProperties = {
  marginLeft: "auto",
  fontFamily: "var(--font-mono, monospace)",
  color: "var(--lcc-text-dim)",
  fontWeight: 500,
  letterSpacing: 0,
  textTransform: "none",
  fontSize: 11,
}
const listResetStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: 0,
  display: "flex",
  flexDirection: "column",
  gap: 6,
}
const sourceRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "6px 0",
  borderBottom: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.06))",
  fontSize: 12,
}
const kindPill: React.CSSProperties = {
  fontSize: 9,
  fontFamily: "var(--font-mono, monospace)",
  padding: "1px 7px",
  borderRadius: 999,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  border: "1px solid",
}
const scopeRowStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 3,
  padding: "8px 0",
  borderBottom: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.06))",
}
const scopeLabelStyle: React.CSSProperties = {
  fontSize: 12.5,
  fontWeight: 600,
  color: "var(--lcc-text)",
}
const scopeNoteStyle: React.CSSProperties = {
  fontSize: 11.5,
  color: "var(--lcc-text-dim)",
  lineHeight: 1.45,
}
const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: 10,
}
const statCardStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  border: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.1))",
  borderRadius: 8,
}
const statValueStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  fontVariantNumeric: "tabular-nums",
  lineHeight: 1,
}
const statLabelStyle: React.CSSProperties = {
  fontSize: 9.5,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--lcc-text-faint)",
  fontFamily: "var(--font-mono, monospace)",
  marginTop: 4,
}
const epicGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
  gap: 8,
}
const epicCardStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  border: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.1))",
  borderRadius: 8,
}
const epicIdStyle: React.CSSProperties = {
  fontSize: 10.5,
  fontFamily: "var(--font-mono, monospace)",
  color: "var(--lcc-blue)",
  marginBottom: 3,
}
const epicTitleStyle: React.CSSProperties = {
  fontSize: 12.5,
  color: "var(--lcc-text)",
  fontWeight: 500,
  lineHeight: 1.35,
}
const progressBarStyle: React.CSSProperties = {
  display: "flex",
  height: 28,
  borderRadius: 6,
  overflow: "hidden",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.08))",
  marginBottom: 12,
}
const progressCardsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: 8,
}
const tabsRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
  marginBottom: 14,
  padding: 4,
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  border: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.08))",
  borderRadius: 999,
  width: "fit-content",
}
const tabStyle: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "var(--lcc-text-dim)",
  font: "inherit",
  fontSize: 11,
  padding: "5px 12px",
  borderRadius: 999,
  cursor: "pointer",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
}
const tabActiveStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--lcc-violet), var(--lcc-blue))",
  color: "#fff",
  boxShadow: "0 0 14px rgba(176,140,255,0.4)",
}
const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "10px 12px",
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  borderRadius: 6,
}
const rowIdStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 10.5,
  color: "var(--lcc-text-faint)",
  flex: "0 0 auto",
  minWidth: 90,
  maxWidth: 140,
  paddingTop: 2,
}
const rowTitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--lcc-text)",
  lineHeight: 1.4,
}
const rowMetaStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--lcc-text-dim)",
  marginTop: 4,
  lineHeight: 1.4,
}
const chipStyle: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  border: "1px solid",
  borderRadius: 999,
  padding: "2px 8px",
  fontFamily: "var(--font-mono, monospace)",
}
const riskRowStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  borderRadius: 6,
  fontSize: 12.5,
  lineHeight: 1.5,
  color: "var(--lcc-text-dim)",
}
const emptyStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--lcc-text-faint)",
  fontStyle: "italic",
  padding: "20px 10px",
  textAlign: "center",
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  borderRadius: 6,
}
const velocityRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: 10,
  marginTop: 12,
}
const devRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 60px 60px 70px 70px 60px 1.6fr",
  gap: 8,
  padding: "8px 0",
}
const devNumStyle = (color?: string): React.CSSProperties => ({
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 12,
  textAlign: "right",
  color: color ?? "var(--lcc-text-dim)",
  fontVariantNumeric: "tabular-nums",
})
const devObservationStyle: React.CSSProperties = {
  padding: "6px 12px",
  color: "var(--lcc-text-dim)",
  fontSize: 12,
  borderLeft: "2px solid var(--lcc-blue)",
  background: "var(--lcc-blue-bg)",
  borderRadius: 4,
}
const crossRefRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "8px 12px",
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  borderRadius: 6,
}
const crossRefLinkStyle: React.CSSProperties = {
  color: "var(--lcc-blue)",
  textDecoration: "none",
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 12,
  flex: "0 0 220px",
}
const heroGridStyle: React.CSSProperties = {
  marginTop: 20,
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
  borderTop: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.08))",
  paddingTop: 18,
}
const subSectionHeadStyle: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 9.5,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--lcc-text-faint)",
  fontWeight: 600,
  fontFamily: "var(--font-mono, monospace)",
}
const depRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  padding: "8px 10px",
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  borderRadius: 6,
  fontSize: 12,
}
const depIdStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 11,
  color: "var(--lcc-blue)",
  flex: "0 0 110px",
}
const depStatusChipStyle: React.CSSProperties = {
  fontSize: 10,
  padding: "2px 8px",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 999,
  color: "var(--lcc-text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontFamily: "var(--font-mono, monospace)",
  whiteSpace: "nowrap",
}
const depArrowStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: "var(--lcc-text-faint)",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  fontFamily: "var(--font-mono, monospace)",
  whiteSpace: "nowrap",
}
const depAreaStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: "var(--lcc-text-dim)",
  fontFamily: "var(--font-mono, monospace)",
  whiteSpace: "nowrap",
}
const criticalBlockerStyle: React.CSSProperties = {
  marginTop: 16,
  padding: "12px 14px",
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  background: "var(--lcc-red-bg, rgba(255,107,139,0.08))",
  border: "1px solid var(--lcc-red)",
  borderRadius: 8,
}
const teamGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))",
  gap: 12,
}
const teamAvatarStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
}
const avatarCircleStyle: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg, var(--lcc-violet), var(--lcc-blue))",
  color: "#fff",
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: "0.03em",
  fontFamily: "var(--font-mono, monospace)",
  boxShadow: "0 0 10px rgba(176,140,255,0.25)",
}
const avatarNameStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--lcc-text-dim)",
  textAlign: "center",
  lineHeight: 1.3,
}
const ajHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "80px 1fr 110px 100px 100px 110px",
  gap: 10,
  padding: "6px 10px",
  fontSize: 9.5,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--lcc-text-faint)",
  fontFamily: "var(--font-mono, monospace)",
  borderBottom: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.08))",
  marginBottom: 4,
}
const ajRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "80px 1fr 110px 100px 100px 110px",
  gap: 10,
  padding: "8px 10px",
  alignItems: "center",
  borderBottom: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.04))",
}
const coverageGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 2fr 1fr",
  gap: 14,
  alignItems: "stretch",
}
