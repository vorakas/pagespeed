import { Archive, Save, X } from "lucide-react"

import type { KnowledgeDomain, KnowledgeEntry, KnowledgeEntryType, KnowledgeStatus } from "@/types"
import { KNOWLEDGE_ENTRY_TYPES, KNOWLEDGE_STATUSES } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  onDraftChange: (draft: KnowledgeEntryDraft) => void
  onSave: () => void
  onArchive: () => void
  onClose: () => void
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

export function KnowledgeEntryEditor({
  domains,
  entry,
  draft,
  saving,
  onDraftChange,
  onSave,
  onArchive,
  onClose,
}: KnowledgeEntryEditorProps) {
  const selectableDomains = domains.filter(
    (domain) => !domain.archived_at || (entry && domain.id === entry.domain_id)
  )
  const selectedDomainName =
    domains.find((domain) => domain.id === draft.domain_id)?.name ?? ""
  const hasCurrentEntryDomain = Boolean(
    entry && domains.some((domain) => domain.id === entry.domain_id)
  )
  const canArchive = Boolean(entry && entry.status !== "Archived")

  const updateDraft = <Key extends keyof KnowledgeEntryDraft>(
    key: Key,
    value: KnowledgeEntryDraft[Key]
  ) => {
    onDraftChange({ ...draft, [key]: value })
  }

  return (
    <aside className="w-full border-l border-border bg-card/40 lg:w-[28rem]">
      <div className="flex h-full flex-col">
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

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Source</span>
            <Input
              value={draft.source}
              onChange={(event) => updateDraft("source", event.target.value)}
              placeholder="Source"
              aria-label="Entry source"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Tags</span>
            <Input
              value={draft.tags}
              onChange={(event) => updateDraft("tags", event.target.value)}
              placeholder="comma, separated, tags"
              aria-label="Entry tags"
            />
          </label>
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
    </aside>
  )
}
