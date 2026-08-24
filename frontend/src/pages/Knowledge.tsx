import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { DomainRail } from "@/components/knowledge/DomainRail"
import { KnowledgeEntryEditor, type KnowledgeEntryDraft } from "@/components/knowledge/KnowledgeEntryEditor"
import { KnowledgeEntryList } from "@/components/knowledge/KnowledgeEntryList"
import { KnowledgeFilters } from "@/components/knowledge/KnowledgeFilters"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { api } from "@/services/api"
import type { KnowledgeDomain, KnowledgeEntry, KnowledgeEntryPayload, KnowledgeEntryType, KnowledgeStatus } from "@/types"

const emptyDraft = (domainId: number | null): KnowledgeEntryDraft => ({
  domain_id: domainId,
  entry_type: "Decision",
  status: "Active",
  title: "",
  details: "",
  source: "",
  tags: "",
})

const draftFromEntry = (entry: KnowledgeEntry): KnowledgeEntryDraft => ({
  domain_id: entry.domain_id,
  entry_type: entry.entry_type,
  status: entry.status,
  title: entry.title,
  details: entry.details,
  source: entry.source,
  tags: entry.tags,
})

const tagsToPayload = (tags: string) =>
  tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed"
}

export function Knowledge() {
  const [domains, setDomains] = useState<KnowledgeDomain[]>([])
  const [entries, setEntries] = useState<KnowledgeEntry[]>([])
  const [selectedDomainId, setSelectedDomainId] = useState<number | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null)
  const [draft, setDraft] = useState<KnowledgeEntryDraft>(() => emptyDraft(null))
  const [editorOpen, setEditorOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [entryType, setEntryType] = useState<KnowledgeEntryType | "">("")
  const [status, setStatus] = useState<KnowledgeStatus | "">("")
  const [tag, setTag] = useState("")
  const [includeArchivedEntries, setIncludeArchivedEntries] = useState(false)
  const [includeArchivedDomains, setIncludeArchivedDomains] = useState(false)
  const [newDomainName, setNewDomainName] = useState("")
  const [newDomainDescription, setNewDomainDescription] = useState("")
  const [loadingDomains, setLoadingDomains] = useState(false)
  const [loadingEntries, setLoadingEntries] = useState(false)
  const [savingDomain, setSavingDomain] = useState(false)
  const [savingEntry, setSavingEntry] = useState(false)
  const entryRequestIdRef = useRef(0)

  const activeDomains = useMemo(
    () => domains.filter((domain) => !domain.archived_at),
    [domains]
  )

  const selectedEntryId = selectedEntry?.id ?? null

  const loadDomains = useCallback(async () => {
    setLoadingDomains(true)
    try {
      const loadedDomains = await api.getKnowledgeDomains(includeArchivedDomains)
      setDomains(loadedDomains)
      setSelectedDomainId((currentDomainId) =>
        currentDomainId !== null &&
        !loadedDomains.some((domain) => domain.id === currentDomainId)
          ? null
          : currentDomainId
      )
    } catch (error) {
      toast.error("Could not load domains", { description: getErrorMessage(error) })
    } finally {
      setLoadingDomains(false)
    }
  }, [includeArchivedDomains])

  const loadEntries = useCallback(async () => {
    const requestId = entryRequestIdRef.current + 1
    entryRequestIdRef.current = requestId
    setLoadingEntries(true)
    try {
      const loadedEntries = await api.searchKnowledgeEntries({
        query: query.trim() || undefined,
        domain_id: selectedDomainId ?? undefined,
        entry_type: entryType || undefined,
        status: status || undefined,
        tag: tag.trim() || undefined,
        include_archived: includeArchivedEntries,
        include_archived_domains: includeArchivedDomains,
      })
      if (requestId !== entryRequestIdRef.current) return
      setEntries(loadedEntries)
    } catch (error) {
      if (requestId === entryRequestIdRef.current) {
        toast.error("Could not load entries", { description: getErrorMessage(error) })
      }
    } finally {
      if (requestId === entryRequestIdRef.current) {
        setLoadingEntries(false)
      }
    }
  }, [entryType, includeArchivedDomains, includeArchivedEntries, query, selectedDomainId, status, tag])

  useEffect(() => {
    void loadDomains()
  }, [loadDomains])

  useEffect(() => {
    void loadEntries()
  }, [loadEntries])

  const startNewEntry = () => {
    const domainId =
      selectedDomainId && activeDomains.some((domain) => domain.id === selectedDomainId)
        ? selectedDomainId
        : activeDomains[0]?.id ?? null

    if (!domainId) {
      toast.error("No active domain", { description: "Add a domain before creating entries." })
      return
    }

    setSelectedEntry(null)
    setDraft(emptyDraft(domainId))
    setEditorOpen(true)
  }

  const openEntry = (entry: KnowledgeEntry) => {
    setSelectedEntry(entry)
    setDraft(draftFromEntry(entry))
    setEditorOpen(true)
  }

  const createDomain = async () => {
    const name = newDomainName.trim()
    if (!name) return

    setSavingDomain(true)
    try {
      const domain = await api.createKnowledgeDomain({
        name,
        description: newDomainDescription.trim() || undefined,
      })
      setNewDomainName("")
      setNewDomainDescription("")
      setSelectedDomainId(domain.id)
      await loadDomains()
      toast.success("Domain added")
    } catch (error) {
      toast.error("Could not add domain", { description: getErrorMessage(error) })
    } finally {
      setSavingDomain(false)
    }
  }

  const saveEntry = async () => {
    if (!draft.domain_id) {
      toast.error("Domain required")
      return
    }

    const payload: KnowledgeEntryPayload = {
      domain_id: draft.domain_id,
      entry_type: draft.entry_type,
      status: draft.status,
      title: draft.title.trim(),
      details: draft.details.trim(),
      source: draft.source.trim() || undefined,
      tags: tagsToPayload(draft.tags),
    }

    setSavingEntry(true)
    try {
      const savedEntry = selectedEntry
        ? await api.updateKnowledgeEntry(selectedEntry.id, payload)
        : await api.createKnowledgeEntry(payload)

      setSelectedEntry(savedEntry)
      setDraft(draftFromEntry(savedEntry))
      setEditorOpen(true)
      await loadEntries()
      toast.success(selectedEntry ? "Entry updated" : "Entry created")
    } catch (error) {
      toast.error("Could not save entry", { description: getErrorMessage(error) })
    } finally {
      setSavingEntry(false)
    }
  }

  const archiveEntry = async () => {
    if (!selectedEntry) return

    setSavingEntry(true)
    try {
      await api.archiveKnowledgeEntry(selectedEntry.id)
      setEditorOpen(false)
      setSelectedEntry(null)
      await loadEntries()
      toast.success("Entry archived")
    } catch (error) {
      toast.error("Could not archive entry", { description: getErrorMessage(error) })
    } finally {
      setSavingEntry(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Knowledge"
        description="Operational facts, decisions, and migration notes."
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void loadDomains()
                void loadEntries()
              }}
              disabled={loadingDomains || loadingEntries}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
            <Button type="button" onClick={startNewEntry}>
              <Plus className="size-4" aria-hidden="true" />
              New Entry
            </Button>
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col border-t border-border lg:flex-row">
        <DomainRail
          domains={domains}
          selectedDomainId={selectedDomainId}
          newDomainName={newDomainName}
          newDomainDescription={newDomainDescription}
          includeArchivedDomains={includeArchivedDomains}
          savingDomain={savingDomain}
          onSelectDomain={setSelectedDomainId}
          onNewDomainNameChange={setNewDomainName}
          onNewDomainDescriptionChange={setNewDomainDescription}
          onIncludeArchivedDomainsChange={setIncludeArchivedDomains}
          onCreateDomain={() => void createDomain()}
        />

        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <main
            className={cn(
              "flex min-h-0 flex-col",
              editorOpen
                ? "max-h-[36vh] min-h-40 shrink-0 overflow-hidden border-b border-border"
                : "flex-1"
            )}
          >
            <KnowledgeFilters
              query={query}
              entryType={entryType}
              status={status}
              tag={tag}
              includeArchived={includeArchivedEntries}
              onQueryChange={setQuery}
              onEntryTypeChange={setEntryType}
              onStatusChange={setStatus}
              onTagChange={setTag}
              onIncludeArchivedChange={setIncludeArchivedEntries}
            />
            <div className="min-h-0 flex-1 overflow-auto">
              <KnowledgeEntryList
                entries={entries}
                selectedEntryId={selectedEntryId}
                loading={loadingEntries}
                onSelectEntry={openEntry}
              />
            </div>
          </main>

          {editorOpen && (
            <KnowledgeEntryEditor
              domains={domains}
              entry={selectedEntry}
              draft={draft}
              saving={savingEntry}
              onDraftChange={setDraft}
              onSave={() => void saveEntry()}
              onArchive={() => void archiveEntry()}
              onClose={() => setEditorOpen(false)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
