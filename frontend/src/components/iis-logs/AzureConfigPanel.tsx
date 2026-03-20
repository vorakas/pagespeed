import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Azure AD Authentication</h3>
            <div className="space-y-1.5">
              <Label htmlFor="azTenant">Tenant ID</Label>
              <Input id="azTenant" value={config.tenantId} onChange={(e) => updateField("tenantId", e.target.value)} placeholder="Directory (Tenant) ID" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="azClient">Client ID</Label>
              <Input id="azClient" value={config.clientId} onChange={(e) => updateField("clientId", e.target.value)} placeholder="Application (Client) ID" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="azSecret">Client Secret</Label>
              <Input id="azSecret" type="password" value={config.clientSecret} onChange={(e) => updateField("clientSecret", e.target.value)} placeholder="Client Secret Value" />
            </div>
            <Button onClick={handleSave}>
              <Save className="h-4 w-4" /> Save Configuration
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Workspace Settings</h3>
            <div className="space-y-1.5">
              <Label htmlFor="azWorkspace">Workspace ID</Label>
              <Input id="azWorkspace" value={config.workspaceId} onChange={(e) => updateField("workspaceId", e.target.value)} placeholder="Log Analytics Workspace ID" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="azExpiration">Secret Expiration Date</Label>
              <Input id="azExpiration" type="date" value={config.secretExpirationDate} onChange={(e) => updateField("secretExpirationDate", e.target.value)} />
            </div>
            <Button variant="outline" onClick={handleTestConnection}>
              <Wifi className="h-4 w-4" /> Test Connection
            </Button>
            {connectionStatus && (
              <p className={`text-sm ${connectionStatus.type === "success" ? "text-score-good" : connectionStatus.type === "error" ? "text-score-poor" : connectionStatus.type === "warning" ? "text-score-average" : "text-muted-foreground"}`}>
                {connectionStatus.message}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      {expirationWarning && (
        <p className={`text-sm font-medium ${expirationWarning.type === "expired" ? "text-score-poor" : "text-score-average"}`}>
          {expirationWarning.message}
        </p>
      )}
    </div>
  )
}
