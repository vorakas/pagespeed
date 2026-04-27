import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { EmptyState } from "@/components/shared/EmptyState"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Search } from "lucide-react"
import { api } from "@/services/api"
import type { AzureConfig } from "@/types"

interface LogEntry {
  TimeGenerated?: string
  csMethod?: string
  csUriStem?: string
  csUriQuery?: string
  scStatus?: number
  TimeTaken?: number
  cIP?: string
  sSiteName?: string
}

interface LogSearchPanelProps {
  config: AzureConfig
  selectedSite: string
}

function getStatusColor(code: number | undefined): string | undefined {
  if (!code) return undefined
  const prefix = String(code).charAt(0)
  if (prefix === "2") return "var(--lcc-green)"
  if (prefix === "3") return "var(--lcc-blue)"
  if (prefix === "4") return "var(--lcc-amber)"
  if (prefix === "5") return "var(--lcc-red)"
  return undefined
}

function formatDateTime(isoStr?: string): string {
  if (!isoStr) return "--"
  return new Date(isoStr).toLocaleString()
}

export function LogSearchPanel({ config, selectedSite }: LogSearchPanelProps) {
  const now = new Date()
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const formatLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const [startDate, setStartDate] = useState(formatLocal(yesterday))
  const [endDate, setEndDate] = useState(formatLocal(now))
  const [urlFilter, setUrlFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [limit, setLimit] = useState("50")
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<LogEntry[] | null>(null)
  const [count, setCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    if (!startDate || !endDate) return
    setLoading(true)
    setError(null)
    try {
      const result = await api.searchAzureLogs(config, {
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        urlFilter: urlFilter || undefined,
        statusCode: statusFilter || undefined,
        siteName: selectedSite || undefined,
        limit: parseInt(limit),
      }) as Record<string, unknown>
      if (result.success) {
        setLogs((result.logs as LogEntry[]) || [])
        setCount((result.count as number) || 0)
      } else {
        setError((result.error as string) || "Search failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="aurora-section-title">Search & Filter IIS Logs</h2>
      <div className="aurora-panel p-4">
        <div className="grid grid-cols-[repeat(5,auto)_1fr] items-end gap-x-3 gap-y-1.5">
          <label className="aurora-label">Start Date</label>
          <label className="aurora-label">End Date</label>
          <label className="aurora-label">URL Path</label>
          <label className="aurora-label">Status</label>
          <label className="aurora-label">Limit</label>
          <div />
          <DateTimePicker value={startDate} onChange={setStartDate} className="w-56" />
          <DateTimePicker value={endDate} onChange={setEndDate} className="w-56" />
          <input
            className="aurora-input w-40"
            value={urlFilter}
            onChange={(e) => setUrlFilter(e.target.value)}
            placeholder="/products"
          />
          <select
            className="aurora-select w-36"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value === "all" ? "" : e.target.value)}
          >
            <option value="all">All</option>
            <option value="2">2xx Success</option>
            <option value="3">3xx Redirect</option>
            <option value="4">4xx Client Error</option>
            <option value="5">5xx Server Error</option>
          </select>
          <select
            className="aurora-select w-24"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          >
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="250">250</option>
            <option value="500">500</option>
          </select>
          <Button onClick={handleSearch} disabled={loading} className="justify-self-start">
            <Search className="h-4 w-4" /> Search
          </Button>
        </div>
      </div>

      {loading && <LoadingSpinner message="Searching IIS logs..." />}
      {error && <p className="text-sm" style={{ color: "var(--lcc-red)" }}>{error}</p>}

      {logs !== null && !loading && (
        <div className="aurora-panel overflow-hidden">
          <div className="aurora-panel-header">
            <span className="aurora-text-faint text-xs font-normal">Found {count} log entries</span>
          </div>
          {logs.length === 0 ? (
            <EmptyState icon={<Search size={36} />} title="No Log Entries Found" description="Try adjusting your search criteria." />
          ) : (
            <div className="overflow-x-auto">
              <table className="aurora-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Method</th>
                    <th>URL Path</th>
                    <th>Query String</th>
                    <th>Status</th>
                    <th>Time (ms)</th>
                    <th>Client IP</th>
                    <th>Site</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={i}>
                      <td className="aurora-text-dim truncate max-w-[120px]" title={formatDateTime(log.TimeGenerated)}>{formatDateTime(log.TimeGenerated)}</td>
                      <td className="aurora-text-dim">{log.csMethod || "--"}</td>
                      <td className="aurora-num truncate max-w-[260px]" title={log.csUriStem}>{log.csUriStem || "--"}</td>
                      <td className="aurora-text-dim break-all max-w-[300px]">{log.csUriQuery || "--"}</td>
                      <td className="font-medium" style={{ color: getStatusColor(log.scStatus) }}>{log.scStatus ?? "--"}</td>
                      <td><span className="aurora-num">{log.TimeTaken != null ? Number(log.TimeTaken).toLocaleString() : "--"}</span></td>
                      <td className="aurora-text-dim truncate max-w-[120px]" title={log.cIP}>{log.cIP || "--"}</td>
                      <td className="aurora-text-dim truncate max-w-[120px]" title={log.sSiteName}>{log.sSiteName || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
