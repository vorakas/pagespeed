import { useState } from "react"
import { Plus, ChevronRight, Trash2, Globe } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
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
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Add Site</h3>
            <form onSubmit={handleAddSite} className="flex gap-2">
              <Input
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
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Add URL</h3>
            <form onSubmit={handleAddUrl} className="space-y-2">
              <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a site..." />
                </SelectTrigger>
                <SelectContent>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id.toString()}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
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
          </CardContent>
        </Card>
      </div>

      {/* Sites and URLs list */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Current Sites and URLs</h2>
        {sites.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <EmptyState
                icon={<Globe size={40} />}
                title="No Sites Created Yet"
                description="Use the forms above to add your first site and start tracking URLs."
              />
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {sites.map((site) => {
              const isExpanded = expandedSites.has(site.id)
              return (
                <Card key={site.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                    onClick={() => toggleSite(site.id)}
                  >
                    <div className="flex items-center gap-2">
                      <ChevronRight
                        className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
                      />
                      <span className="text-sm font-semibold text-foreground">{site.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({site.urls.length} URL{site.urls.length !== 1 ? "s" : ""})
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive hover:text-destructive"
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
                    <div className="border-t border-border px-4 py-2">
                      {site.urls.length === 0 ? (
                        <p className="py-3 text-center text-sm text-muted-foreground">
                          No URLs added yet
                        </p>
                      ) : (
                        <ul className="divide-y divide-border">
                          {site.urls.map((url) => (
                            <li key={url.id} className="flex items-center justify-between py-2">
                              <span className="text-sm text-foreground truncate mr-2" title={url.url}>
                                {url.url}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                className="shrink-0 text-destructive hover:text-destructive"
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
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
