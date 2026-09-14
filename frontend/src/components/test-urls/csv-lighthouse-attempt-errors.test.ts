import { describe, expect, it } from "vitest"

import { buildCsvLighthouseAttemptErrorDisplay } from "./csv-lighthouse-attempt-errors"

describe("buildCsvLighthouseAttemptErrorDisplay", () => {
  it("groups exact attempt errors into compact evidence labels and keeps raw details", () => {
    const display = buildCsvLighthouseAttemptErrorDisplay([
      {
        status: "error",
        error_message: "node[4937]: pthread_create: Resource temporarily unavailable",
        count: 3,
      },
      {
        status: "error",
        error_message: "Error: connect ECONNREFUSED 127.0.0.1:35099",
        count: 2,
      },
      {
        status: "error",
        error_message: "Lighthouse timed out after 90s for https://www.lampsplus.com/sfp/11p72",
        count: 1,
      },
    ])

    expect(display?.summary).toBe(
      "Attempt errors: Resource exhaustion (3), Chrome connection refused (2), Lighthouse timeout (1)",
    )
    expect(display?.title).toContain("3x error: node[4937]: pthread_create")
    expect(display?.title).toContain("2x error: Error: connect ECONNREFUSED")
    expect(display?.total).toBe(6)
  })

  it("returns null when there are no attempt errors", () => {
    expect(buildCsvLighthouseAttemptErrorDisplay([])).toBeNull()
    expect(buildCsvLighthouseAttemptErrorDisplay(undefined)).toBeNull()
  })
})
