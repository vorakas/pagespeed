import { Plus, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { TestCaseChangeEditor } from "@/components/test-case-database/TestCaseChangeEditor"
import { TestCaseChangeFilters } from "@/components/test-case-database/TestCaseChangeFilters"
import { TestCaseChangeList } from "@/components/test-case-database/TestCaseChangeList"
import { PageHeader } from "@/components/layout/PageHeader"
import { ConfirmDialog } from "@/components/shared/ConfirmDialog"
import { Button } from "@/components/ui/button"
import { useUnsavedChangesBlocker } from "@/hooks/use-unsaved-changes-blocker"
import { api } from "@/services/api"
import type {
  TestCaseChange,
  TestCaseChangeAttachment,
  TestCaseChangePayload,
  TestCaseChangeStatus,
} from "@/types"

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed"
}

export function TestCaseDatabase() {
  const [changes, setChanges] = useState<TestCaseChange[]>([])
  const [selectedChange, setSelectedChange] = useState<TestCaseChange | null>(null)
  const [attachments, setAttachments] = useState<TestCaseChangeAttachment[]>([])
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState<TestCaseChangeStatus | "all">("all")
  const [tag, setTag] = useState("")
  const [includeArchived, setIncludeArchived] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attachmentsLoading, setAttachmentsLoading] = useState(false)
  const [attachmentsUploading, setAttachmentsUploading] = useState(false)
  const [editorDirty, setEditorDirty] = useState(false)
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null)
  const requestIdRef = useRef(0)
  const attachmentRequestIdRef = useRef(0)

  const selectedId = selectedChange?.id ?? null
  const navigationBlocker = useUnsavedChangesBlocker(editorDirty)

  const loadChanges = useCallback(async () => {
    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setLoading(true)
    try {
      const loaded = await api.searchTestCaseChanges({
        q: query.trim() || undefined,
        status,
        tag: tag.trim() || undefined,
        include_archived: includeArchived,
      })
      if (requestId !== requestIdRef.current) return
      setChanges(loaded)
      setSelectedChange((current) => {
        if (!current) return loaded[0] ?? null
        return loaded.find((change) => change.id === current.id) ?? loaded[0] ?? null
      })
    } catch (error) {
      if (requestId === requestIdRef.current) {
        toast.error("Could not load test case changes", {
          description: getErrorMessage(error),
        })
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [includeArchived, query, status, tag])

  const loadAttachments = useCallback(async (changeId: number) => {
    const requestId = attachmentRequestIdRef.current + 1
    attachmentRequestIdRef.current = requestId
    setAttachmentsLoading(true)
    setAttachments([])
    try {
      const loaded = await api.listTestCaseChangeAttachments(changeId)
      if (requestId === attachmentRequestIdRef.current) {
        setAttachments(loaded)
      }
    } catch (error) {
      if (requestId === attachmentRequestIdRef.current) {
        toast.error("Could not load attachments", {
          description: getErrorMessage(error),
        })
      }
    } finally {
      if (requestId === attachmentRequestIdRef.current) {
        setAttachmentsLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadChanges()
  }, [loadChanges])

  useEffect(() => {
    if (!selectedId) {
      attachmentRequestIdRef.current += 1
      setAttachments([])
      setAttachmentsLoading(false)
      return
    }

    void loadAttachments(selectedId)
  }, [loadAttachments, selectedId])

  const recordCountLabel = useMemo(() => {
    if (loading) return "Loading"
    return `${changes.length} ${changes.length === 1 ? "record" : "records"}`
  }, [changes.length, loading])

  async function saveChange(draft: TestCaseChangePayload) {
    setSaving(true)
    try {
      const saved = selectedChange
        ? await api.updateTestCaseChange(selectedChange.id, draft)
        : await api.createTestCaseChange(draft)
      setSelectedChange(saved)
      await loadChanges()
      toast.success(selectedChange ? "Change updated" : "Change created")
    } catch (error) {
      toast.error("Could not save test case change", {
        description: getErrorMessage(error),
      })
    } finally {
      setSaving(false)
    }
  }

  async function archiveChange(changeId: number) {
    setSaving(true)
    try {
      const archived = await api.archiveTestCaseChange(changeId)
      setSelectedChange(archived)
      await loadChanges()
      toast.success("Change archived")
    } catch (error) {
      toast.error("Could not archive test case change", {
        description: getErrorMessage(error),
      })
    } finally {
      setSaving(false)
    }
  }

  async function uploadAttachments(files: File[]) {
    if (!selectedChange || files.length === 0) return

    setAttachmentsUploading(true)
    try {
      const uploaded = await api.uploadTestCaseChangeAttachments(selectedChange.id, files)
      setAttachments((current) => [...current, ...uploaded])
      toast.success(files.length === 1 ? "Attachment uploaded" : "Attachments uploaded")
    } catch (error) {
      toast.error("Could not upload attachment", {
        description: getErrorMessage(error),
      })
    } finally {
      setAttachmentsUploading(false)
    }
  }

  async function downloadAttachment(attachment: TestCaseChangeAttachment) {
    if (!selectedChange) return

    try {
      const blob = await api.downloadTestCaseChangeAttachment(selectedChange.id, attachment.id)
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = attachment.filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      toast.error("Could not download attachment", {
        description: getErrorMessage(error),
      })
    }
  }

  async function deleteAttachment(attachmentId: number) {
    if (!selectedChange) return

    try {
      await api.deleteTestCaseChangeAttachment(selectedChange.id, attachmentId)
      setAttachments((current) =>
        current.filter((attachment) => attachment.id !== attachmentId)
      )
      toast.success("Attachment deleted")
    } catch (error) {
      toast.error("Could not delete attachment", {
        description: getErrorMessage(error),
      })
    }
  }

  function selectChange(change: TestCaseChange) {
    if (editorDirty && change !== selectedChange) {
      setPendingAction(() => () => setSelectedChange(change))
      return
    }
    setSelectedChange(change)
  }

  function applyStartNewChange() {
    setSelectedChange(null)
    setAttachments([])
    setAttachmentsLoading(false)
  }

  function startNewChange() {
    if (editorDirty && selectedChange !== null) {
      setPendingAction(() => applyStartNewChange)
      return
    }
    applyStartNewChange()
  }

  return (
    <div className="flex h-[calc(100vh-1.5rem)] flex-col overflow-hidden">
      <PageHeader
        title="Test Case Database"
        description="Manual history for Zephyr test case updates."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void loadChanges()}
              disabled={loading}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button type="button" onClick={startNewChange}>
              <Plus className="size-4" aria-hidden="true" />
              New Change
            </Button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col border-t border-border bg-background p-4">
        <main className="flex h-[clamp(16rem,34vh,24rem)] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card/60 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Changes</h2>
              <p className="text-xs text-muted-foreground">{recordCountLabel}</p>
            </div>
          </div>
          <TestCaseChangeFilters
            query={query}
            status={status}
            tag={tag}
            includeArchived={includeArchived}
            onQueryChange={setQuery}
            onStatusChange={setStatus}
            onTagChange={setTag}
            onIncludeArchivedChange={setIncludeArchived}
          />
          <div className="min-h-0 flex-1 overflow-auto">
            <TestCaseChangeList
              changes={changes}
              selectedId={selectedId}
              loading={loading}
              onSelect={selectChange}
            />
          </div>
        </main>

        <section className="mt-4 min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-card/60 shadow-sm">
          <TestCaseChangeEditor
            selectedChange={selectedChange}
            attachments={attachments}
            attachmentsLoading={attachmentsLoading}
            attachmentsUploading={attachmentsUploading}
            saving={saving}
            onDirtyChange={setEditorDirty}
            onSave={saveChange}
            onArchive={archiveChange}
            onUploadAttachments={uploadAttachments}
            onDownloadAttachment={downloadAttachment}
            onDeleteAttachment={deleteAttachment}
          />
        </section>
      </div>

      <ConfirmDialog
        open={pendingAction !== null || navigationBlocker.state === "blocked"}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null)
            if (navigationBlocker.state === "blocked") navigationBlocker.reset()
          }
        }}
        title="Unsaved changes"
        description="This change has unsaved edits. Keep editing to save them, or discard the edits to continue."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          if (pendingAction) {
            pendingAction()
            setPendingAction(null)
          } else if (navigationBlocker.state === "blocked") {
            navigationBlocker.proceed()
          }
        }}
      />
    </div>
  )
}
