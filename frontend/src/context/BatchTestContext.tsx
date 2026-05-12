import { createContext, useState, useRef, useCallback, type ReactNode } from "react"
import { api } from "@/services/api"
import type { TestProgressEntry } from "@/components/test-urls/TestProgressPanel"
import type { Strategy, SiteWithUrls } from "@/types"
import {
  loadBatchHistory,
  saveBatchRun,
  deleteBatchRun,
  clearBatchHistory,
  type BatchRun,
} from "@/services/batchHistory"

const CONCURRENCY = 3

interface BatchTestProgress {
  completed: number
  total: number
  successful: number
  failed: number
  activeUrls: string[]
  finished: boolean
  strategy: Strategy
}

interface BatchTestContextValue {
  testing: boolean
  progress: BatchTestProgress
  recentResults: TestProgressEntry[]
  allResults: TestProgressEntry[]
  history: BatchRun[]
  startBatchTest: (sites: SiteWithUrls[], strategy: Strategy) => void
  dismissResults: () => void
  deleteRun: (runId: string) => void
  clearHistory: () => void
}

const initialProgress: BatchTestProgress = {
  completed: 0,
  total: 0,
  successful: 0,
  failed: 0,
  activeUrls: [],
  finished: false,
  strategy: "desktop",
}

export const BatchTestContext = createContext<BatchTestContextValue | null>(null)

export function BatchTestProvider({ children }: { children: ReactNode }) {
  const [testing, setTesting] = useState(false)
  const [progress, setProgress] = useState<BatchTestProgress>(initialProgress)
  const [recentResults, setRecentResults] = useState<TestProgressEntry[]>([])
  const [allResults, setAllResults] = useState<TestProgressEntry[]>([])
  const [history, setHistory] = useState<BatchRun[]>(() => loadBatchHistory())
  const abortRef = useRef(false)

  const startBatchTest = useCallback((sites: SiteWithUrls[], strategy: Strategy) => {
    if (testing) return

    const allUrls: Array<{ id: number; url: string; siteName: string }> = []
    for (const site of sites) {
      for (const url of site.urls) {
        allUrls.push({ id: url.id, url: url.url, siteName: site.name })
      }
    }
    if (allUrls.length === 0) return

    abortRef.current = false
    setTesting(true)
    setRecentResults([])
    setAllResults([])
    setProgress({
      completed: 0,
      total: allUrls.length,
      successful: 0,
      failed: 0,
      activeUrls: [],
      finished: false,
      strategy,
    })

    let successful = 0
    let failed = 0
    let nextIndex = 0
    const entries: TestProgressEntry[] = []

    async function testOne(urlData: { id: number; url: string; siteName: string }) {
      setProgress((prev) => ({
        ...prev,
        activeUrls: [...prev.activeUrls, urlData.url],
      }))

      try {
        const response = await api.testUrl(urlData.id, urlData.url, strategy)
        if (response.success) {
          successful++
          entries.unshift({ url: urlData.url, siteName: urlData.siteName, status: "success" })
        } else {
          failed++
          entries.unshift({
            url: urlData.url,
            siteName: urlData.siteName,
            status: "failed",
            error: response.error || "Test failed",
          })
        }
      } catch (err) {
        failed++
        entries.unshift({
          url: urlData.url,
          siteName: urlData.siteName,
          status: "failed",
          error: err instanceof Error ? err.message : "Network error",
        })
      }

      setRecentResults(entries.slice(0, 5))
      setAllResults([...entries])
      setProgress((prev) => ({
        ...prev,
        completed: prev.completed + 1,
        successful,
        failed,
        activeUrls: prev.activeUrls.filter((u) => u !== urlData.url),
      }))
    }

    async function worker() {
      while (!abortRef.current) {
        const index = nextIndex++
        if (index >= allUrls.length) break
        await testOne(allUrls[index])
      }
    }

    const workers = Array.from({ length: Math.min(CONCURRENCY, allUrls.length) }, () => worker())
    Promise.all(workers).then(() => {
      setProgress((prev) => ({ ...prev, activeUrls: [], finished: true }))
      setTesting(false)
      const run = saveBatchRun(strategy, entries)
      setHistory((prev) => [run, ...prev.slice(0, 19)])
    })
  }, [testing])

  const dismissResults = useCallback(() => {
    setAllResults([])
    setRecentResults([])
  }, [])

  const deleteRun = useCallback((runId: string) => {
    deleteBatchRun(runId)
    setHistory((prev) => prev.filter((r) => r.id !== runId))
  }, [])

  const handleClearHistory = useCallback(() => {
    clearBatchHistory()
    setHistory([])
  }, [])

  return (
    <BatchTestContext.Provider
      value={{
        testing, progress, recentResults, allResults, history,
        startBatchTest, dismissResults, deleteRun, clearHistory: handleClearHistory,
      }}
    >
      {children}
    </BatchTestContext.Provider>
  )
}
