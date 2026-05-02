import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { api } from "@/services/api"
import { LaunchShell } from "@/components/launch-dashboard/LaunchShell"
import { renderHeadlineSegments } from "@/components/launch-dashboard/headlineWikilinks"
import { convertUtcTimesToPacific } from "@/lib/datetime"
import type { MigrationHistoryEntry, SnapshotKpiDelta } from "@/types"

type FilterKey = "all" | "changes" | "regressions" | "resolutions"

// Mirrors the handoff History.html — reverse-chron snapshot cards with
// per-day KPI deltas and workstream health arrows. Client-side filter
// pills; no re-fetch.

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "changes", label: "Changes" },
  { key: "regressions", label: "Regressions" },
  { key: "resolutions", label: "Resolutions" },
]

const KPI_VIEW: Array<{ key: string; label: string; goodWhen: "up" | "down" }> = [
  { key: "combinedResolved", label: "Resolved", goodWhen: "up" },
  { key: "combinedActive", label: "Active", goodWhen: "down" },
  { key: "resolvedPct", label: "% Resolved", goodWhen: "up" },
  { key: "productionFailures", label: "Prod Failures", goodWhen: "down" },
  { key: "openBlockers", label: "Open Blockers", goodWhen: "down" },
  { key: "newBugs24h", label: "New Bugs", goodWhen: "down" },
  { key: "wpm", label: "WPM", goodWhen: "up" },
]

/**
 * Body of the Status History page — reverse-chron snapshot cards inside
 * `LaunchShell` so all the `.launch-dashboard .lcc-*` and `--lcc-*` token
 * references resolve. The Aurora prototype at
 * `/prototype/dashboard-history/aurora` mounts this body inside
 * `BeaconLayout`; the production export below renders it directly under
 * `AppLayout`. No internal logic changed during the extraction — only
 * the function name.
 */
export function StatusHistory() {
  const [entries, setEntries] = useState<MigrationHistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>("all")

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await api.getMigrationSnapshotHistory()
      setEntries(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history")
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    if (!entries) return []
    if (filter === "all") return entries
    return entries.filter((entry) => {
      const d = entry.diff
      const regressed = d.prodFailures.regressed.length + d.criticalBugs.added.length
      const resolved = d.criticalBugs.removed.length + d.openBlockers.removed.length
      const hasAreaChange = d.areaStatuses.length > 0
      if (filter === "regressions") return regressed > 0
      if (filter === "resolutions") return resolved > 0
      if (filter === "changes") return regressed + resolved + hasAreaChange > 0
      return true
    })
  }, [entries, filter])

  // Group filtered entries by year-month so each month gets its own
  // section header, breaking up the otherwise endless reverse-chron stack.
  const grouped = useMemo(() => {
    const out: Array<{ key: string; label: string; items: MigrationHistoryEntry[] }> = []
    let current: { key: string; label: string; items: MigrationHistoryEntry[] } | null = null
    for (const entry of filtered) {
      const date = entry.currentPayload.date || entry.to
      const key = date.slice(0, 7) // YYYY-MM
      if (!current || current.key !== key) {
        current = { key, label: formatMonthLabel(date), items: [] }
        out.push(current)
      }
      current.items.push(entry)
    }
    return out
  }, [filtered])

  if (error) {
    return (
      <LaunchShell>
        <div style={{ padding: 24 }}>
          <h1 style={pageTitleStyle}>Status History</h1>
          <div className="panel" style={{ marginTop: 16, color: "var(--lcc-red)" }}>{error}</div>
        </div>
      </LaunchShell>
    )
  }

  if (entries === null) {
    return (
      <LaunchShell>
        <div style={loadingStyle}>
          <Loader2 size={14} className="animate-spin" /> Loading snapshot history…
        </div>
      </LaunchShell>
    )
  }

  return (
    <LaunchShell>
      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
        <header style={headerStyle}>
          <h1 style={pageTitleStyle}>Status History</h1>
          <p style={pageSubStyle}>
            Day-over-day deltas across {entries.length + 1} snapshot{entries.length ? "s" : ""}.
          </p>
        </header>

        <div style={filterBarStyle}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              data-active={filter === f.key}
              style={{
                ...pillStyle,
                ...(filter === f.key ? pillActiveStyle : {}),
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="panel" style={{ marginTop: 20, textAlign: "center", color: "var(--lcc-text-faint)" }}>
            No matching snapshots.
          </div>
        ) : (
          <div style={groupsStyle}>
            {grouped.map((group) => (
              <section key={group.key} style={groupStyle}>
                <h2 style={monthHeaderStyle}>
                  <span>{group.label}</span>
                  <span style={monthCountStyle}>
                    {group.items.length} snapshot{group.items.length === 1 ? "" : "s"}
                  </span>
                </h2>
                <div style={cardsStyle}>
                  {group.items.map((entry) => (
                    <HistoryCard key={`${entry.from}->${entry.to}`} entry={entry} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </LaunchShell>
  )
}

function HistoryCard({ entry }: { entry: MigrationHistoryEntry }) {
  const curr = entry.currentPayload
  const dayLabel = formatDayLabel(curr.date)
  return (
    <article className="panel" style={cardStyle}>
      <aside style={dateColumnStyle}>
        <div style={cardDayNumberStyle}>{dayLabel.day}</div>
        <div style={cardWeekdayStyle}>{dayLabel.weekday}</div>
        <div style={cardFromStyle}>vs {entry.from}</div>
        {curr.overall && (
          <span
            style={{
              ...healthChipStyle,
              color: healthColor(curr.overall),
              background: healthBg(curr.overall),
              borderColor: healthColor(curr.overall),
            }}
          >
            {curr.overall.replace("-", " ").toUpperCase()}
          </span>
        )}
      </aside>
      <div style={cardBodyStyle}>
        {curr.headline && <HeadlineBlocks text={curr.headline} dateContext={curr.date} />}
        <div style={kpiGridStyle}>
          {KPI_VIEW.map((k) => {
            const d = entry.diff.kpis?.[k.key] as SnapshotKpiDelta | undefined
            if (!d || d.curr === null) return null
            return <KpiMini key={k.key} label={k.label} delta={d} goodWhen={k.goodWhen} />
          })}
        </div>
      </div>
    </article>
  )
}

/**
 * The vault-authored headlines are wildly inconsistent: some chain syncs
 * with "Earlier ~HH:MM UTC sync …" markers, others use bare "Earlier
 * HH:MM UTC sync …" (no tilde), some have "Earlier mid-morning resync
 * (YYYY-MM-DD HH:MM UTC)", and some are pure narrative with no markers
 * at all. Split aggressively at any sentence-boundary "Earlier" and
 * fall back to sentence-grouped paragraphs for unmarked walls of text,
 * so every day reads as discrete blocks instead of one giant blob.
 */
function HeadlineBlocks({ text, dateContext }: { text: string; dateContext: string }) {
  const blocks = paragraphizeHeadline(text, dateContext)
  return (
    <div style={headlineStackStyle}>
      {blocks.map((block, i) => {
        const showHead = !!block.timePill || i === 0
        return (
          <div key={i} style={headlineEventStyle}>
            {showHead && (
              <div style={headlineEventHeadStyle}>
                {block.timePill && <span style={headlineTimePillStyle}>{block.timePill}</span>}
                <span style={headlineEventLabelStyle}>{block.label}</span>
              </div>
            )}
            <p style={headlineBodyStyle}>{renderHeadlineSegments(block.body)}</p>
          </div>
        )
      })}
    </div>
  )
}

interface HeadlineBlock {
  timePill: string | null
  label: string
  body: string
}

const SOFT_PARAGRAPH_LIMIT = 600
const HARD_PARAGRAPH_LIMIT = 900

function paragraphizeHeadline(text: string, dateContext: string): HeadlineBlock[] {
  // Mask `[[wikilinks]]` before any splitting. Wikilink display text
  // can contain periods (e.g. "Mao.ATP.EnableTokenCaching"), and
  // without masking the sentence-grouper splits the wikilink across
  // two paragraphs and neither half has a complete `[[…]]` pair, so
  // both render as raw markup. Restore at the end.
  const placeholders: string[] = []
  const masked = text.replace(/\[\[[\s\S]+?\]\]/g, (m) => {
    placeholders.push(m)
    return `WL${placeholders.length - 1}`
  })
  const unmask = (s: string): string =>
    s.replace(/WL(\d+)/g, (_, n) => placeholders[parseInt(n, 10)] ?? "")

  // Phase 1: split at any sentence-boundary "Earlier" — covers
  // "Earlier ~HH:MM UTC sync", "Earlier HH:MM UTC sync", "Earlier
  // mid-morning resync (…)", "Earlier closures: …", etc. The lookahead
  // keeps the marker on the right-hand chunk.
  const earlierSplits = masked
    .split(/(?<=[.!?])\s+(?=Earlier\b)/g)
    .map((s) => s.trim())
    .filter(Boolean)

  // Phase 2: each chunk that's still a wall sub-splits into
  // sentence-grouped paragraphs of ~400-600 chars. This catches days
  // with no "Earlier" markers (Apr 26-style narrative).
  const refined: string[] = []
  for (const chunk of earlierSplits) {
    if (chunk.length <= SOFT_PARAGRAPH_LIMIT) {
      refined.push(chunk)
      continue
    }
    refined.push(...sentenceGroup(chunk))
  }

  return refined.map((chunk, i) => {
    const unmaskedChunk = unmask(chunk)
    const { time, body } = extractLeadingTime(unmaskedChunk)
    const startsWithEarlier = /^Earlier\b/.test(unmaskedChunk)
    const label = i === 0 && !startsWithEarlier ? "LATEST" : "EARLIER"
    // Convert UTC times in prose → Pacific (e.g. "Leslie 02:28 UTC" →
    // "Leslie 7:28 PM PT"). Uses the snapshot date as context for bare
    // HH:MM times, since a bare time alone is timezone-agnostic.
    const pacificBody = convertUtcTimesToPacific(body, dateContext)
    // The time pill stores just the extracted HH:MM. Convert via the
    // same helper so it shows "8:06 PM PT" instead of "03:06 UTC".
    const timePill = time ? convertUtcTimesToPacific(`${time} UTC`, dateContext) : null
    return { timePill, label, body: pacificBody }
  })
}

/**
 * Group sentences into paragraphs roughly 400-600 chars long, breaking
 * only at sentence boundaries. Used for unmarked narrative blocks.
 */
function sentenceGroup(text: string): string[] {
  const sentences = text.match(/[^.!?]+(?:[.!?]+|$)\s*/g) ?? [text]
  const out: string[] = []
  let buf = ""
  for (const sentence of sentences) {
    const next = buf + sentence
    if (next.length > HARD_PARAGRAPH_LIMIT && buf) {
      out.push(buf.trim())
      buf = sentence
    } else if (next.length > SOFT_PARAGRAPH_LIMIT && buf.length > 0) {
      out.push(buf.trim())
      buf = sentence
    } else {
      buf = next
    }
  }
  if (buf.trim()) out.push(buf.trim())
  return out
}

/**
 * Pull a leading "HH:MM" timestamp out of the chunk for display in the
 * time pill. Recognizes the leading patterns we've actually seen:
 *   Earlier ~HH:MM UTC …          → HH:MM
 *   Earlier HH:MM UTC …           → HH:MM
 *   Earlier mid-morning resync (YYYY-MM-DD HH:MM UTC) … → HH:MM
 *   YYYY-MM-DD HH:MM UTC …        → HH:MM
 *   HH:MM UTC sync (Job …) …      → HH:MM
 * Returns the cleaned body with the matched leader stripped only when
 * the leader is a pure prefix; otherwise leaves the body intact so we
 * never lose narrative text.
 */
function extractLeadingTime(chunk: string): { time: string | null; body: string } {
  const patterns: Array<{ re: RegExp; strip: boolean }> = [
    { re: /^Earlier\s+~?(\d{1,2}:\d{2})\s+UTC\s+(?:sync|resync)\b\s*[—-]?\s*/i, strip: true },
    { re: /^Earlier\s+\w+(?:-\w+)?\s+(?:sync|resync|closures?)\s+\((?:\d{4}-\d{2}-\d{2}\s+)?(\d{1,2}:\d{2})\s+UTC\)\s*[:—-]?\s*/i, strip: true },
    { re: /^Earlier\s+(\d{1,2}:\d{2})\s+UTC\b\s*[—-]?\s*/i, strip: true },
    { re: /^(\d{4}-\d{2}-\d{2}\s+)?(\d{1,2}:\d{2})\s+UTC\s+(?:sync|resync|pass|pushback|closures?)\b\s*[—-]?\s*/i, strip: false },
  ]
  for (const { re, strip } of patterns) {
    const m = chunk.match(re)
    if (m) {
      // The capture group with the time may be the last one in
      // multi-group patterns; pick the last non-undefined capture.
      const time = m.slice(1).reverse().find((g) => /^\d{1,2}:\d{2}$/.test(g ?? "")) ?? null
      const body = strip ? chunk.slice(m[0].length).trim() : chunk
      return { time, body }
    }
  }
  // Last-ditch: any "HH:MM UTC" near the start (first 60 chars).
  const head = chunk.slice(0, 80)
  const tm = head.match(/\b(\d{1,2}:\d{2})\s+UTC\b/)
  return { time: tm?.[1] ?? null, body: chunk }
}

function formatMonthLabel(iso: string): string {
  // iso may be YYYY-MM-DD or YYYY-MM. Avoid Date() to dodge timezone shift.
  const [y, m] = iso.split("-")
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ]
  const idx = Math.max(0, Math.min(11, parseInt(m, 10) - 1))
  return `${months[idx]} ${y}`
}

function formatDayLabel(iso: string): { day: string; weekday: string } {
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10))
  if (!y || !m || !d) return { day: iso, weekday: "" }
  const dt = new Date(Date.UTC(y, m - 1, d))
  const weekday = dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
  return { day: String(d).padStart(2, "0"), weekday: weekday.toUpperCase() }
}

function KpiMini({
  label,
  delta,
  goodWhen,
}: {
  label: string
  delta: SnapshotKpiDelta
  goodWhen: "up" | "down"
}) {
  const d = delta.delta ?? 0
  const tone =
    d === 0 ? "neutral" : (goodWhen === "up" && d > 0) || (goodWhen === "down" && d < 0) ? "green" : "red"
  const arrow = d > 0 ? "▲" : d < 0 ? "▼" : "·"
  return (
    <div style={kpiMiniStyle}>
      <div style={kpiMiniLabelStyle}>{label}</div>
      <div style={kpiMiniValueStyle}>
        <span>{delta.curr}</span>
        {d !== 0 && (
          <span style={{ color: `var(--lcc-${tone})`, fontSize: 11, fontWeight: 600, marginLeft: 6 }}>
            {arrow} {Math.abs(d)}
          </span>
        )}
      </div>
    </div>
  )
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

// ── Styles ────────────────────────────────────────────────────────────

const pageTitleStyle: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: "-0.01em",
  margin: 0,
  color: "var(--lcc-text)",
}
const pageSubStyle: React.CSSProperties = {
  margin: "4px 0 0",
  color: "var(--lcc-text-dim)",
  fontSize: 12.5,
}
const headerStyle: React.CSSProperties = {
  marginBottom: 20,
}
const loadingStyle: React.CSSProperties = {
  padding: 24,
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "var(--lcc-text-dim)",
  fontSize: 13,
}
const filterBarStyle: React.CSSProperties = {
  display: "flex",
  gap: 6,
  marginBottom: 14,
}
const pillStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.1))",
  color: "var(--lcc-text-dim)",
  font: "inherit",
  fontSize: 11,
  padding: "6px 14px",
  borderRadius: 999,
  cursor: "pointer",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
}
const pillActiveStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, var(--lcc-violet), var(--lcc-blue))",
  color: "#000",
  borderColor: "transparent",
  boxShadow: "0 0 14px rgba(176,140,255,0.4)",
}
const groupsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 24,
}
const groupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
}
const monthHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  gap: 12,
  margin: 0,
  padding: "0 4px 6px",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "var(--lcc-text-dim)",
  borderBottom: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.1))",
}
const monthCountStyle: React.CSSProperties = {
  fontSize: 10,
  letterSpacing: "0.08em",
  color: "var(--lcc-text-faint)",
  fontFamily: "var(--font-mono, monospace)",
  fontWeight: 500,
  textTransform: "uppercase",
}
const cardsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
}
const cardStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "120px 1fr",
  gap: 18,
  padding: 18,
}
const dateColumnStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 4,
  paddingRight: 14,
  borderRight: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.08))",
}
const cardBodyStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  minWidth: 0,
}
const cardDayNumberStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  lineHeight: 1,
  color: "var(--lcc-text)",
  fontVariantNumeric: "tabular-nums",
  letterSpacing: "-0.02em",
}
const cardWeekdayStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.14em",
  color: "var(--lcc-text-dim)",
  fontFamily: "var(--font-mono, monospace)",
  marginBottom: 6,
}
const cardFromStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--lcc-text-faint)",
  fontFamily: "var(--font-mono, monospace)",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: 4,
}
const healthChipStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "3px 9px",
  borderRadius: 999,
  fontSize: 9.5,
  letterSpacing: "0.08em",
  fontWeight: 700,
  border: "1px solid",
}
const headlineStackStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
}
const headlineEventStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  paddingLeft: 12,
  borderLeft: "2px solid var(--lcc-violet)",
}
const headlineEventHeadStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
}
const headlineTimePillStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontFamily: "var(--font-mono, monospace)",
  fontWeight: 600,
  letterSpacing: "0.04em",
  color: "var(--lcc-violet)",
  background: "var(--lcc-violet-bg, rgba(176,140,255,0.14))",
  border: "1px solid var(--lcc-violet)",
}
const headlineEventLabelStyle: React.CSSProperties = {
  fontSize: 9.5,
  fontFamily: "var(--font-mono, monospace)",
  fontWeight: 700,
  letterSpacing: "0.14em",
  color: "var(--lcc-text-faint)",
  textTransform: "uppercase",
}
const headlineBodyStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.55,
  color: "var(--lcc-text)",
  margin: 0,
}
const kpiGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
  gap: 8,
}
const kpiMiniStyle: React.CSSProperties = { padding: "6px 8px" }
const kpiMiniLabelStyle: React.CSSProperties = {
  fontSize: 9.5,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: "var(--lcc-text-faint)",
  fontFamily: "var(--font-mono, monospace)",
  marginBottom: 2,
}
const kpiMiniValueStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "var(--lcc-text)",
  fontVariantNumeric: "tabular-nums",
}
