import { Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import type { AiConfig, AiSavedConfig } from "@/types"

interface AiConfigPanelProps {
  config: AiConfig
  onConfigChange: (config: AiConfig) => void
  savedConfig: AiSavedConfig | null
  onSave: () => void
  saving: boolean
  saveStatus: string | null
}

export function AiConfigPanel({ config, onConfigChange, savedConfig, onSave, saving, saveStatus }: AiConfigPanelProps) {
  const updateField = (field: keyof AiConfig, value: string) => {
    onConfigChange({ ...config, [field]: value })
  }

  return (
    <div className="aurora-panel space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="aurora-text text-sm font-semibold">Global AI Provider Configuration</h3>
          <p className="text-xs text-muted-foreground">
            Saved keys are stored on the server and shared across Pharos users.
          </p>
        </div>
        <Button onClick={onSave} disabled={saving} className="!bg-white !text-black hover:!bg-white/90 [&_svg]:!text-black">
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
      {saveStatus && <p className="text-xs text-muted-foreground">{saveStatus}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3 rounded-lg border p-4">
          <h4 className="aurora-text text-sm font-semibold">Anthropic</h4>
          <div className="space-y-1.5">
            <label htmlFor="claudeKey" className="aurora-label block">API Key</label>
            <input
              id="claudeKey"
              type="password"
              className="aurora-input w-full"
              value={config.claudeApiKey}
              onChange={(e) => updateField("claudeApiKey", e.target.value)}
              placeholder={savedConfig?.claude.hasApiKey ? `Saved globally (${savedConfig.claude.apiKeyMasked})` : "sk-ant-api03-..."}
            />
            <p className="text-xs text-muted-foreground">
              {savedConfig?.claude.hasApiKey ? "Leave blank to keep the saved key." : "No Anthropic key saved globally."}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="aurora-label block">Model</label>
            <select
              className="aurora-select w-full"
              value={config.claudeModel}
              onChange={(e) => updateField("claudeModel", e.target.value)}
            >
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="claude-opus-4-7">Claude Opus 4.7</option>
              <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
              <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
            </select>
          </div>
        </div>
        <div className="space-y-3 rounded-lg border p-4">
          <h4 className="aurora-text text-sm font-semibold">OpenAI</h4>
          <div className="space-y-1.5">
            <label htmlFor="openaiKey" className="aurora-label block">API Key</label>
            <input
              id="openaiKey"
              type="password"
              className="aurora-input w-full"
              value={config.openaiApiKey}
              onChange={(e) => updateField("openaiApiKey", e.target.value)}
              placeholder={savedConfig?.openai.hasApiKey ? `Saved globally (${savedConfig.openai.apiKeyMasked})` : "sk-..."}
            />
            <p className="text-xs text-muted-foreground">
              {savedConfig?.openai.hasApiKey ? "Leave blank to keep the saved key." : "No OpenAI key saved globally."}
            </p>
          </div>
          <div className="space-y-1.5">
            <label className="aurora-label block">Model</label>
            <select
              className="aurora-select w-full"
              value={config.openaiModel}
              onChange={(e) => updateField("openaiModel", e.target.value)}
            >
              <option value="gpt-5.5">GPT-5.5</option>
              <option value="gpt-5.4">GPT-5.4</option>
              <option value="gpt-5.4-mini">GPT-5.4 Mini</option>
              <option value="gpt-5.2">GPT-5.2</option>
              <option value="gpt-4o">GPT-4o</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
}
