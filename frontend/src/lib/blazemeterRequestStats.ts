import type { BlazemeterLabelRow } from "../types"

export interface BlazemeterRequestStatGroup extends BlazemeterLabelRow {
  groupName: string
  sourceLabels: string[]
}

const EXCLUDED_GROUP_NAMES = new Set([
  "Jsr223 Sampler",
  "Aggregated Labels",
  "HTTPS",
  "Search Sku To Pdp Api",
  "Search SKU To Pdp Final",
  "More Like This",
  "Sort Br",
  "Search Br",
].map((name) => name.toLowerCase()))

function titleCaseGroup(value: string): string {
  if (!value) return value
  const upper = value.toUpperCase()
  if (/^[A-Z0-9]{2,6}$/.test(upper)) return upper
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (char) => char.toUpperCase())
}

export function requestStatGroupName(label: string | null): string | null {
  if (!label) return null
  const trimmed = label.trim()
  if (!trimmed) return null
  const withoutPrefix = trimmed.replace(/^\s*(?:T?C?-?\d{1,3})\s*[-_.:)]\s*/i, "").trim()
  const [beforeColon] = withoutPrefix.split(":")
  const group = (beforeColon || withoutPrefix).trim()
  return titleCaseGroup(group)
}

export function buildRequestStatGroups(rows: BlazemeterLabelRow[]): BlazemeterRequestStatGroup[] {
  const exactGroupNames = new Set(
    rows
      .filter((row) => row.labelName && !row.labelName.includes(":"))
      .map((row) => requestStatGroupName(row.labelName))
      .filter((name): name is string => Boolean(name)),
  )
  const groups = new Map<string, BlazemeterRequestStatGroup>()
  const order: string[] = []

  for (const row of rows) {
    const groupName = requestStatGroupName(row.labelName)
    if (!groupName) continue
    if (EXCLUDED_GROUP_NAMES.has(groupName.toLowerCase())) continue
    const isExactGroup = row.labelName?.trim().toLowerCase() === groupName.toLowerCase()
    if (exactGroupNames.has(groupName) && !isExactGroup) continue
    if (!groups.has(groupName)) {
      groups.set(groupName, {
        ...row,
        labelName: groupName,
        groupName,
        sourceLabels: row.labelName ? [row.labelName] : [],
      })
      order.push(groupName)
      continue
    }

    const group = groups.get(groupName)!
    const existingSamples = group.samples ?? 0
    const rowSamples = row.samples ?? 0
    const totalSamples = existingSamples + rowSamples
    const existingWeighted =
      group.avgResponseTime != null ? group.avgResponseTime * existingSamples : 0
    const rowWeighted = row.avgResponseTime != null ? row.avgResponseTime * rowSamples : 0

    group.samples = totalSamples
    group.errors = (group.errors ?? 0) + (row.errors ?? 0)
    group.errorRate = totalSamples > 0 ? ((group.errors ?? 0) / totalSamples) * 100 : null
    group.avgResponseTime = totalSamples > 0 ? (existingWeighted + rowWeighted) / totalSamples : null
    group.minResponseTime =
      group.minResponseTime == null
        ? row.minResponseTime
        : row.minResponseTime == null
          ? group.minResponseTime
          : Math.min(group.minResponseTime, row.minResponseTime)
    group.maxResponseTime =
      group.maxResponseTime == null
        ? row.maxResponseTime
        : row.maxResponseTime == null
          ? group.maxResponseTime
          : Math.max(group.maxResponseTime, row.maxResponseTime)
    group.avgThroughput = (group.avgThroughput ?? 0) + (row.avgThroughput ?? 0)
    group.avgBytes = group.avgBytes ?? row.avgBytes
    group.sourceLabels.push(row.labelName ?? groupName)
  }

  return order.map((name) => groups.get(name)!)
}
