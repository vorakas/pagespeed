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

function getThresholdColor(value: number | null, good: number, poor: number): string {
  if (value === null) return "var(--lcc-text-faint)"
  if (value <= good) return "var(--lcc-green)"
  if (value <= poor) return "var(--lcc-amber)"
  return "var(--lcc-red)"
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

const percentileValueClass =
  "aurora-text text-base font-semibold leading-tight tabular-nums"

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
  const thresholdColor = getThresholdColor(p75Value, goodThreshold, poorThreshold)
  const thresholdLabel = getThresholdLabel(p75Value, goodThreshold, poorThreshold)

  return (
    <div className="aurora-panel min-w-0 p-3">
      <div className="mb-3">
        <h3 className="aurora-text text-base font-semibold">{title}</h3>
        <p className="aurora-text-faint text-xs">{subtitle}</p>
        <p className="aurora-text-faint text-xs">{idealText}</p>
      </div>
      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-1 text-center">
        <div className="min-w-0">
          <p className="aurora-eyebrow">P50</p>
          <p className={percentileValueClass}>{formatValue(metric?.p50 ?? null, decimals)}</p>
          <p className="aurora-text-faint text-[10px]">{unit}</p>
        </div>
        <div className="min-w-0">
          <p className="aurora-eyebrow">P75</p>
          <p className={percentileValueClass}>{formatValue(metric?.p75 ?? null, decimals)}</p>
          <p className="aurora-text-faint text-[10px]">{unit}</p>
        </div>
        <div className="min-w-0">
          <p className="aurora-eyebrow">P90</p>
          <p className={percentileValueClass}>{formatValue(metric?.p90 ?? null, decimals)}</p>
          <p className="aurora-text-faint text-[10px]">{unit}</p>
        </div>
      </div>
      {thresholdLabel && (
        <p className="mt-2 text-xs font-medium" style={{ color: thresholdColor }}>
          {thresholdLabel}
        </p>
      )}
    </div>
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
  const titleClassName =
    title.length > 22
      ? "aurora-text whitespace-nowrap text-[12px] font-medium leading-tight"
      : "aurora-text text-sm font-medium"

  return (
    <div className="aurora-panel min-w-0 p-3">
      <h4 className={titleClassName}>{title}</h4>
      <p className="aurora-text-faint mb-2 text-[10px]">{idealText}</p>
      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-1 text-center">
        <div className="min-w-0">
          <p className="aurora-text text-sm font-semibold tabular-nums">{formatValue(metric?.p50 ?? null)} ms</p>
          <p className="aurora-eyebrow">P50</p>
        </div>
        <div className="min-w-0">
          <p className="aurora-text text-sm font-semibold tabular-nums">{formatValue(metric?.p75 ?? null)} ms</p>
          <p className="aurora-eyebrow">P75</p>
        </div>
        <div className="min-w-0">
          <p className="aurora-text text-sm font-semibold tabular-nums">{formatValue(metric?.p90 ?? null)} ms</p>
          <p className="aurora-eyebrow">P90</p>
        </div>
      </div>
    </div>
  )
}

export function CwvMetrics({ metrics, metadata, interactionsCount }: CwvMetricsProps) {
  if (!metrics) return null

  const lcp = metrics.lcp as PercentileMetric | undefined
  const inp = metrics.inp as PercentileMetric | undefined
  const cls = metrics.cls as PercentileMetric | undefined
  const pageLoad = metrics.pageLoad as PercentileMetric | undefined
  const backend = metrics.backend as PercentileMetric | undefined
  const frontend = metrics.frontend as PercentileMetric | undefined
  const ttfbLike = metrics.ttfbLike as PercentileMetric | undefined
  const domProcessing = metrics.domProcessing as PercentileMetric | undefined

  // NR returns durations in seconds — convert to ms for display
  const toMs = (m: PercentileMetric | undefined): PercentileMetric | undefined =>
    m
      ? {
          p50: m.p50 !== null ? m.p50 * 1000 : null,
          p75: m.p75 !== null ? m.p75 * 1000 : null,
          p90: m.p90 !== null ? m.p90 * 1000 : null,
        }
      : undefined

  const lcpMs = toMs(lcp)
  const inpMs = toMs(inp)
  const pageLoadMs = toMs(pageLoad)
  const backendMs = toMs(backend)
  const frontendMs = toMs(frontend)
  const ttfbLikeMs = toMs(ttfbLike)
  const domProcessingMs = toMs(domProcessing)

  return (
    <div className="space-y-4">
      {/* Primary CWV Cards — canonical order: LCP → INP → CLS → Page Load */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PercentileCard
          title="LCP"
          subtitle="Largest Contentful Paint"
          idealText="Ideal P75: ≤ 2500ms"
          metric={lcpMs}
          unit="ms"
          goodThreshold={2500}
          poorThreshold={4000}
        />
        <PercentileCard
          title="INP"
          subtitle="Interaction to Next Paint"
          idealText="Ideal P75: ≤ 200ms"
          metric={inpMs}
          unit="ms"
          goodThreshold={200}
          poorThreshold={500}
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
        <h3 className="aurora-text mb-3 text-sm font-semibold">Performance Breakdown</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <BreakdownCard title="Backend Duration" idealText="Ideal P75: ≤ 500ms" metric={backendMs} />
          <BreakdownCard title="Frontend Duration" idealText="Ideal P75: ≤ 1500ms" metric={frontendMs} />
          <BreakdownCard title="TTFB-like (Queue + Network)" idealText="Ideal P75: ≤ 800ms" metric={ttfbLikeMs} />
          <BreakdownCard title="DOM Processing" idealText="Ideal P75: ≤ 500ms" metric={domProcessingMs} />
        </div>
      </div>

      {/* Interactions + Metadata */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="aurora-panel p-4">
          <h3 className="aurora-text text-sm font-semibold">Browser Interactions</h3>
          <p className="aurora-stat-value-lg mt-2">
            {interactionsCount !== null ? interactionsCount.toLocaleString() : "--"}
          </p>
          {metadata?.time_range && (
            <p className="aurora-text-faint mt-1 text-xs">
              In the last {metadata.time_range.replace(" ago", "")}
            </p>
          )}
        </div>
        {metadata && (
          <div className="aurora-panel space-y-1 p-4">
            <h3 className="aurora-text mb-2 text-sm font-semibold">Query Metadata</h3>
            <p className="aurora-text-dim text-xs">
              <span className="aurora-text font-medium">App:</span> {metadata.app_name || "--"}
            </p>
            <p className="aurora-text-dim text-xs">
              <span className="aurora-text font-medium">Page:</span> {metadata.page_url || "--"}
            </p>
            <p className="aurora-text-dim text-xs">
              <span className="aurora-text font-medium">Updated:</span> {new Date().toLocaleString()}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
