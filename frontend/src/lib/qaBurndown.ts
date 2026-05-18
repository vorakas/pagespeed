type QaBurndownCycle = {
  totalCases?: number | null
  testCases?: Array<{ executedAt?: string | null }>
}

export type QaBurndownPoint = {
  date: string
  executed: number
  remaining: number
}

function parseDate(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function localDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${date.getFullYear()}-${month}-${day}`
}

function localDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function buildQaBurndown(cycles: QaBurndownCycle[], startValue: string, endValue: string): QaBurndownPoint[] {
  const start = parseDate(startValue)
  const end = parseDate(endValue)
  if (!start || !end || end < start) return []

  const totalCases = cycles.reduce((sum, cycle) => sum + Number(cycle.totalCases || 0), 0)
  const executedByDay = new Map<string, number>()

  for (const cycle of cycles) {
    for (const testCase of cycle.testCases ?? []) {
      if (!testCase.executedAt) continue
      const executedAt = parseDate(testCase.executedAt)
      if (!executedAt || executedAt < start || executedAt > end) continue
      const day = localDateKey(executedAt)
      executedByDay.set(day, (executedByDay.get(day) ?? 0) + 1)
    }
  }

  const points: QaBurndownPoint[] = []
  let cursor = localDayStart(start)
  const last = localDayStart(end)
  let cumulative = 0

  while (cursor <= last) {
    const date = localDateKey(cursor)
    cumulative += executedByDay.get(date) ?? 0
    points.push({
      date,
      executed: cumulative,
      remaining: Math.max(totalCases - cumulative, 0),
    })
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1)
  }

  return points
}
