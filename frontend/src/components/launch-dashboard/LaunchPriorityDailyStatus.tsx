import { useMemo, useState } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { convertUtcTimesToPacific } from "@/lib/datetime"
import { renderHeadlineSegments } from "./headlineWikilinks"
import { TaskDetail } from "./SidePanel"
import type {
  MigrationLaunchPriorityBucket,
  MigrationLaunchPriorities,
  MigrationSnapshot,
  RawTaskRecord,
} from "@/types"

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
  const [selectedTask, setSelectedTask] = useState<RawTaskRecord | null>(null)
  return (
    <div>
      {bucket.items.length === 0 ? (
        <div style={emptyStyle}>No active {bucket.label} tasks.</div>
      ) : (
        <div style={rowsStyle}>
          {bucket.items.map((task) => (
            <TaskRow
              key={task.key}
              task={task}
              onSelect={() => setSelectedTask(task)}
            />
          ))}
        </div>
      )}
      <TaskModal task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  )
}

function TaskRow({
  task,
  onSelect,
}: {
  task: RawTaskRecord
  onSelect: () => void
}) {
  const meta = [
    task.assignee ? `@${task.assignee}` : "UNASSIGNED",
    task.uatStatus || task.taskStatus || task.status || "Open",
    task.updated ? `updated ${task.updated.slice(0, 10)}` : null,
  ].filter(Boolean)

  return (
    <div style={rowStyle}>
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

function TaskModal({ task, onClose }: { task: RawTaskRecord | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-h-[85vh] overflow-hidden p-0 sm:max-w-[90rem]"
        showCloseButton={false}
      >
        <div
          style={taskDialogFrameStyle}
          className="launch-dashboard-side-panel launch-dashboard-task-dialog-frame open"
        >
          {task && <TaskDetail task={task} onClose={onClose} />}
        </div>
      </DialogContent>
    </Dialog>
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
  letterSpacing: "0.12em",
  fontWeight: 600,
  marginBottom: 10,
}

const eyebrowSep: React.CSSProperties = { color: "var(--lcc-glass-border)" }
const eyebrowFile: React.CSSProperties = { textTransform: "none", fontWeight: 500 }

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

const rowsStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  border: "1px solid var(--glass-border)",
  background: "var(--lcc-violet-bg)",
  borderRadius: 6,
  padding: "9px 10px",
}

const rowIdPillStyle: React.CSSProperties = {
  width: 88,
  flex: "0 0 auto",
  color: "var(--lcc-text)",
  border: "1px solid var(--glass-border-strong)",
  background: "var(--glass-hi)",
  borderRadius: 999,
  padding: "5px 8px",
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
}

const rowTitleStyle: React.CSSProperties = {
  color: "var(--lcc-text)",
  fontSize: 13,
  fontWeight: 600,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}

const rowMetaStyle: React.CSSProperties = {
  color: "var(--lcc-text-dim)",
  fontSize: 11,
  marginTop: 3,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
}

const chipStyle: React.CSSProperties = {
  border: "1px solid var(--glass-border-strong)",
  borderRadius: 6,
  padding: "3px 7px",
  fontSize: 11,
  fontWeight: 700,
  whiteSpace: "nowrap",
  color: "var(--lcc-text)",
}

const emptyStyle: React.CSSProperties = {
  border: "1px dashed var(--lcc-glass-border)",
  borderRadius: 6,
  padding: 14,
  color: "var(--lcc-text-faint)",
  fontSize: 12,
}

const taskDialogFrameStyle: React.CSSProperties = {
  position: "relative",
  top: "auto",
  right: "auto",
  bottom: "auto",
  left: "auto",
  transform: "none",
  width: "100%",
  height: "min(760px, 85vh)",
  maxWidth: "none",
  maxHeight: "85vh",
  minHeight: 0,
  zIndex: "auto",
  transition: "none",
}
