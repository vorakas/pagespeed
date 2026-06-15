import { describe, expect, it } from "vitest"

import { countCsvRows, normalizeEditorText } from "./CsvLighthouseFilesPanel"

describe("CSV Lighthouse file editor helpers", () => {
  it("normalizes editor text to newline-terminated non-empty rows", () => {
    expect(normalizeEditorText(" brass-lamp/ \n\nfloor-lamp/")).toBe("brass-lamp/\nfloor-lamp/\n")
  })

  it("counts non-empty rows", () => {
    expect(countCsvRows("a\n\nb\n")).toBe(2)
  })
})
