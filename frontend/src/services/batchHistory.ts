import type { TestProgressEntry } from "@/components/test-urls/TestProgressPanel"
import type { Strategy } from "@/types"

const STORAGE_KEY = "batchTestHistory"
const MAX_RUNS = 20

export interface BatchRun {
  id: string
  timestamp: string
  strategy: Strategy
  total: number
  successful: number
  failed: number
  results: TestProgressEntry[]
}

export function loadBatchHistory(): BatchRun[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveBatchRun(
  strategy: Strategy,
  results: TestProgressEntry[],
): BatchRun {
  const run: BatchRun = {
    id: Date.now().toString(36),
    timestamp: new Date().toISOString(),
    strategy,
    total: results.length,
    successful: results.filter((r) => r.status === "success").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  }

  const history = loadBatchHistory()
  history.unshift(run)
  if (history.length > MAX_RUNS) history.length = MAX_RUNS
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  return run
}

export function deleteBatchRun(runId: string): void {
  const history = loadBatchHistory().filter((r) => r.id !== runId)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
}

export function clearBatchHistory(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function getRepeatFailures(history: BatchRun[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const run of history) {
    for (const entry of run.results) {
      if (entry.status === "failed") {
        counts.set(entry.url, (counts.get(entry.url) ?? 0) + 1)
      }
    }
  }
  return counts
}
