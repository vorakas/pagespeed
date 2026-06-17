import { describe, expect, it } from "vitest"

import {
  parseSavedQueries,
  removeQuery,
  upsertQuery,
  type SavedQuery,
} from "./savedNrqlQueries"

describe("parseSavedQueries", () => {
  it("returns an empty list for null or empty input", () => {
    expect(parseSavedQueries(null)).toEqual([])
    expect(parseSavedQueries("")).toEqual([])
  })

  it("returns an empty list for corrupt JSON", () => {
    expect(parseSavedQueries("{not json")).toEqual([])
  })

  it("returns an empty list for non-array JSON", () => {
    expect(parseSavedQueries('{"name":"x","query":"y"}')).toEqual([])
  })

  it("drops entries that are not name+query shaped", () => {
    const raw = JSON.stringify([
      { name: "ok", query: "SELECT 1" },
      { name: "missing query" },
      { query: "missing name" },
      null,
      "a string",
    ])
    expect(parseSavedQueries(raw)).toEqual([{ name: "ok", query: "SELECT 1" }])
  })
})

describe("upsertQuery", () => {
  it("appends a new entry with a trimmed name", () => {
    expect(upsertQuery([], "  My Query  ", "SELECT 1")).toEqual([
      { name: "My Query", query: "SELECT 1" },
    ])
  })

  it("overwrites an existing same-name entry without duplicating", () => {
    const list: SavedQuery[] = [{ name: "A", query: "old" }]
    expect(upsertQuery(list, "A", "new")).toEqual([{ name: "A", query: "new" }])
  })

  it("does not mutate the input list", () => {
    const list: SavedQuery[] = [{ name: "A", query: "old" }]
    upsertQuery(list, "B", "x")
    expect(list).toEqual([{ name: "A", query: "old" }])
  })
})

describe("removeQuery", () => {
  it("removes the named entry and keeps the others", () => {
    const list: SavedQuery[] = [
      { name: "A", query: "1" },
      { name: "B", query: "2" },
    ]
    expect(removeQuery(list, "A")).toEqual([{ name: "B", query: "2" }])
  })

  it("does not mutate the input list", () => {
    const list: SavedQuery[] = [{ name: "A", query: "1" }]
    removeQuery(list, "A")
    expect(list).toEqual([{ name: "A", query: "1" }])
  })
})
