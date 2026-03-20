import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
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
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className="tabular-nums text-foreground">{formattedValue}</span>
        {weight !== undefined && (
          <span className="text-xs tabular-nums text-muted-foreground w-12 text-right">
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
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Performance Details</DialogTitle>
          {detail && (
            <DialogDescription className="truncate">{detail.url}</DialogDescription>
          )}
        </DialogHeader>

        {loading && <LoadingSpinner message="Loading details..." />}

        {error && (
          <p className="text-center text-sm text-destructive py-4">{error}</p>
        )}

        {detail && !loading && (
          <div className="space-y-4">
            {/* Score Breakdown */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">Score Breakdown</h3>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">Performance</span>
                    <ScoreBadge score={detail.performance_score} />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">Accessibility</span>
                    <ScoreBadge score={detail.accessibility_score} />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">Best Practices</span>
                    <ScoreBadge score={detail.best_practices_score} />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs text-muted-foreground">SEO</span>
                    <ScoreBadge score={detail.seo_score} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Metric Contributions */}
            {metricWeights && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-2">Metric Contributions</h3>
                  <div className="divide-y divide-border">
                    <MetricWeightRow label="First Contentful Paint" value={detail.fcp} weight={metricWeights.fcp} />
                    <MetricWeightRow label="Largest Contentful Paint" value={detail.lcp} weight={metricWeights.lcp} />
                    <MetricWeightRow label="Cumulative Layout Shift" value={detail.cls} weight={metricWeights.cls} isCls />
                    <MetricWeightRow label="Total Blocking Time" value={detail.tbt} weight={metricWeights.tbt} />
                    <MetricWeightRow label="Speed Index" value={detail.speed_index} weight={metricWeights.si} />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Opportunities */}
            {opportunities && opportunities.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Optimization Opportunities</h3>
                  <p className="text-xs text-muted-foreground mb-3">Potential improvements to boost performance</p>
                  <div className="space-y-2">
                    {opportunities.map((opp, index) => (
                      <div key={index} className="rounded-md border border-border p-3">
                        <div className="text-sm font-medium text-foreground">{opp.title}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Potential savings: {formatSavings(opp.savingsMs)}
                        </div>
                        {opp.displayValue && (
                          <div className="text-xs text-muted-foreground">{opp.displayValue}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Failed Audits */}
            {failedAudits && failedAudits.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold text-foreground mb-1">Failed Audits</h3>
                  <p className="text-xs text-muted-foreground mb-3">Areas that need improvement</p>
                  <div className="space-y-2">
                    {failedAudits.map((audit, index) => (
                      <div key={index} className="rounded-md border border-border p-3">
                        <div className="text-sm font-medium text-foreground">{audit.title}</div>
                        {audit.displayValue && (
                          <div className="text-xs text-muted-foreground mt-1">{audit.displayValue}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* All Metrics */}
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">All Metrics</h3>
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
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function MetricItem({ label, value, tooltip }: { label: string; value: string; tooltip: string }) {
  return (
    <div className="flex items-center justify-between text-sm" title={tooltip}>
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums font-medium text-foreground">{value}</span>
    </div>
  )
}
