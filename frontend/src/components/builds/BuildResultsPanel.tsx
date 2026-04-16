import { useState, useEffect, useMemo, useCallback } from "react"
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

/** Lazy-loaded screenshot thumbnail for a failed test. */
function ScreenshotThumbnail({
  config,
  test,
  onOpen,
}: {
  config: DevOpsConfig
  test: FailedTest
  onOpen: (url: string, testId: string) => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const fetchScreenshot = useCallback(() => {
    if (url || loading || !test.runId || !test.resultId || !test.screenshotId) return
    setLoading(true)
    api
      .getDevOpsTestScreenshot(config, test.runId, test.resultId, test.screenshotId)
      .then((objectUrl) => setUrl(objectUrl))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [config, test.runId, test.resultId, test.screenshotId, url, loading])

  // Fetch on mount (this component only renders inside an open <details>)
  useEffect(() => {
    fetchScreenshot()
  }, [fetchScreenshot])

  if (error) return null
  if (loading) {
    return (
      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading screenshot...
      </div>
    )
  }
  if (!url) return null

  return (
    <button
      type="button"
      className="mt-2 block cursor-pointer rounded border border-border overflow-hidden hover:border-foreground/30 transition-colors w-full max-w-xs"
      onClick={() => onOpen(url, test.testId)}
      title="Click to view full size"
    >
      <img
        src={url}
        alt={`Screenshot for ${test.testId}`}
        className="w-full h-auto"
      />
    </button>
  )
}

/** Expandable failure details: stack trace + screenshot. */
function FailureDetails({
  config,
  test,
  onScreenshotOpen,
}: {
  config: DevOpsConfig
  test: FailedTest
  onScreenshotOpen: (url: string, testId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const hasScreenshot = test.screenshotId != null

  if (!test.stackTrace && !hasScreenshot) return null

  return (
    <details className="group" onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}>
      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground flex items-center gap-1.5">
        {test.stackTrace ? "Stack trace" : "Screenshot"}
        {hasScreenshot && <ImageIcon className="h-3 w-3" />}
      </summary>
      {test.stackTrace && (
        <pre className="mt-1 max-h-64 overflow-auto rounded border border-border bg-background p-2 text-[11px] text-muted-foreground whitespace-pre-wrap break-words">
          {test.stackTrace}
        </pre>
      )}
      {hasScreenshot && open && (
        <ScreenshotThumbnail config={config} test={test} onOpen={onScreenshotOpen} />
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

                  {/* Stack trace + screenshot (expandable, failed mode only) */}
                  {isFailedMode && "stackTrace" in test && (
                    <FailureDetails
                      config={config}
                      test={test as FailedTest}
                      onScreenshotOpen={openLightbox}
                    />
                  )}
                </div>
              ))}
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
