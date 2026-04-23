import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, RefreshCw, FolderTree, FileText, ChevronRight, ChevronDown, StopCircle } from "lucide-react"
import { api } from "@/services/api"
import type {
  ObsidianCapabilities,
  ObsidianPendingOrchestration,
  ObsidianSyncJob,
  ObsidianVaultNode,
  ObsidianVaultPage,
} from "@/types"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Minimal scaffold for the Obsidian Bridge dashboard.
 *
 * This page intentionally does not try to look designed — it wires up the
 * backend capabilities, on-demand sync, live log streaming, vault tree, and
 * single-page preview so Claude Design can replace the layout and styling
 * later without re-plumbing the API layer.
 */
export function Obsidian() {
  const [capabilities, setCapabilities] = useState<ObsidianCapabilities | null>(null)
  const [capabilitiesError, setCapabilitiesError] = useState<string | null>(null)
  const [activeJob, setActiveJob] = useState<ObsidianSyncJob | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [treeRoot, setTreeRoot] = useState<ObsidianVaultNode | null>(null)
  const [treeError, setTreeError] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [page, setPage] = useState<ObsidianVaultPage | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [isStarting, setIsStarting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [pending, setPending] = useState<ObsidianPendingOrchestration | null>(null)
  const [showPendingFiles, setShowPendingFiles] = useState(false)
  const [fullRefresh, setFullRefresh] = useState(false)
  const logEndRef = useRef<HTMLDivElement | null>(null)

  const loadPending = useCallback(async () => {
    try {
      const res = await api.getObsidianPendingOrchestration()
      setPending(res)
    } catch {
      // non-fatal; the panel hides on error
      setPending(null)
    }
  }, [])

  const loadCapabilities = useCallback(async () => {
    try {
      const caps = await api.getObsidianCapabilities()
      setCapabilities(caps)
      setCapabilitiesError(null)
    } catch (err) {
      setCapabilitiesError(err instanceof Error ? err.message : "Failed to load capabilities")
    }
  }, [])

  const loadTree = useCallback(async () => {
    try {
      const res = await api.getObsidianVaultTree("", 6)
      setTreeRoot(res.tree)
      setTreeError(null)
    } catch (err) {
      setTreeError(err instanceof Error ? err.message : "Failed to load vault tree")
    }
  }, [])

  useEffect(() => {
    void loadCapabilities()
    void loadTree()
    void loadPending()
  }, [loadCapabilities, loadTree, loadPending])

  // Poll active job while it's running
  useEffect(() => {
    if (!activeJob || activeJob.status === "running") {
      const interval = window.setInterval(async () => {
        try {
          if (activeJob?.jobId) {
            const res = await api.getObsidianSyncJob(activeJob.jobId)
            setActiveJob(res.job)
            if (res.job.status !== "running") {
              void loadTree()
              void loadPending()
            }
          } else {
            const res = await api.getObsidianActiveSync()
            if (res.active) setActiveJob(res.active)
          }
        } catch {
          // swallow transient poll errors
        }
      }, 1500)
      return () => window.clearInterval(interval)
    }
  }, [activeJob, loadTree, loadPending])

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeJob?.lines.length])

  useEffect(() => {
    if (!selectedPath) {
      setPage(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await api.getObsidianVaultPage(selectedPath)
        if (!cancelled) {
          setPage(res.page)
          setPageError(null)
        }
      } catch (err) {
        if (!cancelled) {
          setPage(null)
          setPageError(err instanceof Error ? err.message : "Failed to load page")
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedPath])

  const handleSync = useCallback(
    async (source: "jira" | "asana" | "both") => {
      setIsStarting(true)
      setSyncError(null)
      try {
        const res = await api.startObsidianSync({ source, fullRefresh })
        setActiveJob(res.job)
      } catch (err) {
        setSyncError(err instanceof Error ? err.message : "Failed to start sync")
      } finally {
        setIsStarting(false)
      }
    },
    [fullRefresh],
  )

  const handleCancel = useCallback(async () => {
    if (!activeJob?.jobId) return
    setIsCancelling(true)
    setSyncError(null)
    try {
      const res = await api.cancelObsidianSync(activeJob.jobId)
      setActiveJob(res.job)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Failed to stop sync")
    } finally {
      setIsCancelling(false)
    }
  }, [activeJob?.jobId])

  const isRunning = activeJob?.status === "running"
  const isCancelRequested = !!activeJob?.cancelRequested
  const canSyncJira = !!capabilities?.jiraConfigured
  const canSyncAsana = !!capabilities?.asanaConfigured
  const canSyncBoth = canSyncJira && canSyncAsana

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Obsidian Bridge</h1>
        <p className="text-sm text-muted-foreground">
          Sync Jira and Asana into the LLM-maintained Adobe Commerce migration vault.
        </p>
      </div>

      {capabilitiesError && (
        <div className="rounded border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {capabilitiesError}
        </div>
      )}

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Vault
        </h2>
        <dl className="grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Root</dt>
          <dd className="font-mono text-xs">{capabilities?.vaultRoot ?? "—"}</dd>
          <dt className="text-muted-foreground">Exists on disk</dt>
          <dd>{capabilities?.vaultExists ? "yes" : "no"}</dd>
          <dt className="text-muted-foreground">Jira</dt>
          <dd>
            {canSyncJira ? (
              <span>configured ({capabilities?.jiraProjects.join(", ")})</span>
            ) : (
              <span className="text-muted-foreground">not configured</span>
            )}
          </dd>
          <dt className="text-muted-foreground">Asana</dt>
          <dd>
            {canSyncAsana ? (
              <span>configured ({capabilities?.asanaProjects.join(", ")})</span>
            ) : (
              <span className="text-muted-foreground">not configured</span>
            )}
          </dd>
        </dl>
      </section>

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Sync
          </h2>
          {activeJob && (
            <span className={cn("text-xs px-2 py-0.5 rounded-full", statusClass(activeJob.status))}>
              {activeJob.status}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => handleSync("both")}
            disabled={!canSyncBoth || isRunning || isStarting}
            size="sm"
          >
            {isStarting || isRunning ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Sync All
          </Button>
          <Button
            onClick={() => handleSync("jira")}
            disabled={!canSyncJira || isRunning || isStarting}
            variant="secondary"
            size="sm"
          >
            Jira only
          </Button>
          <Button
            onClick={() => handleSync("asana")}
            disabled={!canSyncAsana || isRunning || isStarting}
            variant="secondary"
            size="sm"
          >
            Asana only
          </Button>
          {isRunning && (
            <Button
              onClick={handleCancel}
              disabled={isCancelling || isCancelRequested}
              variant="destructive"
              size="sm"
            >
              {isCancelling || isCancelRequested ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <StopCircle size={14} />
              )}
              {isCancelRequested ? "Stopping…" : "Stop Sync"}
            </Button>
          )}
        </div>
        <label className="flex items-center gap-2 text-xs text-muted-foreground select-none">
          <input
            type="checkbox"
            checked={fullRefresh}
            onChange={(e) => setFullRefresh(e.target.checked)}
            disabled={isRunning || isStarting}
            className="h-3.5 w-3.5 accent-amber-500"
          />
          <span>
            <strong className="text-amber-600 dark:text-amber-400">Full refresh</strong> — bypass sync state files and re-fetch every task (slow; use to recover from lost commits)
          </span>
        </label>
        {syncError && <p className="text-xs text-destructive">{syncError}</p>}
        {activeJob && (
          <div className="mt-2 rounded bg-muted/40 p-2 max-h-56 overflow-y-auto font-mono text-[11px] leading-relaxed">
            {activeJob.lines.length === 0 ? (
              <span className="text-muted-foreground">Starting...</span>
            ) : (
              activeJob.lines.map((line, i) => <div key={i}>{line}</div>)
            )}
            <div ref={logEndRef} />
          </div>
        )}
        {activeJob?.error && (
          <p className="text-xs text-destructive">Error: {activeJob.error}</p>
        )}
      </section>

      {pending?.enabled && (
        <PendingOrchestrationCard
          data={pending}
          showFiles={showPendingFiles}
          onToggleFiles={() => setShowPendingFiles((v) => !v)}
          onRefresh={() => void loadPending()}
        />
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4 space-y-2 min-h-[20rem] max-h-[32rem] overflow-y-auto">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <FolderTree size={14} /> Vault Tree
          </div>
          {treeError && <p className="text-xs text-destructive">{treeError}</p>}
          {treeRoot ? (
            <TreeView
              node={treeRoot}
              selectedPath={selectedPath}
              onSelect={setSelectedPath}
            />
          ) : (
            !treeError && <p className="text-xs text-muted-foreground">Loading...</p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-2 min-h-[20rem] max-h-[32rem] overflow-y-auto">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <FileText size={14} /> {page?.path ?? "Page preview"}
          </div>
          {pageError && <p className="text-xs text-destructive">{pageError}</p>}
          {page ? (
            <PagePreview page={page} />
          ) : !pageError ? (
            <p className="text-xs text-muted-foreground">Select a file from the tree.</p>
          ) : null}
        </div>
      </section>
    </div>
  )
}

function statusClass(status: ObsidianSyncJob["status"]): string {
  switch (status) {
    case "succeeded":
      return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
    case "failed":
      return "bg-destructive/15 text-destructive"
    case "partial":
      return "bg-amber-500/15 text-amber-600 dark:text-amber-400"
    case "running":
      return "bg-sky-500/15 text-sky-600 dark:text-sky-400"
    case "cancelled":
      return "bg-muted text-muted-foreground"
    default:
      return "bg-muted text-muted-foreground"
  }
}

interface PendingOrchestrationCardProps {
  data: ObsidianPendingOrchestration
  showFiles: boolean
  onToggleFiles: () => void
  onRefresh: () => void
}

function PendingOrchestrationCard({
  data,
  showFiles,
  onToggleFiles,
  onRefresh,
}: PendingOrchestrationCardProps) {
  const total = data.total ?? 0
  const pendingSyncs = data.pendingSyncCommits ?? 0
  const lastOrch = data.lastOrchestrate
  const lastSync = data.lastSync
  const bySource = data.bySource ?? []
  const files = data.files ?? []

  const headlineTone =
    total === 0
      ? "text-muted-foreground"
      : total > 0
      ? "text-amber-600 dark:text-amber-400"
      : "text-muted-foreground"

  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Pending for Orchestration
        </h2>
        <Button variant="ghost" size="sm" onClick={onRefresh} title="Refresh">
          <RefreshCw size={14} />
        </Button>
      </div>

      {data.error && (
        <p className="text-xs text-destructive">{data.error}</p>
      )}

      {!data.error && (
        <>
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
            <div>
              <span className={cn("text-2xl font-semibold font-mono", headlineTone)}>
                {total}
              </span>
              <span className="ml-1.5 text-xs text-muted-foreground">
                raw file{total === 1 ? "" : "s"} changed since last orchestration
              </span>
            </div>
            {total > 0 && (
              <div className="text-xs text-muted-foreground font-mono">
                <span className="text-green-500 dark:text-green-400">+{data.added ?? 0}</span>{" "}
                <span className="text-sky-500 dark:text-sky-400">~{data.modified ?? 0}</span>{" "}
                <span className="text-rose-500 dark:text-rose-400">−{data.deleted ?? 0}</span>
                {pendingSyncs > 0 && (
                  <span className="ml-3">
                    across {pendingSyncs} sync commit{pendingSyncs === 1 ? "" : "s"}
                  </span>
                )}
              </div>
            )}
          </div>

          {total === 0 && (
            <p className="text-xs text-muted-foreground">
              The vault is caught up — the last {"[orchestrate]"} commit is at or after the latest sync.
              The next orchestrator run will no-op until a new sync lands.
            </p>
          )}

          {total > 0 && bySource.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {bySource.slice(0, 12).map((s) => (
                <div
                  key={s.key}
                  className="rounded border bg-muted/30 px-2.5 py-1.5 text-xs font-mono flex items-center justify-between gap-2"
                >
                  <span className="truncate">{s.key}</span>
                  <span className="shrink-0 text-muted-foreground">
                    <span className="text-green-500 dark:text-green-400">+{s.added}</span>{" "}
                    <span className="text-sky-500 dark:text-sky-400">~{s.modified}</span>
                    {s.deleted > 0 && (
                      <>
                        {" "}
                        <span className="text-rose-500 dark:text-rose-400">−{s.deleted}</span>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
            <dt className="text-muted-foreground">Last sync</dt>
            <dd className="font-mono truncate">
              {lastSync
                ? `${lastSync.shortHash} · ${formatRelative(lastSync.timestamp)}`
                : "—"}
            </dd>
            <dt className="text-muted-foreground">Last orchestration</dt>
            <dd className="font-mono truncate">
              {data.hasOrchestrateAnchor && lastOrch
                ? `${lastOrch.shortHash} · ${formatRelative(lastOrch.timestamp)}`
                : "never"}
            </dd>
          </dl>

          {total > 0 && (
            <button
              type="button"
              onClick={onToggleFiles}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              {showFiles ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {showFiles ? "Hide" : "Show"} file list ({files.length})
            </button>
          )}
          {showFiles && files.length > 0 && (
            <div className="rounded border bg-muted/20 max-h-48 overflow-y-auto px-2 py-1.5 font-mono text-[11px] leading-relaxed space-y-0.5">
              {files.map((f) => (
                <div key={f.path} className="flex gap-2">
                  <span
                    className={cn(
                      "shrink-0 w-3",
                      f.change === "A" && "text-green-500 dark:text-green-400",
                      f.change === "M" && "text-sky-500 dark:text-sky-400",
                      f.change === "D" && "text-rose-500 dark:text-rose-400",
                    )}
                  >
                    {f.change}
                  </span>
                  <span className="truncate">{f.path}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  )
}

function formatRelative(ts: number | null | undefined): string {
  if (!ts) return "—"
  const now = Date.now() / 1000
  const diff = now - ts
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
  return `${Math.round(diff / 86400)}d ago`
}

interface TreeViewProps {
  node: ObsidianVaultNode
  selectedPath: string | null
  onSelect: (path: string) => void
  depth?: number
}

const DEFAULT_OPEN_PATHS = new Set<string>(["raw", "raw/asana"])

function TreeView({ node, selectedPath, onSelect, depth = 0 }: TreeViewProps) {
  const indent = useMemo(() => ({ paddingLeft: `${depth * 12}px` }), [depth])
  const [open, setOpen] = useState(depth === 0 || DEFAULT_OPEN_PATHS.has(node.path))

  if (!node.isDir) {
    const isSelected = selectedPath === node.path
    return (
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        className={cn(
          "block w-full text-left text-xs font-mono rounded px-1.5 py-0.5 hover:bg-muted/50",
          isSelected && "bg-primary/10 text-primary",
        )}
        style={indent}
      >
        {node.name}
      </button>
    )
  }

  return (
    <div>
      {depth > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-1 text-left text-xs font-medium text-muted-foreground rounded px-1.5 py-0.5 hover:bg-muted/50"
          style={indent}
          aria-expanded={open}
        >
          {open ? (
            <ChevronDown size={12} className="shrink-0" />
          ) : (
            <ChevronRight size={12} className="shrink-0" />
          )}
          <span>{node.name}/</span>
        </button>
      )}
      {open &&
        node.children?.map((child) => (
          <TreeView
            key={child.path}
            node={child}
            selectedPath={selectedPath}
            onSelect={onSelect}
            depth={depth + 1}
          />
        ))}
    </div>
  )
}

function PagePreview({ page }: { page: ObsidianVaultPage }) {
  return (
    <div className="space-y-2">
      {Object.keys(page.frontmatter).length > 0 && (
        <div className="rounded bg-muted/40 p-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Frontmatter
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs font-mono">
            {Object.entries(page.frontmatter).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}:</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <pre className="whitespace-pre-wrap text-xs font-mono leading-relaxed">
        {page.body}
      </pre>
    </div>
  )
}
