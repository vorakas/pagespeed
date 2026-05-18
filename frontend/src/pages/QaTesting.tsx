import { useEffect, useMemo, useState, type CSSProperties } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { buildQaBurndown } from "@/lib/qaBurndown"
import { normalizeQaCycleSection } from "@/lib/qaCycleSections"
import { api } from "@/services/api"
import type { QaTaskStatusChange, QaTestCase, QaTestCycle, QaTestingReport } from "@/types"

type Preset = "24h" | "sinceYesterday" | "today" | "yesterday" | "7d" | "custom"
type SummaryTone = "failed" | "passed" | "blocked" | "inProgress"
const RANGE_PRESET_OPTIONS: Array<{ value: Preset; label: string }> = [
  { value: "24h", label: "Last 24h" },
  { value: "sinceYesterday", label: "Since yesterday" },
  { value: "today", label: "today" },
  { value: "yesterday", label: "yesterday" },
  { value: "7d", label: "7d" },
]
type RangeStatusModal = "failed" | "passed" | "blocked" | "inProgress"
const CYCLE_SECTION_ORDER = ["Desktop or Tablet", "Mobile", "LP Sections & Pages", "LP Features"]
const QA_RANGE_SESSION_KEY = "qaTestingRange"
const QA_REPORT_SESSION_KEY = "qaTestingReportSnapshot"
const SUMMARY_TONE_STYLES: Record<SummaryTone, { card: CSSProperties; value: CSSProperties }> = {
  failed: {
    card: { borderColor: "oklch(63.7% 0.237 25.331 / 0.45)", backgroundColor: "oklch(63.7% 0.237 25.331 / 0.10)" },
    value: { color: "oklch(70.4% 0.191 22.216)" },
  },
  passed: {
    card: { borderColor: "oklch(69.6% 0.17 162.48 / 0.45)", backgroundColor: "oklch(69.6% 0.17 162.48 / 0.10)" },
    value: { color: "oklch(76.5% 0.177 163.223)" },
  },
  blocked: {
    card: { borderColor: "oklch(79.5% 0.184 86.047 / 0.45)", backgroundColor: "oklch(79.5% 0.184 86.047 / 0.10)" },
    value: { color: "oklch(90.5% 0.182 98.111)" },
  },
  inProgress: {
    card: { borderColor: "oklch(62.3% 0.214 259.815 / 0.45)", backgroundColor: "oklch(62.3% 0.214 259.815 / 0.10)" },
    value: { color: "oklch(70.7% 0.165 254.624)" },
  },
}

function snapToQuarterHour(date: Date) {
  const snapped = new Date(date)
  snapped.setMinutes(Math.floor(snapped.getMinutes() / 15) * 15, 0, 0)
  return snapped
}

function toLocalPickerValue(date: Date) {
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return offsetDate.toISOString().slice(0, 16)
}

function fromLocalPickerValue(value: string) {
  return new Date(value).toISOString()
}

function isWithinRange(value: string | null | undefined, startValue: string, endValue: string) {
  if (!value) return false
  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return false
  return timestamp >= new Date(startValue).getTime() && timestamp <= new Date(endValue).getTime()
}

function timestampValue(value: string | null | undefined) {
  if (!value) return 0
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

function statusMatches(status: string | undefined, labels: string[]) {
  const wanted = new Set(labels.map((label) => label.toLowerCase()))
  return wanted.has(String(status || "").toLowerCase())
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
  if (normalized === "not executed") return "bg-slate-500/15 text-slate-700 dark:text-slate-300"
  if (["pass", "passed", "done"].includes(normalized)) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
  if (["fail", "failed"].includes(normalized)) return "bg-red-500/10 text-red-700 dark:text-red-300"
  if (normalized.includes("progress")) return "bg-blue-500/10 text-blue-700 dark:text-blue-300"
  if (normalized.includes("blocked")) return "bg-amber-500/10 text-amber-700 dark:text-amber-300"
  return "bg-muted text-muted-foreground"
}

function applyPreset(preset: Preset) {
  const now = snapToQuarterHour(new Date())
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

function initialStoredRanges() {
  const fallbackRange = applyPreset("24h")
  const fallbackBurndownRange = applyPreset("7d")
  if (typeof window === "undefined") {
    return {
      range: fallbackRange,
      customRange: fallbackRange,
      burndownRange: fallbackBurndownRange,
      preset: "24h" as Preset,
    }
  }
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(QA_RANGE_SESSION_KEY) || "{}")
    if (stored?.start && stored?.end && stored?.burndownStart && stored?.burndownEnd) {
      const storedPreset = (stored.preset || "custom") as Preset
      const activeRange = storedPreset === "custom"
        ? { start: new Date(stored.start), end: new Date(stored.end) }
        : applyPreset(storedPreset)
      return {
        range: activeRange,
        customRange: {
          start: new Date(stored.customStart || stored.start),
          end: new Date(stored.customEnd || stored.end),
        },
        burndownRange: { start: new Date(stored.burndownStart), end: new Date(stored.burndownEnd) },
        preset: storedPreset,
      }
    }
  } catch {
    // Ignore malformed session state and fall back to stable defaults.
  }
  return {
    range: fallbackRange,
    customRange: fallbackRange,
    burndownRange: fallbackBurndownRange,
    preset: "24h" as Preset,
  }
}

function reportRequestKey(start: string, end: string) {
  return [
    fromLocalPickerValue(start),
    fromLocalPickerValue(end),
    "tasks:sinceYesterday",
  ].join("|")
}

function SummaryCard({
  label,
  value,
  detail,
  onClick,
  tone,
}: {
  label: string
  value: string | number
  detail: string
  onClick?: () => void
  tone?: SummaryTone
}) {
  const toneStyles = tone ? SUMMARY_TONE_STYLES[tone] : null
  const cardClassName = [
    toneStyles && "border",
    onClick && (toneStyles ? "cursor-pointer transition-colors hover:brightness-110" : "cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5"),
  ].filter(Boolean).join(" ")

  return (
    <Card
      className={cardClassName || undefined}
      style={toneStyles?.card}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onClick()
        }
      }}
    >
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl tabular-nums" style={toneStyles?.value}>{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{detail}</CardContent>
    </Card>
  )
}

function RangeProgressDialog({
  open,
  onOpenChange,
  rows,
  title = "Range Progress Test Cases",
  description = "Test cases executed inside the selected test-case range.",
  emptyMessage = "No test cases were executed in this range.",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: Array<QaTestCase & { cycleKey: string; cycleName: string; section: string }>
  title?: string
  description?: string
  emptyMessage?: string
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-[90rem]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="themed-scrollbar max-h-[65vh] overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Test Case</th>
                <th className="w-32 px-4 py-3">Status</th>
                <th className="w-44 px-4 py-3">Executed</th>
                <th className="w-32 px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                rows.map((testCase) => (
                  <tr key={`${testCase.cycleKey}-${testCase.key}-${testCase.executedAt}`} className="border-t border-border">
                    <td className="max-w-xs px-4 py-3">
                      <div className="font-medium">{testCase.cycleName}</div>
                      <div className="text-xs text-muted-foreground">
                        {testCase.section} · {testCase.cycleKey}
                      </div>
                    </td>
                    <td className="max-w-md px-4 py-3">
                      <div className="font-medium">{testCase.key}</div>
                      <div className="text-muted-foreground">{testCase.name || "Name unavailable"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusClass(testCase.status)}>{testCase.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{testCase.executedBy || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDateTime(testCase.executedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function BlockedTestCasesDialog({
  open,
  onOpenChange,
  rows,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: Array<QaTestCase & { cycleKey: string; cycleName: string; section: string }>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-[90rem]">
        <DialogHeader>
          <DialogTitle>Blocked Test Cases</DialogTitle>
          <DialogDescription>All currently blocked test cases in the loaded round cycles.</DialogDescription>
        </DialogHeader>
        <div className="themed-scrollbar max-h-[65vh] overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Test Case</th>
                <th className="w-32 px-4 py-3">Status</th>
                <th className="w-44 px-4 py-3">Assigned</th>
                <th className="w-32 px-4 py-3">Executed</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No currently blocked test cases found.
                  </td>
                </tr>
              ) : (
                rows.map((testCase) => (
                  <tr key={`${testCase.cycleKey}-${testCase.key}`} className="border-t border-border">
                    <td className="max-w-xs px-4 py-3">
                      <div className="font-medium">{testCase.cycleName}</div>
                      <div className="text-xs text-muted-foreground">
                        {testCase.section} · {testCase.cycleKey}
                      </div>
                    </td>
                    <td className="max-w-md px-4 py-3">
                      <div className="font-medium">{testCase.key}</div>
                      <div className="text-muted-foreground">{testCase.name || "Name unavailable"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={statusClass(testCase.status)}>{testCase.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{testCase.assignedTo || "Unassigned"}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatDateTime(testCase.executedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function TaskMovementDialog({
  open,
  onOpenChange,
  changes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  changes: QaTaskStatusChange[]
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-[90rem]">
        <DialogHeader>
          <DialogTitle>Task Movement</DialogTitle>
          <DialogDescription>Jira tasks whose status changed in the task movement window.</DialogDescription>
        </DialogHeader>
        <TaskMovementTable changes={changes} constrained />
      </DialogContent>
    </Dialog>
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
              <Badge key={status} className={statusClass(status)}>
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

function CycleSectionGroup({ section, cycles }: { section: string; cycles: QaTestCycle[] }) {
  const totalCases = cycles.reduce((sum, cycle) => sum + cycle.totalCases, 0)
  const executedCases = cycles.reduce((sum, cycle) => sum + cycle.executedCases, 0)
  const progressPercent = totalCases > 0 ? Math.round((executedCases / totalCases) * 100) : 0

  return (
    <details className="group/section overflow-hidden rounded-lg border border-border bg-card">
      <summary className="grid cursor-pointer gap-4 p-4 md:grid-cols-[minmax(0,1fr)_18rem_2rem]">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-lg font-semibold tracking-normal">{section}</h3>
            <Badge variant="outline">{cycles.length} cycles</Badge>
            <Badge variant="outline">{totalCases} cases</Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            {executedCases} executed · {Math.max(totalCases - executedCases, 0)} remaining
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Overall progress</span>
            <span className="font-medium tabular-nums">{progressPercent}%</span>
          </div>
          <Progress value={progressPercent} />
        </div>
        <ChevronDown className="mt-1 h-5 w-5 text-muted-foreground transition-transform group-open/section:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-border p-3">
        {cycles.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            No test cycles in this category.
          </div>
        ) : (
          cycles.map((cycle) => <CycleCard key={cycle.key} cycle={cycle} />)
        )}
      </div>
    </details>
  )
}

function TaskMovementTable({ changes, constrained = false }: { changes: QaTaskStatusChange[]; constrained?: boolean }) {
  if (changes.length === 0) {
    return <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">No task status changes matched this range.</div>
  }
  return (
    <div className={`themed-scrollbar overflow-auto rounded-lg border border-border ${constrained ? "max-h-[65vh]" : ""}`}>
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Task</th>
            <th className="w-72 px-4 py-3">Transition</th>
            <th className="w-44 px-4 py-3">Assignee</th>
            <th className="w-56 px-4 py-3">Changed</th>
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
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{change.assignee || "Unassigned"}</td>
              <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
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
  const initialRanges = useMemo(() => initialStoredRanges(), [])
  const [preset, setPreset] = useState<Preset>(initialRanges.preset)
  const [start, setStart] = useState(toLocalPickerValue(initialRanges.range.start))
  const [end, setEnd] = useState(toLocalPickerValue(initialRanges.range.end))
  const [customStart, setCustomStart] = useState(toLocalPickerValue(initialRanges.customRange.start))
  const [customEnd, setCustomEnd] = useState(toLocalPickerValue(initialRanges.customRange.end))
  const [burndownStart, setBurndownStart] = useState(toLocalPickerValue(initialRanges.burndownRange.start))
  const [burndownEnd, setBurndownEnd] = useState(toLocalPickerValue(initialRanges.burndownRange.end))
  const [appliedBurndownStart, setAppliedBurndownStart] = useState(burndownStart)
  const [appliedBurndownEnd, setAppliedBurndownEnd] = useState(burndownEnd)
  const currentRequestKey = reportRequestKey(start, end)
  const [report, setReport] = useState<QaTestingReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [refreshingFromJira, setRefreshingFromJira] = useState(false)
  const [rangeDialogOpen, setRangeDialogOpen] = useState(false)
  const [rangeStatusModal, setRangeStatusModal] = useState<RangeStatusModal | null>(null)
  const [blockedDialogOpen, setBlockedDialogOpen] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)

  async function loadReport(forceRefresh = false) {
    setLoading(true)
    setError(null)
    if (forceRefresh) setRefreshingFromJira(true)
    try {
      const nextReport = await api.getQaTestingReport(
        fromLocalPickerValue(start),
        fromLocalPickerValue(end),
        forceRefresh,
        "sinceYesterday",
        fromLocalPickerValue(burndownStart),
        fromLocalPickerValue(burndownEnd),
      )
      setReport(nextReport)
      if (!nextReport.cache?.refreshInProgress) {
        setRefreshingFromJira(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load QA testing report")
      if (forceRefresh) setRefreshingFromJira(false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    window.sessionStorage.removeItem(QA_REPORT_SESSION_KEY)
  }, [])

  useEffect(() => {
    void loadReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRequestKey])

  useEffect(() => {
    window.sessionStorage.setItem(QA_RANGE_SESSION_KEY, JSON.stringify({
      preset,
      start: fromLocalPickerValue(start),
      end: fromLocalPickerValue(end),
      customStart: fromLocalPickerValue(customStart),
      customEnd: fromLocalPickerValue(customEnd),
      burndownStart: fromLocalPickerValue(burndownStart),
      burndownEnd: fromLocalPickerValue(burndownEnd),
    }))
  }, [preset, start, end, customStart, customEnd, burndownStart, burndownEnd])

  const waitingForInitialSnapshot = Boolean(
    report?.cache?.refreshInProgress
    && report.summary.cycleCount === 0
    && report.summary.totalCases === 0
    && report.burndown.length === 0,
  )
  const waitingForForcedSnapshot = Boolean(
    refreshingFromJira
    && report?.cache?.refreshInProgress
    && report.cache.stale,
  )
  const refreshPollActive = Boolean(report?.cache?.refreshInProgress || refreshingFromJira)

  useEffect(() => {
    if (!refreshPollActive || loading) return undefined
    const timer = window.setTimeout(() => {
      void loadReport()
    }, 5_000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshPollActive, loading, report?.cache?.refreshStartedAt, report?.cache?.lastRefreshedAt])

  function handlePreset(nextPreset: Preset) {
    setPreset(nextPreset)
    if (nextPreset === "custom") return
    const next = applyPreset(nextPreset)
    setStart(toLocalPickerValue(next.start))
    setEnd(toLocalPickerValue(next.end))
    setCustomStart(toLocalPickerValue(next.start))
    setCustomEnd(toLocalPickerValue(next.end))
  }

  function handleSetRange() {
    setPreset("custom")
    setStart(customStart)
    setEnd(customEnd)
  }

  function applyBurndownRange() {
    setAppliedBurndownStart(burndownStart)
    setAppliedBurndownEnd(burndownEnd)
  }

  const groupedCycles = useMemo(() => {
    const groups = new Map<string, QaTestCycle[]>()
    for (const cycle of report?.cycles ?? []) {
      const section = normalizeQaCycleSection(cycle)
      groups.set(section, [...(groups.get(section) ?? []), cycle])
    }
    const orderedGroups = CYCLE_SECTION_ORDER.map((section) => [section, groups.get(section) ?? []] as [string, QaTestCycle[]])
    const extraGroups = Array.from(groups.entries()).filter(([section]) => !CYCLE_SECTION_ORDER.includes(section))
    return [...orderedGroups, ...extraGroups]
  }, [report])

  const rangeExecutedRows = useMemo(
    () =>
      (report?.cycles ?? []).flatMap((cycle) =>
        cycle.testCases
          .filter((testCase) => testCase.inRange)
          .filter((testCase) => isWithinRange(testCase.executedAt, fromLocalPickerValue(start), fromLocalPickerValue(end)))
          .map((testCase) => ({
            ...testCase,
            cycleKey: cycle.key,
            cycleName: cycle.name,
            section: normalizeQaCycleSection(cycle),
          })),
      ),
    [end, report, start],
  )
  const rangeFailedRows = useMemo(
    () => rangeExecutedRows.filter((testCase) => statusMatches(testCase.status, ["Fail", "Failed"])),
    [rangeExecutedRows],
  )
  const rangePassedRows = useMemo(
    () => rangeExecutedRows.filter((testCase) => statusMatches(testCase.status, ["Pass", "Passed"])),
    [rangeExecutedRows],
  )
  const rangeBlockedRows = useMemo(
    () => rangeExecutedRows.filter((testCase) => statusMatches(testCase.status, ["Blocked"])),
    [rangeExecutedRows],
  )
  const rangeInProgressRows = useMemo(
    () => rangeExecutedRows.filter((testCase) => statusMatches(testCase.status, ["In Progress"])),
    [rangeExecutedRows],
  )

  const blockedRows = useMemo(
    () =>
      (report?.cycles ?? []).flatMap((cycle) =>
        cycle.testCases
          .filter((testCase) => testCase.status.toLowerCase().includes("blocked"))
          .map((testCase) => ({
            ...testCase,
            cycleKey: cycle.key,
            cycleName: cycle.name,
            section: normalizeQaCycleSection(cycle),
          })),
      ).sort((a, b) => timestampValue(b.executedAt) - timestampValue(a.executedAt)),
    [report],
  )

  const burndownData = useMemo(
    () =>
      report
        ? buildQaBurndown(
          report.cycles,
          fromLocalPickerValue(appliedBurndownStart),
          fromLocalPickerValue(appliedBurndownEnd),
        )
        : [],
    [appliedBurndownEnd, appliedBurndownStart, report],
  )
  const rangeStatusModalConfig = {
    failed: {
      title: "Failed Test Cases",
      description: "Test cases marked failed inside the selected range.",
      emptyMessage: "No failed test cases were found in this range.",
      rows: rangeFailedRows,
    },
    passed: {
      title: "Passed Test Cases",
      description: "Test cases marked passed inside the selected range.",
      emptyMessage: "No passed test cases were found in this range.",
      rows: rangePassedRows,
    },
    blocked: {
      title: "Blocked Test Cases In Range",
      description: "Test cases marked blocked inside the selected range.",
      emptyMessage: "No blocked test cases were found in this range.",
      rows: rangeBlockedRows,
    },
    inProgress: {
      title: "In Progress Test Cases",
      description: "Test cases marked in progress inside the selected range.",
      emptyMessage: "No in progress test cases were found in this range.",
      rows: rangeInProgressRows,
    },
  }
  const selectedRangeStatusModal = rangeStatusModal ? rangeStatusModalConfig[rangeStatusModal] : null

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
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">Range:</span>
          <div className="flex h-9 items-center gap-0.5 rounded-lg border border-border bg-background/30 p-1">
            {RANGE_PRESET_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant="ghost"
                size="sm"
                className={
                  preset === option.value
                    ? "h-7 min-w-14 rounded-md px-3 text-xs font-semibold leading-none !text-black bg-primary hover:bg-primary/90 hover:!text-black"
                    : "h-7 min-w-14 rounded-md px-3 text-xs font-semibold leading-none text-foreground/85 hover:bg-muted/70 hover:text-foreground"
                }
                onClick={() => handlePreset(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <span className="text-sm font-medium text-muted-foreground">Custom:</span>
          <DateTimePicker value={customStart} onChange={setCustomStart} disabled={loading} />
          <DateTimePicker value={customEnd} onChange={setCustomEnd} disabled={loading} />
          <Button
            type="button"
            variant={preset === "custom" ? "default" : "secondary"}
            onClick={handleSetRange}
            disabled={loading}
            className={preset === "custom" ? "!text-black" : ""}
          >
            Set Range
          </Button>
          <Button onClick={() => loadReport(true)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh from Jira
          </Button>
        </div>
      </div>

      {report?.cache ? (
        <div className="text-sm text-muted-foreground">
          {report.cache.lastRefreshedAt
            ? `Jira data refreshed ${formatDateTime(report.cache.lastRefreshedAt)}`
            : "Jira data refresh has started"}
          {report.cache.hit ? " from cache" : ""}. Cached for {Math.round(report.cache.ttlSeconds / 60)} minutes.
          {report.cache.refreshInProgress ? " Refreshing Jira data in the background." : ""}
          {report.cache.stale ? " Showing last available snapshot until refresh finishes." : ""}
          {report.nameCache ? (
            <>
              {" "}Test case names: {report.nameCache.hitCount} cached
              {report.nameCache.refreshQueued > 0 ? `, ${report.nameCache.refreshQueued} queued for background refresh` : ""}.
            </>
          ) : null}
          {report.userCache ? (
            <>
              {" "}Jira users: {report.userCache.hitCount} cached
              {report.userCache.refreshQueued > 0 ? `, ${report.userCache.refreshQueued} queued for background refresh` : ""}.
            </>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      {waitingForInitialSnapshot || waitingForForcedSnapshot ? (
        <Card>
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div>
              <div className="font-heading text-lg font-semibold tracking-normal">
                {waitingForForcedSnapshot ? "Refreshing QA report" : "Building QA report"}
              </div>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Pulling Adobe Commerce E2E data from Jira. The dashboard will refresh automatically when the new snapshot is ready.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {report && !waitingForInitialSnapshot && !waitingForForcedSnapshot ? (
        <>
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-10">
            <SummaryCard label="Cycles" value={report.summary.cycleCount} detail="Round cycles in Adobe Commerce E2E" />
            <SummaryCard label="Total Cases" value={report.summary.totalCases} detail={`${report.summary.remainingCases} remaining overall`} />
            <SummaryCard label="Overall Progress" value={`${report.summary.progressPercent}%`} detail={`${report.summary.executedCases} cases executed`} />
            <SummaryCard
              label="Range Progress"
              value={`${report.summary.rangeProgressPercent}%`}
              detail={`${report.summary.executedInRange} cases executed in range`}
              onClick={() => setRangeDialogOpen(true)}
            />
            <SummaryCard
              label="Failed"
              value={rangeFailedRows.length}
              detail="Failed in selected range"
              onClick={() => setRangeStatusModal("failed")}
              tone="failed"
            />
            <SummaryCard
              label="Passed"
              value={rangePassedRows.length}
              detail="Passed in selected range"
              onClick={() => setRangeStatusModal("passed")}
              tone="passed"
            />
            <SummaryCard
              label="Blocked"
              value={rangeBlockedRows.length}
              detail="Blocked in selected range"
              onClick={() => setRangeStatusModal("blocked")}
              tone="blocked"
            />
            <SummaryCard
              label="In Progress"
              value={rangeInProgressRows.length}
              detail="In progress in selected range"
              onClick={() => setRangeStatusModal("inProgress")}
              tone="inProgress"
            />
            <SummaryCard
              label="Total Blocked Test Cases"
              value={blockedRows.length}
              detail="Currently blocked across loaded cycles"
              onClick={() => setBlockedDialogOpen(true)}
            />
            <SummaryCard
              label="Task Movement"
              value={report.summary.taskStatusChanges}
              detail="Jira tasks changed since yesterday"
              onClick={() => setTaskDialogOpen(true)}
            />
          </div>

          <RangeProgressDialog
            open={rangeDialogOpen}
            onOpenChange={setRangeDialogOpen}
            rows={rangeExecutedRows}
          />
          <RangeProgressDialog
            open={rangeStatusModal !== null}
            onOpenChange={(open) => {
              if (!open) setRangeStatusModal(null)
            }}
            rows={selectedRangeStatusModal?.rows ?? []}
            title={selectedRangeStatusModal?.title}
            description={selectedRangeStatusModal?.description}
            emptyMessage={selectedRangeStatusModal?.emptyMessage}
          />
          <BlockedTestCasesDialog
            open={blockedDialogOpen}
            onOpenChange={setBlockedDialogOpen}
            rows={blockedRows}
          />
          <TaskMovementDialog
            open={taskDialogOpen}
            onOpenChange={setTaskDialogOpen}
            changes={report.taskMovement.changes}
          />

          <Card>
            <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <CardTitle>Burndown</CardTitle>
                <CardDescription>Executed test cases and remaining cases across the burndown range.</CardDescription>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <span className="pb-2 text-sm font-medium text-foreground">Burndown Range:</span>
                <DateTimePicker value={burndownStart} onChange={setBurndownStart} />
                <DateTimePicker value={burndownEnd} onChange={setBurndownEnd} />
                <Button type="button" variant="secondary" onClick={applyBurndownRange}>
                  <RefreshCw className="h-4 w-4" />
                  Apply
                </Button>
              </div>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={burndownData} margin={{ left: 4, right: 16, top: 12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(226, 232, 240, 0.24)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    className="text-xs"
                    tick={{ fill: "rgba(248, 250, 252, 0.86)" }}
                    axisLine={{ stroke: "rgba(226, 232, 240, 0.32)" }}
                    tickLine={{ stroke: "rgba(226, 232, 240, 0.32)" }}
                  />
                  <YAxis
                    allowDecimals={false}
                    className="text-xs"
                    tick={{ fill: "rgba(248, 250, 252, 0.86)" }}
                    axisLine={{ stroke: "rgba(226, 232, 240, 0.32)" }}
                    tickLine={{ stroke: "rgba(226, 232, 240, 0.32)" }}
                  />
                  <Tooltip
                    labelFormatter={(value) => formatDate(String(value || ""))}
                    labelStyle={{ color: "rgb(15, 23, 42)", fontWeight: 700 }}
                  />
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
            {groupedCycles.map(([section, cycles]) => <CycleSectionGroup key={section} section={section} cycles={cycles} />)}
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
