import { Card, CardContent } from "@/components/ui/card"

interface PercentileMetric {
  p50: number | null
  p75: number | null
  p90: number | null
}

interface CwvMetricsProps {
  metrics: Record<string, PercentileMetric> | null
  metadata: Record<string, string> | null
  interactionsCount: number | null
}

function getThresholdClass(value: number | null, good: number, poor: number): string {
  if (value === null) return "text-muted-foreground"
  if (value <= good) return "text-score-good"
  if (value <= poor) return "text-score-average"
  return "text-score-poor"
}

function getThresholdLabel(value: number | null, good: number, poor: number): string {
  if (value === null) return ""
  if (value <= good) return "Good"
  if (value <= poor) return "Needs Improvement"
  return "Poor"
}

function formatValue(value: number | null, decimals: number = 0): string {
  if (value === null || value === undefined) return "--"
  return Number(value).toFixed(decimals)
}

function PercentileCard({
  title,
  subtitle,
  idealText,
  metric,
  unit,
  decimals = 0,
  goodThreshold,
  poorThreshold,
}: {
  title: string
  subtitle: string
  idealText: string
  metric: PercentileMetric | undefined
  unit: string
  decimals?: number
  goodThreshold: number
  poorThreshold: number
}) {
  const p75Value = metric?.p75 ?? null
  const thresholdClass = getThresholdClass(p75Value, goodThreshold, poorThreshold)
  const thresholdLabel = getThresholdLabel(p75Value, goodThreshold, poorThreshold)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-3">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
          <p className="text-xs text-muted-foreground">{idealText}</p>
        </div>
        <div className="flex items-end gap-6">
          <div className="text-center">
            <p className="text-[10px] uppercase text-muted-foreground">P50</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {formatValue(metric?.p50 ?? null, decimals)}
            </p>
            <p className="text-[10px] text-muted-foreground">{unit}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase text-muted-foreground">P75</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {formatValue(metric?.p75 ?? null, decimals)}
            </p>
            <p className="text-[10px] text-muted-foreground">{unit}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] uppercase text-muted-foreground">P90</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">
              {formatValue(metric?.p90 ?? null, decimals)}
            </p>
            <p className="text-[10px] text-muted-foreground">{unit}</p>
          </div>
        </div>
        {thresholdLabel && (
          <p className={`mt-2 text-xs font-medium ${thresholdClass}`}>{thresholdLabel}</p>
        )}
      </CardContent>
    </Card>
  )
}

function BreakdownCard({
  title,
  idealText,
  metric,
}: {
  title: string
  idealText: string
  metric: PercentileMetric | undefined
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <h4 className="text-sm font-medium text-foreground">{title}</h4>
        <p className="text-[10px] text-muted-foreground mb-2">{idealText}</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-sm font-semibold tabular-nums">{formatValue(metric?.p50 ?? null)} ms</p>
            <p className="text-[10px] text-muted-foreground">P50</p>
          </div>
          <div>
            <p className="text-sm font-semibold tabular-nums">{formatValue(metric?.p75 ?? null)} ms</p>
            <p className="text-[10px] text-muted-foreground">P75</p>
          </div>
          <div>
            <p className="text-sm font-semibold tabular-nums">{formatValue(metric?.p90 ?? null)} ms</p>
            <p className="text-[10px] text-muted-foreground">P90</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function CwvMetrics({ metrics, metadata, interactionsCount }: CwvMetricsProps) {
  if (!metrics) return null

  const lcp = metrics.lcp as PercentileMetric | undefined
  const cls = metrics.cls as PercentileMetric | undefined
  const pageLoad = metrics.pageLoad as PercentileMetric | undefined
  const backend = metrics.backend as PercentileMetric | undefined
  const frontend = metrics.frontend as PercentileMetric | undefined
  const ttfbLike = metrics.ttfbLike as PercentileMetric | undefined
  const domProcessing = metrics.domProcessing as PercentileMetric | undefined

  // Page load values from NR come in seconds — convert to ms
  const pageLoadMs: PercentileMetric | undefined = pageLoad
    ? {
        p50: pageLoad.p50 !== null ? pageLoad.p50 * 1000 : null,
        p75: pageLoad.p75 !== null ? pageLoad.p75 * 1000 : null,
        p90: pageLoad.p90 !== null ? pageLoad.p90 * 1000 : null,
      }
    : undefined

  return (
    <div className="space-y-4">
      {/* Primary CWV Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <PercentileCard
          title="LCP"
          subtitle="Largest Contentful Paint"
          idealText="Ideal P75: ≤ 2500ms"
          metric={lcp}
          unit="ms"
          goodThreshold={2500}
          poorThreshold={4000}
        />
        <PercentileCard
          title="CLS"
          subtitle="Cumulative Layout Shift"
          idealText="Ideal P75: ≤ 0.1"
          metric={cls}
          unit=""
          decimals={3}
          goodThreshold={0.1}
          poorThreshold={0.25}
        />
        <PercentileCard
          title="Page Load"
          subtitle="Total Page Load Time"
          idealText="Ideal P75: ≤ 2000ms"
          metric={pageLoadMs}
          unit="ms"
          goodThreshold={2000}
          poorThreshold={4000}
        />
      </div>

      {/* Breakdown */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Performance Breakdown</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <BreakdownCard title="Backend Duration" idealText="Ideal P75: ≤ 500ms" metric={backend} />
          <BreakdownCard title="Frontend Duration" idealText="Ideal P75: ≤ 1500ms" metric={frontend} />
          <BreakdownCard title="TTFB-like (Queue + Network)" idealText="Ideal P75: ≤ 800ms" metric={ttfbLike} />
          <BreakdownCard title="DOM Processing" idealText="Ideal P75: ≤ 500ms" metric={domProcessing} />
        </div>
      </div>

      {/* Interactions + Metadata */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground">Browser Interactions</h3>
            <p className="text-3xl font-bold tabular-nums text-foreground mt-2">
              {interactionsCount !== null ? interactionsCount.toLocaleString() : "--"}
            </p>
            {metadata?.time_range && (
              <p className="text-xs text-muted-foreground mt-1">
                In the last {metadata.time_range.replace(" ago", "")}
              </p>
            )}
          </CardContent>
        </Card>
        {metadata && (
          <Card>
            <CardContent className="p-4 space-y-1">
              <h3 className="text-sm font-semibold text-foreground mb-2">Query Metadata</h3>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">App:</span> {metadata.app_name || "--"}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Page:</span> {metadata.page_url || "--"}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Updated:</span> {new Date().toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
