import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/shared/EmptyState"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Search } from "lucide-react"
import { api } from "@/services/api"
import { escapeHtml } from "@/lib/utils"
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

const statusClasses: Record<string, string> = {
  "2": "text-score-good",
  "3": "text-primary",
  "4": "text-score-average",
  "5": "text-score-poor",
}

function getStatusClass(code: number | undefined): string {
  if (!code) return ""
  const prefix = String(code).charAt(0)
  return statusClasses[prefix] || ""
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
      <h2 className="text-lg font-semibold text-foreground">Search & Filter IIS Logs</h2>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label>Start Date</Label>
          <Input type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-48" />
        </div>
        <div className="space-y-1.5">
          <Label>End Date</Label>
          <Input type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-48" />
        </div>
        <div className="space-y-1.5">
          <Label>URL Path</Label>
          <Input value={urlFilter} onChange={(e) => setUrlFilter(e.target.value)} placeholder="/products" className="w-40" />
        </div>
        <div className="space-y-1.5 w-36">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="2">2xx Success</SelectItem>
              <SelectItem value="3">3xx Redirect</SelectItem>
              <SelectItem value="4">4xx Client Error</SelectItem>
              <SelectItem value="5">5xx Server Error</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 w-24">
          <Label>Limit</Label>
          <Select value={limit} onValueChange={setLimit}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
              <SelectItem value="250">250</SelectItem>
              <SelectItem value="500">500</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSearch} disabled={loading}>
          <Search className="h-4 w-4" /> Search
        </Button>
      </div>

      {loading && <LoadingSpinner message="Searching IIS logs..." />}
      {error && <p className="text-sm text-score-poor">{error}</p>}

      {logs !== null && !loading && (
        <Card>
          <div className="border-b border-border px-4 py-2">
            <p className="text-xs text-muted-foreground">Found {count} log entries</p>
          </div>
          <CardContent className="p-0">
            {logs.length === 0 ? (
              <EmptyState icon={<Search size={36} />} title="No Log Entries Found" description="Try adjusting your search criteria." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs w-[6%]">Time</TableHead>
                      <TableHead className="text-xs w-[3%]">Method</TableHead>
                      <TableHead className="text-xs w-[24%]">URL Path</TableHead>
                      <TableHead className="text-xs w-[34%]">Query String</TableHead>
                      <TableHead className="text-xs w-[5%]">Status</TableHead>
                      <TableHead className="text-xs w-[7%]">Time (ms)</TableHead>
                      <TableHead className="text-xs w-[8%]">Client IP</TableHead>
                      <TableHead className="text-xs w-[8%]">Site</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log, i) => (
                      <TableRow key={i}>
                        <TableCell className="py-1.5 text-xs truncate max-w-[80px]" title={formatDateTime(log.TimeGenerated)}>{formatDateTime(log.TimeGenerated)}</TableCell>
                        <TableCell className="py-1.5 text-xs">{log.csMethod || "--"}</TableCell>
                        <TableCell className="py-1.5 text-xs font-mono truncate max-w-[200px]" title={log.csUriStem}>{log.csUriStem || "--"}</TableCell>
                        <TableCell className="py-1.5 text-xs break-all max-w-[300px]">{log.csUriQuery || "--"}</TableCell>
                        <TableCell className={`py-1.5 text-xs font-medium ${getStatusClass(log.scStatus)}`}>{log.scStatus ?? "--"}</TableCell>
                        <TableCell className="py-1.5 text-xs tabular-nums">{log.TimeTaken != null ? Number(log.TimeTaken).toLocaleString() : "--"}</TableCell>
                        <TableCell className="py-1.5 text-xs truncate max-w-[80px]" title={log.cIP}>{log.cIP || "--"}</TableCell>
                        <TableCell className="py-1.5 text-xs truncate max-w-[80px]" title={log.sSiteName}>{log.sSiteName || "--"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
