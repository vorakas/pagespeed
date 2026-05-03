import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Save, Wifi } from "lucide-react"
import { api } from "@/services/api"
import type { AzureConfig } from "@/types"

interface AzureConfigPanelProps {
  config: AzureConfig
  onConfigChange: (config: AzureConfig) => void
  onConnected: () => void
}

function getExpirationWarning(dateStr: string): { message: string; type: "expired" | "warning" } | null {
  if (!dateStr) return null
  const expiration = new Date(dateStr)
  const now = new Date()
  const daysUntilExpiry = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysUntilExpiry <= 0) {
    return { message: `Client secret has expired (${dateStr}). Please generate a new secret.`, type: "expired" }
  }
  if (daysUntilExpiry <= 30) {
    return { message: `Client secret expires in ${daysUntilExpiry} day${daysUntilExpiry !== 1 ? "s" : ""} (${dateStr}).`, type: "warning" }
  }
  return null
}

const statusColor = (type: "success" | "error" | "testing" | "warning") => {
  switch (type) {
    case "success": return "var(--lcc-green)"
    case "error":   return "var(--lcc-red)"
    case "warning": return "var(--lcc-amber)"
    case "testing": return "var(--lcc-text-dim)"
  }
}

export function AzureConfigPanel({ config, onConfigChange, onConnected }: AzureConfigPanelProps) {
  const [connectionStatus, setConnectionStatus] = useState<{
    message: string
    type: "success" | "error" | "testing" | "warning"
  } | null>(null)

  const updateField = (field: keyof AzureConfig, value: string) => {
    onConfigChange({ ...config, [field]: value })
  }

  const handleSave = () => {
    onConfigChange(config)
    setConnectionStatus({ message: "Configuration saved", type: "success" })
    setTimeout(() => setConnectionStatus(null), 3000)
  }

  const handleTestConnection = async () => {
    if (!config.tenantId || !config.clientId || !config.clientSecret || !config.workspaceId) {
      setConnectionStatus({ message: "Please fill in all configuration fields.", type: "error" })
      return
    }
    setConnectionStatus({ message: "Testing connection...", type: "testing" })
    try {
      const result = await api.testAzureConnection(config)
      if (result.success) {
        setConnectionStatus({
          message: result.message,
          type: result.warning ? "warning" : "success",
        })
        onConnected()
      } else {
        setConnectionStatus({ message: result.message, type: "error" })
      }
    } catch (err) {
      setConnectionStatus({
        message: err instanceof Error ? err.message : "Connection failed",
        type: "error",
      })
    }
  }

  const expirationWarning = getExpirationWarning(config.secretExpirationDate)

  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="aurora-panel space-y-3 p-4">
          <h3 className="aurora-text text-sm font-semibold">Azure AD Authentication</h3>
          <div className="space-y-1.5">
            <label htmlFor="azTenant" className="aurora-label block">Tenant ID</label>
            <input id="azTenant" className="aurora-input w-full" value={config.tenantId} onChange={(e) => updateField("tenantId", e.target.value)} placeholder="Directory (Tenant) ID" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="azClient" className="aurora-label block">Client ID</label>
            <input id="azClient" className="aurora-input w-full" value={config.clientId} onChange={(e) => updateField("clientId", e.target.value)} placeholder="Application (Client) ID" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="azSecret" className="aurora-label block">Client Secret</label>
            <input id="azSecret" type="password" className="aurora-input w-full" value={config.clientSecret} onChange={(e) => updateField("clientSecret", e.target.value)} placeholder="Client Secret Value" />
          </div>
          <Button onClick={handleSave} style={{ color: "#000" }}>
            <Save className="h-4 w-4" /> Save Configuration
          </Button>
        </div>
        <div className="aurora-panel space-y-3 p-4">
          <h3 className="aurora-text text-sm font-semibold">Workspace Settings</h3>
          <div className="space-y-1.5">
            <label htmlFor="azWorkspace" className="aurora-label block">Workspace ID</label>
            <input id="azWorkspace" className="aurora-input w-full" value={config.workspaceId} onChange={(e) => updateField("workspaceId", e.target.value)} placeholder="Log Analytics Workspace ID" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="azExpiration" className="aurora-label block">Secret Expiration Date</label>
            <input id="azExpiration" type="date" className="aurora-input w-full" value={config.secretExpirationDate} onChange={(e) => updateField("secretExpirationDate", e.target.value)} />
          </div>
          <Button variant="outline" onClick={handleTestConnection}>
            <Wifi className="h-4 w-4" /> Test Connection
          </Button>
          {connectionStatus && (
            <p className="text-sm" style={{ color: statusColor(connectionStatus.type) }}>
              {connectionStatus.message}
            </p>
          )}
        </div>
      </div>
      {expirationWarning && (
        <p
          className="text-sm font-medium"
          style={{ color: expirationWarning.type === "expired" ? "var(--lcc-red)" : "var(--lcc-amber)" }}
        >
          {expirationWarning.message}
        </p>
      )}
    </div>
  )
}
