import { useState, useEffect, useMemo } from "react"
import { X, ExternalLink, CheckCircle2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { api } from "@/services/api"
import type { DevOpsConfig, DevOpsBuild, FailedTest, SkippedTest } from "@/types"

export type PanelMode = "failed" | "skipped"

interface BuildResultsPanelProps {
  config: DevOpsConfig
  build: DevOpsBuild
  mode: PanelMode
  prefetchedFailedTests?: FailedTest[]
  prefetchedSkippedTests?: SkippedTest[]
  onClose: () => void
}

export function BuildResultsPanel({
  config, build, mode, prefetchedFailedTests, prefetchedSkippedTests, onClose,
}: BuildResultsPanelProps) {
  const [loading, setLoading] = useState(false)
  const [failedTests, setFailedTests] = useState<FailedTest[]>([])
  const [skippedTests, setSkippedTests] = useState<SkippedTest[]>([])
  const [error, setError] = useState<string | null>(null)

  // Fetch failed tests
  useEffect(() => {
    if (mode !== "failed") return
    if (prefetchedFailedTests) {
      setFailedTests(prefetchedFailedTests)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setFailedTests([])
    api.getDevOpsFailedTests(config, build.id)
      .then((result) => {
        if (result.success) setFailedTests(result.failedTests)
        else setError("Failed to fetch test results.")
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to fetch test results."))
      .finally(() => setLoading(false))
  }, [build.id, config, mode, prefetchedFailedTests])

  // Fetch skipped tests
  useEffect(() => {
    if (mode !== "skipped") return
    if (prefetchedSkippedTests) {
      setSkippedTests(prefetchedSkippedTests)
      setError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    setSkippedTests([])
    api.getDevOpsSkippedTests(config, build.id)
      .then((result) => {
        if (result.success) setSkippedTests(result.skippedTests)
        else setError("Failed to fetch skipped tests.")
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to fetch skipped tests."))
      .finally(() => setLoading(false))
  }, [build.id, config, mode, prefetchedSkippedTests])

  // Filter out Visual Target tests that failed only because their Baseline failed
  const displayedFailedTests = useMemo(() =>
    failedTests.filter((test) =>
      !test.errorMessage?.includes("Baseline visual test failed and comparison test shouldn't be executed")
    ), [failedTests])

  const isFailedMode = mode === "failed"
  const tests = isFailedMode ? displayedFailedTests : skippedTests
  const title = isFailedMode ? "Failed Tests" : "Skipped Tests"
  const emptyMessage = isFailedMode ? "All tests passed" : "No skipped tests"
  const countLabel = isFailedMode
    ? `${tests.length} failed test${tests.length !== 1 ? "s" : ""}`
    : `${tests.length} skipped test${tests.length !== 1 ? "s" : ""}`

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate">
            {title} — #{build.buildNumber}
          </h3>
          <p className="text-xs text-muted-foreground truncate">{build.definitionName}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading {mode} tests...</span>
          </div>
        )}

        {error && (
          <p className="text-sm text-score-poor py-4">{error}</p>
        )}

        {!loading && !error && tests.length === 0 && (
          <div className="flex items-center gap-2 py-8 justify-center">
            <CheckCircle2 className="h-5 w-5 text-score-good" />
            <span className="text-sm text-score-good font-medium">{emptyMessage}</span>
          </div>
        )}

        {!loading && !error && tests.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground mb-3">{countLabel}</p>

            <div className="space-y-3">
              {tests.map((test, index) => (
                <div
                  key={`${test.testId}-${test.config}-${index}`}
                  className="rounded-lg border border-border bg-card p-3 space-y-2"
                >
                  {/* Header row: Test ID + name + config */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {test.zephyrUrl ? (
                        <a
                          href={test.zephyrUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-semibold text-sidebar-primary hover:underline flex items-center gap-1"
                        >
                          {test.testId} <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <span className="text-sm font-semibold text-foreground">{test.testId}</span>
                      )}
                      <span className="text-xs text-muted-foreground">{test.testName}</span>
                    </div>
                    {test.config && (
                      <span className="text-xs text-muted-foreground">{test.config}</span>
                    )}
                  </div>

                  {/* Exception message */}
                  {test.errorMessage && (
                    <p className={`text-xs ${isFailedMode ? "text-score-poor" : "text-muted-foreground"}`}>
                      {test.errorMessage}
                    </p>
                  )}

                  {/* Stack trace (expandable, failed mode only) */}
                  {"stackTrace" in test && test.stackTrace && (
                    <details className="group">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                        Stack trace
                      </summary>
                      <pre className="mt-1 max-h-64 overflow-auto rounded border border-border bg-background p-2 text-[11px] text-muted-foreground whitespace-pre-wrap break-words">
                        {test.stackTrace}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
