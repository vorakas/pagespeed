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
      <div className="aurora-panel space-y-3 p-4">
        <h3 className="aurora-text text-sm font-semibold">Claude (Anthropic)</h3>
        <div className="space-y-1.5">
          <label htmlFor="claudeKey" className="aurora-label block">API Key</label>
          <input
            id="claudeKey"
            type="password"
            className="aurora-input w-full"
            value={config.claudeApiKey}
            onChange={(e) => updateField("claudeApiKey", e.target.value)}
            placeholder="sk-ant-api03-..."
          />
        </div>
        <div className="space-y-1.5">
          <label className="aurora-label block">Model</label>
          <select
            className="aurora-select w-full"
            value={config.claudeModel}
            onChange={(e) => updateField("claudeModel", e.target.value)}
          >
            <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
            <option value="claude-opus-4-20250514">Claude Opus 4</option>
          </select>
        </div>
      </div>
      <div className="aurora-panel space-y-3 p-4">
        <h3 className="aurora-text text-sm font-semibold">OpenAI</h3>
        <div className="space-y-1.5">
          <label htmlFor="openaiKey" className="aurora-label block">API Key</label>
          <input
            id="openaiKey"
            type="password"
            className="aurora-input w-full"
            value={config.openaiApiKey}
            onChange={(e) => updateField("openaiApiKey", e.target.value)}
            placeholder="sk-..."
          />
        </div>
        <div className="space-y-1.5">
          <label className="aurora-label block">Model</label>
          <select
            className="aurora-select w-full"
            value={config.openaiModel}
            onChange={(e) => updateField("openaiModel", e.target.value)}
          >
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-4o-mini">GPT-4o Mini</option>
          </select>
        </div>
      </div>
    </div>
  )
}
