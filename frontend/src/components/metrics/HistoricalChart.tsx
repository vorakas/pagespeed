import { useState, useCallback } from "react"
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
import { Card, CardContent } from "@/components/ui/card"
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

const SCORE_LINES = [
  { key: "performance_score", name: "Performance", color: "hsl(234 77% 60%)" },
  { key: "accessibility_score", name: "Accessibility", color: "hsl(160 84% 39%)" },
  { key: "best_practices_score", name: "Best Practices", color: "hsl(38 92% 50%)" },
  { key: "seo_score", name: "SEO", color: "hsl(0 84% 60%)" },
] as const

export function HistoricalChart({ strategy }: HistoricalChartProps) {
  const { sites, loading: sitesLoading } = useSites()
  const [selectedSiteId, setSelectedSiteId] = useState<number | "">("")
  const [selectedUrlId, setSelectedUrlId] = useState<number | "">("")
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
      const data = await api.getUrlHistory(selectedUrlId as number, strategy)
      setHistory(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load history")
    } finally {
      setLoading(false)
    }
  }, [selectedUrlId, strategy])

  const chartData = history?.map((point) => ({
    ...point,
    date: formatDate(point.tested_at),
  }))

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Historical Performance</h2>
        <p className="text-sm text-muted-foreground">
          Track Lighthouse score trends over the last 30 days
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground">Site</label>
              <select
                className="h-9 rounded-md border border-border bg-background px-3 text-sm"
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
              <label className="text-xs font-medium text-muted-foreground">URL</label>
              <select
                className="h-9 min-w-[200px] rounded-md border border-border bg-background px-3 text-sm"
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
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          {loading && <LoadingSpinner message="Loading historical data..." />}

          {error && (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
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
              actionHref="/app/test"
            />
          )}

          {!loading && !error && chartData && chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <defs>
                  {SCORE_LINES.map((line) => (
                    <linearGradient key={line.key} id={`gradient-${line.key}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={line.color} stopOpacity={0.8} />
                      <stop offset="95%" stopColor={line.color} stopOpacity={0.1} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.5} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={32}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "4 4" }}
                  contentStyle={{
                    backgroundColor: "hsl(0 0% 9%)",
                    border: "1px solid hsl(0 0% 15%)",
                    borderRadius: "8px",
                    fontSize: 13,
                    padding: "8px 12px",
                    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
                  }}
                  labelStyle={{ color: "hsl(0 0% 95%)", fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: "hsl(0 0% 80%)", padding: "1px 0" }}
                />
                <Legend wrapperStyle={{ color: "var(--foreground)" }} />
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
        </CardContent>
      </Card>
    </div>
  )
}
