import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">API Configuration</h3>
          <div className="space-y-1.5">
            <Label htmlFor="nrApiKey">API Key</Label>
            <Input
              id="nrApiKey"
              type="password"
              value={config.apiKey}
              onChange={(e) => updateField("apiKey", e.target.value)}
              placeholder="Enter your New Relic API key"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nrAccountId">Account ID</Label>
            <Input
              id="nrAccountId"
              value={config.accountId}
              onChange={(e) => updateField("accountId", e.target.value)}
              placeholder="Enter your Account ID"
            />
          </div>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4" />
            Save Configuration
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Application Settings</h3>
          <div className="space-y-1.5">
            <Label htmlFor="nrAppName">Application Name</Label>
            <Input
              id="nrAppName"
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
            <p
              className={`text-sm ${
                connectionStatus.type === "success"
                  ? "text-score-good"
                  : connectionStatus.type === "error"
                  ? "text-score-poor"
                  : "text-muted-foreground"
              }`}
            >
              {connectionStatus.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
