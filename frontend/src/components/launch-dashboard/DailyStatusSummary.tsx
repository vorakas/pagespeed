import { useEffect, useMemo, useState } from "react"
import { renderHeadlineSegments } from "./headlineWikilinks"
import type {
  MigrationSnapshot,
  MigrationWorkstream,
  SnapshotAnalyticsBlocker,
  SnapshotAreaHealthRow,
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
  workstreams?: MigrationWorkstream[] | null
}

export function DailyStatusSummary({ snapshot: input, workstreams }: Props) {
  const snapshot = useMemo(() => withDefaults(input), [input])
  const tabs = useMemo(() => buildTabs(snapshot), [snapshot])
  const [tab, setTab] = useState<TabId>(() => {
    if (typeof window !== "undefined" && window.location.hash === "#workstreams") {
      return "health"
    }
    return tabs.find((t) => t.count > 0)?.id ?? "critical"
  })

  useEffect(() => {
    if (typeof window === "undefined") return
    const onHashChange = () => {
      if (window.location.hash === "#workstreams") setTab("health")
    }
    window.addEventListener("hashchange", onHashChange)
    return () => window.removeEventListener("hashchange", onHashChange)
  }, [])

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

      {snapshot.headline && <HeadlineBullets text={snapshot.headline} />}

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
        {tab === "health" && (
          <HealthTab rows={snapshot.areaHealth} workstreams={workstreams ?? null} />
        )}
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
    {
      id: "health",
      label: "Project Health",
      count: s.areaHealth.length || Object.keys(s.areaStatuses).length,
    },
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

function HealthTab({
  rows,
  workstreams,
}: {
  rows: SnapshotAreaHealthRow[]
  workstreams: MigrationWorkstream[] | null
}) {
  if (!rows.length) return <EmptyHint>No area statuses on this snapshot.</EmptyHint>

  // Derive short labels from the ws- id (e.g. "ws-pdp" → "PDP"). The
  // workstream feed's full name field ("Product Detail Page (PDP)") is
  // too verbose for this compact area view.
  const labelByWs = new Map<string, string>()
  for (const w of workstreams ?? []) {
    if (w.id) labelByWs.set(w.id, deriveWsLabel(w.id))
  }

  // Preserve source order of areas (matches the MD table) rather than
  // alphabetizing, so Storefront → Checkout → … stays meaningful.
  const areas: Array<{ name: string; rows: SnapshotAreaHealthRow[] }> = []
  const index = new Map<string, number>()
  for (const row of rows) {
    const areaKey = row.area || "Unsorted"
    let idx = index.get(areaKey)
    if (idx == null) {
      idx = areas.push({ name: areaKey, rows: [] }) - 1
      index.set(areaKey, idx)
    }
    areas[idx].rows.push(row)
  }

  return (
    <div style={healthColumnsStyle}>
      {areas.map((a) => (
        <section key={a.name} style={healthAreaBlockStyle}>
          <div style={healthAreaHeadStyle}>
            <span style={healthAreaLabelStyle}>{a.name}</span>
            <span style={healthAreaSepStyle} />
            <span style={healthAreaCountStyle}>{a.rows.length}</span>
          </div>
          <div style={healthAreaRowsStyle}>
            {a.rows.map((row) => (
              <HealthRow
                key={row.ws}
                ws={row.ws}
                label={labelByWs.get(row.ws) ?? deriveWsLabel(row.ws)}
                status={row.status}
                concern={row.concern}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function HealthRow({
  ws,
  label,
  status,
  concern,
}: {
  ws: string
  label: string
  status: string
  concern: string
}) {
  const tone = healthStatusTone(status)
  const statusLabel = healthStatusLabel(status)
  return (
    <div
      style={{
        ...healthRowStyle,
        borderLeft: `2px solid ${tone === "neutral" ? "var(--lcc-text-faint)" : `var(--lcc-${tone})`}`,
      }}
    >
      <div style={healthWsChipStyle} title={ws}>
        {ws.length > 18 ? `${ws.slice(0, 16)}…` : ws}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={healthLabelTextStyle}>{label}</div>
        {concern && concern.toLowerCase() !== "no change" && (
          <div style={healthConcernStyle}>{concern}</div>
        )}
        {(!concern || concern.toLowerCase() === "no change") && (
          <div style={healthConcernFaintStyle}>No change</div>
        )}
      </div>
      <span
        style={{
          ...healthStatusPillStyle,
          color:
            tone === "neutral" ? "var(--lcc-text-dim)" : `var(--lcc-${tone})`,
          borderColor:
            tone === "neutral"
              ? "var(--lcc-glass-border, rgba(255,255,255,0.12))"
              : `var(--lcc-${tone})`,
          background:
            tone === "neutral"
              ? "rgba(255,255,255,0.04)"
              : `var(--lcc-${tone}-bg, rgba(255,255,255,0.04))`,
        }}
      >
        {statusLabel}
      </span>
    </div>
  )
}

function healthStatusTone(status: string): Tone {
  switch (status) {
    case "blocked":
      return "red"
    case "at-risk":
      return "amber"
    case "in-progress":
      return "blue"
    case "improving":
      return "blue"
    case "near-complete":
      return "green"
    case "groomed":
      return "neutral"
    default:
      return "neutral"
  }
}

function healthStatusLabel(status: string): string {
  switch (status) {
    case "blocked":
      return "CRITICAL"
    case "at-risk":
      return "AT RISK"
    case "in-progress":
      return "IN PROGRESS"
    case "improving":
      return "IMPROVING"
    case "near-complete":
      return "NEAR COMPLETE"
    case "groomed":
      return "GROOMED"
    default:
      return status.toUpperCase() || "UNKNOWN"
  }
}

const WS_ACRONYMS = new Set(["pdp", "plp", "eds", "qa", "lp", "dy", "be", "ac"])

function deriveWsLabel(ws: string): string {
  const stem = ws.startsWith("ws-") ? ws.slice(3) : ws
  return stem
    .split("-")
    .map((w) => {
      if (!w) return w
      if (WS_ACRONYMS.has(w.toLowerCase())) return w.toUpperCase()
      return w[0].toUpperCase() + w.slice(1)
    })
    .join(" ")
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
  // Split on sentence terminators followed by whitespace + a capital or
  // digit start. Digits are included so sentences that begin with an
  // Asana task id (e.g. "919491 (Blocker) COMPLETED …") still split
  // cleanly off the previous period.
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
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

const healthColumnsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
  gap: 18,
  alignItems: "start",
}

const healthAreaBlockStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
}

const healthAreaHeadStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
  marginBottom: 4,
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.16em",
  fontFamily: "var(--font-mono, monospace)",
  fontWeight: 700,
}

const healthAreaLabelStyle: React.CSSProperties = {
  color: "var(--lcc-blue)",
}

const healthAreaSepStyle: React.CSSProperties = {
  flex: 1,
  height: 1,
  background:
    "linear-gradient(90deg, var(--lcc-glass-border, rgba(255,255,255,0.1)), transparent)",
}

const healthAreaCountStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 10,
  padding: "1px 7px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.06)",
  color: "var(--lcc-text-dim)",
}

const healthAreaRowsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
}

const healthRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 12,
  padding: "10px 12px",
  background: "var(--lcc-glass-bg-faint, rgba(22,28,58,0.3))",
  borderRadius: 6,
}

const healthWsChipStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--lcc-text-faint)",
  fontFamily: "var(--font-mono, monospace)",
  padding: "3px 8px",
  background: "rgba(255,255,255,0.04)",
  borderRadius: 999,
  whiteSpace: "nowrap",
  flexShrink: 0,
  marginTop: 1,
  minWidth: 80,
  textAlign: "center",
}

const healthLabelTextStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--lcc-text)",
  fontWeight: 600,
  lineHeight: 1.3,
}

const healthConcernStyle: React.CSSProperties = {
  fontSize: 11.5,
  color: "var(--lcc-text-dim)",
  marginTop: 3,
  lineHeight: 1.45,
}

const healthConcernFaintStyle: React.CSSProperties = {
  ...healthConcernStyle,
  color: "var(--lcc-text-faint)",
  fontStyle: "italic",
}

const healthStatusPillStyle: React.CSSProperties = {
  fontSize: 9.5,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  padding: "3px 9px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  whiteSpace: "nowrap",
  flexShrink: 0,
  fontFamily: "var(--font-mono, monospace)",
  marginTop: 1,
}
