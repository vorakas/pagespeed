import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Play } from "lucide-react"
import { api } from "@/services/api"
import type { NewRelicConfig } from "@/types"

interface CustomQueryProps {
  config: NewRelicConfig
}

const SAMPLE_QUERIES: Record<string, string> = {
  apm: "SELECT average(duration), count(*) FROM Transaction WHERE appName = 'YourApp' FACET name SINCE 1 hour ago",
  browser:
    "SELECT average(pageRenderingDuration), average(domProcessingDuration) FROM PageView SINCE 1 hour ago",
}

export function CustomQuery({ config }: CustomQueryProps) {
  const [query, setQuery] = useState("")
  const [result, setResult] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleRun = async () => {
    if (!query.trim()) return
    if (!config.apiKey) {
      setError("Please configure your API key first")
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
    <Card>
      <CardContent className="p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Custom NRQL Query</h3>
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
          <Label htmlFor="nrqlQuery">NRQL Query</Label>
          <Textarea
            id="nrqlQuery"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="SELECT ... FROM ... SINCE ..."
            rows={3}
            className="font-mono text-xs"
          />
        </div>
        <Button onClick={handleRun} disabled={running || !query.trim()}>
          <Play className="h-4 w-4" />
          {running ? "Running..." : "Run Query"}
        </Button>
        {error && <p className="text-sm text-score-poor">{error}</p>}
        {result && (
          <pre className="max-h-[300px] overflow-auto rounded-md bg-muted p-3 text-xs font-mono">
            {result}
          </pre>
        )}
      </CardContent>
    </Card>
  )
}
