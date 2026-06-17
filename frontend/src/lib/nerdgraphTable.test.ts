import { describe, expect, it } from "vitest"

import {
  buildCsv,
  csvFilename,
  deriveColumns,
  formatCellValue,
  formatCsvValue,
} from "./nerdgraphTable"

describe("deriveColumns", () => {
  it("returns the first-seen union of keys across rows", () => {
    const rows = [{ a: 1, b: 2 }, { b: 3, c: 4 }]
    expect(deriveColumns(rows)).toEqual(["a", "b", "c"])
  })

  it("places facet first when present", () => {
    const rows = [{ count: 9, facet: "home" }]
    expect(deriveColumns(rows)).toEqual(["facet", "count"])
  })

  it("returns an empty array for no rows", () => {
    expect(deriveColumns([])).toEqual([])
  })

  it("does not duplicate a column missing from a later row", () => {
    const rows = [{ a: 1, b: 2 }, { a: 3 }]
    expect(deriveColumns(rows)).toEqual(["a", "b"])
  })
})

describe("formatCellValue", () => {
  it("renders primitives as strings", () => {
    expect(formatCellValue(42)).toBe("42")
    expect(formatCellValue("x")).toBe("x")
    expect(formatCellValue(true)).toBe("true")
  })

  it("renders null and undefined as an em dash", () => {
    expect(formatCellValue(null)).toBe("—")
    expect(formatCellValue(undefined)).toBe("—")
  })

  it("stringifies nested objects and arrays", () => {
    expect(formatCellValue({ a: 1 })).toBe('{"a":1}')
    expect(formatCellValue([1, 2])).toBe("[1,2]")
  })
})

describe("formatCsvValue", () => {
  it("renders null and undefined as empty string", () => {
    expect(formatCsvValue(null)).toBe("")
    expect(formatCsvValue(undefined)).toBe("")
  })

  it("renders primitives as strings", () => {
    expect(formatCsvValue(42)).toBe("42")
    expect(formatCsvValue("plain")).toBe("plain")
    expect(formatCsvValue(true)).toBe("true")
  })

  it("stringifies nested values like cells do", () => {
    expect(formatCsvValue({ a: 1 })).toBe('{"a":1}')
  })
})

describe("buildCsv", () => {
  it("builds a header row plus one row per result, CRLF separated", () => {
    const rows = [{ facet: "home", count: 9 }]
    const csv = buildCsv(rows, ["facet", "count"])
    expect(csv).toBe("facet,count\r\nhome,9")
  })

  it("escapes fields containing commas, quotes, and newlines", () => {
    const rows = [{ a: 'x,y', b: 'he said "hi"', c: "line1\nline2" }]
    const csv = buildCsv(rows, ["a", "b", "c"])
    expect(csv).toBe('a,b,c\r\n"x,y","he said ""hi""","line1\nline2"')
  })

  it("returns only the header row when results is empty", () => {
    expect(buildCsv([], ["a", "b"])).toBe("a,b")
  })
})

describe("csvFilename", () => {
  it("formats a zero-padded timestamp", () => {
    const date = new Date(2026, 5, 17, 9, 8, 7) // 2026-06-17 09:08:07 local
    expect(csvFilename(date)).toBe("nerdgraph-results-20260617-090807.csv")
  })
})
