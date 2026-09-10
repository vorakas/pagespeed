import { useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/services/api"
import type { ZephyrImportSummary } from "@/types"

const DEFAULT_PROJECT_ID = "14210"
const DEFAULT_FOLDER = "/Data Sync"

interface ZephyrImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => void
}

export function ZephyrImportDialog({ open, onOpenChange, onImported }: ZephyrImportDialogProps) {
  const [projectId, setProjectId] = useState(DEFAULT_PROJECT_ID)
  const [folder, setFolder] = useState(DEFAULT_FOLDER)
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState<ZephyrImportSummary | null>(null)

  async function runImport() {
    const parsedProjectId = Number.parseInt(projectId, 10)
    if (!Number.isFinite(parsedProjectId) || parsedProjectId <= 0 || !folder.trim()) {
      toast.error("Project ID and folder are required")
      return
    }
    setRunning(true)
    setSummary(null)
    try {
      const result = await api.importZephyrHistory({
        projectId: parsedProjectId,
        folder: folder.trim(),
      })
      setSummary(result)
      onImported()
      toast.success(`Imported ${result.recordsCreated} change${result.recordsCreated === 1 ? "" : "s"}`)
    } catch (error) {
      toast.error("Zephyr import failed", {
        description: error instanceof Error ? error.message : "Request failed",
      })
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (running) return
        if (!next) setSummary(null)
        onOpenChange(next)
      }}
    >
      <DialogContent showCloseButton={!running}>
        <DialogHeader>
          <DialogTitle>Import from Zephyr</DialogTitle>
          <DialogDescription>
            Fetches change history for every test case in the folder tree and adds
            records it has not imported before. Safe to re-run.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="zephyr-import-project">Project ID</Label>
            <Input
              id="zephyr-import-project"
              value={projectId}
              onChange={(event) => setProjectId(event.target.value)}
              disabled={running}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="zephyr-import-folder">Folder</Label>
            <Input
              id="zephyr-import-folder"
              value={folder}
              onChange={(event) => setFolder(event.target.value)}
              disabled={running}
            />
          </div>

          {summary && (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <p>
                {summary.testCases} test cases scanned — {summary.recordsCreated} created,{" "}
                {summary.skippedExisting} already imported, {summary.skippedEmpty} noise-only saves skipped.
              </p>
              {summary.failures.length > 0 && (
                <ul className="mt-2 list-inside list-disc text-destructive">
                  {summary.failures.map((failure, index) => (
                    <li key={`${failure.key}-${index}`}>
                      {failure.key}: {failure.error}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={running}>
            Close
          </Button>
          <Button type="button" onClick={() => void runImport()} disabled={running}>
            {running ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Importing…
              </>
            ) : (
              "Run Import"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
