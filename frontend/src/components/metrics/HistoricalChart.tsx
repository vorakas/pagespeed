import { useState, useCallback, useEffect, useRef } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"
import { TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { formatDate } from "@/lib/utils"
import { useSites } from "@/hooks/use-sites"
import { api } from "@/services/api"
import type { Strategy, HistoryPoint } from "@/types"

interface HistoricalChartProps {
  strategy: Strategy
}

const DATE_RANGES = [
  { value: 7, label: "Last 7 days" },
  { value: 14, label: "Last 14 days" },
  { value: 30, label: "Last 30 days" },
  { value: 60, label: "Last 60 days" },
  { value: 90, label: "Last 90 days" },
] as const

const SCORE_LINES = [
  { key: "performance_score", name: "Performance", color: "var(--lcc-violet)" },
  { key: "accessibility_score", name: "Accessibility", color: "var(--lcc-green)" },
  { key: "best_practices_score", name: "Best Practices", color: "var(--lcc-amber)" },
  { key: "seo_score", name: "SEO", color: "var(--lcc-blue)" },
] as const

export function HistoricalChart({ strategy }: HistoricalChartProps) {
  const { sites, loading: sitesLoading } = useSites()
  const [selectedSiteId, setSelectedSiteId] = useState<number | "">("")
  const [selectedUrlId, setSelectedUrlId] = useState<number | "">("")
  const [dateRange, setDateRange] = useState<number>(30)
  const [history, setHistory] = useState<HistoryPoint[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedSite = sites.find((s) => s.id === selectedSiteId)

  const handleSiteChange = useCallback((siteId: number | "") => {
    setSelectedSiteId(siteId)
    setSelectedUrlId("")
    setHistory(null)
    setError(null)
  }, [])

  const loadChart = useCallback(async () => {
    if (!selectedUrlId) return

    setLoading(true)
    setError(null)
    try {
      const data = await api.getUrlHistory(selectedUrlId as number, strategy, dateRange)
      setHistory(data)
      hasLoaded.current = true
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history")
    } finally {
      setLoading(false)
    }
  }, [selectedUrlId, strategy, dateRange])

  const hasLoaded = useRef(false)
  useEffect(() => {
    if (hasLoaded.current && selectedUrlId) {
      loadChart()
    }
  }, [dateRange]) // eslint-disable-line react-hooks/exhaustive-deps

  const chartData = (() => {
    if (!history || history.length === 0) return undefined

    const grouped = new Map<string, HistoryPoint[]>()
    for (const point of history) {
      const date = formatDate(point.tested_at)
      const existing = grouped.get(date)
      if (existing) {
        existing.push(point)
      } else {
        grouped.set(date, [point])
      }
    }

    const scoreKeys = [
      "performance_score",
      "accessibility_score",
      "best_practices_score",
      "seo_score",
    ] as const

    return Array.from(grouped.entries()).map(([date, points]) => {
      const averaged: Record<string, unknown> = { date }
      for (const key of scoreKeys) {
        const values = points.map((p) => p[key]).filter((v): v is number => v != null)
        averaged[key] = values.length > 0
          ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
          : null
      }
      return averaged
    })
  })()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="aurora-section-title">Historical Performance</h2>
          <p className="aurora-section-subtitle">
            Track Lighthouse score trends over time
          </p>
        </div>
        <select
          className="aurora-select"
          value={dateRange}
          onChange={(e) => setDateRange(Number(e.target.value))}
        >
          {DATE_RANGES.map((range) => (
            <option key={range.value} value={range.value}>
              {range.label}
            </option>
          ))}
        </select>
      </div>

      <div className="aurora-panel p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="aurora-label">Site</label>
            <select
              className="aurora-select"
              value={selectedSiteId}
              onChange={(e) => handleSiteChange(e.target.value ? Number(e.target.value) : "")}
              disabled={sitesLoading}
            >
              <option value="">Select a site...</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="aurora-label">URL</label>
            <select
              className="aurora-select min-w-[200px]"
              value={selectedUrlId}
              onChange={(e) => {
                setSelectedUrlId(e.target.value ? Number(e.target.value) : "")
                setHistory(null)
                setError(null)
              }}
              disabled={!selectedSiteId}
            >
              <option value="">Select a URL...</option>
              {selectedSite?.urls.map((url) => (
                <option key={url.id} value={url.id}>
                  {url.url}
                </option>
              ))}
            </select>
          </div>

          <Button onClick={loadChart} disabled={!selectedUrlId || loading}>
            Load Chart
          </Button>
        </div>
      </div>

      <div className="aurora-panel p-4">
        {loading && <LoadingSpinner message="Loading historical data..." />}

        {error && (
          <p className="py-8 text-center text-sm" style={{ color: "var(--lcc-red)" }}>{error}</p>
        )}

        {!loading && !error && !history && (
          <EmptyState
            icon={<TrendingUp size={40} />}
            title="Select a URL to View History"
            description="Choose a site and URL above, then click Load Chart to see performance trends."
          />
        )}

        {!loading && !error && history && history.length === 0 && (
          <EmptyState
            icon={<TrendingUp size={40} />}
            title="No Historical Data"
            description="No test results found for this URL. Run some PageSpeed tests first."
            actionText="Go to Test URLs"
            actionHref="/test"
          />
        )}

        {!loading && !error && chartData && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <defs>
                {SCORE_LINES.map((line) => (
                  <linearGradient key={line.key} id={`gradient-${line.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={line.color} stopOpacity={0.55} />
                    <stop offset="95%" stopColor={line.color} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid vertical={false} stroke="var(--glass-border)" strokeOpacity={0.6} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "var(--lcc-text-faint)", fontFamily: "var(--aurora-font-mono)" }}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "var(--lcc-text-faint)", fontFamily: "var(--aurora-font-mono)" }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                cursor={{ stroke: "var(--lcc-text-faint)", strokeWidth: 1, strokeDasharray: "4 4" }}
                contentStyle={{
                  backgroundColor: "var(--glass-bg-strong)",
                  backdropFilter: "blur(22px) saturate(140%)",
                  WebkitBackdropFilter: "blur(22px) saturate(140%)",
                  border: "1px solid var(--glass-border-strong)",
                  borderRadius: "var(--lcc-radius-sm)",
                  fontSize: 12,
                  padding: "8px 12px",
                  boxShadow: "var(--glass-shadow)",
                  color: "var(--lcc-text)",
                }}
                labelStyle={{ color: "var(--lcc-text)", fontWeight: 600, marginBottom: 4 }}
                itemStyle={{ color: "var(--lcc-text-dim)", padding: "1px 0" }}
              />
              <Legend wrapperStyle={{ color: "var(--lcc-text)", fontSize: 12 }} />
              {SCORE_LINES.map((line) => (
                <Area
                  key={line.key}
                  type="natural"
                  dataKey={line.key}
                  name={line.name}
                  stroke={line.color}
                  strokeWidth={2}
                  fill={`url(#gradient-${line.key})`}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  connectNulls
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
