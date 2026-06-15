import type { CsvLighthouseRunStatus } from "@/types"

function formatDurationParts(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `${hours}h ${remainingMinutes}m`
  }

  return `${minutes}m ${seconds}s`
}

export function formatRunDuration(
  startedAt: string | null,
  finishedAt: string | null,
  status: CsvLighthouseRunStatus,
  now: Date = new Date(),
) {
  if (!startedAt) return "-"

  const started = new Date(startedAt)
  const finished = finishedAt ? new Date(finishedAt) : now
  const durationMs = finished.getTime() - started.getTime()

  if (!Number.isFinite(durationMs)) return "-"

  const formatted = formatDurationParts(durationMs / 1000)
  return finishedAt || status === "completed" || status === "completed_with_failures" ? formatted : `running ${formatted}`
}
