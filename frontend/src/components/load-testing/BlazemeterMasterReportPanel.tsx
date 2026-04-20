import type { ReactElement, ReactNode, PointerEvent as ReactPointerEvent } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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

/**
 * Priority page labels the QA team cares about on the Request Stats tab.
 * Matched against the whole trimmed label (case-insensitive) — optionally
 * allowing a common JMeter step-number prefix like "01 - PDP" or "T03_PDP".
 * Substring match was too loose: short codes like "PDP" and "SFP" pulled
 * in every child sampler of the transaction.
 */
const KEY_PAGE_LABELS = [
  "Homepage",
  "Search Result BR",
  "Sort Page BR",
  "SFP",
  "PDP",
  "Cart Overview",
  "Shipping Page",
  "Payment Page",
]

const KEY_PAGE_SET = new Set(KEY_PAGE_LABELS.map((l) => l.toLowerCase()))

/** Strip a leading "NN ", "NN - ", "NN_", "TNN_", "TC-NN " etc. step prefix. */
function stripStepPrefix(label: string): string {
  return label.replace(/^\s*(?:T?C?-?\d{1,3})\s*[-_.:)]\s*/i, "").trim()
}

function matchesKeyPage(label: string | null): boolean {
  if (!label) return false
  const trimmed = label.trim().toLowerCase()
  if (KEY_PAGE_SET.has(trimmed)) return true
  const stripped = stripStepPrefix(label).toLowerCase()
  return KEY_PAGE_SET.has(stripped)
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

/** Two-handle range slider — mirrors BlazeMeter's time window control. */
function RangeSlider({
  min,
  max,
  value,
  onChange,
  onCommit,
  format,
  disabled,
}: {
  min: number
  max: number
  value: [number, number]
  onChange: (next: [number, number]) => void
  onCommit?: (next: [number, number]) => void
  format: (v: number) => string
  disabled?: boolean
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<"low" | "high" | null>(null)

  const span = Math.max(1, max - min)
  const pct = (v: number) => ((v - min) / span) * 100

  const handleDown =
    (handle: "low" | "high") =>
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      if (disabled) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      draggingRef.current = handle
    }

  const handleMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current || !trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const next = Math.round(min + ratio * span)
    if (draggingRef.current === "low") {
      onChange([Math.min(next, value[1] - 1), value[1]])
    } else {
      onChange([value[0], Math.max(next, value[0] + 1)])
    }
  }

  const handleUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return
    e.currentTarget.releasePointerCapture(e.pointerId)
    draggingRef.current = null
    onCommit?.(value)
  }

  return (
    <div className="w-full">
      <div ref={trackRef} className="relative h-10 touch-none select-none px-2">
        <div className="absolute left-2 right-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-muted" />
        <div
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-violet-500"
          style={{
            left: `calc(${pct(value[0])}% * (100% - 16px) / 100% + 8px)`,
            right: `calc((100% - ${pct(value[1])}%) * (100% - 16px) / 100% + 8px)`,
          }}
        />
        {(["low", "high"] as const).map((h) => (
          <button
            key={h}
            type="button"
            aria-label={h === "low" ? "Range start" : "Range end"}
            disabled={disabled}
            onPointerDown={handleDown(h)}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-violet-600 bg-background shadow-sm transition-transform active:cursor-grabbing active:scale-110 disabled:cursor-not-allowed"
            style={{
              left: `calc(${pct(h === "low" ? value[0] : value[1])}% * (100% - 16px) / 100% + 8px)`,
            }}
          />
        ))}
      </div>
      <div className="flex justify-between px-2 text-xs text-muted-foreground tabular-nums">
        <span>{format(value[0])}</span>
        <span>{format(value[1])}</span>
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

const RAMPUP_SKIP_SECONDS = 60

/** Pull start/end epoch (seconds) from a report, preferring the summary. */
function getReportBounds(
  r: BlazemeterMasterReport | null,
): [number, number] | null {
  if (!r) return null
  const start = r.summary?.startTime ?? r.master?.created ?? null
  const end = r.summary?.endTime ?? r.master?.ended ?? null
  if (start == null || end == null || end <= start) return null
  return [start, end]
}

export function BlazemeterMasterReportPanel({ masterId, testName, onClose }: Props) {
  // `fullReport` is the unfiltered whole-run result — we fetch it once and keep
  // it around purely so the slider always knows the full time bounds, even
  // after the displayed `report` is swapped for a time-filtered one.
  const [fullReport, setFullReport] = useState<BlazemeterMasterReport | null>(null)
  const [report, setReport] = useState<BlazemeterMasterReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [keyPagesOnly, setKeyPagesOnly] = useState(true)
  const [range, setRange] = useState<[number, number] | null>(null)

  const bounds = useMemo(() => getReportBounds(fullReport), [fullReport])

  // Initial unfiltered fetch — establishes bounds and a default skip-rampup range.
  useEffect(() => {
    if (masterId === null) {
      setFullReport(null)
      setReport(null)
      setError(null)
      setRange(null)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    api
      .getBlazemeterMasterReport(masterId)
      .then((r) => {
        if (cancelled) return
        setFullReport(r)
        setReport(r)
        const b = getReportBounds(r)
        if (b) {
          const [s, e] = b
          setRange(
            e - s > RAMPUP_SKIP_SECONDS ? [s + RAMPUP_SKIP_SECONDS, e] : [s, e],
          )
        }
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

  // Range-driven re-fetch (debounced). Skips when the range covers the whole run.
  useEffect(() => {
    if (masterId === null || !range || !bounds) return
    const [s, e] = bounds
    const [from, to] = range
    const coversWholeRun = from <= s && to >= e
    if (coversWholeRun) return

    let cancelled = false
    const handle = setTimeout(() => {
      setRefreshing(true)
      api
        .getBlazemeterMasterReport(masterId, { fromTs: from, toTs: to })
        .then((r) => {
          if (!cancelled) setReport(r)
        })
        .catch((err) => {
          if (!cancelled)
            setError(err instanceof Error ? err.message : "Failed to refresh report")
        })
        .finally(() => {
          if (!cancelled) setRefreshing(false)
        })
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(handle)
    }
  }, [masterId, range, bounds])

  const resetRange = useCallback(() => {
    if (!bounds) return
    const [s, e] = bounds
    setRange(
      e - s > RAMPUP_SKIP_SECONDS ? [s + RAMPUP_SKIP_SECONDS, e] : [s, e],
    )
  }, [bounds])

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

  const timelineMaxUsers = useMemo(() => {
    const values = chartData.map((d) => d.users ?? 0).filter((v) => v > 0)
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

  // Roll up the per-label aggregate — this is the source of truth whenever
  // BM honours the time filter on the aggregate endpoint but ignores it on
  // the summary endpoint (which seems to be the common case).
  const aggregateTotals = useMemo(() => {
    if (!labelRows.length) return null
    let samples = 0
    let errors = 0
    let weightedRt = 0
    let rtSamples = 0
    let kbPerSec = 0
    let haveKbps = false
    let minRt: number | null = null
    let maxRt: number | null = null
    for (const r of labelRows) {
      if (r.samples != null) samples += r.samples
      if (r.errors != null) errors += r.errors
      if (r.avgResponseTime != null && r.samples != null) {
        weightedRt += r.avgResponseTime * r.samples
        rtSamples += r.samples
      }
      if (r.avgBytes != null) {
        kbPerSec += r.avgBytes
        haveKbps = true
      }
      if (r.minResponseTime != null) {
        minRt = minRt == null ? r.minResponseTime : Math.min(minRt, r.minResponseTime)
      }
      if (r.maxResponseTime != null) {
        maxRt = maxRt == null ? r.maxResponseTime : Math.max(maxRt, r.maxResponseTime)
      }
    }
    return {
      samples,
      errors,
      errorRate: samples > 0 ? (errors / samples) * 100 : null,
      avgResponseTime: rtSamples > 0 ? weightedRt / rtSamples : null,
      kbPerSec: haveKbps ? kbPerSec : null,
      minRt,
      maxRt,
    }
  }, [labelRows])

  // Same rollup on the unfiltered baseline — lets us compare and decide
  // whether a filtered re-fetch actually changed the aggregate.
  const fullAggregateSamples = useMemo(() => {
    const rows = fullReport?.aggregate ?? []
    return rows.reduce((sum, r) => sum + (r.samples ?? 0), 0)
  }, [fullReport])

  const [s0, e0] = bounds ?? [null, null]
  const filterActive =
    bounds != null && range != null && (range[0] > (s0 ?? 0) || range[1] < (e0 ?? 0))
  const aggregateWasFiltered =
    filterActive &&
    aggregateTotals != null &&
    fullAggregateSamples > 0 &&
    aggregateTotals.samples !== fullAggregateSamples

  // Effective duration for rate KPIs — the slider window, not the whole run.
  const effectiveDuration =
    filterActive && range ? Math.max(1, range[1] - range[0]) : summary?.duration ?? null

  // Prefer aggregate-derived totals when the aggregate honoured the filter
  // but the summary endpoint didn't (a common BM asymmetry).
  const displayHits = aggregateWasFiltered
    ? aggregateTotals?.samples ?? null
    : summary?.hits ?? null
  const displayErrors = aggregateWasFiltered
    ? aggregateTotals?.errors ?? null
    : summary?.failed ?? null
  const displayErrorRate = aggregateWasFiltered
    ? aggregateTotals?.errorRate ?? null
    : summary?.errorRate ?? null
  const displayAvgRt = aggregateWasFiltered
    ? aggregateTotals?.avgResponseTime ?? null
    : summary?.avgResponseTime ?? null

  const maxUsers = summary?.maxUsers ?? master?.maxUsers ?? timelineMaxUsers
  const avgThroughput = (() => {
    if (aggregateWasFiltered && aggregateTotals?.samples != null && effectiveDuration) {
      return aggregateTotals.samples / effectiveDuration
    }
    if (summary?.avgThroughput != null) return summary.avgThroughput
    if (summary?.hits != null && summary?.duration) return summary.hits / summary.duration
    return null
  })()

  // Bandwidth: when the aggregate was filtered, its per-label KB/s sum is
  // the most accurate. Otherwise fall back through summary fields.
  const avgBandwidth = (() => {
    if (aggregateWasFiltered && aggregateTotals?.kbPerSec != null) {
      return aggregateTotals.kbPerSec * 1024 // convert KB/s -> bytes/s for the MiB/s tile
    }
    if (summary?.avgBandwidth != null) return summary.avgBandwidth
    if (summary?.totalBytes != null && summary?.duration) {
      return summary.totalBytes / summary.duration
    }
    if (
      summary?.avgBytesPerHit != null &&
      summary?.hits != null &&
      summary?.duration
    ) {
      return (summary.avgBytesPerHit * summary.hits) / summary.duration
    }
    if (summary?.duration && labelRows.length) {
      let totalBytes = 0
      let haveData = false
      for (const r of labelRows) {
        if (r.samples != null && r.avgBytes != null) {
          totalBytes += r.samples * r.avgBytes
          haveData = true
        }
      }
      if (haveData) return totalBytes / summary.duration
    }
    return null
  })()

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

      {report && !loading && bounds && range && (
        <div className="mt-5 rounded-lg border border-border bg-background/30 p-3">
          <div className="mb-1 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Time window</span>
              {refreshing && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-violet-500" />
                  Updating…
                </span>
              )}
              {(() => {
                const [s, e] = bounds
                const [from, to] = range
                const skippedStart = Math.max(0, from - s)
                const skippedEnd = Math.max(0, e - to)
                if (skippedStart === 0 && skippedEnd === 0) {
                  return <span>whole run</span>
                }
                return (
                  <span>
                    {fmtDuration(to - from)} window
                    {skippedStart > 0 && ` · skipped first ${fmtDuration(skippedStart)}`}
                    {skippedEnd > 0 && ` · skipped last ${fmtDuration(skippedEnd)}`}
                  </span>
                )
              })()}
            </div>
            <Button variant="ghost" size="sm" onClick={resetRange} className="h-7 text-xs">
              Reset
            </Button>
          </div>
          <RangeSlider
            min={bounds[0]}
            max={bounds[1]}
            value={range}
            onChange={setRange}
            format={fmtClock}
            disabled={refreshing}
          />
          {/* Diagnostic: fires only when the *aggregate* (what Request Stats
              reads) has the same total samples as the whole run — i.e. BM
              ignored the filter on the endpoint that actually drives the
              table. Summary-endpoint mismatches are handled silently by
              recomputing KPIs from the aggregate. */}
          {!refreshing &&
            filterActive &&
            aggregateTotals != null &&
            fullAggregateSamples > 0 &&
            aggregateTotals.samples === fullAggregateSamples && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>
                  BlazeMeter returned the same per-label stats as the full run —
                  Request Stats may still reflect the whole run.
                </span>
              </div>
            )}
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
                value={avgThroughput != null ? avgThroughput.toFixed(2) : "—"}
                unit="Hits/s"
                label="Avg. Throughput"
              />
              <Kpi
                accent="red"
                value={
                  displayErrorRate != null
                    ? fmtPct(displayErrorRate).replace("%", "")
                    : "0"
                }
                unit="%"
                label="Errors"
              />
              <Kpi
                accent="amber"
                value={
                  displayAvgRt != null ? Math.round(displayAvgRt).toString() : "—"
                }
                unit="ms"
                label="Avg. Response Time"
              />
              <Kpi
                accent="amber"
                value={
                  aggregateWasFiltered
                    ? "—"
                    : summary?.p90 != null
                      ? Math.round(summary.p90).toString()
                      : "—"
                }
                unit={aggregateWasFiltered ? "" : "ms"}
                label={aggregateWasFiltered ? "90% Response Time (whole run)" : "90% Response Time"}
              />
              <Kpi
                accent="amber"
                value={avgBandwidth != null ? (avgBandwidth / (1024 * 1024)).toFixed(2) : "—"}
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
                <MetaRow icon={<Tag className="h-3.5 w-3.5" />} label="Samples">
                  {fmtNum(displayHits)} hits · {fmtNum(displayErrors)} errors
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
              <>
                {(() => {
                  const filtered = keyPagesOnly
                    ? labelRows.filter((r) => matchesKeyPage(r.labelName))
                    : labelRows
                  return (
                    <>
                      <div className="mb-3 flex items-center justify-between gap-3 text-xs">
                        <span className="text-muted-foreground">
                          Showing {filtered.length} of {labelRows.length} labels
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setKeyPagesOnly((v) => !v)}
                        >
                          {keyPagesOnly ? "Show all labels" : "Show key pages only"}
                        </Button>
                      </div>
                      {filtered.length === 0 ? (
                        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                          No labels matched the key-page filter. Try "Show all labels".
                        </p>
                      ) : (
                        <div className="overflow-x-auto rounded-md border border-border">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50">
                                <TableHead>Label</TableHead>
                                <TableHead className="text-right"># Samples</TableHead>
                                <TableHead className="text-right">Avg. Response Time (ms)</TableHead>
                                <TableHead className="text-right">Avg. Hits/s</TableHead>
                                <TableHead className="text-right">90% line (ms)</TableHead>
                                <TableHead className="text-right">95% line (ms)</TableHead>
                                <TableHead className="text-right">99% line (ms)</TableHead>
                                <TableHead className="text-right">Min Response Time (ms)</TableHead>
                                <TableHead className="text-right">Max Response Time (ms)</TableHead>
                                <TableHead className="text-right">
                                  Avg. Bandwidth (KBytes/s)
                                </TableHead>
                                <TableHead className="text-right">Error Percentage</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filtered.map((r, i) => {
                                const errPct =
                                  r.errorRate != null
                                    ? r.errorRate <= 1
                                      ? r.errorRate * 100
                                      : r.errorRate
                                    : null
                                // BM's aggregate `avgBytes` field is already in KB/s
                                // (matches its "Avg. Bandwidth (KBytes/s)" column). Do not divide.
                                const kbPerSec = r.avgBytes
                                return (
                                  <TableRow
                                    key={r.labelId ?? i}
                                    className="odd:bg-background even:bg-muted/30 hover:bg-muted/60"
                                  >
                                    <TableCell
                                      className="max-w-[340px] truncate text-xs font-medium"
                                      title={r.labelName ?? ""}
                                    >
                                      {r.labelName ?? "—"}
                                    </TableCell>
                                    <TableCell className="text-right text-xs tabular-nums">
                                      {fmtNum(r.samples)}
                                    </TableCell>
                                    <TableCell className="text-right text-xs tabular-nums">
                                      {r.avgResponseTime != null
                                        ? fmtNum(Math.round(r.avgResponseTime))
                                        : "—"}
                                    </TableCell>
                                    <TableCell className="text-right text-xs tabular-nums">
                                      {r.avgThroughput != null
                                        ? r.avgThroughput.toFixed(2)
                                        : "—"}
                                    </TableCell>
                                    <TableCell className="text-right text-xs tabular-nums">
                                      {r.p90 != null ? fmtNum(Math.round(r.p90)) : "—"}
                                    </TableCell>
                                    <TableCell className="text-right text-xs tabular-nums">
                                      {r.p95 != null ? fmtNum(Math.round(r.p95)) : "—"}
                                    </TableCell>
                                    <TableCell className="text-right text-xs tabular-nums">
                                      {r.p99 != null ? fmtNum(Math.round(r.p99)) : "—"}
                                    </TableCell>
                                    <TableCell className="text-right text-xs tabular-nums">
                                      {r.minResponseTime != null
                                        ? fmtNum(Math.round(r.minResponseTime))
                                        : "—"}
                                    </TableCell>
                                    <TableCell className="text-right text-xs tabular-nums">
                                      {r.maxResponseTime != null
                                        ? fmtNum(Math.round(r.maxResponseTime))
                                        : "—"}
                                    </TableCell>
                                    <TableCell className="text-right text-xs tabular-nums">
                                      {kbPerSec != null ? kbPerSec.toFixed(2) : "—"}
                                    </TableCell>
                                    <TableCell
                                      className={`text-right text-xs tabular-nums ${
                                        errPct != null && errPct > 0
                                          ? "font-semibold text-destructive"
                                          : ""
                                      }`}
                                    >
                                      {errPct != null ? `${errPct.toFixed(2)}%` : "—"}
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </>
                  )
                })()}
              </>
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
