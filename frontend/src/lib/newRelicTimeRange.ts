export type RelativeTimeUnit = "minutes" | "hours" | "days" | "weeks"

export interface RelativeTimeRange {
  value: number
  unit: RelativeTimeUnit
}

const DEFAULT_RANGE: RelativeTimeRange = { value: 30, unit: "minutes" }

const UNIT_LIMITS: Record<RelativeTimeUnit, number> = {
  minutes: 120,
  hours: 72,
  days: 30,
  weeks: 12,
}

function singularize(unit: RelativeTimeUnit, value: number): string {
  return value === 1 ? unit.replace(/s$/, "") : unit
}

export function normalizeRelativeTimeRange(range: RelativeTimeRange): RelativeTimeRange {
  if (!Number.isFinite(range.value)) return DEFAULT_RANGE

  const rounded = Math.round(range.value)
  if (rounded < 1) return DEFAULT_RANGE

  const max = UNIT_LIMITS[range.unit]
  return {
    value: Math.min(rounded, max),
    unit: range.unit,
  }
}

export function buildRelativeTimeRange(value: number, unit: RelativeTimeUnit): string {
  const normalized = normalizeRelativeTimeRange({ value, unit })
  return `${normalized.value} ${singularize(normalized.unit, normalized.value)} ago`
}

export function formatRelativeTimeRangeLabel(range: RelativeTimeRange): string {
  const normalized = normalizeRelativeTimeRange(range)
  return `Last ${normalized.value} ${singularize(normalized.unit, normalized.value)}`
}
