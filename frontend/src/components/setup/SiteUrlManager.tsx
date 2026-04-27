import { useState } from "react"
import { Plus, ChevronRight, Trash2, Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/EmptyState"
import { api } from "@/services/api"
import type { SiteWithUrls } from "@/types"

interface SiteUrlManagerProps {
  sites: SiteWithUrls[]
  onDataChanged: () => void
}

export function SiteUrlManager({ sites, onDataChanged }: SiteUrlManagerProps) {
  const [siteName, setSiteName] = useState("")
  const [selectedSiteId, setSelectedSiteId] = useState("")
  const [urlInput, setUrlInput] = useState("")
  const [addingSite, setAddingSite] = useState(false)
  const [addingUrl, setAddingUrl] = useState(false)
  const [expandedSites, setExpandedSites] = useState<Set<number>>(new Set())

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!siteName.trim()) return
    setAddingSite(true)
    try {
      await api.createSite(siteName.trim())
      setSiteName("")
      onDataChanged()
    } catch {
      // Error handled by API client
    } finally {
      setAddingSite(false)
    }
  }

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedSiteId || !urlInput.trim()) return
    setAddingUrl(true)
    try {
      await api.addUrl(parseInt(selectedSiteId), urlInput.trim())
      setUrlInput("")
      onDataChanged()
    } catch {
      // Error handled by API client
    } finally {
      setAddingUrl(false)
    }
  }

  const handleDeleteSite = async (siteId: number, name: string) => {
    if (!window.confirm(`Delete site "${name}"?\n\nThis will delete all URLs and test results for this site.`)) return
    try {
      await api.deleteSite(siteId)
      onDataChanged()
    } catch {
      // Error handled by API client
    }
  }

  const handleDeleteUrl = async (urlId: number) => {
    if (!window.confirm("Delete this URL? All test results will be lost.")) return
    try {
      await api.deleteUrl(urlId)
      onDataChanged()
    } catch {
      // Error handled by API client
    }
  }

  const toggleSite = (siteId: number) => {
    setExpandedSites((prev) => {
      const next = new Set(prev)
      if (next.has(siteId)) {
        next.delete(siteId)
      } else {
        next.add(siteId)
      }
      return next
    })
  }

  return (
    <div className="space-y-6">
      {/* Add Site / Add URL forms */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="aurora-panel p-4">
          <h3 className="aurora-text mb-3 text-sm font-semibold">Add Site</h3>
          <form onSubmit={handleAddSite} className="flex gap-2">
            <input
              className="aurora-input flex-1"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="Site name (e.g., Production)"
              required
            />
            <Button type="submit" disabled={addingSite} className="shrink-0">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </form>
        </div>

        <div className="aurora-panel p-4">
          <h3 className="aurora-text mb-3 text-sm font-semibold">Add URL</h3>
          <form onSubmit={handleAddUrl} className="space-y-2">
            <select
              className="aurora-select w-full"
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
            >
              <option value="">Select a site...</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id.toString()}>
                  {site.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                className="aurora-input flex-1"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com"
                required
              />
              <Button type="submit" disabled={addingUrl || !selectedSiteId} className="shrink-0">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Sites and URLs list */}
      <div>
        <h2 className="aurora-section-title mb-3">Current Sites and URLs</h2>
        {sites.length === 0 ? (
          <div className="aurora-panel overflow-hidden">
            <EmptyState
              icon={<Globe size={40} />}
              title="No Sites Created Yet"
              description="Use the forms above to add your first site and start tracking URLs."
            />
          </div>
        ) : (
          <div className="space-y-2">
            {sites.map((site) => {
              const isExpanded = expandedSites.has(site.id)
              return (
                <div key={site.id} className="aurora-panel overflow-hidden">
                  <button
                    type="button"
                    className="aurora-row"
                    onClick={() => toggleSite(site.id)}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight
                        className={`aurora-text-faint h-4 w-4 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      />
                      <span className="aurora-text text-sm font-semibold">{site.name}</span>
                      <span className="aurora-text-faint text-xs">
                        ({site.urls.length} URL{site.urls.length !== 1 ? "s" : ""})
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      style={{ color: "var(--lcc-red)" }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteSite(site.id, site.name)
                      }}
                      title="Delete site"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </button>
                  {isExpanded && (
                    <>
                      <div className="aurora-divider" />
                      <div className="px-4 py-2">
                        {site.urls.length === 0 ? (
                          <p className="aurora-text-faint py-3 text-center text-sm">
                            No URLs added yet
                          </p>
                        ) : (
                          <ul className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
                            {site.urls.map((url) => (
                              <li key={url.id} className="flex items-center justify-between py-2">
                                <span className="aurora-text mr-2 truncate text-sm" title={url.url}>
                                  {url.url}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  className="shrink-0"
                                  style={{ color: "var(--lcc-red)" }}
                                  onClick={() => handleDeleteUrl(url.id)}
                                  title="Delete URL"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
