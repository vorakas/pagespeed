import { useEffect, useState } from "react"
import { Download, FileText, Loader2 } from "lucide-react"

import type { KnowledgeEntryAttachment } from "@/types"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type PreviewKind = "image" | "pdf" | "text" | "unsupported"

function previewKindFor(mimeType: string): PreviewKind {
  if (mimeType.startsWith("image/")) return "image"
  if (mimeType === "application/pdf") return "pdf"
  if (mimeType.startsWith("text/") || mimeType === "application/json") return "text"
  return "unsupported"
}

interface AttachmentPreviewDialogProps {
  attachment: KnowledgeEntryAttachment | null
  imageUrl: string
  onFetchBlob: (attachment: KnowledgeEntryAttachment) => Promise<Blob>
  onDownload: (attachment: KnowledgeEntryAttachment) => void
  onClose: () => void
}

export function AttachmentPreviewDialog({
  attachment,
  imageUrl,
  onFetchBlob,
  onDownload,
  onClose,
}: AttachmentPreviewDialogProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const kind = attachment ? previewKindFor(attachment.mime_type) : "unsupported"

  useEffect(() => {
    if (!attachment) return
    if (kind !== "pdf" && kind !== "text") return

    let cancelled = false
    let createdUrl: string | null = null

    setLoading(true)
    setError(null)
    setObjectUrl(null)
    setTextContent(null)

    onFetchBlob(attachment)
      .then(async (blob) => {
        if (cancelled) return
        if (kind === "text") {
          const text = await blob.text()
          if (!cancelled) setTextContent(text)
        } else {
          createdUrl = URL.createObjectURL(blob)
          if (cancelled) {
            URL.revokeObjectURL(createdUrl)
            createdUrl = null
            return
          }
          setObjectUrl(createdUrl)
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load preview.")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
      if (createdUrl) URL.revokeObjectURL(createdUrl)
    }
  }, [attachment, kind, onFetchBlob])

  return (
    <Dialog open={Boolean(attachment)} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8" title={attachment?.filename}>
            {attachment?.filename ?? "Attachment"}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border bg-muted/20">
          {loading && (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="size-6 animate-spin text-muted-foreground" aria-hidden="true" />
            </div>
          )}

          {!loading && error && (
            <div className="flex h-64 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {error}
            </div>
          )}

          {!loading && !error && attachment && kind === "image" && (
            <div className="flex items-center justify-center p-2">
              <img
                src={imageUrl}
                alt={attachment.filename}
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
          )}

          {!loading && !error && kind === "pdf" && objectUrl && (
            <iframe
              src={objectUrl}
              title={attachment?.filename ?? "PDF preview"}
              className="h-[70vh] w-full"
            />
          )}

          {!loading && !error && kind === "text" && textContent !== null && (
            <pre className="max-h-[70vh] overflow-auto whitespace-pre-wrap break-words p-4 text-xs leading-relaxed text-foreground">
              {textContent}
            </pre>
          )}

          {!loading && !error && kind === "unsupported" && (
            <div className="flex h-64 flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
              <FileText className="size-8" aria-hidden="true" />
              <p>Preview isn&apos;t available for this file type.</p>
              <p className="text-xs">Download the file to view it.</p>
            </div>
          )}
        </div>

        <DialogFooter showCloseButton>
          {attachment && (
            <Button type="button" variant="outline" onClick={() => onDownload(attachment)}>
              <Download className="size-4" aria-hidden="true" />
              Download
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
