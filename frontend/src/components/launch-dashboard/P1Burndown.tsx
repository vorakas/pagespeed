import type { MigrationLaunchPriorities, MigrationP1BurndownPoint } from "@/types"

interface P1BurndownProps {
  launchPriorities: MigrationLaunchPriorities | null
}

export function P1Burndown({ launchPriorities }: P1BurndownProps) {
  const points = launchPriorities?.p1Burndown ?? []
  const current = points[points.length - 1] ?? null
  const active = current?.active ?? 0
  const resolved = current?.resolved ?? 0
  const total = current?.total ?? 0
  const resolvedPct = total > 0 ? Math.round((resolved / total) * 100) : 0

  return (
    <div className="panel lcc-trend-panel" aria-label="P1 burndown">
      <h3>
        P1 Burndown
        <span className="count">{current?.date ?? "Current"}</span>
      </h3>

      <div style={statsStyle}>
        <Stat label="Active" value={active} tone="red" />
        <Stat label="Resolved" value={resolved} tone="green" />
        <Stat label="Total" value={total} tone="neutral" />
      </div>

      <div style={barTrackStyle} aria-label={`${resolvedPct}% resolved`}>
        <div style={{ ...barFillStyle, width: `${resolvedPct}%` }} />
      </div>

      {points.length > 1 ? (
        <MiniChart points={points} />
      ) : (
        <div style={emptyStyle}>Tracking from current launch-priority snapshot.</div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone: "red" | "green" | "neutral"
}) {
  const color = tone === "neutral" ? "var(--lcc-text)" : `var(--lcc-${tone})`
  return (
    <div style={statStyle}>
      <span>{label}</span>
      <strong style={{ color }}>{value.toLocaleString()}</strong>
    </div>
  )
}

function MiniChart({ points }: { points: MigrationP1BurndownPoint[] }) {
  const max = Math.max(...points.map((point) => point.active), 1)
  const width = 320
  const height = 88
  const step = points.length > 1 ? width / (points.length - 1) : width
  const line = points
    .map((point, index) => {
      const x = index * step
      const y = height - (point.active / max) * height
      return `${x},${y}`
    })
    .join(" ")

  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={chartStyle}>
      <polyline points={line} fill="none" stroke="var(--lcc-red)" strokeWidth="3" />
    </svg>
  )
}

const statsStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
  marginTop: 12,
}

const statStyle: React.CSSProperties = {
  border: "1px solid var(--lcc-glass-border)",
  background: "var(--lcc-glass-bg-faint)",
  borderRadius: 6,
  padding: "9px 10px",
}

const barTrackStyle: React.CSSProperties = {
  height: 10,
  borderRadius: 6,
  background: "var(--lcc-glass-bg-faint)",
  border: "1px solid var(--lcc-glass-border)",
  overflow: "hidden",
  marginTop: 14,
}

const barFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 6,
  background: "var(--lcc-green)",
}

const chartStyle: React.CSSProperties = {
  width: "100%",
  height: 90,
  marginTop: 14,
  display: "block",
}

const emptyStyle: React.CSSProperties = {
  color: "var(--lcc-text-faint)",
  fontSize: 12,
  marginTop: 10,
}
