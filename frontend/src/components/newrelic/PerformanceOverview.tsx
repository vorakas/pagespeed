import { Card, CardContent } from "@/components/ui/card"
import { Zap, TrendingUp, XCircle, Target } from "lucide-react"
import type { ReactNode } from "react"

interface PerformanceOverviewProps {
  data: Record<string, unknown> | null
}

function StatCard({
  icon,
  label,
  value,
  change,
  direction,
}: {
  icon: ReactNode
  label: string
  value: string
  change: { current: number | null; previous: number | null } | null
  direction: "lower-better" | "higher-better"
}) {
  let changeText = ""
  let changeClass = "text-muted-foreground"

  if (change?.current !== null && change?.previous !== null && change.previous !== 0) {
    const pctChange = ((change.current! - change.previous!) / Math.abs(change.previous!)) * 100
    const absChange = Math.abs(pctChange).toFixed(1)
    const arrow = pctChange >= 0 ? "↑" : "↓"
    const isPositive =
      direction === "lower-better" ? pctChange <= 0 : pctChange >= 0
    changeText = `${arrow} ${absChange}% from previous period`
    changeClass = isPositive ? "text-score-good" : "text-score-poor"
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 text-muted-foreground">{icon}</div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
            {changeText && <p className={`text-xs ${changeClass}`}>{changeText}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function PerformanceOverview({ data }: PerformanceOverviewProps) {
  if (!data) return null

  const current = (data.current || {}) as Record<string, number | null>
  const previous = (data.previous || {}) as Record<string, number | null>

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
      />
      <StatCard
        icon={<TrendingUp className="h-5 w-5" />}
        label="Throughput"
        value={throughput}
        change={{ current: current.throughput ?? null, previous: previous.throughput ?? null }}
        direction="higher-better"
      />
      <StatCard
        icon={<XCircle className="h-5 w-5" />}
        label="Error Rate"
        value={errorRate}
        change={{ current: current.errorRate ?? null, previous: previous.errorRate ?? null }}
        direction="lower-better"
      />
      <StatCard
        icon={<Target className="h-5 w-5" />}
        label="Apdex Score"
        value={apdex}
        change={{ current: current.apdex ?? null, previous: previous.apdex ?? null }}
        direction="higher-better"
      />
    </div>
  )
}
