import { useState, useEffect, useCallback, useRef } from "react"
import { PageHeader } from "@/components/layout/PageHeader"
import {
  AzureConfigPanel,
  type AzureConnectionStatus,
} from "@/components/iis-logs/AzureConfigPanel"
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

function getAzureConnectionKey(config: AzureConfig): string | null {
  if (!config.tenantId || !config.clientId || !config.clientSecret || !config.workspaceId) {
    return null
  }
  return [
    config.tenantId,
    config.clientId,
    config.clientSecret,
    config.workspaceId,
  ].join("|")
}

export function IisLogs() {
  const [config, setConfig] = useLocalConfig<AzureConfig>("azureConfig", DEFAULT_AZURE_CONFIG)
  const [connected, setConnected] = useState(false)
  const [connectedKey, setConnectedKey] = useState<string | null>(null)
  const [lastAutoTestKey, setLastAutoTestKey] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<AzureConnectionStatus | null>(null)
  const [sites, setSites] = useState<string[]>([])
  const [selectedSite, setSelectedSite] = useState(config.site || "")
  const connectionKey = getAzureConnectionKey(config)
  const connectionKeyRef = useRef<string | null>(connectionKey)

  useEffect(() => {
    connectionKeyRef.current = connectionKey
  }, [connectionKey])

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

  useEffect(() => {
    if (connectedKey !== connectionKey) {
      setConnected(false)
      setSites([])
    }
  }, [connectedKey, connectionKey])

  const testConnection = useCallback(async (mode: "auto" | "manual" = "manual") => {
    const key = getAzureConnectionKey(config)
    if (!key) {
      setConnected(false)
      setConnectedKey(null)
      setConnectionStatus({ message: "Please fill in all configuration fields.", type: "error" })
      return
    }

    if (mode === "auto") {
      setLastAutoTestKey(key)
    }

    setConnectionStatus({ message: "Testing connection...", type: "testing" })
    try {
      const result = await api.testAzureConnection(config)
      if (connectionKeyRef.current !== key) return
      if (result.success) {
        setConnected(true)
        setConnectedKey(key)
        setConnectionStatus({
          message: result.message,
          type: result.warning ? "warning" : "success",
        })
      } else {
        setConnected(false)
        setConnectedKey(null)
        setConnectionStatus({ message: result.message, type: "error" })
      }
    } catch (err) {
      if (connectionKeyRef.current !== key) return
      setConnected(false)
      setConnectedKey(null)
      setConnectionStatus({
        message: err instanceof Error ? err.message : "Connection failed",
        type: "error",
      })
    }
  }, [config])

  useEffect(() => {
    if (!connectionKey) return
    if (connectedKey === connectionKey) return
    if (lastAutoTestKey === connectionKey) return
    void testConnection("auto")
  }, [connectionKey, connectedKey, lastAutoTestKey, testConnection])

  const handleSiteChange = (value: string) => {
    const site = value === "all" ? "" : value
    setSelectedSite(site)
    setConfig({ ...config, site })
  }

  return (
    <>
      <PageHeader title="IIS Logs" description="Azure Log Analytics and KQL queries" />
      <div className="space-y-6 p-6">
        {/* Azure Config */}
        <AzureConfigPanel
          config={config}
          onConfigChange={setConfig}
          onTestConnection={testConnection}
          connectionStatus={connectionStatus}
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
