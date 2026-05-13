import { useMemo, useState } from "react"
import { convertUtcTimesToPacific } from "@/lib/datetime"
import { renderHeadlineSegments } from "./headlineWikilinks"
import { TaskDetail } from "./SidePanel"
import type {
  MigrationLaunchPriorityBucket,
  MigrationLaunchPriorities,
  MigrationSnapshot,
  RawTaskRecord,
} from "@/types"

type Tone = "red" | "amber" | "green" | "blue" | "violet" | "neutral"

const TONES: Record<string, Tone> = {
  P1: "red",
  P2: "amber",
  P3: "blue",
  "Post-Launch": "violet",
}

interface Props {
  launchPriorities: MigrationLaunchPriorities | null
  snapshot: MigrationSnapshot | null
}

export function LaunchPriorityDailyStatus({ launchPriorities, snapshot }: Props) {
  const buckets = useMemo(
    () => launchPriorities?.buckets ?? [],
    [launchPriorities],
  )
  const [tab, setTab] = useState("P1")
  const activeBucket =
    buckets.find((bucket) => bucket.priority === tab) ??
    buckets.find((bucket) => bucket.active > 0) ??
    buckets[0] ??
    null

  return (
    <section
      id="workstreams"
      className="panel"
      aria-label="Daily status by launch priority"
      style={{ scrollMarginTop: 16 }}
    >
      <div style={eyebrowStyle}>
        <span>Daily Status · {snapshot?.date ?? launchPriorities?.date ?? "Today"}</span>
        {snapshot?.sourcePath && (
          <>
            <span style={eyebrowSep}>·</span>
            <span style={eyebrowFile}>{snapshot.sourcePath}</span>
          </>
        )}
      </div>

      {snapshot?.headline && (
        <HeadlineBullets text={convertUtcTimesToPacific(snapshot.headline, snapshot.date)} />
      )}

      <div className="lcc-is-tabs" role="tablist">
        {buckets.map((bucket) => {
          const active = activeBucket?.priority === bucket.priority
          return (
            <button
              key={bucket.priority}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(bucket.priority)}
              className={`lcc-is-tab${active ? " active" : ""}`}
            >
              {bucket.label}
              <span>{bucket.active}</span>
            </button>
          )
        })}
      </div>

      <div style={tabBodyStyle}>
        {activeBucket ? (
          <PriorityBucket bucket={activeBucket} />
        ) : (
          <div style={emptyStyle}>No launch-priority tasks tracked.</div>
        )}
      </div>
    </section>
  )
}

function PriorityBucket({ bucket }: { bucket: MigrationLaunchPriorityBucket }) {
  const tone = TONES[bucket.priority] ?? "neutral"
  const [selectedTask, setSelectedTask] = useState<RawTaskRecord | null>(null)
  return (
    <div>
      <div style={summaryGridStyle}>
        <SummaryStat label="Active" value={bucket.active} tone={tone} />
        <SummaryStat label="Resolved" value={bucket.resolved} tone="green" />
        <SummaryStat label="Total" value={bucket.total} tone="neutral" />
      </div>

      {bucket.items.length === 0 ? (
        <div style={emptyStyle}>No active {bucket.label} tasks.</div>
      ) : (
        <div style={rowsStyle}>
          {bucket.items.map((task) => (
            <TaskRow
              key={task.key}
              task={task}
              tone={tone}
              onSelect={() => setSelectedTask(task)}
            />
          ))}
        </div>
      )}
      {selectedTask && (
        <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  )
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: Tone }) {
  return (
    <div style={{ ...summaryStatStyle, borderColor: `var(--lcc-${tone})` }}>
      <span style={summaryLabelStyle}>{label}</span>
      <strong style={{ color: `var(--lcc-${tone})` }}>{value.toLocaleString()}</strong>
    </div>
  )
}

function TaskRow({
  task,
  tone,
  onSelect,
}: {
  task: RawTaskRecord
  tone: Tone
  onSelect: () => void
}) {
  const accent = `var(--lcc-${tone})`
  const meta = [
    task.assignee ? `@${task.assignee}` : "UNASSIGNED",
    task.uatStatus || task.taskStatus || task.status || "Open",
    task.updated ? `updated ${task.updated.slice(0, 10)}` : null,
  ].filter(Boolean)

  return (
    <div style={{ ...rowStyle, borderLeft: `2px solid ${accent}` }}>
      <button type="button" style={rowIdPillStyle} onClick={onSelect}>
        {task.key}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={rowTitleStyle}>{task.summary || "(no summary)"}</div>
        <div style={rowMetaStyle}>{meta.join(" · ")}</div>
      </div>
      <span style={chipStyle}>
        {task.launchPriority || task.priority || "Priority"}
      </span>
    </div>
  )
}

function TaskModal({ task, onClose }: { task: RawTaskRecord; onClose: () => void }) {
  return (
    <div style={modalBackdropStyle} role="presentation" onClick={onClose}>
      <div
        style={modalStyle}
        className="launch-dashboard-side-panel open"
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <TaskDetail task={task} onClose={onClose} />
      </div>
    </div>
  )
}

function HeadlineBullets({ text }: { text: string }) {
  const parts = splitIntoSentences(text)
  if (parts.length <= 1) {
    return <p style={headlineSingleStyle}>{renderHeadlineSegments(text)}</p>
  }
  return (
    <ul style={headlineListStyle}>
      {parts.map((part) => (
        <li key={part} style={headlineItemStyle}>
          <span style={headlineBulletDotStyle} />
          <span>{renderHeadlineSegments(part)}</span>
        </li>
      ))}
    </ul>
  )
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((part) => part.trim())
    .filter(Boolean)
}

const eyebrowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  color: "var(--lcc-text-faint)",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0,
  fontWeight: 800,
  marginBottom: 10,
}

const eyebrowSep: React.CSSProperties = { color: "var(--lcc-glass-border)" }
const eyebrowFile: React.CSSProperties = { textTransform: "none", fontWeight: 650 }

const headlineSingleStyle: React.CSSProperties = {
  margin: "0 0 14px",
  color: "var(--lcc-text)",
  fontSize: 13,
  lineHeight: 1.5,
}

const headlineListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  margin: "0 0 14px",
  display: "grid",
  gap: 7,
}

const headlineItemStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "flex-start",
  color: "var(--lcc-text)",
  fontSize: 13,
  lineHeight: 1.45,
}

const headlineBulletDotStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: 6,
  background: "var(--lcc-accent)",
  marginTop: 6,
  flex: "0 0 auto",
}

const tabBodyStyle: React.CSSProperties = { minHeight: 160 }

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
  marginBottom: 14,
}

const summaryStatStyle: React.CSSProperties = {
  border: "1px solid var(--lcc-glass-border)",
  background: "var(--lcc-glass-bg-faint)",
  borderRadius: 6,
  padding: "10px 12px",
}

const summaryLabelStyle: React.CSSProperties = {
  display: "block",
  color: "var(--lcc-text-faint)",
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: 0,
  fontWeight: 800,
  marginBottom: 4,
}

const rowsStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  border: "1px solid rgba(255, 255, 255, 0.55)",
  background: "var(--lcc-violet-bg)",
  borderRadius: 6,
  padding: "9px 10px",
}

const rowIdPillStyle: React.CSSProperties = {
  width: 88,
  flex: "0 0 auto",
  color: "#fff",
  border: "1px solid rgba(255, 255, 255, 0.68)",
  background: "rgba(255, 255, 255, 0.08)",
  borderRadius: 999,
  padding: "5px 8px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
}

const rowTitleStyle: React.CSSProperties = {
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}

const rowMetaStyle: React.CSSProperties = {
  color: "rgba(255, 255, 255, 0.72)",
  fontSize: 11,
  marginTop: 3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}

const chipStyle: React.CSSProperties = {
  border: "1px solid rgba(255, 255, 255, 0.65)",
  borderRadius: 6,
  padding: "3px 7px",
  fontSize: 11,
  fontWeight: 850,
  whiteSpace: "nowrap",
  color: "#fff",
}

const emptyStyle: React.CSSProperties = {
  border: "1px dashed var(--lcc-glass-border)",
  borderRadius: 6,
  padding: 14,
  color: "var(--lcc-text-faint)",
  fontSize: 12,
}

const modalBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  display: "grid",
  placeItems: "center",
  padding: 18,
  background: "rgba(2, 6, 23, 0.62)",
}

const modalStyle: React.CSSProperties = {
  position: "relative",
  top: "auto",
  right: "auto",
  bottom: "auto",
  transform: "none",
  width: "min(870px, 100%)",
  maxHeight: "min(720px, calc(100vh - 36px))",
  minHeight: 0,
}
