import { useMemo, useState } from "react"
import type {
  MigrationSnapshot,
  SnapshotAnalyticsBlocker,
  SnapshotLpweUnestimated,
  SnapshotMaoItem,
  SnapshotOpenHighPriGroup,
  SnapshotPositive,
  SnapshotPrivateLinkGap,
  SnapshotRetestItem,
  SnapshotSource,
  SnapshotStatusChange,
  SnapshotTaskItem,
} from "@/types"

// Six-tab panel matching the handoff DailyStatus component. Each tab
// consumes a subset of the snapshot payload (see handoff/design/app.jsx
// and status_parser.py). Tabs hide themselves when they have no data
// so low-signal days don't show empty pills.

type Tone = "red" | "amber" | "green" | "blue" | "violet" | "neutral"

type TabId = "critical" | "open" | "changes" | "services" | "coverage" | "health"

interface Props {
  snapshot: MigrationSnapshot
}

export function DailyStatusSummary({ snapshot: input }: Props) {
  const snapshot = useMemo(() => withDefaults(input), [input])
  const tabs = useMemo(() => buildTabs(snapshot), [snapshot])
  const [tab, setTab] = useState<TabId>(() => tabs.find((t) => t.count > 0)?.id ?? "critical")

  return (
    <section className="panel" aria-label="Daily status summary">
      <div style={eyebrowStyle}>
        <span>Daily Status · {snapshot.date}</span>
        {snapshot.sourcePath && (
          <>
            <span style={eyebrowSep}>·</span>
            <span style={eyebrowFile}>{snapshot.sourcePath}</span>
          </>
        )}
        {snapshot.overall && (
          <>
            <span style={eyebrowSep}>·</span>
            <HealthBadge health={snapshot.overall} />
          </>
        )}
      </div>

      {snapshot.headline && <p style={headlineStyle}>{snapshot.headline}</p>}

      <div style={tabBarStyle} role="tablist">
        {tabs.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(t.id)}
              style={active ? tabStyleActive : tabStyle}
            >
              <span>{t.label}</span>
              {t.count > 0 && <span style={tabCountStyle}>{t.count}</span>}
            </button>
          )
        })}
      </div>

      <div style={tabBodyStyle}>
        {tab === "critical" && <CriticalTab snapshot={snapshot} />}
        {tab === "open" && <OpenHighPriTab groups={snapshot.openHighPri} />}
        {tab === "changes" && <ChangesTab snapshot={snapshot} />}
        {tab === "services" && <ServicesTab snapshot={snapshot} />}
        {tab === "coverage" && <CoverageTab sources={snapshot.sourceCoverage} />}
        {tab === "health" && <HealthTab areaStatuses={snapshot.areaStatuses} />}
      </div>
    </section>
  )
}

// ── Defaults ───────────────────────────────────────────────────────────

// Historical snapshot payloads (ingested before the parser was
// extended) may lack the new fields. Coerce them to empty arrays so
// the tab panel renders cleanly instead of crashing on .length.
function withDefaults(s: MigrationSnapshot): MigrationSnapshot {
  return {
    ...s,
    criticalBugs: s.criticalBugs ?? [],
    prodFailures: s.prodFailures ?? [],
    openBlockers: s.openBlockers ?? [],
    newItems: s.newItems ?? [],
    statusChanges: s.statusChanges ?? [],
    positives: s.positives ?? [],
    retest: s.retest ?? [],
    analyticsBlockers: s.analyticsBlockers ?? [],
    openHighPri: s.openHighPri ?? [],
    mao: s.mao ?? [],
    privateLinkGaps: s.privateLinkGaps ?? [],
    lpweUnestimated: s.lpweUnestimated ?? [],
    sourceCoverage: s.sourceCoverage ?? [],
    areaStatuses: s.areaStatuses ?? {},
  }
}

// ── Tab definitions ────────────────────────────────────────────────────

function buildTabs(s: MigrationSnapshot): Array<{ id: TabId; label: string; count: number }> {
  return [
    {
      id: "critical",
      label: "Critical",
      count:
        s.criticalBugs.length +
        s.prodFailures.length +
        s.retest.length +
        s.analyticsBlockers.length,
    },
    {
      id: "open",
      label: "Open High-Pri",
      count: s.openHighPri.reduce((n, g) => n + g.items.length, 0),
    },
    {
      id: "changes",
      label: "Today's Changes",
      count: s.positives.length + s.statusChanges.length + s.newItems.length,
    },
    {
      id: "services",
      label: "Orders & Services",
      count: s.mao.length + s.privateLinkGaps.length + s.lpweUnestimated.length,
    },
    { id: "coverage", label: "Source Coverage", count: s.sourceCoverage.length },
    { id: "health", label: "Project Health", count: Object.keys(s.areaStatuses).length },
  ]
}

// ── Tab bodies ─────────────────────────────────────────────────────────

function CriticalTab({ snapshot }: { snapshot: MigrationSnapshot }) {
  const empty =
    !snapshot.criticalBugs.length &&
    !snapshot.prodFailures.length &&
    !snapshot.retest.length &&
    !snapshot.analyticsBlockers.length
  if (empty) return <EmptyHint>Nothing critical on this snapshot.</EmptyHint>

  return (
    <div style={columnsStyle}>
      {snapshot.criticalBugs.length > 0 && (
        <Section tone="red" label="Critical Bugs" count={snapshot.criticalBugs.length}>
          {snapshot.criticalBugs.map((b) => (
            <Row
              key={b.id}
              id={b.id}
              title={b.title}
              meta={b.due ? `due ${b.due}` : undefined}
              tone="red"
              tag={b.tag ?? "CRITICAL"}
            />
          ))}
        </Section>
      )}

      {snapshot.prodFailures.length > 0 && (
        <Section tone="red" label="Production Failures" count={snapshot.prodFailures.length}>
          {snapshot.prodFailures.map((p) => (
            <Row
              key={p.id}
              id={p.id}
              title={p.title}
              meta={joinMeta(p.who, p.status)}
              tone="red"
              tag={p.regression ? "REGRESSION" : p.tag}
            />
          ))}
        </Section>
      )}

      {snapshot.retest.length > 0 && (
        <Section tone="amber" label="Awaiting Retest" count={snapshot.retest.length}>
          {snapshot.retest.map((r: SnapshotRetestItem) => (
            <Row
              key={r.id}
              id={r.id}
              title={r.title}
              meta={joinMeta(r.who, r.status)}
              tone="amber"
            />
          ))}
        </Section>
      )}

      {snapshot.analyticsBlockers.length > 0 && (
        <Section tone="red" label="Analytics Blockers" count={snapshot.analyticsBlockers.length}>
          {snapshot.analyticsBlockers.map((a: SnapshotAnalyticsBlocker) => (
            <Row
              key={a.id}
              id={a.id}
              title={a.title}
              meta={a.who}
              tone="red"
              tag={a.priority}
            />
          ))}
        </Section>
      )}
    </div>
  )
}

function OpenHighPriTab({ groups }: { groups: SnapshotOpenHighPriGroup[] }) {
  if (!groups.length) return <EmptyHint>No open high-priority bugs tracked.</EmptyHint>
  return (
    <div style={columnsStyle}>
      {groups.map((g) => (
        <Section key={g.label} tone="amber" label={g.label} count={g.items.length}>
          {g.items.map((item) => (
            <Row
              key={item.id}
              id={item.id}
              title={item.title}
              meta={item.status}
              tone="amber"
              tag={item.priority}
            />
          ))}
        </Section>
      ))}
    </div>
  )
}

function ChangesTab({ snapshot }: { snapshot: MigrationSnapshot }) {
  const empty =
    !snapshot.positives.length && !snapshot.statusChanges.length && !snapshot.newItems.length
  if (empty) return <EmptyHint>No tracked changes on this snapshot.</EmptyHint>
  return (
    <div style={columnsStyle}>
      {snapshot.positives.length > 0 && (
        <Section tone="green" label="Positives" count={snapshot.positives.length}>
          {snapshot.positives.map((p: SnapshotPositive) => (
            <Row key={p.id} id={p.id} title={p.title} meta={p.detail} tone="green" />
          ))}
        </Section>
      )}
      {snapshot.statusChanges.length > 0 && (
        <Section tone="blue" label="Status Changes" count={snapshot.statusChanges.length}>
          {snapshot.statusChanges.map((c: SnapshotStatusChange) => (
            <Row key={c.id} id={c.id} title={c.change} meta={c.detail} tone="blue" />
          ))}
        </Section>
      )}
      {snapshot.newItems.length > 0 && (
        <Section tone="violet" label="New Items" count={snapshot.newItems.length}>
          {snapshot.newItems.map((n: SnapshotTaskItem) => (
            <Row
              key={n.id}
              id={n.id}
              title={n.title ?? ""}
              meta={joinMeta(n.type, n.who)}
              tone="violet"
            />
          ))}
        </Section>
      )}
    </div>
  )
}

function ServicesTab({ snapshot }: { snapshot: MigrationSnapshot }) {
  const empty =
    !snapshot.mao.length && !snapshot.privateLinkGaps.length && !snapshot.lpweUnestimated.length
  if (empty) return <EmptyHint>No orders/services items on this snapshot.</EmptyHint>
  return (
    <div style={columnsStyle}>
      {snapshot.mao.length > 0 && (
        <Section tone="amber" label="MAO Interface" count={snapshot.mao.length}>
          {snapshot.mao.map((m: SnapshotMaoItem) => (
            <Row
              key={m.id}
              id={m.id}
              title={m.title}
              meta={m.status}
              tone={m.ok ? "green" : "amber"}
              tag={m.ok ? "IN STAGE" : undefined}
            />
          ))}
        </Section>
      )}
      {snapshot.privateLinkGaps.length > 0 && (
        <Section
          tone="amber"
          label="Private Link Order History"
          count={snapshot.privateLinkGaps.length}
        >
          {snapshot.privateLinkGaps.map((pl: SnapshotPrivateLinkGap) => (
            <Row key={pl.id} id={pl.id} title={pl.field} tone="amber" />
          ))}
        </Section>
      )}
      {snapshot.lpweUnestimated.length > 0 && (
        <Section
          tone="violet"
          label="Unestimated LPWE"
          count={snapshot.lpweUnestimated.length}
        >
          {snapshot.lpweUnestimated.map((l: SnapshotLpweUnestimated) => (
            <Row key={l.id} id={l.id} title={l.title} meta={l.estimate} tone="violet" />
          ))}
        </Section>
      )}
    </div>
  )
}

function CoverageTab({ sources }: { sources: SnapshotSource[] }) {
  if (!sources.length) return <EmptyHint>No source coverage on this snapshot.</EmptyHint>
  const totals = sources.reduce(
    (acc, s) => {
      acc.total += s.total
      acc.resolved += s.resolved
      acc.active += s.active
      return acc
    },
    { total: 0, resolved: 0, active: 0 },
  )
  const totalPct = totals.total > 0 ? Math.round((totals.resolved / totals.total) * 100) : 0

  return (
    <div style={tableWrapStyle}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Source</th>
            <th style={thNumStyle}>Total</th>
            <th style={thNumStyle}>Resolved</th>
            <th style={thNumStyle}>Active</th>
            <th style={thNumStyle}>% Resolved</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => {
            const pct = s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0
            return (
              <tr key={s.key}>
                <td style={tdStyle}>{s.key}</td>
                <td style={tdNumStyle}>{fmt(s.total, s.approx)}</td>
                <td style={tdNumStyle}>{fmt(s.resolved, s.approx)}</td>
                <td style={tdNumStyle}>{fmt(s.active, s.approx)}</td>
                <td style={tdNumStyle}>{pct}%</td>
              </tr>
            )
          })}
          <tr style={totalRowStyle}>
            <td style={{ ...tdStyle, fontWeight: 700 }}>Combined</td>
            <td style={{ ...tdNumStyle, fontWeight: 700 }}>{fmt(totals.total, true)}</td>
            <td style={{ ...tdNumStyle, fontWeight: 700 }}>{fmt(totals.resolved, true)}</td>
            <td style={{ ...tdNumStyle, fontWeight: 700 }}>{fmt(totals.active, true)}</td>
            <td style={{ ...tdNumStyle, fontWeight: 700 }}>{totalPct}%</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function HealthTab({ areaStatuses }: { areaStatuses: Record<string, string> }) {
  const entries = Object.entries(areaStatuses)
  if (!entries.length) return <EmptyHint>No area statuses on this snapshot.</EmptyHint>
  const grouped = entries.reduce<Record<string, number>>((acc, [, status]) => {
    acc[status] = (acc[status] ?? 0) + 1
    return acc
  }, {})
  const order: Array<[string, Tone]> = [
    ["blocked", "red"],
    ["at-risk", "amber"],
    ["in-progress", "blue"],
    ["improving", "blue"],
    ["near-complete", "green"],
    ["groomed", "neutral"],
  ]

  return (
    <div>
      <div style={healthGridStyle}>
        {order
          .filter(([key]) => grouped[key])
          .map(([key, tone]) => (
            <div key={key} style={{ ...healthCellStyle, borderLeft: `2px solid var(--lcc-${tone})` }}>
              <div style={healthCountStyle}>{grouped[key]}</div>
              <div style={healthLabelStyle}>{key.replace("-", " ")}</div>
            </div>
          ))}
      </div>
      <a
        href="#workstreams"
        style={jumpLinkStyle}
        onClick={(e) => {
          e.preventDefault()
          document.getElementById("workstreams")?.scrollIntoView({ behavior: "smooth", block: "start" })
        }}
      >
        Jump to full workstream view ↓
      </a>
    </div>
  )
}

// ── Primitives ─────────────────────────────────────────────────────────

function HealthBadge({ health }: { health: string }) {
  const tone = health === "on-track" ? "green" : health === "off-track" ? "red" : "amber"
  const label = health.replace("-", " ").toUpperCase()
  return (
    <span
      style={{
        padding: "2px 8px",
        borderRadius: 999,
        fontSize: 9.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        color: `var(--lcc-${tone})`,
        background: `var(--lcc-${tone}-bg)`,
        border: `1px solid var(--lcc-${tone})`,
      }}
    >
      {label}
    </span>
  )
}

function Section({
  tone,
  label,
  count,
  children,
}: {
  tone: Tone
  label: string
  count: number
  children: React.ReactNode
}) {
  return (
    <section>
      <div style={sectionHeadStyle}>
        <span style={{ color: `var(--lcc-${tone})` }}>{label}</span>
        <span style={sectionSepStyle} />
        <span style={sectionCountStyle}>{count}</span>
      </div>
      <div style={rowsStyle}>{children}</div>
    </section>
  )
}

function Row({
  id,
  title,
  meta,
  right,
  tone,
  tag,
}: {
  id: string
  title: string
  meta?: string
  right?: string
  tone?: Tone
  tag?: string
}) {
  const accent = tone ? `var(--lcc-${tone})` : "var(--lcc-text-faint)"
  return (
    <div style={{ ...rowStyle, borderLeft: `2px solid ${accent}` }}>
      <div style={rowIdStyle}>{id}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={rowTitleStyle}>{title}</div>
        {meta && <div style={rowMetaStyle}>{meta}</div>}
      </div>
      {tag && <span style={{ ...chipStyle, color: accent, borderColor: accent }}>{tag}</span>}
      {right && <span style={rowRightStyle}>{right}</span>}
    </div>
  )
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <div style={emptyStyle}>{children}</div>
}

// ── Helpers ────────────────────────────────────────────────────────────

function joinMeta(...parts: Array<string | undefined>): string | undefined {
  const filtered = parts.filter((p) => p && p.trim()) as string[]
  return filtered.length ? filtered.join(" · ") : undefined
}

function fmt(n: number, approx?: boolean): string {
  const s = n.toLocaleString()
  return approx ? `~${s}` : s
}

// ── Styles ─────────────────────────────────────────────────────────────

const eyebrowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  flexWrap: "wrap",
  fontSize: 10.5,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--lcc-text-faint)",
  fontWeight: 600,
  fontFamily: "var(--font-mono, monospace)",
  marginBottom: 10,
}
const eyebrowSep: React.CSSProperties = { color: "var(--lcc-text-faint)" }
const eyebrowFile: React.CSSProperties = {
  color: "var(--lcc-text-faint)",
  textTransform: "none",
  letterSpacing: "0.02em",
}

const headlineStyle: React.CSSProperties = {
  fontSize: 13.5,
  lineHeight: 1.5,
  color: "var(--lcc-text-dim)",
  margin: "0 0 14px",
  fontWeight: 400,
  letterSpacing: "-0.005em",
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
}

const tabBarStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  marginBottom: 14,
  borderBottom: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.08))",
  paddingBottom: 6,
}

const tabStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 6,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "transparent",
  background: "transparent",
  color: "var(--lcc-text-dim)",
  fontSize: 11,
  fontFamily: "var(--font-mono, monospace)",
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  cursor: "pointer",
}

const tabStyleActive: React.CSSProperties = {
  ...tabStyle,
  color: "var(--lcc-text)",
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.35))",
  borderColor: "var(--lcc-glass-border, rgba(255,255,255,0.1))",
}

const tabCountStyle: React.CSSProperties = {
  fontSize: 10,
  padding: "1px 6px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.08)",
  color: "var(--lcc-text-dim)",
}

const tabBodyStyle: React.CSSProperties = { minHeight: 100 }

const columnsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 18,
}

const sectionHeadStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 8,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.14em",
  fontFamily: "var(--font-mono, monospace)",
  fontWeight: 700,
}

const sectionSepStyle: React.CSSProperties = {
  flex: 1,
  height: 1,
  background:
    "linear-gradient(90deg, var(--lcc-glass-border, rgba(255,255,255,0.1)), transparent)",
}

const sectionCountStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 10,
  padding: "1px 7px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  color: "var(--lcc-text-dim)",
}

const rowsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "8px 10px",
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  borderRadius: 6,
}

const rowIdStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 10.5,
  color: "var(--lcc-text-faint)",
  flexShrink: 0,
  paddingTop: 2,
  minWidth: 74,
  wordBreak: "break-word",
}

const rowTitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--lcc-text)",
  fontWeight: 600,
  lineHeight: 1.35,
}

const rowMetaStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--lcc-text-dim)",
  marginTop: 3,
  lineHeight: 1.4,
}

const rowRightStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: "var(--lcc-text-faint)",
  fontFamily: "var(--font-mono, monospace)",
  whiteSpace: "nowrap",
  paddingTop: 3,
}

const chipStyle: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  padding: "2px 7px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  whiteSpace: "nowrap",
  flexShrink: 0,
}

const emptyStyle: React.CSSProperties = {
  fontSize: 11,
  color: "var(--lcc-text-faint)",
  fontStyle: "italic",
  padding: "18px 10px",
  textAlign: "center",
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  borderRadius: 6,
}

const tableWrapStyle: React.CSSProperties = {
  overflowX: "auto",
}

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  fontSize: 12,
}

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 10px",
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "var(--lcc-text-dim)",
  fontFamily: "var(--font-mono, monospace)",
  borderBottom: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.08))",
}

const thNumStyle: React.CSSProperties = { ...thStyle, textAlign: "right" }

const tdStyle: React.CSSProperties = {
  padding: "7px 10px",
  color: "var(--lcc-text)",
  borderBottom: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.05))",
}

const tdNumStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: "right",
  fontFamily: "var(--font-mono, monospace)",
}

const totalRowStyle: React.CSSProperties = {
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.25))",
}

const healthGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: 10,
  marginBottom: 14,
}

const healthCellStyle: React.CSSProperties = {
  padding: "10px 12px",
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  borderRadius: 6,
}

const healthCountStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "var(--lcc-text)",
  fontFamily: "var(--font-mono, monospace)",
  lineHeight: 1,
}

const healthLabelStyle: React.CSSProperties = {
  fontSize: 10.5,
  color: "var(--lcc-text-dim)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginTop: 4,
  fontFamily: "var(--font-mono, monospace)",
}

const jumpLinkStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: 11,
  color: "var(--lcc-accent, #6366f1)",
  textDecoration: "none",
  marginTop: 6,
  fontFamily: "var(--font-mono, monospace)",
  letterSpacing: "0.04em",
}
