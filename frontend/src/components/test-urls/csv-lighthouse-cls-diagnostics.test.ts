import { describe, expect, it } from "vitest"

import { buildCsvLighthouseClsDiagnosticDisplay } from "./csv-lighthouse-cls-diagnostics"

describe("buildCsvLighthouseClsDiagnosticDisplay", () => {
  it("explains zero CLS when Lighthouse saw no layout-shift entries", () => {
    const display = buildCsvLighthouseClsDiagnosticDisplay({
      observed_shift_count: 0,
      largest_shift_score: null,
      largest_shift_node: null,
    })

    expect(display?.summary).toBe("No shifts")
    expect(display?.title).toBe("Lighthouse layout-shifts audit observed no layout-shift entries.")
  })

  it("summarizes observed layout shifts with largest culprit details", () => {
    const display = buildCsvLighthouseClsDiagnosticDisplay({
      observed_shift_count: 2,
      largest_shift_score: 0.015,
      largest_shift_node: "<img class=\"hero\">",
    })

    expect(display?.summary).toBe("2 shifts")
    expect(display?.title).toContain("Observed layout-shift entries: 2")
    expect(display?.title).toContain("Largest shift score: 0.015")
    expect(display?.title).toContain("<img class=\"hero\">")
  })
})
