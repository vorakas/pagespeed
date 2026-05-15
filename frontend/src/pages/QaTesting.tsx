import { useEffect, useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { AlertCircle, ChevronDown, ClipboardCheck, Loader2, RefreshCw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { Progress } from "@/components/ui/progress"
import { api } from "@/services/api"
import type { QaTaskStatusChange, QaTestCycle, QaTestingReport } from "@/types"

type Preset = "24h" | "sinceYesterday" | "today" | "yesterday" | "7d" | "custom"

function toLocalPickerValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return offsetDate.toISOString().slice(0, 16)
}

function fromLocalPickerValue(value: string) {
  return new Date(value).toISOString()
}

function formatDateTime(value?: string | null) {
  if (!value) return "Not executed"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value))
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(`${value}T00:00:00`))
}

function statusClass(status: string) {
  const normalized = status.toLowerCase()
  if (["pass", "passed", "done"].includes(normalized)) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  if (["fail", "failed"].includes(normalized)) return "bg-red-500/10 text-red-700 dark:text-red-300"
  if (normalized.includes("progress")) return "bg-blue-500/10 text-blue-700 dark:text-blue-300"
  if (normalized.includes("blocked")) return "bg-amber-500/10 text-amber-700 dark:text-amber-300"
  return "bg-muted text-muted-foreground"
}

function applyPreset(preset: Preset) {
  const now = new Date()
  if (preset === "24h") {
    return { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now }
  }
  if (preset === "sinceYesterday") {
    const start = new Date(now)
    start.setDate(start.getDate() - 1)
    start.setHours(0, 0, 0, 0)
    return { start, end: now }
  }
  if (preset === "today") {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return { start, end: now }
  }
  if (preset === "yesterday") {
    const start = new Date(now)
    start.setDate(start.getDate() - 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }
  if (preset === "7d") {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return { start, end: now }
  }
  return { start: new Date(now.getTime() - 24 * 60 * 60 * 1000), end: now }
}

function SummaryCard({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{detail}</CardContent>
    </Card>
  )
}

function CycleCard({ cycle }: { cycle: QaTestCycle }) {
  const statusEntries = Object.entries(cycle.statusCounts)
  return (
    <details className="group rounded-lg border border-border bg-card">
      <summary className="grid cursor-pointer gap-4 p-4 md:grid-cols-[minmax(0,1fr)_16rem_2rem]">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{cycle.name}</span>
            <Badge variant="outline">{cycle.key}</Badge>
            <Badge className={statusClass(cycle.status)}>{cycle.status}</Badge>
          </div>
          <div className="text-sm text-muted-foreground">{cycle.folder}</div>
          <div className="flex flex-wrap gap-2">
            {statusEntries.map(([status, count]) => (
              <Badge key={status} variant="outline" className={statusClass(status)}>
                {status}: {count}
              </Badge>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Overall progress</span>
            <span className="font-medium tabular-nums">{cycle.progressPercent}%</span>
          </div>
          <Progress value={cycle.progressPercent} />
          <div className="text-xs text-muted-foreground">
            {cycle.executedInRange} executed in range · {cycle.totalCases} total
          </div>
        </div>
        <ChevronDown className="mt-1 h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border">
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Test Case</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Executed</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {cycle.testCases.map((testCase) => (
                <tr key={`${cycle.key}-${testCase.key}`} className={testCase.inRange ? "bg-primary/5" : ""}>
                  <td className="max-w-xl px-4 py-3">
                    <div className="font-medium">{testCase.key}</div>
                    <div className="text-muted-foreground">{testCase.name || "Name unavailable"}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={statusClass(testCase.status)}>{testCase.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{testCase.assignedTo || "Unassigned"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{testCase.executedBy || "-"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(testCase.executedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  )
}

function TaskMovementTable({ changes }: { changes: QaTaskStatusChange[] }) {
  if (changes.length === 0) {
    return <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No task status changes matched this range.</div>
  }
  return (
    <div className="overflow-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Task</th>
            <th className="px-4 py-3">Transition</th>
            <th className="px-4 py-3">Assignee</th>
            <th className="px-4 py-3">Changed</th>
          </tr>
        </thead>
        <tbody>
          {changes.map((change, index) => (
            <tr key={`${change.key}-${change.changedAt}-${index}`} className="border-t border-border">
              <td className="max-w-xl px-4 py-3">
                <div className="font-medium">{change.key}</div>
                <div className="text-muted-foreground">{change.summary}</div>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{change.fromStatus}</Badge>
                  <span className="text-muted-foreground">to</span>
                  <Badge className={statusClass(change.toStatus)}>{change.toStatus}</Badge>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{change.assignee || "Unassigned"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDateTime(change.changedAt)}
                {change.changedBy ? ` by ${change.changedBy}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function QaTesting() {
  const initialRange = useMemo(() => applyPreset("24h"), [])
  const [preset, setPreset] = useState<Preset>("24h")
  const [start, setStart] = useState(toLocalPickerValue(initialRange.start))
  const [end, setEnd] = useState(toLocalPickerValue(initialRange.end))
  const [report, setReport] = useState<QaTestingReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadReport(forceRefresh = false) {
    setLoading(true)
    setError(null)
    try {
      setReport(await api.getQaTestingReport(
        fromLocalPickerValue(start),
        fromLocalPickerValue(end),
        forceRefresh,
        "sinceYesterday",
      ))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load QA testing report")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handlePreset(nextPreset: Preset) {
    setPreset(nextPreset)
    if (nextPreset === "custom") return
    const next = applyPreset(nextPreset)
    setStart(toLocalPickerValue(next.start))
    setEnd(toLocalPickerValue(next.end))
  }

  const groupedCycles = useMemo(() => {
    const groups = new Map<string, QaTestCycle[]>()
    for (const cycle of report?.cycles ?? []) {
      groups.set(cycle.section, [...(groups.get(cycle.section) ?? []), cycle])
    }
    return Array.from(groups.entries())
  }, [report])

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <ClipboardCheck className="h-4 w-4" />
            Adobe Commerce E2E
          </div>
          <h1 className="font-heading text-2xl font-semibold tracking-normal">QA Testing</h1>
          <p className="text-sm text-muted-foreground">
            Round-based test cycle progress and Jira task movement for Lamps Plus Features.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <span className="pb-2 text-sm font-medium text-foreground">Range:</span>
          <div className="flex rounded-md border border-border p-1">
            {(["24h", "sinceYesterday", "today", "yesterday", "7d"] as Preset[]).map((option) => (
              <Button
                key={option}
                type="button"
                variant={preset === option ? "default" : "ghost"}
                size="sm"
                className={preset === option ? "text-black hover:text-black" : undefined}
                onClick={() => handlePreset(option)}
              >
                {option === "24h" ? "Last 24h" : option === "sinceYesterday" ? "Since yesterday" : option === "7d" ? "7d" : option}
              </Button>
            ))}
          </div>
          <DateTimePicker value={start} onChange={(value) => { setPreset("custom"); setStart(value) }} />
          <DateTimePicker value={end} onChange={(value) => { setPreset("custom"); setEnd(value) }} />
          <Button onClick={() => loadReport(true)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh from Jira
          </Button>
        </div>
      </div>

      {report?.cache?.lastRefreshedAt ? (
        <div className="text-sm text-muted-foreground">
          Jira data refreshed {formatDateTime(report.cache.lastRefreshedAt)}
          {report.cache.hit ? " from cache" : ""}. Cached for {Math.round(report.cache.ttlSeconds / 60)} minutes.
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      {report ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="Cycles" value={report.summary.cycleCount} detail="Round cycles in Adobe Commerce E2E" />
            <SummaryCard label="Total Cases" value={report.summary.totalCases} detail={`${report.summary.remainingCases} remaining overall`} />
            <SummaryCard label="Overall Progress" value={`${report.summary.progressPercent}%`} detail={`${report.summary.executedCases} cases executed`} />
            <SummaryCard label="Range Progress" value={`${report.summary.rangeProgressPercent}%`} detail={`${report.summary.executedInRange} cases executed in range`} />
            <SummaryCard label="Task Movement" value={report.summary.taskStatusChanges} detail="Jira status changes in range" />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Burndown</CardTitle>
              <CardDescription>Executed test cases and remaining cases across the selected range.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={report.burndown} margin={{ left: 4, right: 16, top: 12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tickFormatter={formatDate} className="text-xs" />
                  <YAxis allowDecimals={false} className="text-xs" />
                  <Tooltip labelFormatter={formatDate} />
                  <Area type="monotone" dataKey="remaining" stackId="1" stroke="#ef4444" fill="#ef444433" name="Remaining" />
                  <Area type="monotone" dataKey="executed" stackId="2" stroke="#10b981" fill="#10b98133" name="Executed" />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <section className="space-y-3">
            <div>
              <h2 className="font-heading text-xl font-semibold tracking-normal">Test Cycle Progress</h2>
              <p className="text-sm text-muted-foreground">Expand a cycle to inspect every included test case and its current status.</p>
            </div>
            {groupedCycles.map(([section, cycles]) => (
              <div key={section} className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{section}</h3>
                {cycles.map((cycle) => <CycleCard key={cycle.key} cycle={cycle} />)}
              </div>
            ))}
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Jira Task Movement</CardTitle>
              <CardDescription>
                Tasks in the configured ACE2E epics whose status changed since Jira startOfDay(-1).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TaskMovementTable changes={report.taskMovement.changes} />
            </CardContent>
          </Card>
        </>
      ) : loading ? (
        <div className="flex min-h-[20rem] items-center justify-center rounded-lg border border-border">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : null}
    </div>
  )
}
