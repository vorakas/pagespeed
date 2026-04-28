import type { MigrationTrendPoint } from "@/types"

interface TrendChartProps {
  rows: MigrationTrendPoint[]
}

/**
 * 6-sync velocity chart: resolved line (green filled area), active
 * line (amber dashed). Pure inline SVG — no chart library.
 */
export function TrendChart({ rows }: TrendChartProps) {
  if (rows.length === 0) {
    return (
      <div className="panel lcc-trend-panel">
        <h3>Velocity</h3>
        <p style={{ color: "var(--lcc-text-faint)", fontSize: 12 }}>No trend data.</p>
      </div>
    )
  }

  const W = 800
  const H = 220
  const PAD = { l: 48, r: 12, t: 20, b: 30 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b

  const resolvedValues = rows.map((r) => r.resolved ?? 0)
  const activeValues = rows.map((r) => r.active ?? 0)
  const maxResolved = Math.max(1, ...resolvedValues) * 1.05
  const maxActive = Math.max(1, ...activeValues) * 1.1

  const x = (i: number) => PAD.l + (i / Math.max(1, rows.length - 1)) * iw
  const yResolved = (v: number) => PAD.t + ih - (v / maxResolved) * ih
  const yActive = (v: number) => PAD.t + ih - (v / maxActive) * ih

  const pathResolved = rows
    .map((r, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${yResolved(r.resolved ?? 0)}`)
    .join(" ")
  const pathActive = rows
    .map((r, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${yActive(r.active ?? 0)}`)
    .join(" ")

  const lastResolved = resolvedValues[resolvedValues.length - 1] ?? 0
  const lastActive = activeValues[activeValues.length - 1] ?? 0

  return (
    <div className="panel lcc-trend-panel">
      <h3>
        Velocity · last {rows.length} syncs
        <span className="count">
          {fmt(lastResolved)} resolved · {fmt(lastActive)} active
        </span>
      </h3>
      <div className="lcc-trend-wrap">
        <svg
          className="lcc-trend-chart"
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          role="img"
          aria-label="Velocity trend"
        >
          <defs>
            <linearGradient id="lcc-resolved-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--lcc-green)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--lcc-green)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
            <line
              key={i}
              x1={PAD.l}
              x2={W - PAD.r}
              y1={PAD.t + t * ih}
              y2={PAD.t + t * ih}
              stroke="rgba(255, 255, 255, 0.04)"
              strokeDasharray="2 3"
            />
          ))}
          <path
            d={`${pathResolved} L ${x(rows.length - 1)} ${PAD.t + ih} L ${x(0)} ${PAD.t + ih} Z`}
            fill="url(#lcc-resolved-fill)"
          />
          <path d={pathResolved} stroke="var(--lcc-green)" strokeWidth={2} fill="none" />
          <path d={pathActive} stroke="var(--lcc-amber)" strokeWidth={2} fill="none" strokeDasharray="4 3" />
          {rows.map((r, i) => (
            <g key={r.date}>
              <circle cx={x(i)} cy={yResolved(r.resolved ?? 0)} r={3} fill="var(--lcc-green)" />
              <circle cx={x(i)} cy={yActive(r.active ?? 0)} r={3} fill="var(--lcc-amber)" />
              <text
                x={x(i)}
                y={H - 8}
                fontSize={10}
                textAnchor="middle"
                fill="var(--lcc-text-faint)"
                fontFamily="var(--font-mono)"
              >
                {r.date.slice(5)}
              </text>
            </g>
          ))}
          <text
            x={PAD.l - 6}
            y={PAD.t + 4}
            fontSize={10}
            textAnchor="end"
            fill="var(--lcc-text-faint)"
            fontFamily="var(--font-mono)"
          >
            {fmt(Math.round(maxResolved))}
          </text>
          <text
            x={PAD.l - 6}
            y={PAD.t + ih}
            fontSize={10}
            textAnchor="end"
            fill="var(--lcc-text-faint)"
            fontFamily="var(--font-mono)"
          >
            0
          </text>
        </svg>
        <div className="lcc-trend-legend">
          <span>
            <span className="dot" style={{ background: "var(--lcc-green)" }} />
            Resolved
          </span>
          <span>
            <span className="dot" style={{ background: "var(--lcc-amber)" }} />
            Active
          </span>
        </div>
      </div>
    </div>
  )
}

function fmt(n: number): string {
  return Number(n).toLocaleString()
}
