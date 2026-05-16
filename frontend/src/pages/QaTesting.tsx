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
const RANGE_PRESET_OPTIONS: Array<{ value: Preset; label: string }> = [
  { value: "24h", label: "Last 24h" },
  { value: "sinceYesterday", label: "Since yesterday" },
  { value: "today", label: "today" },
  { value: "yesterday", label: "yesterday" },
  { value: "7d", label: "7d" },
]
const CYCLE_SECTION_ORDER = ["Desktop or Tablet", "Mobile", "LP Sections & Pages", "LP Features"]
const QA_RANGE_SESSION_KEY = "qaTestingRange"
const QA_REPORT_SESSION_KEY = "qaTestingReportSnapshot"

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
      burndownRange: fallbackBurndownRange,
      preset: "24h" as Preset,
    }
  }
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(QA_RANGE_SESSION_KEY) || "{}")
    if (stored?.start && stored?.end && stored?.burndownStart && stored?.burndownEnd) {
      return {
        range: { start: new Date(stored.start), end: new Date(stored.end) },
        burndownRange: { start: new Date(stored.burndownStart), end: new Date(stored.burndownEnd) },
        preset: (stored.preset || "custom") as Preset,
      }
    }
  } catch {
    // Ignore malformed session state and fall back to stable defaults.
  }
  return {
    range: fallbackRange,
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

function readStoredReport(requestKey: string) {
  if (typeof window === "undefined") return null
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(QA_REPORT_SESSION_KEY) || "{}")
    if (stored?.requestKey === requestKey && stored?.report) {
      return stored.report as QaTestingReport
    }
  } catch {
    // Ignore malformed snapshots.
  }
  return null
}

function storeReportSnapshot(requestKey: string, report: QaTestingReport) {
  if (typeof window === "undefined") return
  if (report.summary.cycleCount === 0 && report.summary.totalCases === 0 && report.cache?.refreshInProgress) {
    return
  }
  window.sessionStorage.setItem(QA_REPORT_SESSION_KEY, JSON.stringify({
    requestKey,
    savedAt: new Date().toISOString(),
    report,
  }))
}

function SummaryCard({
  label,
  value,
  detail,
  onClick,
}: {
  label: string
  value: string | number
  detail: string
  onClick?: () => void
}) {
  return (
    <Card
      className={onClick ? "cursor-pointer transition-colors hover:border-primary/50 hover:bg-primary/5" : undefined}
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
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{detail}</CardContent>
    </Card>
  )
}

function RangeProgressDialog({
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
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>Range Progress Test Cases</DialogTitle>
          <DialogDescription>Test cases executed inside the selected test-case range.</DialogDescription>
        </DialogHeader>
        <div className="themed-scrollbar max-h-[65vh] overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-background text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Test Case</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Executed</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    No test cases were executed in this range.
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
                    <td className="px-4 py-3 text-muted-foreground">{testCase.executedBy || "-"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(testCase.executedAt)}</td>
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
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-6xl">
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
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3">Executed</th>
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
                    <td className="px-4 py-3 text-muted-foreground">{testCase.assignedTo || "Unassigned"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDateTime(testCase.executedAt)}</td>
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
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-5xl">
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
  const initialRanges = useMemo(() => initialStoredRanges(), [])
  const [preset, setPreset] = useState<Preset>(initialRanges.preset)
  const [start, setStart] = useState(toLocalPickerValue(initialRanges.range.start))
  const [end, setEnd] = useState(toLocalPickerValue(initialRanges.range.end))
  const [burndownStart, setBurndownStart] = useState(toLocalPickerValue(initialRanges.burndownRange.start))
  const [burndownEnd, setBurndownEnd] = useState(toLocalPickerValue(initialRanges.burndownRange.end))
  const [appliedBurndownStart, setAppliedBurndownStart] = useState(burndownStart)
  const [appliedBurndownEnd, setAppliedBurndownEnd] = useState(burndownEnd)
  const currentRequestKey = reportRequestKey(start, end)
  const [report, setReport] = useState<QaTestingReport | null>(() => readStoredReport(currentRequestKey))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rangeDialogOpen, setRangeDialogOpen] = useState(false)
  const [blockedDialogOpen, setBlockedDialogOpen] = useState(false)
  const [taskDialogOpen, setTaskDialogOpen] = useState(false)

  async function loadReport(forceRefresh = false) {
    setLoading(true)
    setError(null)
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
      storeReportSnapshot(currentRequestKey, nextReport)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load QA testing report")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!report) {
      void loadReport()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    window.sessionStorage.setItem(QA_RANGE_SESSION_KEY, JSON.stringify({
      preset,
      start: fromLocalPickerValue(start),
      end: fromLocalPickerValue(end),
      burndownStart: fromLocalPickerValue(burndownStart),
      burndownEnd: fromLocalPickerValue(burndownEnd),
    }))
  }, [preset, start, end, burndownStart, burndownEnd])

  useEffect(() => {
    const storedReport = readStoredReport(currentRequestKey)
    setReport(storedReport)
  }, [currentRequestKey])

  const waitingForInitialSnapshot = Boolean(
    report?.cache?.refreshInProgress
    && report.summary.cycleCount === 0
    && report.summary.totalCases === 0
    && report.burndown.length === 0,
  )

  useEffect(() => {
    if (!waitingForInitialSnapshot) return undefined
    const timer = window.setTimeout(() => {
      void loadReport()
    }, 30_000)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForInitialSnapshot, report?.cache?.refreshStartedAt])

  function handlePreset(nextPreset: Preset) {
    setPreset(nextPreset)
    if (nextPreset === "custom") return
    const next = applyPreset(nextPreset)
    setStart(toLocalPickerValue(next.start))
    setEnd(toLocalPickerValue(next.end))
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
          .map((testCase) => ({
            ...testCase,
            cycleKey: cycle.key,
            cycleName: cycle.name,
            section: normalizeQaCycleSection(cycle),
          })),
      ),
    [report],
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
      ),
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
          <DateTimePicker value={start} onChange={(value) => { setPreset("custom"); setStart(value) }} />
          <DateTimePicker value={end} onChange={(value) => { setPreset("custom"); setEnd(value) }} />
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

      {waitingForInitialSnapshot ? (
        <Card>
          <CardContent className="flex min-h-72 flex-col items-center justify-center gap-3 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <div>
              <div className="font-heading text-lg font-semibold tracking-normal">Building QA report</div>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Pulling all Adobe Commerce E2E test cycles from Jira. The dashboard will refresh automatically when the first snapshot is ready.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {report && !waitingForInitialSnapshot ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
              label="Blocked Test Cases"
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
                    labelFormatter={formatDate}
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
