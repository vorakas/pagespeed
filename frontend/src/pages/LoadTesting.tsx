import { useCallback, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  AlertCircle,
  CheckCircle2,
  CircleDot,
  Edit2,
  Loader2,
  ListPlus,
  Play,
  Plus,
  RefreshCw,
  Square,
  Trash2,
  XCircle,
} from "lucide-react"

import { Header } from "@/components/layout/Header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { api } from "@/services/api"
import type {
  BlazemeterConfigStatus,
  BlazemeterPreset,
  BlazemeterProject,
  BlazemeterQueueItem,
  BlazemeterQueueSnapshot,
  BlazemeterQueueStatus,
  BlazemeterTest,
} from "@/types"

const ACTIVE_POLL_MS = 10_000
const IDLE_POLL_MS = 30_000

const statusBadgeVariant: Record<
  BlazemeterQueueStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  running: "default",
  completed: "outline",
  failed: "destructive",
  cancelled: "secondary",
}

function StatusIcon({ status }: { status: BlazemeterQueueStatus }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
    case "completed":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
    case "failed":
      return <XCircle className="h-3.5 w-3.5 text-destructive" />
    case "cancelled":
      return <Square className="h-3.5 w-3.5 text-muted-foreground" />
    default:
      return <CircleDot className="h-3.5 w-3.5 text-muted-foreground" />
  }
}

function formatRelative(epochSeconds: number | null): string {
  if (!epochSeconds) return "—"
  const diff = Date.now() / 1000 - epochSeconds
  if (diff < 60) return `${Math.floor(diff)}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatDuration(
  start: number | null,
  end: number | null,
): string {
  if (!start) return "—"
  const until = end ?? Date.now() / 1000
  const total = Math.max(0, Math.floor(until - start))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}m ${s.toString().padStart(2, "0")}s`
}

const PROJECT_STORAGE_KEY = "blazemeter.selectedProjectId"

export function LoadTesting() {
  const [config, setConfig] = useState<BlazemeterConfigStatus | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [connectionChecked, setConnectionChecked] = useState(false)
  const [projects, setProjects] = useState<BlazemeterProject[]>([])
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [tests, setTests] = useState<BlazemeterTest[]>([])
  const [testsLoading, setTestsLoading] = useState(false)
  const [testFilter, setTestFilter] = useState("")
  const [queue, setQueue] = useState<BlazemeterQueueSnapshot | null>(null)
  const [actionBusy, setActionBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [presets, setPresets] = useState<BlazemeterPreset[]>([])
  const [presetsLoading, setPresetsLoading] = useState(false)
  const [presetDialogOpen, setPresetDialogOpen] = useState(false)
  const [editingPreset, setEditingPreset] = useState<BlazemeterPreset | null>(null)
  const [presetName, setPresetName] = useState("")
  const [presetTestIds, setPresetTestIds] = useState<Set<number>>(new Set())
  const [presetSaving, setPresetSaving] = useState(false)
  const [presetQueueBusy, setPresetQueueBusy] = useState<number | null>(null)

  const selectedProject = useMemo(
    () => projects.find((p) => String(p.id) === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  )

  const refreshConfig = useCallback(async () => {
    setConfigLoading(true)
    try {
      const data = await api.getBlazemeterConfig()
      setConfig(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read BlazeMeter config")
    } finally {
      setConfigLoading(false)
    }
  }, [])

  const refreshQueue = useCallback(async () => {
    try {
      const snap = await api.getBlazemeterQueue()
      setQueue(snap)
    } catch (err) {
      // Quiet — polling errors shouldn't spam toasts.
      console.warn("Queue poll failed", err)
    }
  }, [])

  const refreshProjects = useCallback(async () => {
    setProjectsLoading(true)
    try {
      const data = await api.listBlazemeterProjects()
      setProjects(data.projects ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list BlazeMeter projects")
    } finally {
      setProjectsLoading(false)
    }
  }, [])

  const refreshTests = useCallback(async (projectId: string) => {
    if (!projectId) {
      setTests([])
      return
    }
    setTestsLoading(true)
    try {
      const data = await api.listBlazemeterTests(projectId)
      setTests(data.tests ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list BlazeMeter tests")
    } finally {
      setTestsLoading(false)
    }
  }, [])

  const refreshPresets = useCallback(async () => {
    setPresetsLoading(true)
    try {
      const data = await api.listBlazemeterPresets()
      setPresets(data.presets ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list presets")
    } finally {
      setPresetsLoading(false)
    }
  }, [])

  // Initial load.
  useEffect(() => {
    void refreshConfig()
  }, [refreshConfig])

  useEffect(() => {
    if (!config?.configured) return
    void refreshQueue()
    void refreshProjects()
    void refreshPresets()
  }, [config?.configured, refreshQueue, refreshProjects, refreshPresets])

  // Pick a default project once the list arrives: remembered → env default → first.
  useEffect(() => {
    if (selectedProjectId || projects.length === 0) return
    const remembered = window.localStorage.getItem(PROJECT_STORAGE_KEY)
    const fromDefault = config?.defaultProjectId ?? null
    const pick =
      (remembered && projects.find((p) => String(p.id) === remembered)?.id) ??
      (fromDefault && projects.find((p) => String(p.id) === String(fromDefault))?.id) ??
      projects[0].id
    setSelectedProjectId(String(pick))
  }, [projects, selectedProjectId, config?.defaultProjectId])

  // Load tests whenever selected project changes.
  useEffect(() => {
    if (!config?.configured || !selectedProjectId) return
    void refreshTests(selectedProjectId)
    window.localStorage.setItem(PROJECT_STORAGE_KEY, selectedProjectId)
  }, [config?.configured, selectedProjectId, refreshTests])

  // Polling — faster when queue has activity.
  useEffect(() => {
    if (!config?.configured) return
    const hasActivity =
      Boolean(queue?.active) || (queue?.pending.length ?? 0) > 0
    const interval = hasActivity ? ACTIVE_POLL_MS : IDLE_POLL_MS
    const id = window.setInterval(refreshQueue, interval)
    return () => window.clearInterval(id)
  }, [config?.configured, queue?.active, queue?.pending.length, refreshQueue])

  const handleTestConnection = useCallback(async () => {
    try {
      const result = await api.testBlazemeterConnection()
      setConnectionChecked(true)
      toast.success(`Connected${result.user?.email ? ` as ${result.user.email}` : ""}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Connection failed")
    }
  }, [])

  const handleEnqueue = useCallback(
    async (test: BlazemeterTest) => {
      setActionBusy(test.id)
      try {
        const projectContext = selectedProject
          ? { projectId: selectedProject.id, projectName: selectedProject.name }
          : undefined
        await api.enqueueBlazemeterTest(test.id, test.name, projectContext)
        toast.success(`Queued: ${test.name}`)
        await refreshQueue()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to enqueue test")
      } finally {
        setActionBusy(null)
      }
    },
    [refreshQueue, selectedProject],
  )

  const handleRemove = useCallback(
    async (item: BlazemeterQueueItem) => {
      try {
        await api.removeBlazemeterQueueItem(item.itemId)
        await refreshQueue()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to remove item")
      }
    },
    [refreshQueue],
  )

  const handleClearPending = useCallback(async () => {
    try {
      const { removed } = await api.clearBlazemeterQueue()
      toast.success(`Cleared ${removed} pending test${removed === 1 ? "" : "s"}`)
      await refreshQueue()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to clear queue")
    }
  }, [refreshQueue])

  const handleCancelActive = useCallback(async () => {
    try {
      await api.cancelBlazemeterActive()
      toast.success("Active test termination requested")
      await refreshQueue()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel active test")
    }
  }, [refreshQueue])

  // ---------- Presets ----------

  const openCreatePreset = useCallback(() => {
    setEditingPreset(null)
    setPresetName("")
    setPresetTestIds(new Set())
    setPresetDialogOpen(true)
  }, [])

  const openEditPreset = useCallback((preset: BlazemeterPreset) => {
    setEditingPreset(preset)
    setPresetName(preset.name)
    setPresetTestIds(new Set(preset.tests.map((t) => t.test_id)))
    setPresetDialogOpen(true)
  }, [])

  const togglePresetTest = useCallback((testId: number) => {
    setPresetTestIds((prev) => {
      const next = new Set(prev)
      if (next.has(testId)) {
        next.delete(testId)
      } else {
        next.add(testId)
      }
      return next
    })
  }, [])

  const handleSavePreset = useCallback(async () => {
    const name = presetName.trim()
    if (!name) {
      toast.error("Preset name is required")
      return
    }
    if (presetTestIds.size === 0) {
      toast.error("Select at least one test")
      return
    }

    // Resolve test names from both the current tests list (for newly-checked
    // items in this project) and the existing preset (for items that aren't
    // in the current filter). This keeps the name intact across projects.
    const nameById = new Map<number, string>()
    tests.forEach((t) => nameById.set(t.id, t.name))
    editingPreset?.tests.forEach((t) => {
      if (!nameById.has(t.test_id)) nameById.set(t.test_id, t.test_name)
    })

    const input = {
      name,
      projectId: selectedProject?.id ?? null,
      projectName: selectedProject?.name ?? null,
      tests: Array.from(presetTestIds).map((testId) => ({
        testId,
        testName: nameById.get(testId) ?? `Test ${testId}`,
      })),
    }

    setPresetSaving(true)
    try {
      if (editingPreset) {
        await api.updateBlazemeterPreset(editingPreset.id, input)
        toast.success(`Updated preset: ${name}`)
      } else {
        await api.createBlazemeterPreset(input)
        toast.success(`Created preset: ${name}`)
      }
      setPresetDialogOpen(false)
      await refreshPresets()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save preset")
    } finally {
      setPresetSaving(false)
    }
  }, [presetName, presetTestIds, tests, editingPreset, selectedProject, refreshPresets])

  const handleDeletePreset = useCallback(
    async (preset: BlazemeterPreset) => {
      if (!window.confirm(`Delete preset "${preset.name}"?`)) return
      try {
        await api.deleteBlazemeterPreset(preset.id)
        toast.success(`Deleted preset: ${preset.name}`)
        await refreshPresets()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to delete preset")
      }
    },
    [refreshPresets],
  )

  const handleQueuePreset = useCallback(
    async (preset: BlazemeterPreset) => {
      setPresetQueueBusy(preset.id)
      try {
        const result = await api.queueBlazemeterPreset(preset.id)
        toast.success(`Queued ${result.queued} test${result.queued === 1 ? "" : "s"} from "${preset.name}"`)
        await refreshQueue()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to queue preset")
      } finally {
        setPresetQueueBusy(null)
      }
    },
    [refreshQueue],
  )

  const filteredTests = useMemo(() => {
    if (!testFilter.trim()) return tests
    const needle = testFilter.trim().toLowerCase()
    return tests.filter(
      (t) =>
        t.name.toLowerCase().includes(needle) ||
        String(t.id).includes(needle),
    )
  }, [tests, testFilter])

  const queuedIds = useMemo(() => {
    const ids = new Set<number>()
    if (queue?.active) ids.add(queue.active.testId)
    queue?.pending.forEach((p) => ids.add(p.testId))
    return ids
  }, [queue])

  return (
    <div className="pb-8">
      <Header
        title="Load Testing"
        description="Queue and orchestrate BlazeMeter load tests sequentially"
      />

      <div className="mx-3 mt-3 space-y-3">
        {/* ---------- Config status ---------- */}
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">BlazeMeter configuration</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Credentials are stored server-side as environment variables and never sent to the browser.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void refreshConfig()
              }}
              disabled={configLoading}
            >
              <RefreshCw className={`mr-2 h-3.5 w-3.5 ${configLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {configLoading ? (
            <div className="mt-4"><LoadingSpinner /></div>
          ) : config?.configured ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <Badge variant="outline" className="gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                Configured
              </Badge>
              <span className="text-muted-foreground">API key:</span>
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{config.apiKeyIdMasked ?? "****"}</code>
              {config.workspaceId && (
                <>
                  <span className="text-muted-foreground">Workspace:</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{config.workspaceId}</code>
                </>
              )}
              {config.projectId && (
                <>
                  <span className="text-muted-foreground">Project:</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{config.projectId}</code>
                </>
              )}
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" onClick={handleTestConnection}>
                  Test connection
                </Button>
                {connectionChecked && (
                  <span className="text-xs text-muted-foreground">Last tested just now</span>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
                <div className="space-y-2">
                  <p className="font-medium text-destructive">BlazeMeter is not configured</p>
                  <p className="text-muted-foreground">
                    Set these environment variables on Railway, then restart the service:
                  </p>
                  <ul className="ml-4 list-disc space-y-0.5 font-mono text-xs text-muted-foreground">
                    <li>BLAZEMETER_API_KEY_ID</li>
                    <li>BLAZEMETER_API_SECRET</li>
                    <li>BLAZEMETER_WORKSPACE_ID <span className="text-muted-foreground/70">(optional, recommended)</span></li>
                    <li>BLAZEMETER_PROJECT_ID <span className="text-muted-foreground/70">(optional)</span></li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {config?.configured && (
          <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-foreground">Presets</h2>
                <p className="text-xs text-muted-foreground">
                  Saved groups of tests that can be queued with one click. Shared across all users.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void refreshPresets()}
                  disabled={presetsLoading}
                  aria-label="Refresh presets"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${presetsLoading ? "animate-spin" : ""}`} />
                </Button>
                <Button size="sm" onClick={openCreatePreset}>
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  New preset
                </Button>
              </div>
            </div>

            {presetsLoading && presets.length === 0 ? (
              <div className="mt-3"><LoadingSpinner /></div>
            ) : presets.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No presets yet. Create one to bundle a group of tests for one-click queueing.
              </p>
            ) : (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex flex-col gap-2 rounded-lg border border-border bg-background/40 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{preset.name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span>
                            {preset.tests.length} test{preset.tests.length === 1 ? "" : "s"}
                          </span>
                          {preset.project_name && (
                            <Badge variant="outline" className="text-[10px]">
                              {preset.project_name}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openEditPreset(preset)}
                          aria-label="Edit preset"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => void handleDeletePreset(preset)}
                          aria-label="Delete preset"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={presetQueueBusy === preset.id || preset.tests.length === 0}
                      onClick={() => void handleQueuePreset(preset)}
                    >
                      {presetQueueBusy === preset.id ? (
                        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="mr-1 h-3.5 w-3.5" />
                      )}
                      Queue all
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {config?.configured && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
            {/* ---------- Tests ---------- */}
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Tests</h2>
                  <p className="text-xs text-muted-foreground">
                    {tests.length} test{tests.length === 1 ? "" : "s"}
                    {selectedProject ? ` in ${selectedProject.name}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={selectedProjectId}
                    onValueChange={(val) => setSelectedProjectId(val)}
                    disabled={projectsLoading || projects.length === 0}
                  >
                    <SelectTrigger className="h-8 w-56 text-sm" aria-label="Project">
                      <SelectValue placeholder={projectsLoading ? "Loading projects…" : "Select project"} />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={String(project.id)}>
                          {project.name}
                          {project.testsCount != null && (
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({project.testsCount})
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Filter…"
                    value={testFilter}
                    onChange={(e) => setTestFilter(e.target.value)}
                    className="h-8 w-44 text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void refreshTests(selectedProjectId)}
                    disabled={testsLoading || !selectedProjectId}
                    aria-label="Refresh tests"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${testsLoading ? "animate-spin" : ""}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void refreshProjects()}
                    disabled={projectsLoading}
                    aria-label="Refresh projects"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${projectsLoading ? "animate-spin" : ""}`} />
                    <span className="ml-1 text-xs">Projects</span>
                  </Button>
                </div>
              </div>

              <div className="mt-3 max-h-[520px] overflow-auto rounded-md border border-border">
                {testsLoading && tests.length === 0 ? (
                  <div className="p-6"><LoadingSpinner /></div>
                ) : filteredTests.length === 0 ? (
                  <EmptyState
                    title="No tests"
                    description={
                      !selectedProjectId
                        ? "Select a project to see its tests."
                        : testFilter
                          ? "No tests match your filter."
                          : `No BlazeMeter tests in ${selectedProject?.name ?? "this project"}.`
                    }
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[60px]">ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead className="w-[110px]">Type</TableHead>
                        <TableHead className="w-[120px] text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTests.map((test) => {
                        const alreadyQueued = queuedIds.has(test.id)
                        return (
                          <TableRow key={test.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">
                              {test.id}
                            </TableCell>
                            <TableCell className="font-medium">{test.name}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {test.testType ?? "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                size="sm"
                                variant={alreadyQueued ? "outline" : "default"}
                                disabled={actionBusy === test.id || alreadyQueued}
                                onClick={() => void handleEnqueue(test)}
                              >
                                {actionBusy === test.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <Plus className="mr-1 h-3.5 w-3.5" />
                                    {alreadyQueued ? "Queued" : "Queue"}
                                  </>
                                )}
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </div>
            </section>

            {/* ---------- Queue ---------- */}
            <section className="rounded-xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold text-foreground">Sequential queue</h2>
                  <p className="text-xs text-muted-foreground">
                    Tests run one at a time in the order queued
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {queue?.pending.length ? (
                    <Button variant="outline" size="sm" onClick={() => void handleClearPending()}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" />
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Active */}
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Active</p>
                {queue?.active ? (
                  <div className="mt-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusIcon status={queue.active.status} />
                          <span className="truncate text-sm font-medium">{queue.active.testName}</span>
                          {queue.active.projectName && (
                            <Badge variant="outline" className="text-[10px]">
                              {queue.active.projectName}
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>Master: <code>{queue.active.masterId ?? "—"}</code></span>
                          <span>Duration: {formatDuration(queue.active.startedAt, queue.active.endedAt)}</span>
                          {queue.active.lastStatus && (
                            <span>BM: {queue.active.lastStatus}</span>
                          )}
                        </div>
                      </div>
                      <Button size="sm" variant="destructive" onClick={() => void handleCancelActive()}>
                        <Square className="mr-1 h-3.5 w-3.5" />
                        Stop
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1.5 text-sm text-muted-foreground">No active run</p>
                )}
              </div>

              {/* Pending */}
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Pending ({queue?.pending.length ?? 0})
                </p>
                {queue?.pending.length ? (
                  <ul className="mt-1.5 space-y-1.5">
                    {queue.pending.map((item, idx) => (
                      <li
                        key={item.itemId}
                        className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/40 px-3 py-1.5 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                            {idx + 1}
                          </span>
                          <span className="truncate">{item.testName}</span>
                          {item.projectName && (
                            <Badge variant="outline" className="flex-shrink-0 text-[10px]">
                              {item.projectName}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => void handleRemove(item)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-sm text-muted-foreground">Nothing queued</p>
                )}
              </div>

              {/* History */}
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Recent runs
                </p>
                {queue?.history.length ? (
                  <ul className="mt-1.5 space-y-1">
                    {[...queue.history].reverse().map((item) => (
                      <li
                        key={item.itemId}
                        className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-sm"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <StatusIcon status={item.status} />
                          <span className="truncate">{item.testName}</span>
                          {item.projectName && (
                            <Badge variant="outline" className="flex-shrink-0 text-[10px]">
                              {item.projectName}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant={statusBadgeVariant[item.status]} className="text-[10px]">
                            {item.status}
                          </Badge>
                          <span>{formatRelative(item.endedAt)}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1.5 text-sm text-muted-foreground">No completed runs yet</p>
                )}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* ---------- Preset create/edit dialog ---------- */}
      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPreset ? "Edit preset" : "New preset"}</DialogTitle>
            <DialogDescription>
              Select the tests that should be queued when this preset runs.
              {selectedProject
                ? ` Showing tests from ${selectedProject.name}.`
                : " Switch projects in the Tests panel to see tests from another project."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="preset-name" className="text-xs">
                Name
              </Label>
              <Input
                id="preset-name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g. Regression — PPE"
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs">
                  Tests ({presetTestIds.size} selected)
                </Label>
                {editingPreset && editingPreset.tests.some((t) => !tests.find((ct) => ct.id === t.test_id)) && (
                  <span className="text-[11px] text-muted-foreground">
                    Some saved tests aren't shown (different project)
                  </span>
                )}
              </div>
              <div className="max-h-[280px] overflow-auto rounded-md border border-border">
                {tests.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    No tests in the current project. Switch projects or refresh.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {tests.map((test) => {
                      const checked = presetTestIds.has(test.id)
                      return (
                        <li key={test.id}>
                          <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-accent/40">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => togglePresetTest(test.id)}
                            />
                            <span className="font-mono text-xs text-muted-foreground">
                              {test.id}
                            </span>
                            <span className="truncate">{test.name}</span>
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
              {editingPreset && editingPreset.tests.some((t) => !tests.find((ct) => ct.id === t.test_id)) && (
                <div className="rounded-md border border-dashed border-border p-2 text-xs text-muted-foreground">
                  {editingPreset.tests
                    .filter((t) => !tests.find((ct) => ct.id === t.test_id))
                    .map((t) => (
                      <div key={t.test_id} className="flex items-center gap-2 py-0.5">
                        <Checkbox
                          checked={presetTestIds.has(t.test_id)}
                          onCheckedChange={() => togglePresetTest(t.test_id)}
                        />
                        <span className="font-mono">{t.test_id}</span>
                        <span className="truncate">{t.test_name}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPresetDialogOpen(false)} disabled={presetSaving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSavePreset()} disabled={presetSaving}>
              {presetSaving ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ListPlus className="mr-1 h-3.5 w-3.5" />
              )}
              {editingPreset ? "Save changes" : "Create preset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
