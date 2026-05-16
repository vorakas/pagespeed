import assert from "node:assert/strict"
import { test } from "node:test"

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
      { date: "2026-05-11", executed: 2, remaining: 4 },
      { date: "2026-05-12", executed: 3, remaining: 3 },
      { date: "2026-05-13", executed: 4, remaining: 2 },
    ],
  )
})

test("buildQaBurndown returns no points for an invalid range", () => {
  assert.deepEqual(buildQaBurndown([], "2026-05-13T00:00:00Z", "2026-05-11T00:00:00Z"), [])
})
