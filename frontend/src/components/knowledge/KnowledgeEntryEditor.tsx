import { type ChangeEvent, useRef } from "react"
import { Archive, Download, ExternalLink, File, Image, Loader2, Paperclip, Save, Trash2, Upload, X } from "lucide-react"

import type { KnowledgeDomain, KnowledgeEntry, KnowledgeEntryAttachment, KnowledgeEntryType, KnowledgeStatus } from "@/types"
import { KNOWLEDGE_ENTRY_TYPES, KNOWLEDGE_STATUSES } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { splitLinkedText } from "@/lib/linkify"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

export interface KnowledgeEntryDraft {
  domain_id: number | null
  entry_type: KnowledgeEntryType
  status: KnowledgeStatus
  title: string
  details: string
  source: string
  tags: string
}

interface KnowledgeEntryEditorProps {
  domains: KnowledgeDomain[]
  entry: KnowledgeEntry | null
  draft: KnowledgeEntryDraft
  saving: boolean
  attachments: KnowledgeEntryAttachment[]
  attachmentsLoading: boolean
  attachmentsUploading: boolean
  getAttachmentUrl: (attachment: KnowledgeEntryAttachment) => string
  onUploadAttachments: (files: File[]) => void
  onDownloadAttachment: (attachment: KnowledgeEntryAttachment) => void
  onDeleteAttachment: (attachment: KnowledgeEntryAttachment) => void
  onDraftChange: (draft: KnowledgeEntryDraft) => void
  onSave: () => void
  onArchive: () => void
  onClose: () => void
}

function LinkPreview({ value }: { value: string }) {
  const parts = splitLinkedText(value)
  const hasLink = parts.some((part) => part.type === "link")

  if (!hasLink) return null

  return (
    <div
      className="whitespace-pre-wrap break-words rounded-md border border-border bg-background/60 px-3 py-2 text-xs leading-relaxed text-muted-foreground"
      aria-label="Clickable URL preview"
    >
      {parts.map((part, index) => {
        if (part.type === "text") return <span key={index}>{part.text}</span>

        return (
          <a
            key={index}
            href={part.href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
          >
            {part.text}
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )
      })}
    </div>
  )
}

function formatUpdatedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function KnowledgeEntryEditor({
  domains,
  entry,
  draft,
  saving,
  attachments,
  attachmentsLoading,
  attachmentsUploading,
  getAttachmentUrl,
  onUploadAttachments,
  onDownloadAttachment,
  onDeleteAttachment,
  onDraftChange,
  onSave,
  onArchive,
  onClose,
}: KnowledgeEntryEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const selectableDomains = domains.filter(
    (domain) => !domain.archived_at || (entry && domain.id === entry.domain_id)
  )
  const selectedDomainName =
    domains.find((domain) => domain.id === draft.domain_id)?.name ?? ""
  const hasCurrentEntryDomain = Boolean(
    entry && domains.some((domain) => domain.id === entry.domain_id)
  )
  const canArchive = Boolean(entry && entry.status !== "Archived")
  const canAttach = Boolean(entry)

  const updateDraft = <Key extends keyof KnowledgeEntryDraft>(
    key: Key,
    value: KnowledgeEntryDraft[Key]
  ) => {
    onDraftChange({ ...draft, [key]: value })
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (files.length) onUploadAttachments(files)
  }

  return (
    <section className="flex h-full min-h-0 flex-col bg-card/40">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">
              {entry ? "Edit Entry" : "New Entry"}
            </h2>
            {entry && (
              <p className="text-xs text-muted-foreground">
                Updated {formatUpdatedAt(entry.updated_at)}
              </p>
            )}
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close editor">
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Domain</span>
              <Select
                value={draft.domain_id ? String(draft.domain_id) : ""}
                onValueChange={(value) => updateDraft("domain_id", Number(value))}
              >
                <SelectTrigger className="w-full" aria-label="Entry domain">
                  <SelectValue placeholder="Select domain">
                    {selectedDomainName}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {selectableDomains.map((domain) => (
                    <SelectItem key={domain.id} value={String(domain.id)}>
                      {domain.name}
                      {domain.archived_at ? " (Archived)" : ""}
                    </SelectItem>
                  ))}
                  {entry && !hasCurrentEntryDomain && (
                    <SelectItem value={String(entry.domain_id)}>
                      {entry.domain_name} (Archived)
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Type</span>
              <Select
                value={draft.entry_type}
                onValueChange={(value) => updateDraft("entry_type", value as KnowledgeEntryType)}
              >
                <SelectTrigger className="w-full" aria-label="Entry type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KNOWLEDGE_ENTRY_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            <label className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <Select
                value={draft.status}
                onValueChange={(value) => updateDraft("status", value as KnowledgeStatus)}
              >
                <SelectTrigger className="w-full" aria-label="Entry status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KNOWLEDGE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>

            {entry && (
              <div className="space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Entry ID</span>
                <div className="flex h-10 items-center">
                  <Badge variant="outline">#{entry.id}</Badge>
                </div>
              </div>
            )}
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Title</span>
            <Input
              value={draft.title}
              onChange={(event) => updateDraft("title", event.target.value)}
              placeholder="Title"
              aria-label="Entry title"
            />
          </label>

          <div className="space-y-1.5">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Details</span>
              <Textarea
                value={draft.details}
                onChange={(event) => updateDraft("details", event.target.value)}
                placeholder="Details"
                rows={10}
                aria-label="Entry details"
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Source</span>
              <Input
                value={draft.source}
                onChange={(event) => updateDraft("source", event.target.value)}
                placeholder="Source"
                aria-label="Entry source"
              />
            </label>
            <LinkPreview value={draft.source} />
          </div>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Tags</span>
            <Input
              value={draft.tags}
              onChange={(event) => updateDraft("tags", event.target.value)}
              placeholder="comma, separated, tags"
              aria-label="Entry tags"
            />
          </label>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">Attachments</span>
              <div className="flex items-center gap-2">
                {attachmentsLoading && (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canAttach || attachmentsUploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {attachmentsUploading ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload className="size-4" aria-hidden="true" />
                  )}
                  Upload
                </Button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
              aria-label="Upload entry attachments"
            />

            {canAttach && attachments.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {attachments.map((attachment) => {
                  const isImage = attachment.mime_type.startsWith("image/")
                  return (
                    <div
                      key={attachment.id}
                      className="min-w-0 overflow-hidden rounded-md border border-border bg-background/60"
                    >
                      <div className="flex h-24 items-center justify-center bg-muted/30">
                        {isImage ? (
                          <img
                            src={getAttachmentUrl(attachment)}
                            alt={attachment.filename}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <File className="size-8 text-muted-foreground" aria-hidden="true" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 p-2">
                        {isImage ? (
                          <Image className="size-4 shrink-0 text-primary" aria-hidden="true" />
                        ) : (
                          <Paperclip className="size-4 shrink-0 text-primary" aria-hidden="true" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium text-foreground" title={attachment.filename}>
                            {attachment.filename}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {formatFileSize(attachment.file_size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          onClick={() => onDownloadAttachment(attachment)}
                          aria-label={`Download ${attachment.filename}`}
                        >
                          <Download className="size-4" aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0 text-destructive hover:text-destructive"
                          onClick={() => onDeleteAttachment(attachment)}
                          aria-label={`Delete ${attachment.filename}`}
                        >
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {canAttach && !attachmentsLoading && attachments.length === 0 && (
              <div className="rounded-md border border-dashed border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                No attachments
              </div>
            )}
            {!canAttach && (
              <div className="rounded-md border border-dashed border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                Save entry to attach files
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          <Button type="button" onClick={onSave} disabled={saving || !draft.domain_id || !draft.title.trim() || !draft.details.trim()}>
            <Save className="size-4" aria-hidden="true" />
            {saving ? "Saving" : "Save"}
          </Button>
          {canArchive && (
            <Button type="button" variant="outline" onClick={onArchive} disabled={saving}>
              <Archive className="size-4" aria-hidden="true" />
              Archive
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}
