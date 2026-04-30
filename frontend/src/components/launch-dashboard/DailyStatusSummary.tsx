import { useMemo, useState } from "react"
import { convertUtcTimesToPacific } from "@/lib/datetime"
import { renderHeadlineSegments } from "./headlineWikilinks"
import type {
  MigrationSnapshot,
  MigrationSource,
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

// Five-tab panel matching the handoff DailyStatus component. Each tab
// consumes a subset of the snapshot payload (see handoff/design/app.jsx
// and status_parser.py). Tabs hide themselves when they have no data
// so low-signal days don't show empty pills.
//
// The legacy "Project Health" tab was removed when we demoted workstreams
// — its data was a per-area workstream rollup, which is now an editorial
// view rather than a primary surface. Project-level health lives on the
// per-project dashboard pages instead.

type Tone = "red" | "amber" | "green" | "blue" | "violet" | "neutral"

type TabId = "critical" | "open" | "changes" | "services" | "coverage"

interface Props {
  snapshot: MigrationSnapshot
  /**
   * Live source totals from /api/dashboard/sources. When provided,
   * the Source Coverage tab swaps each row's resolved/active/total
   * with the live value (matched by `key`) so the tab agrees with
   * the Projects sidebar instead of pinning to whatever totals were
   * authored into today's status note.
   */
  sources?: MigrationSource[] | null
  /**
   * Accepted for backwards compatibility with existing callers but no
   * longer used — the workstream-driven Health tab was removed when we
   * demoted workstreams behind the per-project view. Safe to drop on
   * the call site.
   */
  workstreams?: unknown
}

export function DailyStatusSummary({ snapshot: input, sources }: Props) {
  const snapshot = useMemo(
    () => withLiveSources(withDefaults(input), sources),
    [input, sources],
  )
  const tabs = useMemo(() => buildTabs(snapshot), [snapshot])
  const [tab, setTab] = useState<TabId>(
    () => tabs.find((t) => t.count > 0)?.id ?? "critical",
  )

  return (
    <section
      id="workstreams"
      className="panel"
      aria-label="Daily status summary"
      style={{ scrollMarginTop: 16 }}
    >
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

      {snapshot.headline && (
        <HeadlineBullets
          text={convertUtcTimesToPacific(snapshot.headline, snapshot.date)}
        />
      )}

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
    areaHealth: s.areaHealth ?? [],
  }
}

// Status notes hand-author the Source Coverage table, so its totals
// freeze at publish time and drift from the live Jira/Asana counts the
// Projects sidebar shows. When the caller passes live `sources`, swap
// each authored row's resolved/active/total with the live values
// (matched by key) and clear the `~` approx flag — the live counts are
// exact. Rows without a live match (none today, but cheap insurance)
// keep the authored values.
function withLiveSources(
  snap: MigrationSnapshot,
  sources: MigrationSource[] | null | undefined,
): MigrationSnapshot {
  if (!sources || sources.length === 0) return snap
  const liveByKey = new Map(sources.map((s) => [s.key.toUpperCase(), s]))
  const merged = snap.sourceCoverage.map<SnapshotSource>((row) => {
    const live = liveByKey.get(row.key.toUpperCase())
    if (!live) return row
    return {
      key: row.key,
      total: live.total,
      resolved: live.resolved,
      active: live.active,
    }
  })
  return { ...snap, sourceCoverage: merged }
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
    <div style={coverageTableStyle}>
      <div style={coverageHeaderStyle}>
        <span>Source</span>
        <span style={coverageNumHeadStyle}>Resolved</span>
        <span style={coverageNumHeadStyle}>Active</span>
        <span style={coverageNumHeadStyle}>Total</span>
        <span style={coverageBarHeadStyle}>Coverage</span>
      </div>
      {sources.map((s) => {
        const pct = s.total > 0 ? Math.round((s.resolved / s.total) * 100) : 0
        return (
          <CoverageRow
            key={s.key}
            kind={sourceKind(s.key)}
            label={sourceLabel(s.key)}
            resolved={s.resolved}
            active={s.active}
            total={s.total}
            pct={pct}
            approx={s.approx}
          />
        )
      })}
      <CoverageRow
        kind="all"
        label="Combined unique"
        resolved={totals.resolved}
        active={totals.active}
        total={totals.total}
        pct={totalPct}
        approx
        emphasize
      />
    </div>
  )
}

function CoverageRow({
  kind,
  label,
  resolved,
  active,
  total,
  pct,
  approx,
  emphasize,
}: {
  kind: SourceKind
  label: string
  resolved: number
  active: number
  total: number
  pct: number
  approx?: boolean
  emphasize?: boolean
}) {
  return (
    <div style={emphasize ? coverageRowEmphStyle : coverageRowStyle}>
      <div style={coverageSourceCellStyle}>
        <SourceBadge kind={kind} />
        <span
          style={{
            ...coverageLabelStyle,
            fontWeight: emphasize ? 700 : 500,
            color: emphasize ? "var(--lcc-text)" : "var(--lcc-text)",
          }}
        >
          {label}
        </span>
      </div>
      <span style={{ ...coverageNumStyle, color: "var(--lcc-green, #22c55e)" }}>
        {fmt(resolved, approx)}
      </span>
      <span style={{ ...coverageNumStyle, color: "var(--lcc-amber, #f59e0b)" }}>
        {fmt(active, approx)}
      </span>
      <span style={{ ...coverageNumStyle, fontWeight: emphasize ? 700 : 500 }}>
        {fmt(total, approx)}
      </span>
      <CoverageBar pct={pct} approx={approx} />
    </div>
  )
}

function SourceBadge({ kind }: { kind: SourceKind }) {
  const palette: Record<SourceKind, { bg: string; color: string; border: string }> = {
    jira: {
      bg: "rgba(59, 130, 246, 0.14)",
      color: "#60a5fa",
      border: "rgba(59, 130, 246, 0.5)",
    },
    asana: {
      bg: "rgba(167, 139, 250, 0.14)",
      color: "#c4b5fd",
      border: "rgba(167, 139, 250, 0.5)",
    },
    all: {
      bg: "rgba(34, 197, 94, 0.14)",
      color: "#4ade80",
      border: "rgba(34, 197, 94, 0.5)",
    },
  }
  const p = palette[kind]
  return (
    <span
      style={{
        ...sourceBadgeStyle,
        background: p.bg,
        color: p.color,
        borderColor: p.border,
      }}
    >
      {kind.toUpperCase()}
    </span>
  )
}

function CoverageBar({ pct, approx }: { pct: number; approx?: boolean }) {
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div style={coverageBarTrackStyle}>
      <div
        style={{
          ...coverageBarFillStyle,
          width: `${clamped}%`,
        }}
      >
        {clamped >= 20 && (
          <span style={coverageBarLabelStyle}>
            {approx ? `~${clamped}%` : `${clamped}%`}
          </span>
        )}
      </div>
      {clamped < 20 && (
        <span style={coverageBarLabelOutsideStyle}>
          {approx ? `~${clamped}%` : `${clamped}%`}
        </span>
      )}
    </div>
  )
}

type SourceKind = "jira" | "asana" | "all"

const ASANA_KEYS = new Set(["LAMPSPLUS", "LPWE"])

function sourceKind(key: string): SourceKind {
  return ASANA_KEYS.has(key) ? "asana" : "jira"
}

function sourceLabel(key: string): string {
  // The badge already conveys the source type (JIRA / ASANA), so the
  // label can drop the "Jira " / "Asana " prefix. Saves ~35px of
  // horizontal space in a cramped panel.
  if (key === "WPM") return "WPM (28 projects)"
  return key
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

function HeadlineBullets({ text }: { text: string }) {
  const bullets = splitIntoSentences(text)
  if (bullets.length === 0) return null
  if (bullets.length === 1)
    return <p style={headlineSingleStyle}>{renderHeadlineSegments(bullets[0])}</p>
  return (
    <ul style={headlineListStyle}>
      {bullets.map((b, i) => (
        <li key={i} style={headlineItemStyle}>
          <span style={headlineBulletDotStyle} aria-hidden />
          <span>{renderHeadlineSegments(b)}</span>
        </li>
      ))}
    </ul>
  )
}

function splitIntoSentences(text: string): string[] {
  // Split on sentence terminators followed by whitespace + a capital,
  // digit, or `[` start. Digits cover sentences that begin with an
  // Asana task id ("919491 (Blocker) COMPLETED …"); `[` covers
  // sentences that open with an Obsidian wikilink ("[[LAMPSPLUS-1521 -
  // …|LAMPSPLUS-1521]] Multishipping …") which would otherwise glue
  // onto the previous bullet because `[` isn't a capital letter.
  // Mirrors the backend `_extract_reasons_from_headline` regex.
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9\[])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// Wikilink rendering for headline bullets lives in `./headlineWikilinks`
// so HeroStrip (Project Status reasons) and this panel (Daily Status
// bullets) share a single rendering rule. They both consume the same
// `snap.headline` field so they must stay visually consistent.

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

const headlineSingleStyle: React.CSSProperties = {
  fontSize: 13.5,
  lineHeight: 1.5,
  color: "var(--lcc-text)",
  margin: "0 0 14px",
  fontWeight: 500,
  letterSpacing: "-0.005em",
}

const headlineListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "0 0 14px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
}

const headlineItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  fontSize: 13,
  lineHeight: 1.45,
  color: "var(--lcc-text)",
  fontWeight: 500,
}

const headlineBulletDotStyle: React.CSSProperties = {
  display: "inline-block",
  width: 4,
  height: 4,
  borderRadius: 999,
  background: "var(--lcc-accent, #6366f1)",
  flexShrink: 0,
  marginTop: 8,
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
  // Chip styling mirrors `inlineTaskIdStyle` from headlineWikilinks so
  // task IDs read consistently across the headline, HeroStrip reasons,
  // and every tab row in the panel below. minWidth keeps row titles
  // visually aligned even when IDs vary in length (904692 vs
  // LAMPSPLUS-1521); textAlign centers short IDs in the wider chip.
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 10.5,
  color: "var(--lcc-text)",
  flexShrink: 0,
  padding: "2px 7px",
  borderRadius: 4,
  background: "rgba(255,255,255,0.06)",
  border: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.1))",
  minWidth: 78,
  textAlign: "center",
  whiteSpace: "nowrap",
  marginTop: 1,
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

const coverageTableStyle: React.CSSProperties = {
  borderRadius: 10,
  border: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.08))",
  overflowX: "auto",
}

const coverageGridColumns =
  "minmax(150px, 1.3fr) 58px 58px 58px minmax(110px, 1fr)"

const coverageHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: coverageGridColumns,
  alignItems: "center",
  gap: 12,
  padding: "10px 12px",
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.35))",
  fontSize: 10,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--lcc-text-dim)",
  fontFamily: "var(--font-mono, monospace)",
  fontWeight: 700,
}

const coverageNumHeadStyle: React.CSSProperties = { textAlign: "right" }
const coverageBarHeadStyle: React.CSSProperties = { textAlign: "left" }

const coverageRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: coverageGridColumns,
  alignItems: "center",
  gap: 10,
  padding: "9px 12px",
  borderTop: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.05))",
  fontSize: 12.5,
}

const coverageRowEmphStyle: React.CSSProperties = {
  ...coverageRowStyle,
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.25))",
  fontWeight: 700,
}

const coverageSourceCellStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  minWidth: 0,
}

const coverageLabelStyle: React.CSSProperties = {
  color: "var(--lcc-text)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
}

const coverageNumStyle: React.CSSProperties = {
  textAlign: "right",
  fontFamily: "var(--font-mono, monospace)",
  fontWeight: 500,
}

const sourceBadgeStyle: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  padding: "2px 9px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  fontFamily: "var(--font-mono, monospace)",
  flexShrink: 0,
}

const coverageBarTrackStyle: React.CSSProperties = {
  position: "relative",
  height: 22,
  background: "rgba(255,255,255,0.04)",
  borderRadius: 999,
  overflow: "hidden",
  display: "flex",
  alignItems: "center",
}

const coverageBarFillStyle: React.CSSProperties = {
  height: "100%",
  background:
    "linear-gradient(90deg, rgba(34,197,94,0.55) 0%, rgba(34,197,94,0.85) 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-end",
  paddingRight: 8,
  borderRadius: 999,
  transition: "width 220ms ease",
}

const coverageBarLabelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  color: "#0b1220",
  fontFamily: "var(--font-mono, monospace)",
  letterSpacing: "0.04em",
}

const coverageBarLabelOutsideStyle: React.CSSProperties = {
  position: "absolute",
  right: 10,
  fontSize: 10,
  fontWeight: 700,
  color: "var(--lcc-text-dim)",
  fontFamily: "var(--font-mono, monospace)",
  letterSpacing: "0.04em",
}

