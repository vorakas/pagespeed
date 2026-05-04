import { useState, useCallback } from "react"
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts"
import { GitCompareArrows } from "lucide-react"
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

interface VitalBarProps {
  metric: string
  value1: number | null
  value2: number | null
  benchmark: number
  format: (value: number | null) => string
  site1Name: string
  site2Name: string
}

const SITE1_COLOR = "var(--lcc-violet)"
const SITE2_COLOR = "var(--lcc-green)"

function MetricRow({ label, value1, value2, format, isScore }: MetricRowProps) {
  const formatted1 = format ? format(value1 as number | null) : String(value1 ?? "N/A")
  const formatted2 = format ? format(value2 as number | null) : String(value2 ?? "N/A")

  if (isScore) {
    return (
      <div className="flex items-center justify-between py-1">
        <span className="aurora-text-dim text-sm">{label}</span>
        <div className="flex items-center gap-6">
          <span className="w-20 flex justify-end"><ScoreBadge score={value1 as number | null} /></span>
          <span className="w-20 flex justify-end"><ScoreBadge score={value2 as number | null} /></span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-1">
      <span className="aurora-text-dim text-sm">{label}</span>
      <div className="flex items-center gap-6">
        <span className="aurora-text aurora-num w-20 text-right text-sm">{formatted1}</span>
        <span className="aurora-text aurora-num w-20 text-right text-sm">{formatted2}</span>
      </div>
    </div>
  )
}

function VitalBar({
  metric,
  value1,
  value2,
  benchmark,
  format,
  site1Name,
  site2Name,
}: VitalBarProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="aurora-text-faint text-[11px] font-medium">{metric}</span>
        <span className="aurora-num text-[10px]" style={{ color: "var(--lcc-amber)" }}>
          target {format(benchmark)}
        </span>
      </div>
      <VitalBarRow
        siteName={site1Name}
        value={value1}
        benchmark={benchmark}
        format={format}
        color={SITE1_COLOR}
      />
      <VitalBarRow
        siteName={site2Name}
        value={value2}
        benchmark={benchmark}
        format={format}
        color={SITE2_COLOR}
      />
    </div>
  )
}

function VitalBarRow({
  siteName,
  value,
  benchmark,
  format,
  color,
}: {
  siteName: string
  value: number | null
  benchmark: number
  format: (value: number | null) => string
  color: string
}) {
  const numericValue = value ?? 0
  const pct = numericValue === 0 ? 0 : Math.max(2, Math.min(100, (numericValue / benchmark) * 100))
  const overTarget = numericValue > benchmark
  return (
    <div className="grid grid-cols-[72px_minmax(120px,360px)_56px] items-center gap-2">
      <span className="aurora-text-faint truncate text-right text-[10px]" title={siteName}>
        {siteName}
      </span>
      <div
        className="aurora-bar-track w-full max-w-[360px]"
        data-over-target={overTarget ? "true" : undefined}
      >
        <div
          className="aurora-bar-fill"
          style={{
            width: `${pct}%`,
            backgroundColor: overTarget ? "var(--lcc-red)" : color,
          }}
        />
      </div>
      <span className="aurora-text aurora-num text-right text-[11px]">
        {format(value)}
      </span>
    </div>
  )
}

function ComparisonResults({ data }: { data: ComparisonResult }) {
  const { url1, url2 } = data

  const scoreDiff = (url1.performance_score ?? 0) - (url2.performance_score ?? 0)
  const diffLabel = scoreDiff > 0 ? `+${scoreDiff}` : String(scoreDiff)
  const diffColor = scoreDiff > 0
    ? "var(--lcc-green)"
    : scoreDiff < 0
      ? "var(--lcc-red)"
      : "var(--lcc-text-dim)"
  const weightDiff = (url1.total_byte_weight ?? 0) - (url2.total_byte_weight ?? 0)
  const weightDiffLabel = weightDiff === 0
    ? "0 B"
    : `${weightDiff > 0 ? "+" : "-"}${formatBytes(Math.abs(weightDiff))}`

  const radarData = [
    { metric: "Performance", site1: url1.performance_score ?? 0, site2: url2.performance_score ?? 0 },
    { metric: "Accessibility", site1: url1.accessibility_score ?? 0, site2: url2.accessibility_score ?? 0 },
    { metric: "Best Practices", site1: url1.best_practices_score ?? 0, site2: url2.best_practices_score ?? 0 },
    { metric: "SEO", site1: url1.seo_score ?? 0, site2: url2.seo_score ?? 0 },
  ]

  const cwvData = [
    { metric: "FCP", site1: url1.fcp, site2: url2.fcp, benchmark: 3000, format: formatMilliseconds },
    { metric: "LCP", site1: url1.lcp, site2: url2.lcp, benchmark: 5000, format: formatMilliseconds },
    { metric: "CLS", site1: url1.cls, site2: url2.cls, benchmark: 0.25, format: formatCls },
    { metric: "INP", site1: url1.inp, site2: url2.inp, benchmark: 500, format: formatMilliseconds },
    { metric: "TTFB", site1: url1.ttfb, site2: url2.ttfb, benchmark: 1000, format: formatMilliseconds },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h4 className="aurora-text mb-2 text-sm font-semibold">Lighthouse Scores</h4>
        <div className="grid gap-4 lg:grid-cols-[minmax(360px,1fr)_300px] xl:grid-cols-[minmax(360px,0.95fr)_300px_minmax(220px,0.55fr)]">
          <div className="divide-y self-start" style={{ borderColor: "var(--glass-border)" }}>
            <div className="flex items-center justify-between px-0 pb-1">
              <div />
              <div className="flex items-center gap-6">
                <span className="aurora-text-faint w-20 truncate text-right text-xs font-medium" title={url1.site_name}>
                  {url1.site_name}
                </span>
                <span className="aurora-text-faint w-20 truncate text-right text-xs font-medium" title={url2.site_name}>
                  {url2.site_name}
                </span>
              </div>
            </div>
            <MetricRow label="Performance" value1={url1.performance_score} value2={url2.performance_score} isScore />
            <MetricRow label="Accessibility" value1={url1.accessibility_score} value2={url2.accessibility_score} isScore />
            <MetricRow label="Best Practices" value1={url1.best_practices_score} value2={url2.best_practices_score} isScore />
            <MetricRow label="SEO" value1={url1.seo_score} value2={url2.seo_score} isScore />
          </div>
          <div className="min-w-0">
            <ResponsiveContainer width="100%" height={176}>
              <RadarChart data={radarData} margin={{ top: 12, right: 104, bottom: 18, left: 0 }}>
                <PolarGrid stroke="var(--glass-border)" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: "var(--lcc-text-dim)", fontFamily: "var(--aurora-font-mono)" }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name={url1.site_name} dataKey="site1" stroke={SITE1_COLOR} fill={SITE1_COLOR} fillOpacity={0.25} />
                <Radar name={url2.site_name} dataKey="site2" stroke={SITE2_COLOR} fill={SITE2_COLOR} fillOpacity={0.25} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SITE1_COLOR }} />
                <span className="aurora-text">{url1.site_name}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: SITE2_COLOR }} />
                <span className="aurora-text">{url2.site_name}</span>
              </span>
            </div>
          </div>
          <div className="aurora-callout flex flex-col justify-between gap-3 self-start p-3 text-left lg:col-span-2 xl:col-span-1">
            <div>
              <span className="aurora-label">Performance delta</span>
              <div className="aurora-num mt-1 text-2xl font-semibold" style={{ color: diffColor }}>
                {diffLabel} pts
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="min-w-0">
                <span className="aurora-text-faint block truncate" title={`${url1.site_name} weight`}>
                  {url1.site_name}
                </span>
                <span className="aurora-text aurora-num font-semibold">{formatBytes(url1.total_byte_weight)}</span>
              </div>
              <div className="min-w-0">
                <span className="aurora-text-faint block truncate" title={`${url2.site_name} weight`}>
                  {url2.site_name}
                </span>
                <span className="aurora-text aurora-num font-semibold">{formatBytes(url2.total_byte_weight)}</span>
              </div>
            </div>
            <div className="aurora-text-faint text-xs">
              Weight delta <span className="aurora-num aurora-text">{weightDiffLabel}</span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h4 className="aurora-text mb-2 text-sm font-semibold">Core Web Vitals</h4>
        <div className="grid gap-4 xl:grid-cols-[minmax(360px,0.85fr)_minmax(360px,1fr)]">
          <div className="divide-y self-start" style={{ borderColor: "var(--glass-border)" }}>
            <MetricRow label="FCP" value1={url1.fcp} value2={url2.fcp} format={formatMilliseconds} />
            <MetricRow label="LCP" value1={url1.lcp} value2={url2.lcp} format={formatMilliseconds} />
            <MetricRow label="CLS" value1={url1.cls} value2={url2.cls} format={formatCls} />
            <MetricRow label="INP" value1={url1.inp} value2={url2.inp} format={formatMilliseconds} />
            <MetricRow label="TTFB" value1={url1.ttfb} value2={url2.ttfb} format={formatMilliseconds} />
          </div>
          <div className="max-w-[492px] space-y-3 xl:ml-7">
            {cwvData.map((item) => (
              <VitalBar
                key={item.metric}
                metric={item.metric}
                value1={item.site1}
                value2={item.site2}
                benchmark={item.benchmark}
                format={item.format}
                site1Name={url1.site_name}
                site2Name={url2.site_name}
              />
            ))}
          </div>
        </div>
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
        <h2 className="aurora-section-title">Page Comparison</h2>
        <p className="aurora-section-subtitle">
          Compare the same page across different sites
        </p>
      </div>

      <div className="aurora-panel p-4">
        <div className="flex items-end gap-3">
          {/* Site 1 */}
          <div className="flex flex-col gap-1.5">
            <label className="aurora-label">Site 1</label>
            <select
              className="aurora-select"
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

          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <label className="aurora-label">URL</label>
            <select
              className="aurora-select w-full"
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

          <span className="aurora-text-faint pb-2 text-sm font-medium">vs</span>

          {/* Site 2 */}
          <div className="flex flex-col gap-1.5">
            <label className="aurora-label">Site 2</label>
            <select
              className="aurora-select"
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

          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
            <label className="aurora-label">URL</label>
            <select
              className="aurora-select w-full"
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

          <Button onClick={handleCompare} disabled={!url1Id || !url2Id || loading} style={{ color: "#000" }}>
            Compare
          </Button>
        </div>
      </div>

      <div className="aurora-panel p-4">
        {loading && <LoadingSpinner message="Loading comparison..." />}

        {error && (
          <p className="py-8 text-center text-sm" style={{ color: "var(--lcc-red)" }}>{error}</p>
        )}

        {!loading && !error && !result && (
          <EmptyState
            icon={<GitCompareArrows size={40} />}
            title="Select URLs to Compare"
            description="Choose a site and URL on each side, then click Compare to see a side-by-side breakdown."
          />
        )}

        {!loading && !error && result && <ComparisonResults data={result} />}
      </div>
    </div>
  )
}
