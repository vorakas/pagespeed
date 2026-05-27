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

interface RadarAxisTickProps {
  x?: string | number
  y?: string | number
  payload?: {
    value?: string | number
  }
}

const SITE1_COLOR = "var(--lcc-violet)"
const SITE2_COLOR = "var(--lcc-green)"

function MetricRow({ label, value1, value2, format, isScore }: MetricRowProps) {
  const formatted1 = format ? format(value1 as number | null) : String(value1 ?? "N/A")
  const formatted2 = format ? format(value2 as number | null) : String(value2 ?? "N/A")

  if (isScore) {
    return (
      <div className="grid grid-cols-[minmax(120px,1fr)_76px_76px] items-center gap-3 py-1.5">
        <span className="aurora-text-dim truncate text-sm">{label}</span>
        <span className="flex justify-end"><ScoreBadge score={value1 as number | null} /></span>
        <span className="flex justify-end"><ScoreBadge score={value2 as number | null} /></span>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[minmax(120px,1fr)_76px_76px] items-center gap-3 py-1.5">
      <span className="aurora-text-dim truncate text-sm">{label}</span>
      <span className="aurora-text aurora-num text-right text-sm">{formatted1}</span>
      <span className="aurora-text aurora-num text-right text-sm">{formatted2}</span>
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
    <div className="grid grid-cols-[72px_minmax(0,1fr)_56px] items-center gap-2">
      <span className="aurora-text-faint truncate text-right text-[10px]" title={siteName}>
        {siteName}
      </span>
      <div
        className="aurora-bar-track w-full"
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

function SummaryTile({
  label,
  value,
  detail,
}: {
  label: string
  value: string
  detail: string
}) {
  return (
    <div className="aurora-callout min-w-0 p-3">
      <span className="aurora-label block truncate">{label}</span>
      <p className="aurora-text aurora-num mt-1 truncate text-sm font-semibold" title={value}>
        {value}
      </p>
      <p className="aurora-text-faint mt-1 truncate text-xs" title={detail}>
        {detail}
      </p>
    </div>
  )
}

function renderRadarAxisTick({ x = 0, y = 0, payload }: RadarAxisTickProps) {
  const label = String(payload?.value ?? "")
  const tickX = typeof x === "number" ? x : Number(x) || 0
  const tickY = typeof y === "number" ? y : Number(y) || 0
  const isRightLabel = label === "Accessibility"
  const isLeftLabel = label === "SEO"
  const isTopLabel = label === "Performance"
  const isBottomLabel = label === "Best Practices"

  return (
    <text
      x={isRightLabel ? tickX + 12 : isLeftLabel ? tickX - 12 : tickX}
      y={isTopLabel ? tickY - 4 : isBottomLabel ? tickY + 8 : tickY}
      textAnchor={isRightLabel ? "start" : isLeftLabel ? "end" : "middle"}
      dominantBaseline="middle"
      fill="var(--lcc-text-dim)"
      fontFamily="var(--aurora-font-mono)"
      fontSize={11}
    >
      {label}
    </text>
  )
}

function ComparisonResults({ data }: { data: ComparisonResult }) {
  const { url1, url2 } = data
  const site1Name = url1.site_name || "Site 1"
  const site2Name = url2.site_name || "Site 2"

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
  const availableVitals = cwvData.filter((item) => item.site1 !== null || item.site2 !== null)
  const site1TargetsMet = cwvData.filter((item) => item.site1 !== null && item.site1 <= item.benchmark).length
  const site2TargetsMet = cwvData.filter((item) => item.site2 !== null && item.site2 <= item.benchmark).length
  const site1AvailableVitals = cwvData.filter((item) => item.site1 !== null).length
  const site2AvailableVitals = cwvData.filter((item) => item.site2 !== null).length
  const biggestVitalGap = cwvData
    .filter((item) => item.site1 !== null && item.site2 !== null)
    .map((item) => {
      const delta = item.site1! - item.site2!
      return {
        ...item,
        delta,
        normalizedGap: Math.abs(delta) / item.benchmark,
      }
    })
    .sort((a, b) => b.normalizedGap - a.normalizedGap)[0]
  const biggestVitalGapLabel = biggestVitalGap
    ? `${biggestVitalGap.metric}: ${biggestVitalGap.delta > 0 ? site1Name : site2Name}`
    : "No comparable vitals"
  const biggestVitalGapDetail = biggestVitalGap
    ? `Higher by ${biggestVitalGap.format(Math.abs(biggestVitalGap.delta))}`
    : "Load both sides to compare"
  const lighterSiteName = weightDiff === 0 ? "Tie" : weightDiff < 0 ? site1Name : site2Name
  const lighterPageDetail = weightDiff === 0 ? "Same page weight" : `${formatBytes(Math.abs(weightDiff))} lighter`

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(420px,0.9fr)_minmax(360px,0.8fr)]">
      <div className="min-w-0 space-y-5">
        <div>
          <div className="mb-2 grid grid-cols-[minmax(120px,1fr)_76px_76px] items-end gap-3">
            <h4 className="aurora-text text-sm font-semibold">Lighthouse Scores</h4>
            <span className="aurora-text-faint truncate text-right text-xs font-medium" title={site1Name}>
              {site1Name}
            </span>
            <span className="aurora-text-faint truncate text-right text-xs font-medium" title={site2Name}>
              {site2Name}
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
            <MetricRow label="Performance" value1={url1.performance_score} value2={url2.performance_score} isScore />
            <MetricRow label="Accessibility" value1={url1.accessibility_score} value2={url2.accessibility_score} isScore />
            <MetricRow label="Best Practices" value1={url1.best_practices_score} value2={url2.best_practices_score} isScore />
            <MetricRow label="SEO" value1={url1.seo_score} value2={url2.seo_score} isScore />
          </div>
        </div>

        <div>
          <div className="mb-2 grid grid-cols-[minmax(120px,1fr)_76px_76px] items-end gap-3">
            <h4 className="aurora-text text-sm font-semibold">Core Web Vitals</h4>
            <span className="aurora-text-faint truncate text-right text-xs font-medium" title={site1Name}>
              {site1Name}
            </span>
            <span className="aurora-text-faint truncate text-right text-xs font-medium" title={site2Name}>
              {site2Name}
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
            <MetricRow label="FCP" value1={url1.fcp} value2={url2.fcp} format={formatMilliseconds} />
            <MetricRow label="LCP" value1={url1.lcp} value2={url2.lcp} format={formatMilliseconds} />
            <MetricRow label="CLS" value1={url1.cls} value2={url2.cls} format={formatCls} />
            <MetricRow label="INP" value1={url1.inp} value2={url2.inp} format={formatMilliseconds} />
            <MetricRow label="TTFB" value1={url1.ttfb} value2={url2.ttfb} format={formatMilliseconds} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <SummaryTile
              label="Vitals on target"
              value={`${site1TargetsMet}/${site1AvailableVitals} vs ${site2TargetsMet}/${site2AvailableVitals}`}
              detail={`${site1Name} vs ${site2Name}`}
            />
            <SummaryTile
              label="Largest vital gap"
              value={biggestVitalGapLabel}
              detail={biggestVitalGapDetail}
            />
            <SummaryTile
              label="Lighter page"
              value={lighterSiteName}
              detail={lighterPageDetail}
            />
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-4">
        <div>
          <ResponsiveContainer width="100%" height={172}>
            <RadarChart data={radarData} margin={{ top: 12, right: 72, bottom: 18, left: 72 }}>
              <PolarGrid stroke="var(--glass-border)" />
              <PolarAngleAxis dataKey="metric" tick={renderRadarAxisTick} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name={site1Name} dataKey="site1" stroke={SITE1_COLOR} fill={SITE1_COLOR} fillOpacity={0.25} />
              <Radar name={site2Name} dataKey="site2" stroke={SITE2_COLOR} fill={SITE2_COLOR} fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: SITE1_COLOR }} />
              <span className="aurora-text truncate" title={site1Name}>{site1Name}</span>
            </span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: SITE2_COLOR }} />
              <span className="aurora-text truncate" title={site2Name}>{site2Name}</span>
            </span>
          </div>
        </div>

        <div className="aurora-callout p-3 text-left">
          <div className="grid gap-2 text-xs sm:grid-cols-[144px_1fr_1fr_auto]">
            <div className="min-w-0">
              <span className="aurora-label block whitespace-nowrap">Performance delta</span>
              <span className="aurora-num block text-sm font-semibold" style={{ color: diffColor }}>
                {diffLabel} pts
              </span>
            </div>
            <div className="min-w-0">
              <span className="aurora-text-faint block truncate" title={`${site1Name} weight`}>
                {site1Name}
              </span>
              <span className="aurora-text aurora-num font-semibold">{formatBytes(url1.total_byte_weight)}</span>
            </div>
            <div className="min-w-0">
              <span className="aurora-text-faint block truncate" title={`${site2Name} weight`}>
                {site2Name}
              </span>
              <span className="aurora-text aurora-num font-semibold">{formatBytes(url2.total_byte_weight)}</span>
            </div>
            <div className="min-w-0">
              <span className="aurora-text-faint block truncate">Weight delta</span>
              <span className="aurora-num aurora-text font-semibold">{weightDiffLabel}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {cwvData.map((item) => (
            <VitalBar
              key={item.metric}
              metric={item.metric}
              value1={item.site1}
              value2={item.site2}
              benchmark={item.benchmark}
              format={item.format}
              site1Name={site1Name}
              site2Name={site2Name}
            />
          ))}
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
