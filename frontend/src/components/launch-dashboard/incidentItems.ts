import { formatPacificDate } from "@/lib/datetime"
import type { MigrationBlocker, RawTaskRecord } from "@/types"

export type IncidentFilter = "all" | "prod" | "blocker" | "bug"

export interface IncidentItem {
  kind: "prod" | "blocker" | "bug"
  id: string
  title: string
  note: string | null
  severity: string | null
  meta: string | null
  time: string | null
  sortTime: number
  raw: MigrationBlocker | RawTaskRecord
}

interface BuildIncidentItemsInput {
  blockers: MigrationBlocker[] | null
  prodFailures: RawTaskRecord[] | null
  newBugs: RawTaskRecord[] | null
  filter?: IncidentFilter
}

const SEV_ORDER: Record<string, number> = {
  critical: 0,
  blocker: 0,
  high: 1,
  medium: 2,
  low: 3,
}

function parseTimestamp(value: string | null | undefined): number {
  if (!value) return 0
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : 0
}

export function buildIncidentItems({
  blockers,
  prodFailures,
  newBugs,
  filter = "all",
}: BuildIncidentItemsInput): IncidentItem[] {
  const out: IncidentItem[] = []
  for (const p of prodFailures ?? []) {
    out.push({
      kind: "prod",
      id: p.key,
      title: p.summary ?? "(no summary)",
      note: p.uatStatus ?? p.status,
      severity: incidentSeverity(p),
      meta: p.assignee,
      time: "active",
      sortTime: parseTimestamp(p.updated) || parseTimestamp(p.created),
      raw: p,
    })
  }
  for (const b of blockers ?? []) {
    out.push({
      kind: "blocker",
      id: b.id,
      title: b.name,
      note: b.note,
      severity: (b.severity ?? "").toLowerCase() || "medium",
      meta: b.affects.join(", "),
      time: b.status || null,
      sortTime: 0,
      raw: b,
    })
  }
  for (const n of newBugs ?? []) {
    out.push({
      kind: "bug",
      id: n.key,
      title: n.summary ?? "(no summary)",
      note: n.assignee ? `@${n.assignee}` : "UNASSIGNED",
      severity: incidentSeverity(n),
      meta: n.project,
      time: n.created ? `filed ${formatPacificDate(n.created)}` : null,
      sortTime: parseTimestamp(n.updated) || parseTimestamp(n.created),
      raw: n,
    })
  }
  return out
    .filter((i) => filter === "all" || i.kind === filter)
    .sort((a, b) => {
      const sevDiff =
        (SEV_ORDER[a.severity ?? "medium"] ?? 9) -
        (SEV_ORDER[b.severity ?? "medium"] ?? 9)
      if (sevDiff !== 0) return sevDiff
      return b.sortTime - a.sortTime
    })
}

function incidentSeverity(task: RawTaskRecord): string {
  const launchPriority = (task.launchPriority ?? "").toLowerCase()
  if (launchPriority === "p1") return "critical"
  if (launchPriority === "p2") return "high"
  if (launchPriority === "p3") return "medium"
  if (launchPriority === "post-launch") return "low"
  return (task.priority ?? "").toLowerCase() || "medium"
}
