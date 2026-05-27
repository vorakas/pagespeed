import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { EmptyState } from "@/components/shared/EmptyState"
import { Database, Globe, AlertTriangle, Activity } from "lucide-react"

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

const statusStyles: Record<string, { label: string; color: string }> = {
  good: { label: "Good", color: "var(--lcc-green)" },
  warning: { label: "Slow", color: "var(--lcc-amber)" },
  critical: { label: "Critical", color: "var(--lcc-red)" },
}

export function ApmMetrics({ data }: ApmMetricsProps) {
  if (!data) return null

  const transactions = (data.transactions || []) as Transaction[]
  const database = (data.database || []) as DbOperation[]
  const external = (data.external || []) as ExternalCall[]
  const errors = (data.errors || []) as ErrorEntry[]

  return (
    <Tabs defaultValue="transactions">
      <TabsList className="aurora-tabs-list">
        <TabsTrigger value="transactions" className="aurora-tabs-trigger">Transactions</TabsTrigger>
        <TabsTrigger value="database" className="aurora-tabs-trigger">Database</TabsTrigger>
        <TabsTrigger value="external" className="aurora-tabs-trigger">External Services</TabsTrigger>
        <TabsTrigger value="errors" className="aurora-tabs-trigger">Errors</TabsTrigger>
      </TabsList>

      <TabsContent value="transactions">
        <div className="aurora-panel overflow-hidden">
          {transactions.length === 0 ? (
            <EmptyState
              icon={<Activity size={36} />}
              title="No Transaction Data"
              description="No transactions found for this time range."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="aurora-table">
                <thead>
                  <tr>
                    <th>Transaction Name</th>
              <th>Avg Duration</th>
                    <th>Calls/Min</th>
                    <th>Total Time %</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t, i) => {
                    const status = statusStyles[t.status] || statusStyles.good
                    return (
                      <tr key={i}>
                        <td><span className="aurora-num">{t.name}</span></td>
                        <td><span className="aurora-num">{t.avgTime} ms</span></td>
                        <td><span className="aurora-num">{t.callsPerMin}</span></td>
                        <td><span className="aurora-num">{t.timePercent}%</span></td>
                        <td className="font-medium" style={{ color: status.color }}>
                          {status.label}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="database">
        <div className="aurora-panel overflow-hidden">
          {database.length === 0 ? (
            <EmptyState
              icon={<Database size={36} />}
              title="No Database Data"
              description="No database operations found for this time range."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="aurora-table">
                <thead>
                  <tr>
                    <th>Database Operation</th>
                    <th>Avg Duration</th>
                    <th>Calls/Min</th>
                    <th>Total Time %</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {database.map((d, i) => (
                    <tr key={i}>
                      <td><span className="aurora-num">{d.name}</span></td>
                      <td><span className="aurora-num">{d.avgDuration} ms</span></td>
                      <td><span className="aurora-num">{d.callsPerMin}</span></td>
                      <td><span className="aurora-num">{d.timePercent}%</span></td>
                      <td className="aurora-text-dim">{d.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="external">
        <div className="aurora-panel overflow-hidden">
          {external.length === 0 ? (
            <EmptyState
              icon={<Globe size={36} />}
              title="No External Service Data"
              description="No external service calls found for this time range."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="aurora-table">
                <thead>
                  <tr>
                    <th>External Service</th>
              <th>Avg Duration</th>
                    <th>Calls/Min</th>
                    <th>Total Time %</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {external.map((e, i) => {
                    const status = statusStyles[e.status] || statusStyles.good
                    return (
                      <tr key={i}>
                        <td><span className="aurora-num">{e.name}</span></td>
                        <td><span className="aurora-num">{e.avgTime} ms</span></td>
                        <td><span className="aurora-num">{e.callsPerMin}</span></td>
                        <td><span className="aurora-num">{e.timePercent}%</span></td>
                        <td className="font-medium" style={{ color: status.color }}>
                          {status.label}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </TabsContent>

      <TabsContent value="errors">
        <div className="aurora-panel overflow-hidden">
          {errors.length === 0 ? (
            <EmptyState
              icon={<AlertTriangle size={36} />}
              title="No Errors Found"
              description="No errors found for this time range. Looking good!"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="aurora-table">
                <thead>
                  <tr>
                    <th>Error Type</th>
                    <th>Error Message</th>
                    <th>Count</th>
                    <th>Last Occurrence</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((e, i) => (
                    <tr key={i}>
                      <td><span className="aurora-num">{e.errorClass}</span></td>
                      <td className="aurora-text-dim">{e.errorMessage}</td>
                      <td><span className="aurora-num">{e.count}</span></td>
                      <td className="aurora-text-faint">
                        {e.lastOccurrence ? new Date(e.lastOccurrence).toLocaleString() : "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  )
}
