import { useCallback, useEffect, useMemo, useState } from "react"
import { Download, FileText, Loader2, Play, Square, Trash2, Upload } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { CsvLibraryPanel } from "@/components/test-urls/CsvLibraryPanel"
import { CsvLighthouseFilesPanel } from "@/components/test-urls/CsvLighthouseFilesPanel"
import { CsvLighthouseResultsTable } from "@/components/test-urls/CsvLighthouseResultsTable"
import { api } from "@/services/api"
import type {
  CsvLighthouseRun,
  CsvLighthouseRunDetail,
  CsvLighthouseRunStatus,
  CsvLighthouseSiteKey,
  Strategy,
} from "@/types"
import { formatDateTime } from "@/lib/utils"
import { formatRunDuration } from "@/components/test-urls/csv-lighthouse-duration"

interface CsvLighthousePanelProps {
  strategy: Strategy
}

const terminalStatuses: CsvLighthouseRunStatus[] = [
  "completed",
  "completed_with_failures",
  "cancelled",
  "failed",
  "interrupted",
]

const exportableStatuses: CsvLighthouseRunStatus[] = ["completed", "completed_with_failures"]

const targetOptions: Array<{ key: CsvLighthouseSiteKey; label: string; shortLabel: string }> = [
  { key: "mcprod", label: "Adobe Commerce", shortLabel: "mcprod" },
  { key: "www", label: "LampsPlus", shortLabel: "www" },
]

function isTerminalStatus(status: CsvLighthouseRunStatus) {
  return terminalStatuses.includes(status)
}

function formatStatus(status: CsvLighthouseRunStatus) {
  return status.replaceAll("_", " ")
}

function statusClassName(status: CsvLighthouseRunStatus) {
  if (status === "completed") {
    return "border-[color:var(--lcc-green)]/40 bg-[color:var(--lcc-green)]/10 text-[color:var(--lcc-green)]"
  }
  if (status === "completed_with_failures" || status === "failed" || status === "interrupted") {
    return "border-[color:var(--lcc-red)]/40 bg-[color:var(--lcc-red)]/10 text-[color:var(--lcc-red)]"
  }
  if (status === "cancelled") {
    return "border-border bg-muted text-muted-foreground"
  }
  return "border-[color:var(--lcc-blue)]/40 bg-[color:var(--lcc-blue)]/10 text-[color:var(--lcc-blue)]"
}

function RunStatusBadge({ status }: { status: CsvLighthouseRunStatus }) {
  return (
    <span className={`inline-flex rounded border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClassName(status)}`}>
      {formatStatus(status)}
    </span>
  )
}

export function CsvLighthousePanel({ strategy }: CsvLighthousePanelProps) {
  const [files, setFiles] = useState<File[]>([])
  const [libraryCount, setLibraryCount] = useState(0)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [label, setLabel] = useState("")
  const [selectedTargets, setSelectedTargets] = useState<CsvLighthouseSiteKey[]>(["mcprod", "www"])
  const [runs, setRuns] = useState<CsvLighthouseRun[]>([])
  const [selectedDetail, setSelectedDetail] = useState<CsvLighthouseRunDetail | null>(null)
  const [activeRunId, setActiveRunId] = useState<number | null>(null)
  const [starting, setStarting] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [deletingRunId, setDeletingRunId] = useState<number | null>(null)
  const [loadingRuns, setLoadingRuns] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedRun = selectedDetail?.run ?? null
  const activeRun = selectedRun && !isTerminalStatus(selectedRun.status) ? selectedRun : null
  const processedItems = selectedRun
    ? selectedRun.completed_items + selectedRun.failed_items + selectedRun.cancelled_items
    : 0
  const progress = selectedRun?.total_items ? Math.round((processedItems / selectedRun.total_items) * 100) : 0
  const canStart = (files.length > 0 || libraryCount > 0) && selectedTargets.length > 0 && !starting
  const canRunSelected = Boolean(selectedRun?.status === "pending" && !launching)
  const canCancel = Boolean(activeRun?.status === "running" && !cancelling)
  const canDownload = Boolean(selectedRun && exportableStatuses.includes(selectedRun.status))
  const largeRunWarning = files.length >= 3 || (selectedRun?.total_items ?? 0) >= 100

  const selectedTargetText = useMemo(() => {
    return selectedTargets
      .map((target) => targetOptions.find((option) => option.key === target)?.shortLabel)
      .filter(Boolean)
      .join(", ")
  }, [selectedTargets])

  const loadRuns = useCallback(async () => {
    setLoadingRuns(true)
    try {
      const response = await api.listCsvLighthouseRuns()
      setRuns(response.runs)
      setActiveRunId((current) => current ?? response.runs.find((run) => !isTerminalStatus(run.status))?.id ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load CSV Lighthouse runs")
    } finally {
      setLoadingRuns(false)
    }
  }, [])

  const loadRunDetail = useCallback(async (runId: number, options?: { quiet?: boolean }) => {
    if (!options?.quiet) {
      setLoadingDetail(true)
    }
    try {
      const response = await api.getCsvLighthouseRun(runId)
      setSelectedDetail({ run: response.run, items: response.items })
      setActiveRunId((current) => {
        if (!isTerminalStatus(response.run.status)) {
          return response.run.id
        }
        return current === response.run.id ? null : current
      })
      setRuns((current) => current.map((run) => (run.id === response.run.id ? response.run : run)))
      return response.run
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load CSV Lighthouse run")
      return null
    } finally {
      if (!options?.quiet) {
        setLoadingDetail(false)
      }
    }
  }, [])

  // Poll the active (running) run without clobbering whichever run the user is
  // currently viewing — only refresh selectedDetail when it matches the active run.
  const pollActiveRun = useCallback(async (runId: number) => {
    try {
      const response = await api.getCsvLighthouseRun(runId)
      setSelectedDetail((current) =>
        current?.run.id === response.run.id
          ? { run: response.run, items: response.items }
          : current,
      )
      setActiveRunId((current) => {
        if (!isTerminalStatus(response.run.status)) {
          return response.run.id
        }
        return current === response.run.id ? null : current
      })
      setRuns((current) => current.map((run) => (run.id === response.run.id ? response.run : run)))
      return response.run
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  useEffect(() => {
    if (!activeRunId) return

    const intervalId = window.setInterval(() => {
      pollActiveRun(activeRunId).then((run) => {
        if (run && isTerminalStatus(run.status)) {
          loadRuns()
        }
      })
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [activeRunId, pollActiveRun, loadRuns])

  const handleTargetToggle = (target: CsvLighthouseSiteKey, checked: boolean) => {
    setSelectedTargets((current) => {
      if (checked) {
        return current.includes(target) ? current : [...current, target]
      }
      return current.filter((item) => item !== target)
    })
  }

  const handleStart = async () => {
    if (!canStart) return

    setStarting(true)
    setError(null)
    try {
      const response = await api.createCsvLighthouseRun({
        files,
        siteKeys: selectedTargets,
        strategy,
        label,
      })
      setFiles([])
      setFileInputKey((current) => current + 1)
      await loadRuns()
      await loadRunDetail(response.run_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start CSV Lighthouse run")
    } finally {
      setStarting(false)
    }
  }

  const handleRunSelected = async () => {
    if (!selectedRun || !canRunSelected) return

    setLaunching(true)
    setError(null)
    try {
      const response = await api.startCsvLighthouseRun(selectedRun.id)
      setSelectedDetail({ run: response.run, items: response.items })
      setActiveRunId(response.run.id)
      await loadRuns()
      await loadRunDetail(response.run.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run CSV Lighthouse")
    } finally {
      setLaunching(false)
    }
  }

  const handleCancel = async () => {
    if (!activeRun) return

    setCancelling(true)
    setError(null)
    try {
      await api.cancelCsvLighthouseRun(activeRun.id)
      await loadRunDetail(activeRun.id)
      await loadRuns()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to cancel CSV Lighthouse run")
    } finally {
      setCancelling(false)
    }
  }

  const handleDeleteRun = async (run: CsvLighthouseRun) => {
    if (run.status === "running") return
    if (!window.confirm(`Delete "${run.label || `Run #${run.id}`}"? This cannot be undone.`)) return

    setDeletingRunId(run.id)
    setError(null)
    try {
      await api.deleteCsvLighthouseRun(run.id)
      setSelectedDetail((current) => (current?.run.id === run.id ? null : current))
      setActiveRunId((current) => (current === run.id ? null : current))
      await loadRuns()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete CSV Lighthouse run")
    } finally {
      setDeletingRunId(null)
    }
  }

  const handleDownload = async () => {
    if (!selectedRun || !canDownload) return

    setError(null)
    try {
      const response = await fetch(api.getCsvLighthouseExportUrl(selectedRun.id))
      if (!response.ok) {
        const errorText = await response.text().catch(() => "")
        throw new Error(errorText || `CSV download failed: ${response.status}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      const safeName = (selectedRun.label || "")
        .trim()
        .replace(/[^a-z0-9 _.-]+/gi, "-")
        .replace(/\s+/g, "_")
        .replace(/^[-_.]+|[-_.]+$/g, "")
      link.href = url
      link.download = `${safeName || `csv-lighthouse-run-${selectedRun.id}`}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to download CSV export")
    }
  }

  return (
    <section className="aurora-panel overflow-hidden">
      <div className="border-b border-border/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="aurora-text text-sm font-semibold">CSV Lighthouse Runs</h2>
            <p className="aurora-text-dim mt-1 text-xs">
              {strategy === "mobile" ? "Mobile" : "Desktop"} strategy
              {selectedTargetText ? ` · ${selectedTargetText}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRunSelected} disabled={!canRunSelected}>
              {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Lighthouse
            </Button>
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={!canCancel}>
              {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
              Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} disabled={!canDownload}>
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1.3fr)_minmax(12rem,0.8fr)_auto] lg:items-end">
            <div className="space-y-1.5">
              <label className="aurora-text-dim text-xs font-medium" htmlFor="csv-lighthouse-files">
                Additional CSVs (optional)
              </label>
              <Input
                key={fileInputKey}
                id="csv-lighthouse-files"
                type="file"
                accept=".csv,text/csv"
                multiple
                onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
                className="h-9"
              />
              <p className="aurora-text-faint text-xs">
                {libraryCount > 0
                  ? `Using ${libraryCount} library file${libraryCount === 1 ? "" : "s"}${files.length ? ` + ${files.length} uploaded` : ""}`
                  : "No library files yet — upload below or add them to the library."}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="aurora-text-dim text-xs font-medium" htmlFor="csv-lighthouse-label">
                Run label
              </label>
              <Input
                id="csv-lighthouse-label"
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder="Optional"
                className="h-9"
              />
            </div>
            <Button onClick={handleStart} disabled={!canStart} className="h-9">
              {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Save CSVs
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {targetOptions.map((target) => (
              <label key={target.key} className="aurora-text flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selectedTargets.includes(target.key)}
                  onCheckedChange={(checked) => handleTargetToggle(target.key, checked === true)}
                />
                {target.label}
                <span className="aurora-text-faint text-xs">({target.shortLabel})</span>
              </label>
            ))}
            {largeRunWarning && (
              <span className="aurora-text-faint text-xs">Large runs can take several minutes.</span>
            )}
          </div>

          {error && (
            <div className="rounded border border-[color:var(--lcc-red)]/40 bg-[color:var(--lcc-red)]/10 px-3 py-2 text-sm text-[color:var(--lcc-red)]">
              {error}
            </div>
          )}

          {selectedRun && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <RunStatusBadge status={selectedRun.status} />
                  <span className="aurora-text text-sm font-medium">
                    {selectedRun.label || `Run #${selectedRun.id}`}
                  </span>
                </div>
                <span className="aurora-text-dim text-xs tabular-nums">
                  {processedItems} / {selectedRun.total_items} processed · {selectedRun.failed_items} failed
                  {selectedRun.cancelled_items ? ` · ${selectedRun.cancelled_items} cancelled` : ""}
                </span>
              </div>
              <Progress value={progress} className="aurora-progress" />
              {selectedRun.error_message && (
                <p className="text-sm text-[color:var(--lcc-red)]">{selectedRun.error_message}</p>
              )}
            </div>
          )}

          {selectedRun && (
            <CsvLighthouseFilesPanel
              runId={selectedRun.id}
              editable={selectedRun.status === "pending"}
              onFilesChanged={async () => {
                await loadRunDetail(selectedRun.id)
                await loadRuns()
              }}
            />
          )}

          {loadingDetail ? (
            <div className="aurora-panel p-4">
              <div className="aurora-text-dim flex items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading run detail...
              </div>
            </div>
          ) : selectedDetail ? (
            <CsvLighthouseResultsTable items={selectedDetail.items} />
          ) : null}
        </div>

        <aside className="space-y-4">
          <CsvLibraryPanel onLibraryChanged={setLibraryCount} />

          <div className="flex items-center justify-between">
            <h3 className="aurora-text text-xs font-semibold uppercase tracking-[0.12em]">Recent Runs</h3>
            {loadingRuns && <Loader2 className="aurora-text-faint h-3.5 w-3.5 animate-spin" />}
          </div>
          <div className="max-h-[28rem] space-y-2 overflow-y-auto pr-1">
            {runs.length === 0 && !loadingRuns ? (
              <p className="aurora-text-dim text-sm">No saved runs.</p>
            ) : (
              runs.map((run) => (
                <div
                  key={run.id}
                  className={`relative rounded border transition-colors ${
                    selectedRun?.id === run.id ? "border-primary/60 bg-primary/5" : "border-border/60"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setError(null)
                      loadRunDetail(run.id)
                    }}
                    className="block w-full rounded p-3 pr-9 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0 pr-12">
                      <div className="aurora-text flex items-center gap-1.5 text-sm font-medium">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{run.label || `Run #${run.id}`}</span>
                      </div>
                      <p className="aurora-text-faint mt-1 text-xs">
                        {formatDateTime(run.created_at)} · {formatRunDuration(run.started_at, run.finished_at, run.status)}
                      </p>
                    </div>
                    <div className="aurora-text-dim mt-2 text-xs tabular-nums">
                      {run.completed_items + run.failed_items + run.cancelled_items}/{run.total_items} processed · {run.failed_items} failed
                      {run.cancelled_items ? ` · ${run.cancelled_items} cancelled` : ""}
                    </div>
                  </button>
                  <div className="absolute right-2 top-2 flex items-center gap-1.5">
                    <RunStatusBadge status={run.status} />
                    <button
                      type="button"
                      onClick={() => handleDeleteRun(run)}
                      disabled={deletingRunId === run.id || run.status === "running"}
                      title={run.status === "running" ? "Cancel the run before deleting" : "Delete run"}
                      aria-label="Delete run"
                      className="aurora-text-faint rounded p-1 transition-colors hover:bg-[color:var(--lcc-red)]/10 hover:text-[color:var(--lcc-red)] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {deletingRunId === run.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
