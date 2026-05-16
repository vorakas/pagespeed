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

function utcDateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function utcDayStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
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
      const day = utcDateKey(executedAt)
      executedByDay.set(day, (executedByDay.get(day) ?? 0) + 1)
    }
  }

  const points: QaBurndownPoint[] = []
  let cursor = utcDayStart(start)
  const last = utcDayStart(end)
  let cumulative = 0

  while (cursor <= last) {
    const date = utcDateKey(cursor)
    cumulative += executedByDay.get(date) ?? 0
    points.push({
      date,
      executed: cumulative,
      remaining: Math.max(totalCases - cumulative, 0),
    })
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  }

  return points
}
