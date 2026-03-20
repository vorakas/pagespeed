import { useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

const statusClasses: Record<string, string> = {
  "2": "text-score-good",
  "3": "text-primary",
  "4": "text-score-average",
  "5": "text-score-poor",
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
        <h2 className="text-lg font-semibold text-foreground">Dashboard Summary</h2>
        <Button variant="outline" size="sm" onClick={loadDashboard}>
          <BarChart3 className="h-4 w-4" /> Load Dashboard (24h)
        </Button>
      </div>

      {data && (
        <>
          {/* Stat Cards */}
          <div className="grid gap-3 sm:grid-cols-4">
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Requests</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">{Number(data.summary.totalRequests).toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">4xx Errors</p>
              <p className={`text-2xl font-bold tabular-nums ${data.summary.errorCount4xx > 0 ? "text-score-average" : "text-foreground"}`}>{Number(data.summary.errorCount4xx).toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">5xx Errors</p>
              <p className={`text-2xl font-bold tabular-nums ${data.summary.errorCount5xx > 0 ? "text-score-poor" : "text-foreground"}`}>{Number(data.summary.errorCount5xx).toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Avg Response</p>
              <p className="text-2xl font-bold tabular-nums text-foreground">{data.summary.avgTimeTaken} ms</p>
            </CardContent></Card>
          </div>

          {/* Percentiles */}
          <Card><CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-2">Response Time Breakdown</h3>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div><p className="text-[10px] uppercase text-muted-foreground">P50</p><p className="text-lg font-semibold tabular-nums">{data.summary.p50TimeTaken} ms</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">P90</p><p className="text-lg font-semibold tabular-nums">{data.summary.p90TimeTaken} ms</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">P99</p><p className="text-lg font-semibold tabular-nums">{data.summary.p99TimeTaken} ms</p></div>
              <div><p className="text-[10px] uppercase text-muted-foreground">Max</p><p className="text-lg font-semibold tabular-nums">{Number(data.summary.maxTimeTaken).toLocaleString()} ms</p></div>
            </div>
          </CardContent></Card>

          {/* Top Pages + Status Distribution side by side */}
          <div className="grid gap-4 sm:grid-cols-2">
            {data.topPages && data.topPages.length > 0 && (
              <Card><CardContent className="p-0">
                <div className="px-4 py-2 border-b border-border"><h3 className="text-sm font-semibold text-foreground">Top Pages</h3></div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">URL</TableHead>
                      <TableHead className="text-xs">Requests</TableHead>
                      <TableHead className="text-xs">Avg Time</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {data.topPages.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="py-1.5 text-xs font-mono truncate max-w-[200px]">{p.url}</TableCell>
                          <TableCell className="py-1.5 text-xs tabular-nums">{Number(p.requestCount).toLocaleString()}</TableCell>
                          <TableCell className="py-1.5 text-xs tabular-nums">{p.avgTimeTaken} ms</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent></Card>
            )}
            {data.statusDistribution && data.statusDistribution.length > 0 && (
              <Card><CardContent className="p-0">
                <div className="px-4 py-2 border-b border-border"><h3 className="text-sm font-semibold text-foreground">Status Distribution</h3></div>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs">Count</TableHead>
                      <TableHead className="text-xs">%</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {data.statusDistribution.map((s, i) => (
                        <TableRow key={i}>
                          <TableCell className={`py-1.5 text-xs font-medium ${statusClasses[String(s.statusCode).charAt(0)] || ""}`}>{s.statusCode}</TableCell>
                          <TableCell className="py-1.5 text-xs tabular-nums">{Number(s.count).toLocaleString()}</TableCell>
                          <TableCell className="py-1.5 text-xs tabular-nums">{s.percentage}%</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent></Card>
            )}
          </div>
        </>
      )}
    </div>
  )
}
