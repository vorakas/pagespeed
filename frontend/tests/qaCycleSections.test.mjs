import assert from "node:assert/strict"
import { test } from "node:test"

const { normalizeQaCycleSection } = await import("../src/lib/qaCycleSections.ts")

test("normalizeQaCycleSection maps known root cycles into requested QA rollups", () => {
  assert.equal(normalizeQaCycleSection({ key: "TC-C1426", name: "Bloomreach LP Feature E2E Testing - Desktop - Round 1", section: "Root" }), "LP Features")
  assert.equal(normalizeQaCycleSection({ key: "TC-C1427", name: "Bloomreach LP Feature E2E Testing - Mobile - Round 1", section: "Root" }), "LP Features")
  assert.equal(normalizeQaCycleSection({ key: "TC-C1570", name: "Search & Sort Page E2E Testing - Desktop - Round 1", section: "Root" }), "Desktop or Tablet")
  assert.equal(normalizeQaCycleSection({ key: "TC-C1569", name: "Search & Sort Page E2E Testing - Mobile - Round 1", section: "Root" }), "Mobile")
})

test("normalizeQaCycleSection preserves normal section values", () => {
  assert.equal(normalizeQaCycleSection({ key: "TC-C1", name: "Other Round 1", section: "LP Features" }), "LP Features")
})
