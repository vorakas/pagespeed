import { Archive, Paperclip } from "lucide-react"

import type { TestCaseChange } from "@/types"
import { RichTextPreview } from "@/components/shared/RichTextTextarea"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn, formatDateTime } from "@/lib/utils"

interface TestCaseChangeListProps {
  changes: TestCaseChange[]
  selectedId: number | null
  loading: boolean
  onSelect: (change: TestCaseChange) => void
}

const ROW_CLASS =
  "min-w-[74rem] grid-cols-[8rem_minmax(18rem,1fr)_8rem_9rem_10rem_8rem]"

export function TestCaseChangeList({
  changes,
  selectedId,
  loading,
  onSelect,
}: TestCaseChangeListProps) {
  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Loading test case changes...
      </div>
    )
  }

  if (changes.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No test case changes match the current filters.
      </div>
    )
  }

  return (
    <div className="overflow-auto">
      <div
        className={cn(
          "grid w-full border-b border-border bg-muted/30 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
          ROW_CLASS
        )}
      >
        <span>Test Case</span>
        <span>Title</span>
        <span>Status</span>
        <span>Date</span>
        <span>Changed By</span>
        <span>Links</span>
      </div>
      <div className="divide-y divide-border">
        {changes.map((change) => {
          const isSelected = selectedId === change.id
          const isArchived = Boolean(change.archived_at)
          return (
            <Button
              key={change.id}
              type="button"
              variant="ghost"
              className={cn(
                "grid h-auto w-full !justify-start gap-0 rounded-none px-4 py-3 text-left",
                ROW_CLASS,
                isSelected && "bg-muted",
                isArchived && "text-muted-foreground"
              )}
              onClick={() => onSelect(change)}
            >
              <span className="font-mono text-xs text-foreground">{change.test_case_id}</span>
              <div className="min-w-0">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium text-foreground">
                    {change.title}
                  </span>
                  {isArchived && <Archive className="size-3.5 shrink-0" aria-label="Archived" />}
                </span>
                <RichTextPreview
                  value={change.change_summary}
                  className="mt-1 line-clamp-2 min-h-0 border-0 bg-transparent p-0 text-xs leading-5 text-muted-foreground"
                />
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {change.tags.join(", ") || "No tags"}
                </span>
              </div>
              <span>
                <Badge variant="outline">{change.status}</Badge>
              </span>
              <span className="text-xs text-muted-foreground">
                {change.change_date || "No date"}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {change.changed_by || "Unassigned"}
              </span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                B{change.associated_bugs.length} T{change.associated_tasks.length}
                <Paperclip className="size-3" aria-hidden="true" />
              </span>
              <span className="col-span-full mt-2 truncate text-xs text-muted-foreground">
                Updated {formatDateTime(change.updated_at)}
              </span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
