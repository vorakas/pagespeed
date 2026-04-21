import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Loader2, RefreshCw, FolderTree, FileText, ChevronRight, ChevronDown } from "lucide-react"
import { api } from "@/services/api"
import type {
  ObsidianCapabilities,
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
  const logEndRef = useRef<HTMLDivElement | null>(null)

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
  }, [loadCapabilities, loadTree])

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
  }, [activeJob, loadTree])

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

  const handleSync = useCallback(async (source: "jira" | "asana" | "both") => {
    setIsStarting(true)
    setSyncError(null)
    try {
      const res = await api.startObsidianSync({ source })
      setActiveJob(res.job)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : "Failed to start sync")
    } finally {
      setIsStarting(false)
    }
  }, [])

  const isRunning = activeJob?.status === "running"
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
        </div>
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
    default:
      return "bg-muted text-muted-foreground"
  }
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
