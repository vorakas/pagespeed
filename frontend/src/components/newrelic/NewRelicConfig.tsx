import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Wifi } from "lucide-react"
import { api } from "@/services/api"
import type { NewRelicConfig as NrConfig } from "@/types"

interface SiteConfigCardProps {
  label: string
  config: NrConfig
  onConfigChange: (config: NrConfig) => void
}

export function SiteConfigCard({ label, config, onConfigChange }: SiteConfigCardProps) {
  const [status, setStatus] = useState<{
    message: string
    type: "success" | "error" | "testing"
  } | null>(null)

  const handleTestConnection = async () => {
    if (!config.apiKey) {
      setStatus({ message: "API key required", type: "error" })
      return
    }
    setStatus({ message: "Testing...", type: "testing" })
    try {
      const result = await api.testNewRelicConnection(config)
      setStatus({
        message: result.message,
        type: result.success ? "success" : "error",
      })
    } catch (err) {
      setStatus({
        message: err instanceof Error ? err.message : "Connection failed",
        type: "error",
      })
    }
  }

  const updateField = (field: keyof NrConfig, value: string) => {
    onConfigChange({ ...config, [field]: value })
  }

  const isConfigured = Boolean(config.apiKey && config.accountId && config.appName)
  const statusColor =
    status?.type === "success"
      ? "var(--lcc-green)"
      : status?.type === "error"
        ? "var(--lcc-red)"
        : "var(--lcc-text-dim)"

  return (
    <div className="aurora-panel space-y-3 p-4">
      <div className="flex items-center gap-2">
        <h3 className="aurora-text text-sm font-semibold">{label}</h3>
        {isConfigured && (
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor:
                status?.type === "success" ? "var(--lcc-green)" : "var(--lcc-text-faint)",
            }}
          />
        )}
      </div>
      <div className="space-y-1.5">
        <label className="aurora-label block">API Key</label>
        <input
          type="password"
          className="aurora-input w-full"
          value={config.apiKey}
          onChange={(e) => updateField("apiKey", e.target.value)}
          placeholder="New Relic API key"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="aurora-label block">Account ID</label>
          <input
            className="aurora-input w-full"
            value={config.accountId}
            onChange={(e) => updateField("accountId", e.target.value)}
            placeholder="Account ID"
          />
        </div>
        <div className="space-y-1.5">
          <label className="aurora-label block">App Name</label>
          <input
            className="aurora-input w-full"
            value={config.appName}
            onChange={(e) => updateField("appName", e.target.value)}
            placeholder="Application name"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleTestConnection}>
          <Wifi className="h-3.5 w-3.5" />
          Test Connection
        </Button>
        {status && (
          <p className="text-xs" style={{ color: statusColor }}>
            {status.message}
          </p>
        )}
      </div>
    </div>
  )
}
