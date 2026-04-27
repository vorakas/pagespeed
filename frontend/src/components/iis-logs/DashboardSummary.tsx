import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { BarChart3 } from "lucide-react"
import { api } from "@/services/api"
import type { AzureConfig } from "@/types"

interface DashboardSummaryProps {
  config: AzureConfig
  selectedSite: string
}

interface SummaryData {
  summary: {
    totalRequests: number
    errorCount4xx: number
    errorCount5xx: number
    avgTimeTaken: number
    p50TimeTaken: number
    p90TimeTaken: number
    p99TimeTaken: number
    maxTimeTaken: number
  }
  topPages: Array<{ url: string; requestCount: number; avgTimeTaken: number }>
  statusDistribution: Array<{ statusCode: number; count: number; percentage: number }>
}

function getStatusColor(code: number): string | undefined {
  const prefix = String(code).charAt(0)
  if (prefix === "2") return "var(--lcc-green)"
  if (prefix === "3") return "var(--lcc-blue)"
  if (prefix === "4") return "var(--lcc-amber)"
  if (prefix === "5") return "var(--lcc-red)"
  return undefined
}

export function DashboardSummary({ config, selectedSite }: DashboardSummaryProps) {
  const [data, setData] = useState<SummaryData | null>(null)
  const [loading, setLoading] = useState(false)

  const loadDashboard = useCallback(async () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    setLoading(true)
    try {
      const result = await api.getAzureDashboard(
        config,
        yesterday.toISOString(),
        now.toISOString(),
        selectedSite || undefined
      ) as Record<string, unknown>
      if (result.success) {
        setData(result as unknown as SummaryData)
      }
    } catch {
      // Silent fail for dashboard
    } finally {
      setLoading(false)
    }
  }, [config, selectedSite])

  if (loading) return <LoadingSpinner message="Loading dashboard..." />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="aurora-section-title">Dashboard Summary</h2>
        <Button variant="outline" size="sm" onClick={loadDashboard}>
          <BarChart3 className="h-4 w-4" /> Load Dashboard (24h)
        </Button>
      </div>

      {data && (
        <>
          {/* Stat Cards */}
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="aurora-panel p-4">
              <p className="aurora-stat-label">Total Requests</p>
              <p className="aurora-stat-value">{Number(data.summary.totalRequests).toLocaleString()}</p>
            </div>
            <div className="aurora-panel p-4">
              <p className="aurora-stat-label">4xx Errors</p>
              <p
                className="aurora-stat-value"
                style={{ color: data.summary.errorCount4xx > 0 ? "var(--lcc-amber)" : undefined }}
              >
                {Number(data.summary.errorCount4xx).toLocaleString()}
              </p>
            </div>
            <div className="aurora-panel p-4">
              <p className="aurora-stat-label">5xx Errors</p>
              <p
                className="aurora-stat-value"
                style={{ color: data.summary.errorCount5xx > 0 ? "var(--lcc-red)" : undefined }}
              >
                {Number(data.summary.errorCount5xx).toLocaleString()}
              </p>
            </div>
            <div className="aurora-panel p-4">
              <p className="aurora-stat-label">Avg Response</p>
              <p className="aurora-stat-value">{data.summary.avgTimeTaken} ms</p>
            </div>
          </div>

          {/* Percentiles */}
          <div className="aurora-panel p-4">
            <h3 className="aurora-text mb-2 text-sm font-semibold">Response Time Breakdown</h3>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="aurora-eyebrow">P50</p>
                <p className="aurora-text text-lg font-semibold tabular-nums">{data.summary.p50TimeTaken} ms</p>
              </div>
              <div>
                <p className="aurora-eyebrow">P90</p>
                <p className="aurora-text text-lg font-semibold tabular-nums">{data.summary.p90TimeTaken} ms</p>
              </div>
              <div>
                <p className="aurora-eyebrow">P99</p>
                <p className="aurora-text text-lg font-semibold tabular-nums">{data.summary.p99TimeTaken} ms</p>
              </div>
              <div>
                <p className="aurora-eyebrow">Max</p>
                <p className="aurora-text text-lg font-semibold tabular-nums">{Number(data.summary.maxTimeTaken).toLocaleString()} ms</p>
              </div>
            </div>
          </div>

          {/* Top Pages + Status Distribution side by side */}
          <div className="grid gap-4 sm:grid-cols-2">
            {data.topPages && data.topPages.length > 0 && (
              <div className="aurora-panel overflow-hidden">
                <div className="aurora-panel-header">Top Pages</div>
                <div className="overflow-x-auto">
                  <table className="aurora-table">
                    <thead>
                      <tr>
                        <th>URL</th>
                        <th>Requests</th>
                        <th>Avg Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topPages.map((p, i) => (
                        <tr key={i}>
                          <td><span className="aurora-num truncate max-w-[260px] inline-block align-middle">{p.url}</span></td>
                          <td><span className="aurora-num">{Number(p.requestCount).toLocaleString()}</span></td>
                          <td><span className="aurora-num">{p.avgTimeTaken} ms</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {data.statusDistribution && data.statusDistribution.length > 0 && (
              <div className="aurora-panel overflow-hidden">
                <div className="aurora-panel-header">Status Distribution</div>
                <div className="overflow-x-auto">
                  <table className="aurora-table">
                    <thead>
                      <tr>
                        <th>Status</th>
                        <th>Count</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.statusDistribution.map((s, i) => (
                        <tr key={i}>
                          <td className="font-medium" style={{ color: getStatusColor(s.statusCode) }}>{s.statusCode}</td>
                          <td><span className="aurora-num">{Number(s.count).toLocaleString()}</span></td>
                          <td><span className="aurora-num">{s.percentage}%</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
