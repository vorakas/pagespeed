import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { EmptyState } from "@/components/shared/EmptyState"
import { Database, Globe, AlertTriangle, Activity } from "lucide-react"
import { escapeHtml } from "@/lib/utils"

interface ApmMetricsProps {
  data: Record<string, unknown> | null
}

interface Transaction {
  name: string
  avgTime: number
  callsPerMin: number
  timePercent: number
  status: "good" | "warning" | "critical"
}

interface DbOperation {
  name: string
  avgDuration: number
  callsPerMin: number
  timePercent: number
  type: string
}

interface ExternalCall {
  name: string
  avgTime: number
  callsPerMin: number
  timePercent: number
  status: "good" | "warning" | "critical"
}

interface ErrorEntry {
  errorClass: string
  errorMessage: string
  count: number
  lastOccurrence?: string
}

const statusStyles: Record<string, { label: string; className: string }> = {
  good: { label: "Good", className: "text-score-good" },
  warning: { label: "Slow", className: "text-score-average" },
  critical: { label: "Critical", className: "text-score-poor" },
}

export function ApmMetrics({ data }: ApmMetricsProps) {
  if (!data) return null

  const transactions = (data.transactions || []) as Transaction[]
  const database = (data.database || []) as DbOperation[]
  const external = (data.external || []) as ExternalCall[]
  const errors = (data.errors || []) as ErrorEntry[]

  return (
    <Tabs defaultValue="transactions">
      <TabsList>
        <TabsTrigger value="transactions">Transactions</TabsTrigger>
        <TabsTrigger value="database">Database</TabsTrigger>
        <TabsTrigger value="external">External Services</TabsTrigger>
        <TabsTrigger value="errors">Errors</TabsTrigger>
      </TabsList>

      <TabsContent value="transactions">
        <Card>
          <CardContent className="p-0">
            {transactions.length === 0 ? (
              <EmptyState
                icon={<Activity size={36} />}
                title="No Transaction Data"
                description="No transactions found for this time range."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Transaction Name</TableHead>
                      <TableHead className="text-xs">Avg Response Time</TableHead>
                      <TableHead className="text-xs">Calls/Min</TableHead>
                      <TableHead className="text-xs">Total Time %</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((t, i) => {
                      const status = statusStyles[t.status] || statusStyles.good
                      return (
                        <TableRow key={i}>
                          <TableCell className="py-2 text-sm font-mono text-xs">{t.name}</TableCell>
                          <TableCell className="py-2 text-sm tabular-nums">{t.avgTime} ms</TableCell>
                          <TableCell className="py-2 text-sm tabular-nums">{t.callsPerMin}</TableCell>
                          <TableCell className="py-2 text-sm tabular-nums">{t.timePercent}%</TableCell>
                          <TableCell className={`py-2 text-sm font-medium ${status.className}`}>
                            {status.label}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="database">
        <Card>
          <CardContent className="p-0">
            {database.length === 0 ? (
              <EmptyState
                icon={<Database size={36} />}
                title="No Database Data"
                description="No database operations found for this time range."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Database Operation</TableHead>
                      <TableHead className="text-xs">Avg Duration</TableHead>
                      <TableHead className="text-xs">Calls/Min</TableHead>
                      <TableHead className="text-xs">Total Time %</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {database.map((d, i) => (
                      <TableRow key={i}>
                        <TableCell className="py-2 text-sm font-mono text-xs">{d.name}</TableCell>
                        <TableCell className="py-2 text-sm tabular-nums">{d.avgDuration} ms</TableCell>
                        <TableCell className="py-2 text-sm tabular-nums">{d.callsPerMin}</TableCell>
                        <TableCell className="py-2 text-sm tabular-nums">{d.timePercent}%</TableCell>
                        <TableCell className="py-2 text-sm">{d.type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="external">
        <Card>
          <CardContent className="p-0">
            {external.length === 0 ? (
              <EmptyState
                icon={<Globe size={36} />}
                title="No External Service Data"
                description="No external service calls found for this time range."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">External Service</TableHead>
                      <TableHead className="text-xs">Avg Response Time</TableHead>
                      <TableHead className="text-xs">Calls/Min</TableHead>
                      <TableHead className="text-xs">Total Time %</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {external.map((e, i) => {
                      const status = statusStyles[e.status] || statusStyles.good
                      return (
                        <TableRow key={i}>
                          <TableCell className="py-2 text-sm font-mono text-xs">{e.name}</TableCell>
                          <TableCell className="py-2 text-sm tabular-nums">{e.avgTime} ms</TableCell>
                          <TableCell className="py-2 text-sm tabular-nums">{e.callsPerMin}</TableCell>
                          <TableCell className="py-2 text-sm tabular-nums">{e.timePercent}%</TableCell>
                          <TableCell className={`py-2 text-sm font-medium ${status.className}`}>
                            {status.label}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="errors">
        <Card>
          <CardContent className="p-0">
            {errors.length === 0 ? (
              <EmptyState
                icon={<AlertTriangle size={36} />}
                title="No Errors Found"
                description="No errors found for this time range. Looking good!"
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs">Error Type</TableHead>
                      <TableHead className="text-xs">Error Message</TableHead>
                      <TableHead className="text-xs">Count</TableHead>
                      <TableHead className="text-xs">Last Occurrence</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errors.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="py-2 text-sm font-mono text-xs">{e.errorClass}</TableCell>
                        <TableCell className="py-2 text-sm text-muted-foreground">{e.errorMessage}</TableCell>
                        <TableCell className="py-2 text-sm tabular-nums">{e.count}</TableCell>
                        <TableCell className="py-2 text-sm text-muted-foreground">
                          {e.lastOccurrence ? new Date(e.lastOccurrence).toLocaleString() : "--"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
