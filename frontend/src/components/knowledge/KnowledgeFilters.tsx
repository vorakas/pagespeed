import { Archive, Search, X } from "lucide-react"

import type { KnowledgeEntryType, KnowledgeStatus } from "@/types"
import { KNOWLEDGE_ENTRY_TYPES, KNOWLEDGE_STATUSES } from "@/types"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const ALL_TYPES = "all-types"
const ALL_STATUSES = "all-statuses"

interface KnowledgeFiltersProps {
  query: string
  entryType: KnowledgeEntryType | ""
  status: KnowledgeStatus | ""
  tag: string
  includeArchived: boolean
  onQueryChange: (value: string) => void
  onEntryTypeChange: (value: KnowledgeEntryType | "") => void
  onStatusChange: (value: KnowledgeStatus | "") => void
  onTagChange: (value: string) => void
  onIncludeArchivedChange: (value: boolean) => void
}

export function KnowledgeFilters({
  query,
  entryType,
  status,
  tag,
  includeArchived,
  onQueryChange,
  onEntryTypeChange,
  onStatusChange,
  onTagChange,
  onIncludeArchivedChange,
}: KnowledgeFiltersProps) {
  return (
    <div className="border-b border-border bg-background px-4 py-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem_12rem_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search knowledge"
            className="pl-9 pr-9"
            aria-label="Search knowledge entries"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="absolute right-2 top-1/2 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <Select
          value={entryType || ALL_TYPES}
          onValueChange={(value) =>
            onEntryTypeChange(value === ALL_TYPES ? "" : (value as KnowledgeEntryType))
          }
        >
          <SelectTrigger className="w-full" aria-label="Filter by entry type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPES}>All Types</SelectItem>
            {KNOWLEDGE_ENTRY_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status || ALL_STATUSES}
          onValueChange={(value) =>
            onStatusChange(value === ALL_STATUSES ? "" : (value as KnowledgeStatus))
          }
        >
          <SelectTrigger className="w-full" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES}>All Statuses</SelectItem>
            {KNOWLEDGE_STATUSES.map((statusOption) => (
              <SelectItem key={statusOption} value={statusOption}>
                {statusOption}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          value={tag}
          onChange={(event) => onTagChange(event.target.value)}
          placeholder="Tag"
          aria-label="Filter by tag"
        />

        <label className="flex h-10 items-center gap-2 whitespace-nowrap rounded-md border border-input px-3 text-sm text-muted-foreground">
          <Checkbox
            checked={includeArchived}
            onCheckedChange={(checked) => onIncludeArchivedChange(checked === true)}
          />
          <Archive className="size-4" aria-hidden="true" />
          Archived
        </label>
      </div>
    </div>
  )
}
