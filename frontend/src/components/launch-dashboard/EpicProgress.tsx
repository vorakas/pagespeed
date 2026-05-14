import { useMemo, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { EpicProgressResponse, EpicProgressRow } from "@/types"

interface EpicProgressProps {
  data: EpicProgressResponse | null
}

type SortKey = "active" | "tasks" | "hours" | "team"

/**
 * Hours-based epic progress panel — the core deliverable that replaces
 * the Excel Report tab's SUMIFS-driven epic breakdown. Shows dual
 * progress per epic: task completion (always available) and hours
 * (where time tracking data exists).
 */
export function EpicProgress({ data }: EpicProgressProps) {
  const [expanded, setExpanded] = useState(false)
  const [sortKey, setSortKey] = useState<SortKey>("active")
  const [showCompleted, setShowCompleted] = useState(false)

  const sorted = useMemo(() => {
    if (!data) return []
    let rows = data.epics
    if (!showCompleted) {
      rows = rows.filter((r) => r.activeTasks > 0)
    }
    const copy = [...rows]
    switch (sortKey) {
      case "active":
        copy.sort((a, b) => b.activeTasks - a.activeTasks || a.epicKey.localeCompare(b.epicKey))
        break
      case "tasks":
        copy.sort((a, b) => b.totalTasks - a.totalTasks || a.epicKey.localeCompare(b.epicKey))
        break
      case "hours":
        copy.sort(
          (a, b) =>
            b.originalEstimateHours - a.originalEstimateHours ||
            a.epicKey.localeCompare(b.epicKey),
        )
        break
      case "team":
        copy.sort(
          (a, b) =>
            (a.team ?? "zzz").localeCompare(b.team ?? "zzz") ||
            b.activeTasks - a.activeTasks,
        )
        break
    }
    return copy
  }, [data, sortKey, showCompleted])

  if (!data) return null

  const { totals, ungrouped } = data
  const visibleCount = sorted.length
  const INITIAL_SHOW = 15

  return (
    <section className="panel lcc-ep-panel" aria-label="Epic progress">
      <h3>
        Epic Progress
        <span className="count">
          {totals.epicCount} epics · {totals.totalTasks.toLocaleString()} tasks
        </span>
      </h3>

      {/* Summary strip */}
      <div className="lcc-ep-summary">
        <SummaryCell
          label="Tasks done"
          value={`${totals.resolvedTasks.toLocaleString()} / ${totals.totalTasks.toLocaleString()}`}
          pct={totals.taskPct}
          tone="green"
        />
        <SummaryCell
          label="Hours logged"
          value={`${fmtHours(totals.timeSpentHours)} / ${fmtHours(totals.originalEstimateHours)}`}
          pct={totals.hoursPct}
          tone="blue"
          dimNote={
            totals.tasksWithEstimates < totals.totalTasks
              ? `${totals.tasksWithEstimates} of ${totals.totalTasks.toLocaleString()} have estimates`
              : undefined
          }
        />
        <SummaryCell
          label="Remaining"
          value={`${fmtHours(totals.remainingEstimateHours)}`}
          tone="amber"
        />
      </div>

      {/* Controls row */}
      <div className="lcc-ep-controls">
        <div className="lcc-ep-sort-pills" role="tablist">
          {(["active", "tasks", "hours", "team"] as const).map((key) => (
            <button
              key={key}
              role="tab"
              aria-selected={sortKey === key}
              className={`lcc-ep-pill${sortKey === key ? " active" : ""}`}
              onClick={() => setSortKey(key)}
              type="button"
            >
              {key === "active" ? "Active" : key === "tasks" ? "Total" : key === "hours" ? "Hours" : "Team"}
            </button>
          ))}
        </div>
        <label className="lcc-ep-toggle">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
          />
          <span>Show completed</span>
        </label>
      </div>

      {/* Epic rows */}
      <div className="lcc-ep-list">
        {sorted.slice(0, expanded ? undefined : INITIAL_SHOW).map((row) => (
          <EpicRow key={row.epicKey} row={row} />
        ))}
      </div>

      {visibleCount > INITIAL_SHOW && (
        <button
          type="button"
          className="lcc-ep-expand"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded
            ? "Show fewer"
            : `Show all ${visibleCount} epics`}
        </button>
      )}

      {/* Ungrouped tasks */}
      {ungrouped.totalTasks > 0 && (
        <div className="lcc-ep-ungrouped">
          <div className="lcc-ep-row-head">
            <span className="lcc-ep-name">Ungrouped tasks</span>
            <span className="lcc-ep-count dim">
              {ungrouped.activeTasks} active / {ungrouped.totalTasks.toLocaleString()} total
            </span>
          </div>
          <DualBar
            taskPct={ungrouped.taskPct}
            hoursPct={ungrouped.hoursPct}
            resolvedTasks={ungrouped.resolvedTasks}
            totalTasks={ungrouped.totalTasks}
            spentHours={ungrouped.timeSpentHours}
            estimatedHours={ungrouped.originalEstimateHours}
          />
        </div>
      )}
    </section>
  )
}

function EpicRow({ row }: { row: EpicProgressRow }) {
  const [open, setOpen] = useState(false)
  const isCompleted = row.activeTasks === 0

  return (
    <div className={`lcc-ep-row${isCompleted ? " completed" : ""}`}>
      <button
        type="button"
        className="lcc-ep-row-head"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="lcc-ep-chevron">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </span>
        <span className="lcc-ep-name" title={`${row.epicKey}: ${row.summary}`}>
          {row.summary}
        </span>
        {row.team && <span className="lcc-ep-team">{row.team}</span>}
        <span className="lcc-ep-count">
          {row.activeTasks > 0
            ? `${row.activeTasks} active`
            : `${row.resolvedTasks} done`}
        </span>
      </button>

      <DualBar
        taskPct={row.taskPct}
        hoursPct={row.hoursPct}
        resolvedTasks={row.resolvedTasks}
        totalTasks={row.totalTasks}
        spentHours={row.timeSpentHours}
        estimatedHours={row.originalEstimateHours}
      />

      {open && (
        <div className="lcc-ep-detail">
          <dl>
            <dt>Key</dt>
            <dd>{row.epicKey}</dd>
            <dt>Status</dt>
            <dd>{row.status ?? "—"}</dd>
            <dt>Tasks</dt>
            <dd>
              {row.resolvedTasks} resolved, {row.activeTasks} active of{" "}
              {row.totalTasks} total ({row.taskPct}%)
            </dd>
            {row.originalEstimateHours > 0 && (
              <>
                <dt>Hours</dt>
                <dd>
                  {fmtHours(row.timeSpentHours)} spent of{" "}
                  {fmtHours(row.originalEstimateHours)} estimated
                  {row.remainingEstimateHours > 0 &&
                    ` · ${fmtHours(row.remainingEstimateHours)} remaining`}
                  {row.tasksWithEstimates < row.totalTasks &&
                    ` (${row.tasksWithEstimates} of ${row.totalTasks} tasks have estimates)`}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}
    </div>
  )
}

function DualBar({
  taskPct,
  hoursPct,
  resolvedTasks,
  totalTasks,
  spentHours,
  estimatedHours,
}: {
  taskPct: number
  hoursPct: number | null
  resolvedTasks: number
  totalTasks: number
  spentHours: number
  estimatedHours: number
}) {
  return (
    <div className="lcc-ep-bars">
      <div className="lcc-ep-bar-row">
        <span className="lcc-ep-bar-label">Tasks</span>
        <div className="lcc-ep-track">
          <div
            className="lcc-ep-fill"
            data-tone="green"
            style={{ width: `${clamp(taskPct)}%` }}
          />
        </div>
        <span className="lcc-ep-bar-num">
          {resolvedTasks}/{totalTasks}
        </span>
      </div>
      {estimatedHours > 0 && (
        <div className="lcc-ep-bar-row">
          <span className="lcc-ep-bar-label">Hours</span>
          <div className="lcc-ep-track">
            <div
              className="lcc-ep-fill"
              data-tone={hoursPct !== null && hoursPct > 100 ? "red" : "blue"}
              style={{ width: `${clamp(hoursPct ?? 0)}%` }}
            />
          </div>
          <span className="lcc-ep-bar-num">
            {fmtHours(spentHours)}/{fmtHours(estimatedHours)}
          </span>
        </div>
      )}
    </div>
  )
}

function SummaryCell({
  label,
  value,
  pct,
  tone,
  dimNote,
}: {
  label: string
  value: string
  pct?: number | null
  tone: string
  dimNote?: string
}) {
  return (
    <div className="lcc-ep-sum-cell">
      <div className="lcc-ep-sum-label">{label}</div>
      <div className="lcc-ep-sum-value">{value}</div>
      {pct != null && (
        <div className="lcc-ep-sum-bar">
          <div className="lcc-ep-track" style={{ height: 6 }}>
            <div
              className="lcc-ep-fill"
              data-tone={tone}
              style={{ width: `${clamp(pct)}%` }}
            />
          </div>
          <span className="lcc-ep-sum-pct">{pct}%</span>
        </div>
      )}
      {dimNote && <div className="lcc-ep-sum-dim">{dimNote}</div>}
    </div>
  )
}

function fmtHours(hours: number): string {
  if (hours === 0) return "0h"
  if (hours < 10) return `${hours.toFixed(1)}h`
  return `${Math.round(hours).toLocaleString()}h`
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, value))
}
