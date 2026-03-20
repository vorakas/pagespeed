import { createContext, useState, useCallback, useEffect, type ReactNode } from "react"
import type { Site, SiteWithUrls } from "@/types"
import { api } from "@/services/api"

interface SitesContextValue {
  sites: SiteWithUrls[]
  loading: boolean
  error: string | null
  refreshSites: () => Promise<void>
}

export const SitesContext = createContext<SitesContextValue | null>(null)

export function SitesProvider({ children }: { children: ReactNode }) {
  const [sites, setSites] = useState<SiteWithUrls[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refreshSites = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const siteList: Site[] = await api.getSites()
      const sitesWithUrls: SiteWithUrls[] = await Promise.all(
        siteList.map(async (site) => {
          const urls = await api.getUrls(site.id)
          return { ...site, urls }
        })
      )
      setSites(sitesWithUrls)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sites")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshSites()
  }, [refreshSites])

  return (
    <SitesContext.Provider value={{ sites, loading, error, refreshSites }}>
      {children}
    </SitesContext.Provider>
  )
}
