import type { MigrationTrendPoint } from "@/types"

interface TrendChartProps {
  rows: MigrationTrendPoint[]
}

interface FlowPoint {
  date: string
  closed: number
  added: number
  activeDelta: number
  netBurn: number
  active: number
}

export function TrendChart({ rows }: TrendChartProps) {
  const flows = toFlowPoints(rows)

  if (rows.length === 0) {
    return (
      <div className="panel lcc-trend-panel">
        <h3>Migration Flow</h3>
        <p style={{ color: "var(--lcc-text-faint)", fontSize: 12 }}>No trend data.</p>
      </div>
    )
  }

  if (flows.length === 0) {
    const current = rows[rows.length - 1]
    return (
      <div className="panel lcc-trend-panel">
        <h3>Migration Flow</h3>
        <div className="lcc-flow-empty">
          Need at least two snapshots to calculate closed work, added scope, and net burn.
          <span>{fmt(num(current.active))} active now</span>
        </div>
      </div>
    )
  }

  const latest = rows[rows.length - 1]
  const trailing = flows.slice(-5)
  const closedTotal = sum(flows, "closed")
  const addedTotal = sum(flows, "added")
  const netBurnTotal = sum(flows, "netBurn")
  const latestActive = num(latest.active)
  const avgBurn = trailing.reduce((acc, row) => acc + Math.max(0, row.netBurn), 0) / trailing.length
  const forecast = avgBurn > 0 ? Math.ceil(latestActive / avgBurn) : null
  const status =
    netBurnTotal > 0
      ? "Backlog shrinking"
      : netBurnTotal < 0
        ? "Scope outpacing closures"
        : "Backlog flat"

  return (
    <div className="panel lcc-trend-panel">
      <h3>
        Migration Flow
        <span className="count">
          {status} · last {flows.length} intervals
        </span>
      </h3>

      <div className="lcc-flow-stats" aria-label="Migration flow summary">
        <FlowStat label="Closed" value={`+${fmt(closedTotal)}`} tone="green" />
        <FlowStat label="Added" value={`+${fmt(addedTotal)}`} tone="blue" />
        <FlowStat
          label="Net active"
          value={signed(-netBurnTotal)}
          tone={netBurnTotal > 0 ? "green" : netBurnTotal < 0 ? "red" : "neutral"}
        />
        <FlowStat
          label="Forecast"
          value={forecast == null ? "n/a" : `~${forecast}`}
          detail={forecast == null ? "needs burn" : "syncs left"}
          tone="amber"
        />
      </div>

      <div className="lcc-trend-wrap">
        <FlowChart rows={flows} />
        <div className="lcc-trend-legend">
          <span>
            <span className="dot sq" style={{ background: "var(--lcc-green)" }} />
            Closed
          </span>
          <span>
            <span className="dot sq" style={{ background: "var(--lcc-blue)" }} />
            Added scope
          </span>
          <span>
            <span className="dot" style={{ background: "var(--lcc-amber)" }} />
            Active remaining
          </span>
        </div>
      </div>
    </div>
  )
}

function FlowStat({
  label,
  value,
  detail,
  tone,
}: {
  label: string
  value: string
  detail?: string
  tone: "green" | "blue" | "amber" | "red" | "neutral"
}) {
  return (
    <div className="lcc-flow-stat" data-tone={tone}>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <em>{detail}</em>}
    </div>
  )
}

function FlowChart({ rows }: { rows: FlowPoint[] }) {
  const W = 800
  const H = 220
  const PAD = { l: 42, r: 44, t: 18, b: 34 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const barMax = Math.max(1, ...rows.flatMap((r) => [r.closed, r.added])) * 1.15
  const activeMax = Math.max(1, ...rows.map((r) => r.active)) * 1.08
  const slot = iw / rows.length
  const barW = Math.min(18, slot * 0.24)

  const xCenter = (i: number) => PAD.l + slot * i + slot / 2
  const barH = (value: number) => (value / barMax) * ih
  const barY = (value: number) => PAD.t + ih - barH(value)
  const activeY = (value: number) => PAD.t + ih - (value / activeMax) * ih
  const activePath = rows
    .map((r, i) => `${i === 0 ? "M" : "L"} ${xCenter(i)} ${activeY(r.active)}`)
    .join(" ")

  return (
    <svg
      className="lcc-trend-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="Migration flow: closed work, added scope, and active remaining"
    >
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

      {rows.map((r, i) => {
        const cx = xCenter(i)
        return (
          <g key={r.date}>
            <rect
              x={cx - barW - 2}
              y={barY(r.closed)}
              width={barW}
              height={Math.max(1, barH(r.closed))}
              rx={2}
              fill="var(--lcc-green)"
            />
            <rect
              x={cx + 2}
              y={barY(r.added)}
              width={barW}
              height={Math.max(1, barH(r.added))}
              rx={2}
              fill="var(--lcc-blue)"
              opacity={0.82}
            />
            <text
              x={cx}
              y={H - 9}
              fontSize={10}
              textAnchor="middle"
              fill="var(--lcc-text-faint)"
              fontFamily="var(--font-mono)"
            >
              {r.date.slice(5)}
            </text>
          </g>
        )
      })}

      <path d={activePath} stroke="var(--lcc-amber)" strokeWidth={2} fill="none" />
      {rows.map((r, i) => (
        <circle key={r.date} cx={xCenter(i)} cy={activeY(r.active)} r={3} fill="var(--lcc-amber)" />
      ))}

      <text x={PAD.l - 6} y={PAD.t + 4} fontSize={10} textAnchor="end" fill="var(--lcc-text-faint)" fontFamily="var(--font-mono)">
        {fmt(Math.ceil(barMax))}
      </text>
      <text x={PAD.l - 6} y={PAD.t + ih} fontSize={10} textAnchor="end" fill="var(--lcc-text-faint)" fontFamily="var(--font-mono)">
        0
      </text>
      <text x={W - PAD.r + 6} y={PAD.t + 4} fontSize={10} textAnchor="start" fill="var(--lcc-amber)" fontFamily="var(--font-mono)">
        {fmt(Math.ceil(activeMax))}
      </text>
      <text x={W - PAD.r + 6} y={PAD.t + ih} fontSize={10} textAnchor="start" fill="var(--lcc-amber)" fontFamily="var(--font-mono)">
        active
      </text>
    </svg>
  )
}

function toFlowPoints(rows: MigrationTrendPoint[]): FlowPoint[] {
  const out: FlowPoint[] = []
  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1]
    const current = rows[i]
    const resolvedDelta = num(current.resolved) - num(prev.resolved)
    const totalDelta = num(current.total) - num(prev.total)
    const activeDelta = num(current.active) - num(prev.active)
    out.push({
      date: current.date,
      closed: Math.max(0, resolvedDelta),
      added: Math.max(0, totalDelta),
      activeDelta,
      netBurn: -activeDelta,
      active: num(current.active),
    })
  }
  return out
}

function num(value: number | null | undefined): number {
  return Number.isFinite(value) ? Number(value) : 0
}

function sum(rows: FlowPoint[], key: keyof Pick<FlowPoint, "closed" | "added" | "netBurn">): number {
  return rows.reduce((acc, row) => acc + row[key], 0)
}

function signed(n: number): string {
  if (n > 0) return `+${fmt(n)}`
  if (n < 0) return `-${fmt(Math.abs(n))}`
  return "0"
}

function fmt(n: number): string {
  return Number(n).toLocaleString()
}
