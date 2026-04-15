import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Loader2, ExternalLink, CheckCircle2 } from "lucide-react"
import { api } from "@/services/api"
import type { DevOpsConfig, DevOpsBuild, FailedTest } from "@/types"

interface BuildResultsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  config: DevOpsConfig
  build: DevOpsBuild
}

export function BuildResultsModal({ open, onOpenChange, config, build }: BuildResultsModalProps) {
  const [loading, setLoading] = useState(false)
  const [failedTests, setFailedTests] = useState<FailedTest[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setError(null)
    api.getDevOpsFailedTests(config, build.id)
      .then((result) => {
        if (result.success) {
          setFailedTests(result.failedTests)
        } else {
          setError("Failed to fetch test results.")
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to fetch test results.")
      })
      .finally(() => setLoading(false))
  }, [open, build.id, config])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Test Results — #{build.buildNumber}
          </DialogTitle>
          <DialogDescription>
            {build.definitionName}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Loading test results...</span>
          </div>
        )}

        {error && (
          <p className="text-sm text-score-poor py-4">{error}</p>
        )}

        {!loading && !error && failedTests.length === 0 && (
          <div className="flex items-center gap-2 py-8 justify-center">
            <CheckCircle2 className="h-5 w-5 text-score-good" />
            <span className="text-sm text-score-good font-medium">All tests passed</span>
          </div>
        )}

        {!loading && !error && failedTests.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground mb-3">
              {failedTests.length} failed test{failedTests.length !== 1 ? "s" : ""}
            </p>

            <div className="space-y-3">
              {failedTests.map((test, index) => (
                <div
                  key={`${test.testId}-${test.config}-${index}`}
                  className="rounded-lg border border-border bg-card p-3 space-y-2"
                >
                  {/* Header row: Test ID + config */}
                  <div className="flex items-start justify-between gap-2">
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
                  </div>

                  {/* Exception message */}
                  {test.errorMessage && (
                    <p className="text-xs text-score-poor line-clamp-2">{test.errorMessage}</p>
                  )}

                  {/* Stack trace (expandable) */}
                  {test.stackTrace && (
                    <details className="group">
                      <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                        Stack trace
                      </summary>
                      <pre className="mt-1 max-h-48 overflow-auto rounded border border-border bg-background p-2 text-[11px] text-muted-foreground whitespace-pre-wrap break-words">
                        {test.stackTrace}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
