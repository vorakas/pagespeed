import type { MigrationLaunchPriorities, MigrationP1BurndownPoint } from "@/types"

interface P1BurndownProps {
  launchPriorities: MigrationLaunchPriorities | null
}

export function P1Burndown({ launchPriorities }: P1BurndownProps) {
  const points = launchPriorities?.p1Burndown ?? []
  const current = points[points.length - 1] ?? null
  const resolved = current?.resolved ?? 0
  const total = current?.total ?? 0
  const resolvedPct = total > 0 ? Math.round((resolved / total) * 100) : 0

  return (
    <div className="panel lcc-trend-panel" aria-label="P1 burndown">
      <h3>
        P1 Burndown
        <span className="count">
          {resolvedPct}% resolved · {current?.date ?? "Current"}
        </span>
      </h3>

      <div style={barTrackStyle} aria-label={`${resolvedPct}% resolved`}>
        <div style={{ ...barFillStyle, width: `${resolvedPct}%` }} />
      </div>

      {points.length > 1 ? (
        <MiniChart points={points} />
      ) : (
        <div style={emptyStyle}>Need dated P1 task history to draw a burndown.</div>
      )}
    </div>
  )
}

function MiniChart({ points }: { points: MigrationP1BurndownPoint[] }) {
  const max = Math.max(...points.map((point) => point.active), 1)
  const width = 320
  const height = 88
  const topPad = 8
  const bottomPad = 12
  const plotHeight = height - topPad - bottomPad
  const step = points.length > 1 ? width / (points.length - 1) : width
  const line = points
    .map((point, index) => {
      const x = index * step
      const y = topPad + (1 - point.active / max) * plotHeight
      return `${x},${y}`
    })
    .join(" ")
  const latest = points[points.length - 1]

  return (
    <div style={chartWrapStyle}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={chartStyle}>
        <line x1="0" y1={topPad} x2={width} y2={topPad} stroke="var(--lcc-glass-border)" />
        <line
          x1="0"
          y1={height - bottomPad}
          x2={width}
          y2={height - bottomPad}
          stroke="var(--lcc-glass-border)"
        />
        <polyline points={line} fill="none" stroke="var(--lcc-red)" strokeWidth="3" />
      </svg>
      <div style={chartCaptionStyle}>
        <span>{points[0]?.date}</span>
        <span>{latest?.active.toLocaleString()} active</span>
        <span>{latest?.date}</span>
      </div>
    </div>
  )
}

const barTrackStyle: React.CSSProperties = {
  height: 10,
  borderRadius: 6,
  background: "var(--lcc-glass-bg-faint)",
  border: "1px solid var(--lcc-glass-border)",
  overflow: "hidden",
  marginTop: 4,
}

const barFillStyle: React.CSSProperties = {
  height: "100%",
  borderRadius: 6,
  background: "var(--lcc-green)",
}

const chartWrapStyle: React.CSSProperties = {
  marginTop: 14,
}

const chartStyle: React.CSSProperties = {
  width: "100%",
  height: 90,
  display: "block",
}

const chartCaptionStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  color: "var(--lcc-text-faint)",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
}

const emptyStyle: React.CSSProperties = {
  color: "var(--lcc-text-faint)",
  fontSize: 12,
  marginTop: 10,
}
