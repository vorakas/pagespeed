import { Zap, TrendingUp, XCircle, Target } from "lucide-react"
import type { ReactNode } from "react"

interface PerformanceOverviewProps {
  data: Record<string, unknown> | null
}

function parseTimeRangeMinutes(timeRange: unknown): number | null {
  if (typeof timeRange !== "string") return null

  const match = timeRange.match(/^(\d+)\s+(minute|minutes|hour|hours)\s+ago$/i)
  if (!match) return null

  const value = Number(match[1])
  if (!Number.isFinite(value)) return null

  return match[2].toLowerCase().startsWith("hour") ? value * 60 : value
}

function formatWindowDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return `${hours} hr${hours === 1 ? "" : "s"}`
  }
  return `${minutes} min`
}

function buildComparisonLabel(timeRange: unknown): string {
  const minutes = parseTimeRangeMinutes(timeRange)
  if (!minutes) return "previous matching window"

  const duration = formatWindowDuration(minutes)
  return `prior ${duration} (${duration} to ${formatWindowDuration(minutes * 2)} ago)`
}

function StatCard({
  icon,
  label,
  value,
  change,
  direction,
  comparisonLabel,
  description,
}: {
  icon: ReactNode
  label: string
  value: string
  change: { current: number | null; previous: number | null } | null
  direction: "lower-better" | "higher-better"
  comparisonLabel: string
  description?: string
}) {
  let changeText = ""
  let changeColor: string = "var(--lcc-text-faint)"
  const currentValue = change?.current
  const previousValue = change?.previous

  if (
    currentValue !== null &&
    currentValue !== undefined &&
    previousValue !== null &&
    previousValue !== undefined &&
    previousValue !== 0
  ) {
    const pctChange = ((currentValue - previousValue) / Math.abs(previousValue)) * 100
    const absChange = Math.abs(pctChange).toFixed(1)
    const directionText = pctChange >= 0 ? "Up" : "Down"
    const isPositive =
      direction === "lower-better" ? pctChange <= 0 : pctChange >= 0
    changeText = `${directionText} ${absChange}% vs ${comparisonLabel}`
    changeColor = isPositive ? "var(--lcc-green)" : "var(--lcc-red)"
  }

  return (
    <div className="aurora-panel min-w-0 p-4">
      <div className="flex items-start gap-3">
        <div className="aurora-text-faint shrink-0">{icon}</div>
        <div className="min-w-0">
          <p className="aurora-stat-label">{label}</p>
          <p className="aurora-stat-value break-words">{value}</p>
          {changeText && <p className="text-xs leading-snug" style={{ color: changeColor }}>{changeText}</p>}
          {description && (
            <p className="mt-2 text-xs leading-snug aurora-text-faint">{description}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export function PerformanceOverview({ data }: PerformanceOverviewProps) {
  if (!data) return null

  const current = (data.current || {}) as Record<string, number | null>
  const previous = (data.previous || {}) as Record<string, number | null>
  const metadata = (data.metadata || {}) as Record<string, unknown>
  const comparisonLabel = buildComparisonLabel(metadata.time_range)

  const avgResponseTime =
    current.avgResponseTime !== null && current.avgResponseTime !== undefined
      ? `${Math.round(current.avgResponseTime)} ms`
      : "-- ms"

  const throughput =
    current.throughput !== null && current.throughput !== undefined
      ? `${Number(current.throughput).toLocaleString(undefined, { maximumFractionDigits: 0 })} rpm`
      : "-- rpm"

  const errorRate =
    current.errorRate !== null && current.errorRate !== undefined
      ? `${Number(current.errorRate) < 0.01 ? Number(current.errorRate).toFixed(4) : Number(current.errorRate).toFixed(2)}%`
      : "--%"

  const apdex =
    current.apdex !== null && current.apdex !== undefined
      ? Number(current.apdex).toFixed(2)
      : "--"

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        icon={<Zap className="h-5 w-5" />}
        label="Avg Response Time"
        value={avgResponseTime}
        change={{ current: current.avgResponseTime ?? null, previous: previous.avgResponseTime ?? null }}
        direction="lower-better"
        comparisonLabel={comparisonLabel}
      />
      <StatCard
        icon={<TrendingUp className="h-5 w-5" />}
        label="Throughput"
        value={throughput}
        change={{ current: current.throughput ?? null, previous: previous.throughput ?? null }}
        direction="higher-better"
        comparisonLabel={comparisonLabel}
      />
      <StatCard
        icon={<XCircle className="h-5 w-5" />}
        label="Error Rate"
        value={errorRate}
        change={{ current: current.errorRate ?? null, previous: previous.errorRate ?? null }}
        direction="lower-better"
        comparisonLabel={comparisonLabel}
      />
      <StatCard
        icon={<Target className="h-5 w-5" />}
        label="Apdex Score"
        value={apdex}
        change={{ current: current.apdex ?? null, previous: previous.apdex ?? null }}
        direction="higher-better"
        comparisonLabel={comparisonLabel}
        description="User satisfaction score from response time: 1.00 is best, 0.85+ good, 0.70-0.84 watch, below 0.70 poor."
      />
    </div>
  )
}
