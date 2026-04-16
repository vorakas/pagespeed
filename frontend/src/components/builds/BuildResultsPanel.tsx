import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { X, ExternalLink, CheckCircle2, Loader2, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
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

type ScreenshotStatus = "loading" | "loaded" | "error"

/** Cache key for a screenshot, unique per test result. */
function screenshotKey(test: FailedTest): string {
  return `${test.runId}-${test.resultId}-${test.screenshotId}`
}

/**
 * Hook that background-fetches all screenshots for a list of failed tests.
 * Returns a Map of key → object URL for ready screenshots, and a status Map.
 */
function useScreenshotPrefetch(config: DevOpsConfig, tests: FailedTest[]) {
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  const [statuses, setStatuses] = useState<Map<string, ScreenshotStatus>>(new Map())
  const activeRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    const testsWithScreenshots = tests.filter(
      (t) => t.runId != null && t.resultId != null && t.screenshotId != null
    )
    if (testsWithScreenshots.length === 0) return

    for (const test of testsWithScreenshots) {
      const key = screenshotKey(test)
      // Skip if already fetched or in-flight
      if (activeRef.current.has(key)) continue
      activeRef.current.add(key)

      setStatuses((prev) => new Map(prev).set(key, "loading"))

      api
        .getDevOpsTestScreenshot(config, test.runId!, test.resultId!, test.screenshotId!)
        .then((objectUrl) => {
          setUrls((prev) => new Map(prev).set(key, objectUrl))
          setStatuses((prev) => new Map(prev).set(key, "loaded"))
        })
        .catch(() => {
          setStatuses((prev) => new Map(prev).set(key, "error"))
        })
    }
  }, [config, tests])

  // Revoke object URLs on unmount to free memory
  useEffect(() => {
    return () => {
      urls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { urls, statuses }
}

/** Screenshot thumbnail that reads from the prefetch cache. */
function ScreenshotThumbnail({
  test,
  screenshotUrl,
  status,
  onOpen,
}: {
  test: FailedTest
  screenshotUrl: string | undefined
  status: ScreenshotStatus | undefined
  onOpen: (url: string, testId: string) => void
}) {
  if (status === "error" || (!status && !screenshotUrl)) return null
  if (status === "loading") {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading screenshot...
      </div>
    )
  }
  if (!screenshotUrl) return null

  return (
    <button
      type="button"
      className="mt-2 block cursor-pointer rounded border border-border overflow-hidden hover:border-foreground/30 transition-colors w-full max-w-xs"
      onClick={() => onOpen(screenshotUrl, test.testId)}
      title="Click to view full size"
    >
      <img
        src={screenshotUrl}
        alt={`Screenshot for ${test.testId}`}
        className="w-full h-auto"
      />
    </button>
  )
}

/** Expandable failure details: stack trace + screenshot. */
function FailureDetails({
  test,
  screenshotUrl,
  screenshotStatus,
  onScreenshotOpen,
}: {
  test: FailedTest
  screenshotUrl: string | undefined
  screenshotStatus: ScreenshotStatus | undefined
  onScreenshotOpen: (url: string, testId: string) => void
}) {
  const hasScreenshot = test.screenshotId != null

  if (!test.stackTrace && !hasScreenshot) return null

  return (
    <details className="group">
      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1.5">
        {test.stackTrace ? "Stack trace" : "Screenshot"}
        {hasScreenshot && <ImageIcon className="h-3 w-3" />}
      </summary>
      {test.stackTrace && (
        <pre className="mt-1 max-h-64 overflow-auto rounded border border-border bg-background p-2 text-[11px] text-muted-foreground whitespace-pre-wrap break-words">
          {test.stackTrace}
        </pre>
      )}
      {hasScreenshot && (
        <ScreenshotThumbnail
          test={test}
          screenshotUrl={screenshotUrl}
          status={screenshotStatus}
          onOpen={onScreenshotOpen}
        />
      )}
    </details>
  )
}

export function BuildResultsPanel({
  config, build, mode, prefetchedFailedTests, prefetchedSkippedTests, onClose,
}: BuildResultsPanelProps) {
  const [loading, setLoading] = useState(false)
  const [failedTests, setFailedTests] = useState<FailedTest[]>([])
  const [skippedTests, setSkippedTests] = useState<SkippedTest[]>([])
  const [error, setError] = useState<string | null>(null)

  // Screenshot lightbox state
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [lightboxTestId, setLightboxTestId] = useState<string>("")

  const openLightbox = useCallback((url: string, testId: string) => {
    setLightboxUrl(url)
    setLightboxTestId(testId)
  }, [])

  const closeLightbox = useCallback(() => {
    setLightboxUrl(null)
    setLightboxTestId("")
  }, [])

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

  // Background-prefetch all screenshots as soon as failed tests are available
  const { urls: screenshotUrls, statuses: screenshotStatuses } =
    useScreenshotPrefetch(config, displayedFailedTests)

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
              {tests.map((test, index) => {
                const key = isFailedMode ? screenshotKey(test as FailedTest) : ""
                return (
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

                    {/* Stack trace + screenshot (expandable, failed mode only) */}
                    {isFailedMode && "stackTrace" in test && (
                      <FailureDetails
                        test={test as FailedTest}
                        screenshotUrl={screenshotUrls.get(key)}
                        screenshotStatus={screenshotStatuses.get(key)}
                        onScreenshotOpen={openLightbox}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Screenshot lightbox modal */}
      <Dialog open={lightboxUrl !== null} onOpenChange={(open) => { if (!open) closeLightbox() }}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] sm:max-w-[90vw] p-2">
          <DialogHeader className="px-2 pt-1">
            <DialogTitle className="text-sm">Screenshot — {lightboxTestId}</DialogTitle>
            <DialogDescription className="sr-only">
              Full-size failure screenshot for test {lightboxTestId}
            </DialogDescription>
          </DialogHeader>
          {lightboxUrl && (
            <div className="overflow-auto max-h-[calc(90vh-4rem)]">
              <img
                src={lightboxUrl}
                alt={`Full screenshot for ${lightboxTestId}`}
                className="w-full h-auto"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
