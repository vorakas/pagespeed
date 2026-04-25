import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ScoreBadge } from "@/components/shared/ScoreBadge"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { formatMilliseconds, formatCls, formatBytes } from "@/lib/utils"
import type { TestDetail } from "@/types"

interface TestDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  detail: TestDetail | null
  loading: boolean
  error: string | null
}

interface Opportunity {
  title: string
  savingsMs?: number
  displayValue?: string
}

interface FailedAudit {
  title: string
  displayValue?: string
}

function formatSavings(savingsMs: number | undefined): string {
  if (!savingsMs) return "N/A"
  if (savingsMs >= 1000) return `${(savingsMs / 1000).toFixed(1)}s`
  return `${Math.round(savingsMs)}ms`
}

function MetricWeightRow({
  label,
  value,
  weight,
  isCls,
}: {
  label: string
  value: number | null | undefined
  weight: number | undefined
  isCls?: boolean
}) {
  const formattedValue = isCls
    ? formatCls(value ?? null)
    : formatMilliseconds(value ?? null)

  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="aurora-text-dim">{label}</span>
      <div className="flex items-center gap-3">
        <span className="aurora-text tabular-nums">{formattedValue}</span>
        {weight !== undefined && (
          <span className="aurora-text-faint text-xs tabular-nums w-12 text-right">
            {Math.round(weight * 100)}%
          </span>
        )}
      </div>
    </div>
  )
}

export function TestDetailDialog({
  open,
  onOpenChange,
  detail,
  loading,
  error,
}: TestDetailDialogProps) {
  const rawData = detail?.raw_data as Record<string, unknown> | undefined
  const metricWeights = rawData?.metric_weights as Record<string, number> | undefined
  const opportunities = rawData?.opportunities as Opportunity[] | undefined
  const failedAudits = rawData?.failed_audits as FailedAudit[] | undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="aurora-dialog sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Performance Details</DialogTitle>
          {detail && (
            <DialogDescription className="truncate">{detail.url}</DialogDescription>
          )}
        </DialogHeader>

        {loading && <LoadingSpinner message="Loading details..." />}

        {error && (
          <p className="text-center text-sm py-4" style={{ color: "var(--lcc-red)" }}>{error}</p>
        )}

        {detail && !loading && (
          <div className="space-y-4">
            {/* Score Breakdown */}
            <div className="aurora-panel p-4">
              <h3 className="aurora-text text-sm font-semibold mb-3">Score Breakdown</h3>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex flex-col items-center gap-1">
                  <span className="aurora-text-dim text-xs">Performance</span>
                  <ScoreBadge score={detail.performance_score} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="aurora-text-dim text-xs">Accessibility</span>
                  <ScoreBadge score={detail.accessibility_score} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="aurora-text-dim text-xs">Best Practices</span>
                  <ScoreBadge score={detail.best_practices_score} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="aurora-text-dim text-xs">SEO</span>
                  <ScoreBadge score={detail.seo_score} />
                </div>
              </div>
            </div>

            {/* Metric Contributions */}
            {metricWeights && (
              <div className="aurora-panel p-4">
                <h3 className="aurora-text text-sm font-semibold mb-2">Metric Contributions</h3>
                <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
                  <MetricWeightRow label="First Contentful Paint" value={detail.fcp} weight={metricWeights.fcp} />
                  <MetricWeightRow label="Largest Contentful Paint" value={detail.lcp} weight={metricWeights.lcp} />
                  <MetricWeightRow label="Cumulative Layout Shift" value={detail.cls} weight={metricWeights.cls} isCls />
                  <MetricWeightRow label="Total Blocking Time" value={detail.tbt} weight={metricWeights.tbt} />
                  <MetricWeightRow label="Speed Index" value={detail.speed_index} weight={metricWeights.si} />
                </div>
              </div>
            )}

            {/* Opportunities */}
            {opportunities && opportunities.length > 0 && (
              <div className="aurora-panel p-4">
                <h3 className="aurora-text text-sm font-semibold mb-1">Optimization Opportunities</h3>
                <p className="aurora-text-dim text-xs mb-3">Potential improvements to boost performance</p>
                <div className="space-y-2">
                  {opportunities.map((opp, index) => (
                    <div
                      key={index}
                      className="rounded-md p-3"
                      style={{ border: "1px solid var(--glass-border)", background: "var(--glass-hi)" }}
                    >
                      <div className="aurora-text text-sm font-medium">{opp.title}</div>
                      <div className="aurora-text-dim text-xs mt-1">
                        Potential savings: {formatSavings(opp.savingsMs)}
                      </div>
                      {opp.displayValue && (
                        <div className="aurora-text-dim text-xs">{opp.displayValue}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Failed Audits */}
            {failedAudits && failedAudits.length > 0 && (
              <div className="aurora-panel p-4">
                <h3 className="aurora-text text-sm font-semibold mb-1">Failed Audits</h3>
                <p className="aurora-text-dim text-xs mb-3">Areas that need improvement</p>
                <div className="space-y-2">
                  {failedAudits.map((audit, index) => (
                    <div
                      key={index}
                      className="rounded-md p-3"
                      style={{ border: "1px solid var(--glass-border)", background: "var(--glass-hi)" }}
                    >
                      <div className="aurora-text text-sm font-medium">{audit.title}</div>
                      {audit.displayValue && (
                        <div className="aurora-text-dim text-xs mt-1">{audit.displayValue}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Metrics */}
            <div className="aurora-panel p-4">
              <h3 className="aurora-text text-sm font-semibold mb-2">All Metrics</h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
                <MetricItem label="FCP" value={formatMilliseconds(detail.fcp)} tooltip="First Contentful Paint" />
                <MetricItem label="LCP" value={formatMilliseconds(detail.lcp)} tooltip="Largest Contentful Paint" />
                <MetricItem label="CLS" value={formatCls(detail.cls)} tooltip="Cumulative Layout Shift" />
                <MetricItem label="TBT" value={formatMilliseconds(detail.tbt)} tooltip="Total Blocking Time" />
                <MetricItem label="Speed Index" value={formatMilliseconds(detail.speed_index)} tooltip="Speed Index" />
                <MetricItem label="TTI" value={formatMilliseconds(detail.tti)} tooltip="Time to Interactive" />
                <MetricItem label="INP" value={formatMilliseconds(detail.inp)} tooltip="Interaction to Next Paint" />
                <MetricItem label="TTFB" value={formatMilliseconds(detail.ttfb)} tooltip="Time to First Byte" />
                <MetricItem label="Page Size" value={formatBytes(detail.total_byte_weight)} tooltip="Total page weight" />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MetricItem({ label, value, tooltip }: { label: string; value: string; tooltip: string }) {
  return (
    <div className="flex items-center justify-between text-sm" title={tooltip}>
      <span className="aurora-text-dim">{label}</span>
      <span className="aurora-text tabular-nums font-medium">{value}</span>
    </div>
  )
}
