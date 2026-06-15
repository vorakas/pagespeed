import { useCallback, useEffect, useState } from "react"
import { Edit3, FileText, Loader2, Save, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { api } from "@/services/api"
import type { CsvLighthouseFile } from "@/types"

interface CsvLighthouseFilesPanelProps {
  runId: number | null
  editable: boolean
  onFilesChanged: () => Promise<void> | void
}

export function normalizeEditorText(text: string) {
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
  return rows.length ? `${rows.join("\n")}\n` : ""
}

export function countCsvRows(text: string) {
  return normalizeEditorText(text).split("\n").filter(Boolean).length
}

export function CsvLighthouseFilesPanel({
  runId,
  editable,
  onFilesChanged,
}: CsvLighthouseFilesPanelProps) {
  const [files, setFiles] = useState<CsvLighthouseFile[]>([])
  const [selectedFile, setSelectedFile] = useState<CsvLighthouseFile | null>(null)
  const [editorText, setEditorText] = useState("")
  const [loading, setLoading] = useState(false)
  const [loadingFile, setLoadingFile] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadFiles = useCallback(async () => {
    if (!runId) {
      setFiles([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const response = await api.listCsvLighthouseFiles(runId)
      setFiles(response.files)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load uploaded CSVs")
    } finally {
      setLoading(false)
    }
  }, [runId])

  useEffect(() => {
    loadFiles()
  }, [loadFiles])

  const openFile = async (file: CsvLighthouseFile) => {
    setLoadingFile(true)
    setError(null)
    try {
      const response = await api.getCsvLighthouseFile(file.id)
      setSelectedFile(response.file)
      setEditorText(response.file.csv_text)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open CSV")
    } finally {
      setLoadingFile(false)
    }
  }

  const handleSave = async () => {
    if (!selectedFile || !editable) return
    setSaving(true)
    setError(null)
    try {
      const normalized = normalizeEditorText(editorText)
      const response = await api.updateCsvLighthouseFile(selectedFile.id, normalized)
      setSelectedFile(response.file)
      setEditorText(response.file.csv_text)
      await loadFiles()
      await onFilesChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save CSV")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (file: CsvLighthouseFile) => {
    if (!editable) return
    const confirmed = window.confirm(`Delete ${file.filename}?`)
    if (!confirmed) return
    setDeletingId(file.id)
    setError(null)
    try {
      await api.deleteCsvLighthouseFile(file.id)
      if (selectedFile?.id === file.id) {
        setSelectedFile(null)
        setEditorText("")
      }
      await loadFiles()
      await onFilesChanged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete CSV")
    } finally {
      setDeletingId(null)
    }
  }

  if (!runId) return null

  return (
    <div className="rounded-lg border border-border/60 bg-muted/20">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div>
          <h3 className="aurora-text text-xs font-semibold uppercase tracking-[0.12em]">Uploaded CSVs</h3>
          <p className="aurora-text-faint mt-0.5 text-xs">
            {editable ? "Edit saved values before the run starts." : "Run has started; files are read-only."}
          </p>
        </div>
        {loading && <Loader2 className="aurora-text-faint h-4 w-4 animate-spin" />}
      </div>

      {error && (
        <div className="m-3 rounded border border-[color:var(--lcc-red)]/40 bg-[color:var(--lcc-red)]/10 px-3 py-2 text-sm text-[color:var(--lcc-red)]">
          {error}
        </div>
      )}

      <div className="divide-y divide-border/60">
        {files.length === 0 && !loading ? (
          <p className="aurora-text-dim px-3 py-3 text-sm">No uploaded CSVs saved for this run.</p>
        ) : (
          files.map((file) => (
            <div key={file.id} className="grid gap-3 px-3 py-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <div className="aurora-text flex min-w-0 items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{file.filename}</span>
                </div>
                <p className="aurora-text-faint mt-1 text-xs">
                  {file.group_key} - {file.row_count} rows
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => openFile(file)} disabled={loadingFile}>
                  {loadingFile && selectedFile?.id === file.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Edit3 className="h-4 w-4" />
                  )}
                  {editable ? "Edit" : "View"}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(file)}
                  disabled={!editable || deletingId === file.id}
                >
                  {deletingId === file.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog open={Boolean(selectedFile)} onOpenChange={(open) => !open && setSelectedFile(null)}>
        <DialogContent className="aurora-dialog max-h-[85vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedFile?.filename}</DialogTitle>
            <p className="aurora-text-faint text-xs">
              {countCsvRows(editorText)} rows - {selectedFile?.group_key}
            </p>
          </DialogHeader>
          <Textarea
            value={editorText}
            onChange={(event) => setEditorText(event.target.value)}
            readOnly={!editable}
            className="min-h-[22rem] resize-y font-mono text-sm"
            spellCheck={false}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedFile(null)}>
              Close
            </Button>
            {editable && (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
