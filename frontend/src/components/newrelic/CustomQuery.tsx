import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Play, Save, Trash2 } from "lucide-react"
import { NrqlEditor } from "@/components/newrelic/NrqlEditor"
import { NerdGraphResultsTable } from "@/components/newrelic/NerdGraphResultsTable"
import { buildCsv, csvFilename, deriveColumns, type ResultRow } from "@/lib/nerdgraphTable"
import {
  loadSavedQueries,
  removeQuery,
  saveSavedQueries,
  upsertQuery,
  type SavedQuery,
} from "@/lib/savedNrqlQueries"
import { api } from "@/services/api"
import type { NewRelicConfig } from "@/types"

type SiteKey = "lampsplus" | "adobe"
type ResultView = "table" | "json"

const SITE_LABELS: Record<SiteKey, string> = {
  lampsplus: "LampsPlus",
  adobe: "Adobe Commerce",
}

interface CustomQueryProps {
  configs: Record<SiteKey, NewRelicConfig>
  activeSite?: SiteKey
}

const SAMPLE_QUERIES: Record<string, { label: string; query: string }> = {
  apm: {
    label: "APM Sample",
    query:
      "SELECT average(duration), count(*) FROM Transaction WHERE appName = 'YourApp' FACET name SINCE 1 hour ago",
  },
  browser: {
    label: "Browser Sample",
    query:
      "SELECT average(pageRenderingDuration), average(domProcessingDuration) FROM PageView SINCE 1 hour ago",
  },
}

/** Pull the row array out of the API envelope, or null when the response is not tabular. */
function extractRows(response: Record<string, unknown>): ResultRow[] | null {
  const payload = (response?.data ?? {}) as { results?: unknown }
  return Array.isArray(payload.results) ? (payload.results as ResultRow[]) : null
}

export function CustomQuery({ configs, activeSite }: CustomQueryProps) {
  const [selectedSite, setSelectedSite] = useState<SiteKey>(activeSite ?? "lampsplus")
  const [query, setQuery] = useState("")
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>(loadSavedQueries)
  const [selected, setSelected] = useState("")
  const [queryName, setQueryName] = useState("")
  const [rawResult, setRawResult] = useState<Record<string, unknown> | null>(null)
  const [rows, setRows] = useState<ResultRow[] | null>(null)
  const [view, setView] = useState<ResultView>("table")
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const config = configs[selectedSite]

  const handleSelectChange = (value: string) => {
    setSelected(value)
    if (value.startsWith("preset:")) {
      const preset = SAMPLE_QUERIES[value.slice("preset:".length)]
      if (preset) setQuery(preset.query)
    } else if (value.startsWith("saved:")) {
      const name = value.slice("saved:".length)
      const saved = savedQueries.find((item) => item.name === name)
      if (saved) setQuery(saved.query)
    }
  }

  const handleSaveQuery = () => {
    const name = queryName.trim()
    if (!name || !query.trim()) return
    const next = upsertQuery(savedQueries, name, query)
    saveSavedQueries(next)
    setSavedQueries(loadSavedQueries())
    setSelected(`saved:${name}`)
  }

  const handleDeleteQuery = () => {
    if (!selected.startsWith("saved:")) return
    const name = selected.slice("saved:".length)
    const next = removeQuery(savedQueries, name)
    saveSavedQueries(next)
    setSavedQueries(loadSavedQueries())
    setSelected("")
  }

  const handleRun = async () => {
    if (!query.trim()) return
    if (!config.apiKey) {
      setError(`Configure ${SITE_LABELS[selectedSite]} API key first`)
      return
    }
    setRunning(true)
    setError(null)
    setRawResult(null)
    setRows(null)
    try {
      const response = await api.executeNewRelicQuery(config, query.trim())
      setRawResult(response)
      const extracted = extractRows(response)
      setRows(extracted)
      // Non-tabular responses (e.g. NRQL errors) fall back to the JSON view.
      setView(extracted ? "table" : "json")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed")
    } finally {
      setRunning(false)
    }
  }

  const handleDownloadCsv = () => {
    if (!rows || rows.length === 0) return
    const csv = buildCsv(rows, deriveColumns(rows))
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = csvFilename(new Date())
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const hasRows = !!rows && rows.length > 0

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
                border: `1px solid ${selectedSite === site ? "var(--lcc-amber)" : "var(--glass-border)"}`,
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
      <div className="flex flex-wrap items-end gap-2">
        <select
          className="aurora-select min-w-[200px] flex-1"
          value={selected}
          onChange={(e) => handleSelectChange(e.target.value)}
        >
          <option value="">Load a query...</option>
          {Object.entries(SAMPLE_QUERIES).map(([key, preset]) => (
            <option key={key} value={`preset:${key}`}>
              {preset.label}
            </option>
          ))}
          {savedQueries.length > 0 && (
            <>
              <option value="" disabled>
                -- Saved --
              </option>
              {savedQueries.map((saved) => (
                <option key={saved.name} value={`saved:${saved.name}`}>
                  {saved.name}
                </option>
              ))}
            </>
          )}
        </select>
        <input
          className="aurora-input w-40"
          value={queryName}
          onChange={(e) => setQueryName(e.target.value)}
          placeholder="Query name..."
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleSaveQuery}
          disabled={!queryName.trim() || !query.trim()}
        >
          <Save className="h-3.5 w-3.5" />
          Save
        </Button>
        {selected.startsWith("saved:") && (
          <Button variant="destructive" size="sm" onClick={handleDeleteQuery}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>
      <div className="space-y-1.5">
        <label className="aurora-label block">NRQL Query</label>
        <NrqlEditor
          value={query}
          onChange={setQuery}
          placeholder="SELECT ... FROM ... SINCE ..."
        />
      </div>
      <Button onClick={handleRun} disabled={running || !query.trim()} style={{ color: "#000" }}>
        <Play className="h-4 w-4" />
        {running ? "Running..." : "Run Query"}
      </Button>
      {error && <p className="text-sm" style={{ color: "var(--lcc-red)" }}>{error}</p>}

      {rawResult && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="inline-flex gap-1.5">
              {(["table", "json"] as const).map((mode) => (
                <button
                  key={mode}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-colors"
                  style={{
                    border: `1px solid ${view === mode ? "var(--lcc-amber)" : "var(--glass-border)"}`,
                    backgroundColor: view === mode ? "var(--lcc-amber)" : "transparent",
                    color: view === mode ? "#000" : "var(--lcc-text-dim)",
                  }}
                  onClick={() => setView(mode)}
                >
                  {mode === "table" ? "Table" : "JSON"}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={handleDownloadCsv}
              disabled={!hasRows}
            >
              <Download className="h-4 w-4" />
              Download CSV
            </Button>
          </div>

          {view === "table" && rows ? (
            <NerdGraphResultsTable results={rows} />
          ) : (
            <pre className="aurora-pre max-h-[300px]">
              {JSON.stringify(rawResult, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
