import { Archive, Globe2, Plus } from "lucide-react"

import type { KnowledgeDomain } from "@/types"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface DomainRailProps {
  domains: KnowledgeDomain[]
  selectedDomainId: number | null
  newDomainName: string
  newDomainDescription: string
  includeArchivedDomains: boolean
  savingDomain: boolean
  onSelectDomain: (domainId: number | null) => void
  onNewDomainNameChange: (value: string) => void
  onNewDomainDescriptionChange: (value: string) => void
  onIncludeArchivedDomainsChange: (value: boolean) => void
  onCreateDomain: () => void
}

export function DomainRail({
  domains,
  selectedDomainId,
  newDomainName,
  newDomainDescription,
  includeArchivedDomains,
  savingDomain,
  onSelectDomain,
  onNewDomainNameChange,
  onNewDomainDescriptionChange,
  onIncludeArchivedDomainsChange,
  onCreateDomain,
}: DomainRailProps) {
  const activeCount = domains.filter((domain) => !domain.archived_at).length

  return (
    <aside className="w-full border-b border-border bg-card/40 lg:w-72 lg:border-b-0 lg:border-r">
      <div className="flex h-full flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Domains</h2>
            <p className="text-xs text-muted-foreground">
              {activeCount} active / {domains.length} shown
            </p>
          </div>
          <Globe2 className="size-4 text-muted-foreground" aria-hidden="true" />
        </div>

        <div className="space-y-1">
          <Button
            type="button"
            variant={selectedDomainId === null ? "secondary" : "ghost"}
            className="h-9 w-full justify-start px-3 text-sm"
            onClick={() => onSelectDomain(null)}
          >
            All Domains
          </Button>

          <div className="max-h-72 space-y-1 overflow-y-auto pr-1 lg:max-h-[calc(100vh-25rem)]">
            {domains.map((domain) => {
              const archived = Boolean(domain.archived_at)
              return (
                <Button
                  key={domain.id}
                  type="button"
                  variant={selectedDomainId === domain.id ? "secondary" : "ghost"}
                  className={cn(
                    "h-auto w-full justify-start px-3 py-2 text-left text-sm",
                    archived && "text-muted-foreground"
                  )}
                  onClick={() => onSelectDomain(domain.id)}
                >
                  <span className="min-w-0 flex-1 truncate">{domain.name}</span>
                  {archived && <Archive className="ml-2 size-3.5 shrink-0" aria-label="Archived" />}
                </Button>
              )
            })}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={includeArchivedDomains}
            onCheckedChange={(checked) => onIncludeArchivedDomainsChange(checked === true)}
          />
          Show archived domains
        </label>

        <div className="border-t border-border pt-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Add Domain
          </h3>
          <div className="space-y-2">
            <Input
              value={newDomainName}
              onChange={(event) => onNewDomainNameChange(event.target.value)}
              placeholder="Domain name"
            />
            <Textarea
              value={newDomainDescription}
              onChange={(event) => onNewDomainDescriptionChange(event.target.value)}
              placeholder="Description"
              rows={3}
            />
            <Button
              type="button"
              className="w-full"
              onClick={onCreateDomain}
              disabled={savingDomain || !newDomainName.trim()}
            >
              <Plus className="size-4" aria-hidden="true" />
              {savingDomain ? "Saving" : "Add Domain"}
            </Button>
          </div>
        </div>
      </div>
    </aside>
  )
}
