import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Save, Wifi } from "lucide-react"
import { api } from "@/services/api"
import type { DevOpsConfig } from "@/types"

interface DevOpsConfigPanelProps {
  config: DevOpsConfig
  onConfigChange: (config: DevOpsConfig) => void
  onConnected: () => void
}

export function DevOpsConfigPanel({ config, onConfigChange, onConnected }: DevOpsConfigPanelProps) {
  const [connectionStatus, setConnectionStatus] = useState<{
    message: string
    type: "success" | "error" | "testing"
  } | null>(null)

  const updateField = (field: keyof DevOpsConfig, value: string) => {
    onConfigChange({ ...config, [field]: value })
  }

  const handleSave = () => {
    onConfigChange(config)
    setConnectionStatus({ message: "Configuration saved", type: "success" })
    setTimeout(() => setConnectionStatus(null), 3000)
  }

  const handleTestConnection = async () => {
    if (!config.pat) {
      setConnectionStatus({ message: "Please enter a Personal Access Token.", type: "error" })
      return
    }
    setConnectionStatus({ message: "Testing connection...", type: "testing" })
    try {
      const result = await api.testDevOpsConnection(config)
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

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Authentication</h3>
          <div className="space-y-1.5">
            <Label htmlFor="devopsPat">Personal Access Token</Label>
            <Input
              id="devopsPat"
              type="password"
              value={config.pat}
              onChange={(e) => updateField("pat", e.target.value)}
              placeholder="PAT with Build read & execute scope"
            />
          </div>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4" /> Save Configuration
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Project Settings</h3>
          <div className="space-y-1.5">
            <Label htmlFor="devopsOrg">Organization</Label>
            <Input
              id="devopsOrg"
              value={config.organization}
              onChange={(e) => updateField("organization", e.target.value)}
              placeholder="LampsPlus"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="devopsProject">Project</Label>
            <Input
              id="devopsProject"
              value={config.project}
              onChange={(e) => updateField("project", e.target.value)}
              placeholder="TestAutomation"
            />
          </div>
          <Button variant="outline" onClick={handleTestConnection}>
            <Wifi className="h-4 w-4" /> Test Connection
          </Button>
          {connectionStatus && (
            <p className={`text-sm ${connectionStatus.type === "success" ? "text-score-good" : connectionStatus.type === "error" ? "text-score-poor" : "text-muted-foreground"}`}>
              {connectionStatus.message}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
