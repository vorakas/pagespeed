import { describe, expect, it } from "vitest"

import {
  buildRelativeTimeRange,
  formatRelativeTimeRangeLabel,
  normalizeRelativeTimeRange,
} from "./newRelicTimeRange"

describe("New Relic relative time ranges", () => {
  it("builds New Relic query strings from custom day and week ranges", () => {
    expect(buildRelativeTimeRange(5, "days")).toBe("5 days ago")
    expect(buildRelativeTimeRange(1, "weeks")).toBe("1 week ago")
  })

  it("formats custom relative labels for the picker", () => {
    expect(formatRelativeTimeRangeLabel({ value: 7, unit: "days" })).toBe("Last 7 days")
    expect(formatRelativeTimeRangeLabel({ value: 1, unit: "hours" })).toBe("Last 1 hour")
  })

  it("normalizes invalid custom ranges to the default 30 minute window", () => {
    expect(normalizeRelativeTimeRange({ value: 0, unit: "days" })).toEqual({
      value: 30,
      unit: "minutes",
    })
    expect(normalizeRelativeTimeRange({ value: Number.NaN, unit: "weeks" })).toEqual({
      value: 30,
      unit: "minutes",
    })
  })
})
