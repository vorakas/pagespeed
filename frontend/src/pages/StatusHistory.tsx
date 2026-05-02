import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { api } from "@/services/api"
import { LaunchShell } from "@/components/launch-dashboard/LaunchShell"
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
        {curr.headline && <p style={headlineStyle}>{curr.headline}</p>}
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
const headlineStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.55,
  color: "var(--lcc-text)",
  margin: 0,
  paddingLeft: 10,
  borderLeft: "2px solid var(--lcc-violet)",
  fontStyle: "italic",
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
