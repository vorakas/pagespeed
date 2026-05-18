import assert from "node:assert/strict"
import { test } from "node:test"

process.env.TZ = "America/Los_Angeles"

const { buildQaBurndown } = await import("../src/lib/qaBurndown.ts")

test("buildQaBurndown computes cumulative executed and remaining cases from loaded cycles", () => {
  const cycles = [
    {
      totalCases: 4,
      testCases: [
        { executedAt: "2026-05-10T15:00:00Z" },
        { executedAt: "2026-05-11T01:00:00Z" },
        { executedAt: "2026-05-11T18:00:00Z" },
        { executedAt: "2026-05-13T01:00:00Z" },
      ],
    },
    {
      totalCases: 2,
      testCases: [
        { executedAt: null },
        { executedAt: "2026-05-12T12:00:00Z" },
      ],
    },
  ]

  assert.deepEqual(
    buildQaBurndown(cycles, "2026-05-11T00:00:00Z", "2026-05-13T23:59:59Z"),
    [
      { date: "2026-05-10", executed: 1, remaining: 5 },
      { date: "2026-05-11", executed: 2, remaining: 4 },
      { date: "2026-05-12", executed: 4, remaining: 2 },
      { date: "2026-05-13", executed: 4, remaining: 2 },
    ],
  )
})

test("buildQaBurndown labels late local ranges by local calendar day", () => {
  assert.deepEqual(
    buildQaBurndown(
      [{ totalCases: 2, testCases: [{ executedAt: "2026-05-18T08:00:00Z" }] }],
      "2026-05-12T06:30:00Z",
      "2026-05-19T06:30:00Z",
    ).map((point) => point.date),
    [
      "2026-05-11",
      "2026-05-12",
      "2026-05-13",
      "2026-05-14",
      "2026-05-15",
      "2026-05-16",
      "2026-05-17",
      "2026-05-18",
    ],
  )
})

test("buildQaBurndown returns no points for an invalid range", () => {
  assert.deepEqual(buildQaBurndown([], "2026-05-13T00:00:00Z", "2026-05-11T00:00:00Z"), [])
})
