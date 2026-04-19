import { useEffect, useMemo, useState } from "react"
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
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

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/50 p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
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
    return points.map((p, i) => ({
      idx: i,
      t: typeof p.t === "number" ? p.t : i,
      avgResponseTime: p.avgResponseTime,
      errorRate:
        p.errorRate === null || p.errorRate === undefined
          ? null
          : p.errorRate <= 1
            ? p.errorRate * 100
            : p.errorRate,
      users: p.users,
      hits: p.hits,
    }))
  }, [report])

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

  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-foreground">{title}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              Master <code className="rounded bg-muted px-1 py-0.5">{masterId}</code>
            </span>
            {master?.ended != null && (
              <span>Ended: {new Date(master.ended * 1000).toLocaleString()}</span>
            )}
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
        <div className="mt-5 space-y-6">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Summary
            </h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
              <Tile label="Hits" value={fmtNum(summary?.hits ?? null)} />
              <Tile
                label="Errors"
                value={fmtNum(summary?.failed ?? null)}
                sub={fmtPct(summary?.errorRate ?? null)}
              />
              <Tile label="Avg RT" value={fmtMs(summary?.avgResponseTime ?? null)} />
              <Tile label="p90 RT" value={fmtMs(summary?.p90 ?? null)} />
              <Tile label="p95 RT" value={fmtMs(summary?.p95 ?? null)} />
              <Tile
                label="Throughput"
                value={
                  summary?.avgThroughput != null
                    ? `${fmtNum(summary.avgThroughput, 1)} /s`
                    : "—"
                }
              />
              <Tile label="p50 RT" value={fmtMs(summary?.p50 ?? null)} />
              <Tile label="p99 RT" value={fmtMs(summary?.p99 ?? null)} />
              <Tile label="Min RT" value={fmtMs(summary?.minResponseTime ?? null)} />
              <Tile label="Max RT" value={fmtMs(summary?.maxResponseTime ?? null)} />
              <Tile label="Avg latency" value={fmtMs(summary?.avgLatency ?? null)} />
              <Tile label="Duration" value={fmtDuration(summary?.duration ?? null)} />
            </div>
          </div>

          {chartData.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Timeline
              </h3>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData}>
                    <defs>
                      <linearGradient id="bmRt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis
                      dataKey="idx"
                      tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                    />
                    <YAxis
                      yAxisId="rt"
                      tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                      label={{
                        value: "ms",
                        position: "insideLeft",
                        fontSize: 10,
                        fill: "var(--color-muted-foreground)",
                      }}
                    />
                    <YAxis
                      yAxisId="err"
                      orientation="right"
                      tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
                      label={{
                        value: "%",
                        position: "insideRight",
                        fontSize: 10,
                        fill: "var(--color-muted-foreground)",
                      }}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-popover)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 6,
                        fontSize: 12,
                      }}
                      formatter={(val: number | string, name: string) => {
                        if (name === "avgResponseTime") return [fmtMs(Number(val)), "Avg RT"]
                        if (name === "errorRate") return [`${Number(val).toFixed(2)}%`, "Error %"]
                        if (name === "users") return [fmtNum(Number(val)), "Users"]
                        return [val, name]
                      }}
                    />
                    <Area
                      yAxisId="rt"
                      type="monotone"
                      dataKey="avgResponseTime"
                      stroke="var(--color-primary)"
                      fill="url(#bmRt)"
                      strokeWidth={2}
                    />
                    <Line
                      yAxisId="err"
                      type="monotone"
                      dataKey="errorRate"
                      stroke="var(--color-destructive)"
                      strokeWidth={1.5}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

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

          {labelRows.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Per-label stats
              </h3>
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
            </div>
          )}

          {errorRows.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Errors
              </h3>
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
        </div>
      )}
    </section>
  )
}
