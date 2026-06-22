import { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, RefreshCw, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api } from "@/services/api"
import type { CsvLighthouseFile } from "@/types"
import { formatDateTime } from "@/lib/utils"

interface CsvLibraryPanelProps {
  onLibraryChanged?: (count: number) => void
}

export function CsvLibraryPanel({ onLibraryChanged }: CsvLibraryPanelProps) {
  const [files, setFiles] = useState<CsvLighthouseFile[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const replaceInputRef = useRef<HTMLInputElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await api.listCsvLighthouseLibrary()
      setFiles(response.files)
      onLibraryChanged?.(response.files.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load CSV library")
    } finally {
      setLoading(false)
    }
  }, [onLibraryChanged])

  useEffect(() => {
    load()
  }, [load])

  const upload = async (selected: File[]) => {
    if (selected.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const response = await api.uploadCsvLighthouseLibrary(selected)
      setFiles(response.files)
      onLibraryChanged?.(response.files.length)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save CSV library files")
    } finally {
      setBusy(false)
    }
  }

  const remove = async (filename: string) => {
    if (!window.confirm(`Remove ${filename} from the library?`)) return
    setBusy(true)
    setError(null)
    try {
      await api.deleteCsvLighthouseLibraryFile(filename)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to remove CSV library file")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="aurora-panel space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="aurora-text text-xs font-semibold uppercase tracking-[0.12em]">CSV Library</h3>
        {loading && <Loader2 className="aurora-text-faint h-3.5 w-3.5 animate-spin" />}
      </div>

      <p className="aurora-text-dim text-xs">
        Stored files are reused for every run. Re-upload a file to update it when stock changes.
      </p>

      {error && (
        <div className="rounded border border-[color:var(--lcc-red)]/40 bg-[color:var(--lcc-red)]/10 px-3 py-2 text-sm text-[color:var(--lcc-red)]">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {files.length === 0 && !loading ? (
          <p className="aurora-text-dim text-sm">No library files yet.</p>
        ) : (
          files.map((file) => (
            <div key={file.filename} className="flex items-center justify-between gap-2 rounded border border-border/60 p-2">
              <div className="min-w-0">
                <div className="aurora-text truncate text-sm font-medium">{file.filename}</div>
                <div className="aurora-text-faint text-xs">
                  {file.group_key} · {file.row_count} rows · {formatDateTime(file.updated_at)}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => replaceInputRef.current?.click()}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Replace
                </Button>
                <Button variant="outline" size="sm" disabled={busy} onClick={() => remove(file.filename)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="space-y-1.5">
        <label className="aurora-text-dim text-xs font-medium" htmlFor="csv-library-add">Add files</label>
        <Input
          id="csv-library-add"
          type="file"
          accept=".csv,text/csv"
          multiple
          disabled={busy}
          onChange={(event) => {
            void upload(Array.from(event.target.files ?? []))
            event.target.value = ""
          }}
          className="h-9"
        />
      </div>

      <input
        ref={replaceInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? [])
          event.target.value = ""
          void upload(selected)
        }}
      />

      {busy && (
        <div className="aurora-text-dim flex items-center gap-2 text-xs">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…
        </div>
      )}
    </section>
  )
}
