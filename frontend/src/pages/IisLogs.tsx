import { useState, useEffect, useCallback } from "react"
import { BeaconHeader } from "@/components/layout/BeaconHeader"
import { AzureConfigPanel } from "@/components/iis-logs/AzureConfigPanel"
import { LogSearchPanel } from "@/components/iis-logs/LogSearchPanel"
import { DashboardSummary } from "@/components/iis-logs/DashboardSummary"
import { KqlQueryPanel } from "@/components/iis-logs/KqlQueryPanel"
import { useLocalConfig } from "@/hooks/use-local-config"
import { api } from "@/services/api"
import type { AzureConfig } from "@/types"

const DEFAULT_AZURE_CONFIG: AzureConfig = {
  tenantId: "",
  clientId: "",
  clientSecret: "",
  workspaceId: "",
  secretExpirationDate: "",
  site: "",
}

export function IisLogs() {
  const [config, setConfig] = useLocalConfig<AzureConfig>("azureConfig", DEFAULT_AZURE_CONFIG)
  const [connected, setConnected] = useState(false)
  const [sites, setSites] = useState<string[]>([])
  const [selectedSite, setSelectedSite] = useState(config.site || "")

  // Load site list after connection
  const loadSites = useCallback(async () => {
    if (!config.tenantId || !config.clientId || !config.clientSecret || !config.workspaceId) return
    try {
      const result = await api.listAzureSites(config)
      if (result.success && result.sites) {
        setSites(result.sites)
      }
    } catch {
      // Silent fail
    }
  }, [config])

  useEffect(() => {
    if (connected) {
      loadSites()
    }
  }, [connected, loadSites])

  const handleConnected = () => {
    setConnected(true)
  }

  const handleSiteChange = (value: string) => {
    const site = value === "all" ? "" : value
    setSelectedSite(site)
    setConfig({ ...config, site })
  }

  return (
    <>
      <BeaconHeader title="IIS Logs" description="Azure Log Analytics and KQL queries" />
      <div className="space-y-6 p-6">
        {/* Azure Config */}
        <AzureConfigPanel
          config={config}
          onConfigChange={setConfig}
          onConnected={handleConnected}
        />

        {/* Site Selector */}
        {connected && sites.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="aurora-label">IIS Site:</label>
            <select
              className="aurora-select w-60"
              value={selectedSite || "all"}
              onChange={(e) => handleSiteChange(e.target.value)}
            >
              <option value="all">All Sites</option>
              {sites.map((site) => (
                <option key={site} value={site}>{site}</option>
              ))}
            </select>
          </div>
        )}

        {/* Search, Dashboard, KQL — shown after connection */}
        {connected && (
          <>
            <LogSearchPanel config={config} selectedSite={selectedSite} />
            <DashboardSummary config={config} selectedSite={selectedSite} />
            <KqlQueryPanel config={config} />
          </>
        )}
      </div>
    </>
  )
}
