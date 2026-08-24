import { Archive, FileText } from "lucide-react"

import type { KnowledgeEntry } from "@/types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface KnowledgeEntryListProps {
  entries: KnowledgeEntry[]
  selectedEntryId: number | null
  loading: boolean
  onSelectEntry: (entry: KnowledgeEntry) => void
}

const ENTRY_GRID_CLASS =
  "min-w-[58rem] grid-cols-[minmax(18rem,1fr)_8rem_8rem_12rem_12rem_9rem]"

function formatUpdatedAt(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date)
}

function statusVariant(status: KnowledgeEntry["status"]) {
  if (status === "Active") return "default"
  if (status === "Archived") return "secondary"
  if (status === "Superseded") return "outline"
  return "secondary"
}

export function KnowledgeEntryList({
  entries,
  selectedEntryId,
  loading,
  onSelectEntry,
}: KnowledgeEntryListProps) {
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Loading knowledge entries
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
        <FileText className="size-5 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">No entries found</p>
        <p className="text-xs text-muted-foreground">Adjust filters or create an entry.</p>
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <div
        className={cn(
          "grid w-full border-b border-border bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
          ENTRY_GRID_CLASS
        )}
      >
        <span>Title</span>
        <span>Type</span>
        <span>Status</span>
        <span>Domain</span>
        <span>Source</span>
        <span>Updated</span>
      </div>
      <div className="divide-y divide-border">
        {entries.map((entry) => {
          const selected = selectedEntryId === entry.id
          const archived = entry.status === "Archived"
          return (
            <Button
              key={entry.id}
              type="button"
              variant="ghost"
              className={cn(
                "grid h-auto w-full !justify-start gap-0 rounded-none px-4 py-3 text-left",
                ENTRY_GRID_CLASS,
                selected && "bg-muted",
                archived && "text-muted-foreground"
              )}
              onClick={() => onSelectEntry(entry)}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium text-foreground">{entry.title}</span>
                  {archived && <Archive className="size-3.5 shrink-0" aria-label="Archived" />}
                </span>
                {entry.tags && (
                  <span className="mt-1 block truncate text-xs text-muted-foreground">
                    {entry.tags}
                  </span>
                )}
              </span>
              <span>
                <Badge variant="outline">{entry.entry_type}</Badge>
              </span>
              <span>
                <Badge variant={statusVariant(entry.status)}>{entry.status}</Badge>
              </span>
              <span className="truncate text-sm text-muted-foreground">{entry.domain_name}</span>
              <span className="truncate text-sm text-muted-foreground">{entry.source || "-"}</span>
              <span className="text-sm text-muted-foreground">{formatUpdatedAt(entry.updated_at)}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
