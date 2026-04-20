import type { ReactElement, ReactNode } from "react"
import { useEffect, useMemo, useState } from "react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  MapPin,
  PlayCircle,
  StopCircle,
  Tag,
  X,
  XCircle,
} from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { api } from "@/services/api"
import type { BlazemeterMasterReport } from "@/types"

interface Props {
  masterId: number | null
  testName?: string | null
  onClose: () => void
}

function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—"
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

function fmtMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return "—"
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function fmtPct(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return "—"
  const pct = rate <= 1 ? rate * 100 : rate
  return `${pct.toFixed(2)}%`
}

function fmtDuration(seconds: number | null | undefined): string {
  if (!seconds) return "—"
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function fmtDateTime(epoch: number | null | undefined): string {
  if (!epoch) return "—"
  const ms = epoch > 1e12 ? epoch : epoch * 1000
  return new Date(ms).toLocaleString()
}

function fmtClock(epoch: number | null | undefined): string {
  if (!epoch) return ""
  const ms = epoch > 1e12 ? epoch : epoch * 1000
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

/** KPI tile with a colored accent bar on the left, matching BlazeMeter's summary cards. */
function Kpi({
  accent,
  value,
  unit,
  label,
}: {
  accent: "green" | "amber" | "red" | "violet"
  value: string
  unit?: string
  label: string
}) {
  const accentClass = {
    green: "bg-green-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    violet: "bg-violet-500",
  }[accent]
  return (
    <div className="relative flex items-center overflow-hidden rounded-lg border border-border bg-background/50 px-4 py-3">
      <span className={`absolute left-0 top-0 h-full w-1 ${accentClass}`} aria-hidden />
      <div className="min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold leading-none text-foreground">{value}</span>
          {unit && <span className="text-xs font-medium text-muted-foreground">{unit}</span>}
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

function MetaRow({
  icon,
  label,
  children,
}: {
  icon?: ReactNode
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-3 text-sm">
      <div className="flex w-36 flex-shrink-0 items-center gap-1.5 text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="min-w-0 flex-1 text-foreground">{children}</div>
    </div>
  )
}

export function BlazemeterMasterReportPanel({ masterId, testName, onClose }: Props) {
  const [report, setReport] = useState<BlazemeterMasterReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (masterId === null) {
      setReport(null)
      setError(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .getBlazemeterMasterReport(masterId)
      .then((r) => {
        if (!cancelled) setReport(r)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load report")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [masterId])

  const chartData = useMemo(() => {
    const points = report?.timeline?.points ?? []
    return points.map((p, i) => {
      const tVal = typeof p.t === "number" ? p.t : i
      const errPct =
        p.errorRate === null || p.errorRate === undefined
          ? null
          : p.errorRate <= 1
            ? p.errorRate * 100
            : p.errorRate
      const errorsAbs =
        errPct !== null && p.hits !== null && p.hits !== undefined
          ? Math.round((errPct / 100) * p.hits)
          : null
      return {
        idx: i,
        t: tVal,
        label: typeof p.t === "number" ? fmtClock(p.t) : String(i),
        avgResponseTime: p.avgResponseTime,
        errorRate: errPct,
        errors: errorsAbs,
        users: p.users,
        hits: p.hits,
      }
    })
  }, [report])

  const maxUsers = useMemo(() => {
    const values = chartData.map((d) => d.users ?? 0)
    return values.length ? Math.max(...values) : null
  }, [chartData])

  if (masterId === null) return null

  const summary = report?.summary ?? null
  const ciPassed = report?.ciStatus?.passed
  const ciFailures = report?.ciStatus?.failures ?? []
  const thresholds = report?.thresholds ?? []
  const labelRows = report?.aggregate ?? []
  const errorRows = report?.errors ?? []
  const master = report?.master ?? null
  const fetchErrors = report?.fetchErrors ?? {}

  const title = testName || master?.name || `Master ${masterId}`
  const startedEpoch = summary?.startTime ?? master?.created ?? null
  const endedEpoch = summary?.endTime ?? master?.ended ?? null

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Master <code className="rounded bg-muted px-1 py-0.5">{masterId}</code>
            </span>
            {ciPassed === true && (
              <Badge variant="outline" className="gap-1 border-green-600/40 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                CI passed
              </Badge>
            )}
            {ciPassed === false && (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="h-3 w-3" />
                CI failed
              </Badge>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {master?.publicTokenUrl && (
            <Button asChild variant="outline" size="sm">
              <a href={master.publicTokenUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1 h-3.5 w-3.5" />
                Open in BlazeMeter
              </a>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close report">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading && (
        <div className="py-12">
          <LoadingSpinner />
        </div>
      )}

      {error && !loading && (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {report && !loading && (
        <Tabs defaultValue="summary" className="mt-5">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="stats">Request Stats</TabsTrigger>
            <TabsTrigger value="errors">
              Errors
              {errorRows.length > 0 && (
                <span className="ml-1.5 rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                  {errorRows.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="mt-5 space-y-6">
            {/* KPI tile row */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Kpi accent="green" value={fmtNum(maxUsers)} unit="VU" label="Max Users" />
              <Kpi
                accent="green"
                value={summary?.avgThroughput != null ? summary.avgThroughput.toFixed(2) : "—"}
                unit="Hits/s"
                label="Avg. Throughput"
              />
              <Kpi
                accent="red"
                value={summary?.errorRate != null ? fmtPct(summary.errorRate).replace("%", "") : "0"}
                unit="%"
                label="Errors"
              />
              <Kpi
                accent="amber"
                value={
                  summary?.avgResponseTime != null ? Math.round(summary.avgResponseTime).toString() : "—"
                }
                unit="ms"
                label="Avg. Response Time"
              />
              <Kpi
                accent="amber"
                value={summary?.p90 != null ? Math.round(summary.p90).toString() : "—"}
                unit="ms"
                label="90% Response Time"
              />
              <Kpi
                accent="amber"
                value={
                  summary?.avgBandwidth != null
                    ? (summary.avgBandwidth / (1024 * 1024)).toFixed(2)
                    : "—"
                }
                unit="MiB/s"
                label="Avg. Bandwidth"
              />
            </div>

            {/* Meta info */}
            <div className="grid gap-3 rounded-lg border border-border bg-background/30 p-4 md:grid-cols-2">
              <div className="space-y-2.5">
                <MetaRow icon={<Clock className="h-3.5 w-3.5" />} label="Duration">
                  {fmtDuration(summary?.duration ?? null)}
                </MetaRow>
                <MetaRow icon={<PlayCircle className="h-3.5 w-3.5" />} label="Started">
                  {fmtDateTime(startedEpoch)}
                </MetaRow>
                <MetaRow icon={<StopCircle className="h-3.5 w-3.5" />} label="Ended">
                  {fmtDateTime(endedEpoch)}
                </MetaRow>
              </div>
              <div className="space-y-2.5">
                {master?.note && (
                  <MetaRow icon={<Tag className="h-3.5 w-3.5" />} label="Note">
                    {master.note}
                  </MetaRow>
                )}
                <MetaRow icon={<MapPin className="h-3.5 w-3.5" />} label="Report Status">
                  <span className="capitalize">{master?.reportStatus ?? "—"}</span>
                </MetaRow>
                <MetaRow icon={<Tag className="h-3.5 w-3.5" />} label="Samples">
                  {fmtNum(summary?.hits ?? null)} hits · {fmtNum(summary?.failed ?? null)} errors
                </MetaRow>
              </div>
            </div>

            {/* Side-by-side charts */}
            {chartData.length > 0 && (
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard title="Load">
                  <ComposedChart data={chartData}>
                    <defs>
                      <linearGradient id="bmUsersL" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                      formatter={(val: number | string, name: string) => {
                        if (name === "Users") return [fmtNum(Number(val)), "Users"]
                        if (name === "Hits/s") return [`${Number(val).toFixed(2)}`, "Hits/s"]
                        if (name === "Errors") return [fmtNum(Number(val)), "Errors"]
                        return [val, name]
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="users"
                      name="Users"
                      stroke="#a78bfa"
                      fill="url(#bmUsersL)"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="hits"
                      name="Hits/s"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="errors"
                      name="Errors"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ChartCard>

                <ChartCard title="Response Time">
                  <ComposedChart data={chartData}>
                    <defs>
                      <linearGradient id="bmUsersR" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                      formatter={(val: number | string, name: string) => {
                        if (name === "Users") return [fmtNum(Number(val)), "Users"]
                        if (name === "Response Time") return [fmtMs(Number(val)), "Response Time"]
                        return [val, name]
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="users"
                      name="Users"
                      stroke="#a78bfa"
                      fill="url(#bmUsersR)"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="avgResponseTime"
                      name="Response Time"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ChartCard>
              </div>
            )}

            {/* CI gates */}
            {((ciPassed !== null && ciPassed !== undefined) ||
              thresholds.length > 0 ||
              ciFailures.length > 0) && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pass / fail gates
                </h3>
                {ciFailures.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {ciFailures.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs"
                      >
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-destructive" />
                        <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-destructive">
                          {JSON.stringify(f, null, 2)}
                        </pre>
                      </div>
                    ))}
                  </div>
                )}
                {thresholds.length > 0 && (
                  <div className="rounded-md border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Threshold</TableHead>
                          <TableHead className="w-24 text-right">Result</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {thresholds.map((t, i) => {
                          const passed =
                            (t as Record<string, unknown>).success === true ||
                            (t as Record<string, unknown>).passed === true
                          const failed =
                            (t as Record<string, unknown>).success === false ||
                            (t as Record<string, unknown>).passed === false
                          return (
                            <TableRow key={i}>
                              <TableCell className="text-xs">
                                <code className="break-all">{JSON.stringify(t)}</code>
                              </TableCell>
                              <TableCell className="text-right">
                                {passed && (
                                  <Badge
                                    variant="outline"
                                    className="border-green-600/40 text-green-600"
                                  >
                                    Pass
                                  </Badge>
                                )}
                                {failed && <Badge variant="destructive">Fail</Badge>}
                                {!passed && !failed && "—"}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            {Object.keys(fetchErrors).length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Sections that failed to load
                </h3>
                <ul className="space-y-1 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
                  {Object.entries(fetchErrors).map(([section, msg]) => (
                    <li key={section}>
                      <span className="font-semibold">{section}:</span> {msg}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          <TabsContent value="stats" className="mt-5">
            {labelRows.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No per-label stats available.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead className="text-right">Samples</TableHead>
                      <TableHead className="text-right">Errors</TableHead>
                      <TableHead className="text-right">Err %</TableHead>
                      <TableHead className="text-right">Avg</TableHead>
                      <TableHead className="text-right">p90</TableHead>
                      <TableHead className="text-right">p95</TableHead>
                      <TableHead className="text-right">p99</TableHead>
                      <TableHead className="text-right">Max</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {labelRows.map((r, i) => (
                      <TableRow key={r.labelId ?? i}>
                        <TableCell
                          className="max-w-[420px] truncate text-xs"
                          title={r.labelName ?? ""}
                        >
                          {r.labelName ?? "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs">{fmtNum(r.samples)}</TableCell>
                        <TableCell className="text-right text-xs">{fmtNum(r.errors)}</TableCell>
                        <TableCell className="text-right text-xs">
                          {fmtPct(r.errorRate)}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {fmtMs(r.avgResponseTime)}
                        </TableCell>
                        <TableCell className="text-right text-xs">{fmtMs(r.p90)}</TableCell>
                        <TableCell className="text-right text-xs">{fmtMs(r.p95)}</TableCell>
                        <TableCell className="text-right text-xs">{fmtMs(r.p99)}</TableCell>
                        <TableCell className="text-right text-xs">
                          {fmtMs(r.maxResponseTime)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          <TabsContent value="errors" className="mt-5">
            {errorRows.length === 0 ? (
              <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                No errors recorded.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead className="w-24">Code</TableHead>
                      <TableHead className="w-24 text-right">Count</TableHead>
                      <TableHead>Message</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {errorRows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{r.labelName ?? "—"}</TableCell>
                        <TableCell className="text-xs">{r.errorCode ?? "—"}</TableCell>
                        <TableCell className="text-right text-xs">{fmtNum(r.count)}</TableCell>
                        <TableCell
                          className="max-w-[560px] truncate text-xs"
                          title={r.message ?? ""}
                        >
                          {r.message ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </section>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactElement }) {
  return (
    <div className="rounded-lg border border-border bg-background/30 p-3">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}
