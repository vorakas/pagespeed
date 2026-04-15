import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RefreshCw } from "lucide-react"
import { api } from "@/services/api"
import type { DevOpsConfig, DevOpsPipeline } from "@/types"

const PIPELINE_ROLES = [
  { key: "WarmUp", label: "Warm Up" },
  { key: "Windows_Functional", label: "Windows Functional" },
  { key: "Mac_Functional", label: "Mac Functional" },
  { key: "iPhone_Functional", label: "iPhone Functional" },
  { key: "Android_Functional", label: "Android Functional" },
  { key: "Windows_Visual", label: "Windows Visual" },
  { key: "Mac_Visual", label: "Mac Visual" },
  { key: "iPhone_Visual", label: "iPhone Visual" },
  { key: "Android_Visual", label: "Android Visual" },
] as const

const DEFAULT_PIPELINE_MAP: Record<string, number> = {
  WarmUp: 219,
  Windows_Functional: 167,
  Mac_Functional: 217,
  iPhone_Functional: 169,
  Android_Functional: 248,
  Windows_Visual: 170,
  Mac_Visual: 218,
  iPhone_Visual: 215,
  Android_Visual: 249,
}

interface PipelineMapperProps {
  config: DevOpsConfig
  onConfigChange: (config: DevOpsConfig) => void
}

export function PipelineMapper({ config, onConfigChange }: PipelineMapperProps) {
  const [pipelines, setPipelines] = useState<DevOpsPipeline[]>([])
  const [loading, setLoading] = useState(false)

  const pipelineMap = Object.keys(config.pipelineMap).length > 0
    ? config.pipelineMap
    : DEFAULT_PIPELINE_MAP

  useEffect(() => {
    fetchPipelines()
  }, [])

  const fetchPipelines = async () => {
    setLoading(true)
    try {
      const result = await api.getDevOpsPipelines(config)
      if (result.success) {
        setPipelines(result.pipelines)
      }
    } catch {
      // Silently fail — user will see empty dropdowns
    } finally {
      setLoading(false)
    }
  }

  const updateMapping = (roleKey: string, pipelineId: number) => {
    const newMap = { ...pipelineMap, [roleKey]: pipelineId }
    onConfigChange({ ...config, pipelineMap: newMap })
  }

  const updateOrchestratorId = (pipelineId: number) => {
    onConfigChange({ ...config, orchestratorPipelineId: pipelineId || null })
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Pipeline Mapping</h3>
          <Button variant="ghost" size="sm" onClick={fetchPipelines} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Map each build role to its Azure DevOps pipeline definition. Defaults are pre-filled.
        </p>

        <div className="space-y-1.5">
          <Label htmlFor="orchestratorPipeline">Orchestrator Pipeline</Label>
          <select
            id="orchestratorPipeline"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={config.orchestratorPipelineId ?? ""}
            onChange={(e) => updateOrchestratorId(Number(e.target.value))}
          >
            <option value="">-- Select Orchestrator --</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (ID: {p.id})
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE_ROLES.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`pipeline-${key}`} className="text-xs">{label}</Label>
              <select
                id={`pipeline-${key}`}
                className="flex h-8 w-full rounded-md border border-input bg-background px-2 py-0.5 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={pipelineMap[key] ?? ""}
                onChange={(e) => updateMapping(key, Number(e.target.value))}
              >
                <option value="">-- Select --</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (ID: {p.id})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
