import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Save, Wifi } from "lucide-react"
import { api } from "@/services/api"
import type { NewRelicConfig as NrConfig } from "@/types"

interface NewRelicConfigProps {
  config: NrConfig
  onConfigChange: (config: NrConfig) => void
  onConnected: () => void
}

export function NewRelicConfigPanel({ config, onConfigChange, onConnected }: NewRelicConfigProps) {
  const [connectionStatus, setConnectionStatus] = useState<{
    message: string
    type: "success" | "error" | "testing"
  } | null>(null)

  const handleSave = () => {
    onConfigChange(config)
    setConnectionStatus({ message: "Configuration saved", type: "success" })
    setTimeout(() => setConnectionStatus(null), 3000)
  }

  const handleTestConnection = async () => {
    if (!config.apiKey) {
      setConnectionStatus({ message: "Please enter an API key first", type: "error" })
      return
    }
    setConnectionStatus({ message: "Testing connection...", type: "testing" })
    try {
      const result = await api.testNewRelicConnection(config)
      if (result.success) {
        setConnectionStatus({ message: result.message, type: "success" })
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

  const updateField = (field: keyof NrConfig, value: string) => {
    onConfigChange({ ...config, [field]: value })
  }

  const statusColor =
    connectionStatus?.type === "success"
      ? "var(--lcc-green)"
      : connectionStatus?.type === "error"
        ? "var(--lcc-red)"
        : "var(--lcc-text-dim)"

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="aurora-panel space-y-3 p-4">
        <h3 className="aurora-text text-sm font-semibold">API Configuration</h3>
        <div className="space-y-1.5">
          <label htmlFor="nrApiKey" className="aurora-label block">API Key</label>
          <input
            id="nrApiKey"
            type="password"
            className="aurora-input w-full"
            value={config.apiKey}
            onChange={(e) => updateField("apiKey", e.target.value)}
            placeholder="Enter your New Relic API key"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="nrAccountId" className="aurora-label block">Account ID</label>
          <input
            id="nrAccountId"
            className="aurora-input w-full"
            value={config.accountId}
            onChange={(e) => updateField("accountId", e.target.value)}
            placeholder="Enter your Account ID"
          />
        </div>
        <Button onClick={handleSave} style={{ color: "#000" }}>
          <Save className="h-4 w-4" />
          Save Configuration
        </Button>
      </div>
      <div className="aurora-panel space-y-3 p-4">
        <h3 className="aurora-text text-sm font-semibold">Application Settings</h3>
        <div className="space-y-1.5">
          <label htmlFor="nrAppName" className="aurora-label block">Application Name</label>
          <input
            id="nrAppName"
            className="aurora-input w-full"
            value={config.appName}
            onChange={(e) => updateField("appName", e.target.value)}
            placeholder="e.g., Production Web App"
          />
        </div>
        <Button variant="outline" onClick={handleTestConnection}>
          <Wifi className="h-4 w-4" />
          Test Connection
        </Button>
        {connectionStatus && (
          <p className="text-sm" style={{ color: statusColor }}>
            {connectionStatus.message}
          </p>
        )}
      </div>
    </div>
  )
}
