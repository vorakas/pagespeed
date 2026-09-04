import { Search } from "lucide-react"

import type { TestCaseChangeStatus } from "@/types"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"

interface TestCaseChangeFiltersProps {
  query: string
  status: TestCaseChangeStatus | "all"
  tag: string
  includeArchived: boolean
  onQueryChange: (value: string) => void
  onStatusChange: (value: TestCaseChangeStatus | "all") => void
  onTagChange: (value: string) => void
  onIncludeArchivedChange: (value: boolean) => void
}

export function TestCaseChangeFilters({
  query,
  status,
  tag,
  includeArchived,
  onQueryChange,
  onStatusChange,
  onTagChange,
  onIncludeArchivedChange,
}: TestCaseChangeFiltersProps) {
  return (
    <div className="border-b border-border bg-background px-4 py-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_12rem_12rem_auto]">
        <div className="space-y-1.5">
          <Label htmlFor="test-case-change-search">Search</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="test-case-change-search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              className="pl-9"
              placeholder="Keyword, test ID, bug, task, owner"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="test-case-change-status">Status</Label>
          <Select
            value={status}
            onValueChange={(value) => onStatusChange(value as TestCaseChangeStatus | "all")}
          >
            <SelectTrigger id="test-case-change-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Superseded">Superseded</SelectItem>
              <SelectItem value="Archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="test-case-change-tag">Tag</Label>
          <Input
            id="test-case-change-tag"
            value={tag}
            onChange={(event) => onTagChange(event.target.value)}
            placeholder="checkout"
          />
        </div>

        <div className="flex items-end gap-2 pb-2">
          <Switch checked={includeArchived} onCheckedChange={onIncludeArchivedChange} />
          <span className="text-sm text-muted-foreground">Archived</span>
        </div>
      </div>
    </div>
  )
}
