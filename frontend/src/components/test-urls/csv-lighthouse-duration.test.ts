import { describe, expect, it } from "vitest"
import { formatRunDuration } from "./csv-lighthouse-duration"

describe("formatRunDuration", () => {
  it("formats completed run duration from start and finish timestamps", () => {
    expect(formatRunDuration("2026-06-15T10:00:00Z", "2026-06-15T10:08:42Z", "completed")).toBe("8m 42s")
  })

  it("formats running elapsed duration from start timestamp", () => {
    expect(formatRunDuration("2026-06-15T10:00:00Z", null, "running", new Date("2026-06-15T10:03:10Z"))).toBe("running 3m 10s")
  })

  it("returns a dash when timestamps are missing", () => {
    expect(formatRunDuration(null, null, "pending")).toBe("-")
  })
})
