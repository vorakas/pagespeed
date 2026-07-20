import type { CsvLighthouseItem } from "@/types"

export interface CsvLighthouseAverageRow {
  passedCount: number
  performance: number | null
  fcp: number | null
  speed_index: number | null
  lcp: number | null
  tbt: number | null
  cls: number | null
}

export interface CsvLighthouseResultSection {
  key: string
  target: CsvLighthouseItem["site_key"]
  group: string
  items: CsvLighthouseItem[]
  average: CsvLighthouseAverageRow
}

const metricKeys = ["performance", "fcp", "speed_index", "lcp", "tbt", "cls"] as const

function average(values: number[]) {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function buildAverage(items: CsvLighthouseItem[]): CsvLighthouseAverageRow {
  const passedItems = items.filter((item) => item.status === "passed")
  const row: CsvLighthouseAverageRow = {
    passedCount: passedItems.length,
    performance: null,
    fcp: null,
    speed_index: null,
    lcp: null,
    tbt: null,
    cls: null,
  }

  for (const key of metricKeys) {
    row[key] = average(
      passedItems
        .map((item) => item[key])
        .filter((value): value is number => typeof value === "number"),
    )
  }

  return row
}

export function buildCsvLighthouseResultSections(items: CsvLighthouseItem[]) {
  const sections = new Map<string, CsvLighthouseResultSection>()

  for (const item of items) {
    const key = `${item.site_key}::${item.group_key}`
    const existing = sections.get(key)
    if (existing) {
      existing.items.push(item)
      continue
    }

    sections.set(key, {
      key,
      target: item.site_key,
      group: item.group_key,
      items: [item],
      average: {
        passedCount: 0,
        performance: null,
        fcp: null,
        speed_index: null,
        lcp: null,
        tbt: null,
        cls: null,
      },
    })
  }

  return Array.from(sections.values()).map((section) => ({
    ...section,
    average: buildAverage(section.items),
  }))
}
