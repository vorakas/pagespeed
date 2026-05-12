import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Play } from "lucide-react"
import { api } from "@/services/api"
import type { NewRelicConfig } from "@/types"

type SiteKey = "lampsplus" | "adobe"

const SITE_LABELS: Record<SiteKey, string> = {
  lampsplus: "LampsPlus",
  adobe: "Adobe Commerce",
}

interface CustomQueryProps {
  configs: Record<SiteKey, NewRelicConfig>
  activeSite?: SiteKey
}

const SAMPLE_QUERIES: Record<string, string> = {
  apm: "SELECT average(duration), count(*) FROM Transaction WHERE appName = 'YourApp' FACET name SINCE 1 hour ago",
  browser:
    "SELECT average(pageRenderingDuration), average(domProcessingDuration) FROM PageView SINCE 1 hour ago",
}

export function CustomQuery({ configs, activeSite }: CustomQueryProps) {
  const [selectedSite, setSelectedSite] = useState<SiteKey>(activeSite ?? "lampsplus")
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const config = configs[selectedSite]

  const handleRun = async () => {
    if (!query.trim()) return
    if (!config.apiKey) {
      setError(`Configure ${SITE_LABELS[selectedSite]} API key first`)
      return
    }
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const data = await api.executeNewRelicQuery(config, query.trim())
      setResult(JSON.stringify(data, null, 2))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed")
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="aurora-panel space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="aurora-text text-sm font-semibold">Custom NRQL Query</h3>
        <div className="inline-flex gap-1.5">
          {(["lampsplus", "adobe"] as const).map((site) => (
            <button
              key={site}
              className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
              style={{
                border: `1px solid ${selectedSite === site ? "var(--lcc-amber)" : "var(--lcc-border)"}`,
                backgroundColor: selectedSite === site ? "var(--lcc-amber)" : "transparent",
                color: selectedSite === site ? "#000" : "var(--lcc-text-dim)",
              }}
              onClick={() => setSelectedSite(site)}
            >
              {SITE_LABELS[site]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="xs"
          onClick={() => setQuery(SAMPLE_QUERIES.apm)}
        >
          APM Sample
        </Button>
        <Button
          variant="outline"
          size="xs"
          onClick={() => setQuery(SAMPLE_QUERIES.browser)}
        >
          Browser Sample
        </Button>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="nrqlQuery" className="aurora-label block">NRQL Query</label>
        <textarea
          id="nrqlQuery"
          className="aurora-textarea"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="SELECT ... FROM ... SINCE ..."
          rows={3}
        />
      </div>
      <Button onClick={handleRun} disabled={running || !query.trim()} style={{ color: "#000" }}>
        <Play className="h-4 w-4" />
        {running ? "Running..." : "Run Query"}
      </Button>
      {error && <p className="text-sm" style={{ color: "var(--lcc-red)" }}>{error}</p>}
      {result && (
        <pre className="aurora-pre max-h-[300px]">{result}</pre>
      )}
    </div>
  )
}
