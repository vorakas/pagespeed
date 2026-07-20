import { describe, expect, it } from "vitest"
import type { CsvLighthouseItem } from "@/types"
import { buildCsvLighthouseResultSections } from "./csv-lighthouse-results"

function item(overrides: Partial<CsvLighthouseItem>): CsvLighthouseItem {
  return {
    id: overrides.id ?? 1,
    run_id: 1,
    source_filename: "PDP.csv",
    group_key: "PDP",
    site_key: "www",
    original_value: "brass-lamp/",
    generated_url: "https://www.lampsplus.com/p/brass-lamp/",
    strategy: "desktop",
    status: "passed",
    error_message: null,
    performance: 90,
    fcp: 100,
    speed_index: 200,
    lcp: 300,
    tbt: 40,
    cls: 0.01,
    attempts: 1,
    started_at: null,
    completed_at: null,
    duration_ms: null,
    created_at: "2026-06-15T10:00:00Z",
    ...overrides,
  }
}

describe("buildCsvLighthouseResultSections", () => {
  it("adds an averages row after each target and group section using passed rows only", () => {
    const sections = buildCsvLighthouseResultSections([
      item({ id: 1, performance: 80, fcp: 100, speed_index: 200, lcp: 300, tbt: 40, cls: 0.01 }),
      item({ id: 2, performance: 90, fcp: 300, speed_index: 600, lcp: 900, tbt: 80, cls: 0.03 }),
      item({ id: 3, status: "failed", performance: null, fcp: null, speed_index: null, lcp: null, tbt: null, cls: null }),
      item({ id: 4, group_key: "SFP", performance: 70, fcp: 500, speed_index: 700, lcp: 900, tbt: 100, cls: 0.05 }),
    ])

    expect(sections).toHaveLength(2)
    expect(sections[0].key).toBe("www::PDP")
    expect(sections[0].average).toMatchObject({
      passedCount: 2,
      performance: 85,
      fcp: 200,
      speed_index: 400,
      lcp: 600,
      tbt: 60,
      cls: 0.02,
    })
    expect(sections[1].key).toBe("www::SFP")
    expect(sections[1].average.passedCount).toBe(1)
  })
})
