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
import { Save } from "lucide-react"
import type { AiConfig } from "@/types"

interface AiConfigPanelProps {
  config: AiConfig
  onConfigChange: (config: AiConfig) => void
}

export function AiConfigPanel({ config, onConfigChange }: AiConfigPanelProps) {
  const updateField = (field: keyof AiConfig, value: string) => {
    onConfigChange({ ...config, [field]: value })
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Claude (Anthropic)</h3>
          <div className="space-y-1.5">
            <Label htmlFor="claudeKey">API Key</Label>
            <Input
              id="claudeKey"
              type="password"
              value={config.claudeApiKey}
              onChange={(e) => updateField("claudeApiKey", e.target.value)}
              placeholder="sk-ant-api03-..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Model</Label>
            <Select value={config.claudeModel} onValueChange={(v) => updateField("claudeModel", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude-sonnet-4-20250514">Claude Sonnet 4</SelectItem>
                <SelectItem value="claude-opus-4-20250514">Claude Opus 4</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">OpenAI</h3>
          <div className="space-y-1.5">
            <Label htmlFor="openaiKey">API Key</Label>
            <Input
              id="openaiKey"
              type="password"
              value={config.openaiApiKey}
              onChange={(e) => updateField("openaiApiKey", e.target.value)}
              placeholder="sk-..."
            />
          </div>
          <div className="space-y-1.5">
            <Label>Model</Label>
            <Select value={config.openaiModel} onValueChange={(v) => updateField("openaiModel", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
