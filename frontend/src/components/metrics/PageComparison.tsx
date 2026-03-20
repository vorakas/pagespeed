import { useState, useCallback } from "react"
import { GitCompareArrows } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ScoreBadge } from "@/components/shared/ScoreBadge"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { formatMilliseconds, formatCls, formatBytes } from "@/lib/utils"
import { useSites } from "@/hooks/use-sites"
import { api } from "@/services/api"
import type { LatestResult } from "@/types"

interface ComparisonResult {
  url1: LatestResult
  url2: LatestResult
}

interface MetricRowProps {
  label: string
  value1: string | number | null
  value2: string | number | null
  format?: (value: number | null) => string
  isScore?: boolean
}

function MetricRow({ label, value1, value2, format, isScore }: MetricRowProps) {
  const formatted1 = format ? format(value1 as number | null) : String(value1 ?? "N/A")
  const formatted2 = format ? format(value2 as number | null) : String(value2 ?? "N/A")

  if (isScore) {
    return (
      <div className="flex items-center justify-between py-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="flex items-center gap-6">
          <ScoreBadge score={value1 as number | null} />
          <ScoreBadge score={value2 as number | null} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-6">
        <span className="w-20 text-right text-sm tabular-nums text-foreground">{formatted1}</span>
        <span className="w-20 text-right text-sm tabular-nums text-foreground">{formatted2}</span>
      </div>
    </div>
  )
}

function ComparisonResults({ data }: { data: ComparisonResult }) {
  const { url1, url2 } = data

  const scoreDiff = (url1.performance_score ?? 0) - (url2.performance_score ?? 0)
  const diffLabel = scoreDiff > 0 ? `+${scoreDiff}` : String(scoreDiff)
  const diffColor = scoreDiff > 0
    ? "text-score-good"
    : scoreDiff < 0
      ? "text-score-poor"
      : "text-muted-foreground"

  return (
    <div className="space-y-4">
      {/* Column headers */}
      <div className="flex items-center justify-between px-0">
        <div />
        <div className="flex items-center gap-6">
          <span className="w-20 text-right text-xs font-medium text-muted-foreground truncate" title={url1.site_name}>
            {url1.site_name}
          </span>
          <span className="w-20 text-right text-xs font-medium text-muted-foreground truncate" title={url2.site_name}>
            {url2.site_name}
          </span>
        </div>
      </div>

      {/* Lighthouse Scores */}
      <div>
        <h4 className="mb-2 text-sm font-semibold text-foreground">Lighthouse Scores</h4>
        <div className="divide-y divide-border">
          <MetricRow label="Performance" value1={url1.performance_score} value2={url2.performance_score} isScore />
          <MetricRow label="Accessibility" value1={url1.accessibility_score} value2={url2.accessibility_score} isScore />
          <MetricRow label="Best Practices" value1={url1.best_practices_score} value2={url2.best_practices_score} isScore />
          <MetricRow label="SEO" value1={url1.seo_score} value2={url2.seo_score} isScore />
        </div>
      </div>

      {/* Core Web Vitals */}
      <div>
        <h4 className="mb-2 text-sm font-semibold text-foreground">Core Web Vitals</h4>
        <div className="divide-y divide-border">
          <MetricRow label="FCP" value1={url1.fcp} value2={url2.fcp} format={formatMilliseconds} />
          <MetricRow label="LCP" value1={url1.lcp} value2={url2.lcp} format={formatMilliseconds} />
          <MetricRow label="CLS" value1={url1.cls} value2={url2.cls} format={formatCls} />
          <MetricRow label="INP" value1={url1.inp} value2={url2.inp} format={formatMilliseconds} />
          <MetricRow label="TTFB" value1={url1.ttfb} value2={url2.ttfb} format={formatMilliseconds} />
        </div>
      </div>

      {/* Size */}
      <div>
        <h4 className="mb-2 text-sm font-semibold text-foreground">Page Size</h4>
        <div className="divide-y divide-border">
          <MetricRow label="Total Weight" value1={url1.total_byte_weight} value2={url2.total_byte_weight} format={formatBytes} />
        </div>
      </div>

      {/* Performance diff summary */}
      <div className="rounded-md border border-border bg-muted/50 p-3 text-center">
        <span className="text-sm text-muted-foreground">Performance difference: </span>
        <span className={`text-sm font-semibold tabular-nums ${diffColor}`}>{diffLabel} points</span>
      </div>
    </div>
  )
}

export function PageComparison() {
  const { sites, loading: sitesLoading } = useSites()

  const [site1Id, setSite1Id] = useState<number | "">("")
  const [site2Id, setSite2Id] = useState<number | "">("")
  const [url1Id, setUrl1Id] = useState<number | "">("")
  const [url2Id, setUrl2Id] = useState<number | "">("")
  const [result, setResult] = useState<ComparisonResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const site1 = sites.find((s) => s.id === site1Id)
  const site2 = sites.find((s) => s.id === site2Id)

  const handleCompare = useCallback(async () => {
    if (!url1Id || !url2Id) return

    setLoading(true)
    setError(null)
    try {
      const data = await api.compareUrls(url1Id as number, url2Id as number)
      if (!data.url1 || !data.url2) {
        setError("No test results available for one or both URLs. Run tests first.")
        return
      }
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load comparison")
    } finally {
      setLoading(false)
    }
  }, [url1Id, url2Id])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Page Comparison</h2>
        <p className="text-sm text-muted-foreground">
          Compare the same page across different sites
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* Site 1 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Site 1</label>
              <select
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={site1Id}
                onChange={(e) => {
                  setSite1Id(e.target.value ? Number(e.target.value) : "")
                  setUrl1Id("")
                  setResult(null)
                  setError(null)
                }}
                disabled={sitesLoading}
              >
                <option value="">Select first site...</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">URL</label>
              <select
                className="h-9 min-w-[250px] rounded-md border border-border bg-background px-3 text-sm"
                value={url1Id}
                onChange={(e) => {
                  setUrl1Id(e.target.value ? Number(e.target.value) : "")
                  setResult(null)
                  setError(null)
                }}
                disabled={!site1Id}
              >
                <option value="">Select URL...</option>
                {site1?.urls.map((url) => (
                  <option key={url.id} value={url.id}>
                    {url.url}
                  </option>
                ))}
              </select>
            </div>

            <span className="pb-2 text-sm font-medium text-muted-foreground">vs</span>

            {/* Site 2 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Site 2</label>
              <select
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                value={site2Id}
                onChange={(e) => {
                  setSite2Id(e.target.value ? Number(e.target.value) : "")
                  setUrl2Id("")
                  setResult(null)
                  setError(null)
                }}
                disabled={sitesLoading}
              >
                <option value="">Select second site...</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">URL</label>
              <select
                className="h-9 min-w-[250px] rounded-md border border-border bg-background px-3 text-sm"
                value={url2Id}
                onChange={(e) => {
                  setUrl2Id(e.target.value ? Number(e.target.value) : "")
                  setResult(null)
                  setError(null)
                }}
                disabled={!site2Id}
              >
                <option value="">Select URL...</option>
                {site2?.urls.map((url) => (
                  <option key={url.id} value={url.id}>
                    {url.url}
                  </option>
                ))}
              </select>
            </div>

            <Button onClick={handleCompare} disabled={!url1Id || !url2Id || loading}>
              Compare
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          {loading && <LoadingSpinner message="Loading comparison..." />}

          {error && (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
          )}

          {!loading && !error && !result && (
            <EmptyState
              icon={<GitCompareArrows size={40} />}
              title="Select URLs to Compare"
              description="Choose a site and URL on each side, then click Compare to see a side-by-side breakdown."
            />
          )}

          {!loading && !error && result && <ComparisonResults data={result} />}
        </CardContent>
      </Card>
    </div>
  )
}
