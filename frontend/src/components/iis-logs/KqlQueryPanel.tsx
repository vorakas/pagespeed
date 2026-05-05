import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/shared/EmptyState"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Play, Save, Trash2, Download, Search } from "lucide-react"
import { api } from "@/services/api"
import type { AzureConfig } from "@/types"
import { formatQueryDuration } from "./queryTiming"

const KQL_PRESETS: Record<string, { label: string; query: string }> = {
  errors5xx: {
    label: "5xx Errors (last 1h)",
    query: "W3CIISLog\n| where TimeGenerated > ago(1h)\n| where scStatus >= 500\n| project TimeGenerated, csMethod, csUriStem, csUriQuery, scStatus, TimeTaken, cIP, sSiteName\n| order by TimeGenerated desc\n| take 100",
  },
  slowPages: {
    label: "Slow Pages (last 1h)",
    query: "W3CIISLog\n| where TimeGenerated > ago(1h)\n| where TimeTaken > 5000\n| project TimeGenerated, csMethod, csUriStem, scStatus, TimeTaken, sSiteName\n| order by TimeTaken desc\n| take 100",
  },
  requestVolume: {
    label: "Request Volume (24h)",
    query: "W3CIISLog\n| where TimeGenerated > ago(24h)\n| summarize RequestCount = count() by bin(TimeGenerated, 1h)\n| order by TimeGenerated asc",
  },
  statusDist: {
    label: "Status Distribution (1h)",
    query: "W3CIISLog\n| where TimeGenerated > ago(1h)\n| summarize Count = count() by scStatus\n| order by Count desc",
  },
  topUrls: {
    label: "Top URLs (1h)",
    query: 'W3CIISLog\n| where TimeGenerated > ago(1h)\n| where csUriStem !endswith ".css" and csUriStem !endswith ".js" and csUriStem !endswith ".png" and csUriStem !endswith ".jpg"\n| summarize RequestCount = count(), AvgTime = avg(TimeTaken) by csUriStem\n| order by RequestCount desc\n| take 25',
  },
}

const PROFILES_KEY = "kqlProfiles"

interface SavedQuery {
  name: string
  query: string
}

interface Profile {
  name: string
  queries: SavedQuery[]
}

interface ProfilesData {
  activeProfile: string
  profiles: Profile[]
}

function getProfilesData(): ProfilesData {
  try {
    const data = JSON.parse(localStorage.getItem(PROFILES_KEY) || "")
    if (data?.profiles && Array.isArray(data.profiles)) return data
  } catch { /* fall through */ }
  return { activeProfile: "Default", profiles: [{ name: "Default", queries: [] }] }
}

function saveProfilesData(data: ProfilesData) {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(data))
}

interface KqlResult {
  columns: string[]
  rows: Record<string, unknown>[]
  count: number
  raw: unknown
}

function getStatusColor(code: unknown): string | undefined {
  if (code == null) return undefined
  const prefix = String(code).charAt(0)
  if (prefix === "2") return "var(--lcc-green)"
  if (prefix === "3") return "var(--lcc-blue)"
  if (prefix === "4") return "var(--lcc-amber)"
  if (prefix === "5") return "var(--lcc-red)"
  return undefined
}

interface KqlQueryPanelProps {
  config: AzureConfig
}

export function KqlQueryPanel({ config }: KqlQueryPanelProps) {
  const [profilesData, setProfilesData] = useState<ProfilesData>(getProfilesData)
  const [currentProfileName, setCurrentProfileName] = useState(profilesData.activeProfile)
  const [query, setQuery] = useState("")
  const [queryName, setQueryName] = useState("")
  const [selectedPreset, setSelectedPreset] = useState("")
  const [result, setResult] = useState<KqlResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [queryDurationMs, setQueryDurationMs] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<"table" | "json">("table")

  const currentProfile = profilesData.profiles.find((p) => p.name === currentProfileName) || profilesData.profiles[0]

  const refreshProfiles = () => {
    const data = getProfilesData()
    setProfilesData(data)
  }

  const handlePresetChange = (value: string) => {
    setSelectedPreset(value)
    if (value.startsWith("preset:")) {
      const key = value.replace("preset:", "")
      const preset = KQL_PRESETS[key]
      if (preset) setQuery(preset.query)
    } else if (value.startsWith("saved:")) {
      const idx = parseInt(value.replace("saved:", ""))
      const q = currentProfile.queries[idx]
      if (q) {
        setQuery(q.query)
        setQueryName(q.name)
      }
    }
  }

  const handleRun = useCallback(async () => {
    if (!query.trim()) return
    setRunning(true)
    setError(null)
    setResult(null)
    setQueryDurationMs(null)
    const startedAt = performance.now()
    try {
      const data = await api.executeAzureQuery(config, query.trim()) as Record<string, unknown>
      if (data.success) {
        setResult(data as unknown as KqlResult)
        setQueryDurationMs(performance.now() - startedAt)
      } else {
        setError((data.error as string) || "Query failed")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed")
    } finally {
      setRunning(false)
    }
  }, [config, query])

  const handleSaveQuery = () => {
    if (!queryName.trim() || !query.trim()) return
    const data = getProfilesData()
    const profile = data.profiles.find((p) => p.name === currentProfileName)
    if (!profile) return
    const existing = profile.queries.findIndex((q) => q.name === queryName.trim())
    if (existing >= 0) {
      profile.queries[existing].query = query.trim()
    } else {
      profile.queries.push({ name: queryName.trim(), query: query.trim() })
    }
    saveProfilesData(data)
    refreshProfiles()
    setQueryName("")
  }

  const handleDeleteQuery = () => {
    if (!selectedPreset.startsWith("saved:")) return
    const idx = parseInt(selectedPreset.replace("saved:", ""))
    const data = getProfilesData()
    const profile = data.profiles.find((p) => p.name === currentProfileName)
    if (!profile || !profile.queries[idx]) return
    if (!window.confirm(`Delete query "${profile.queries[idx].name}"?`)) return
    profile.queries.splice(idx, 1)
    saveProfilesData(data)
    refreshProfiles()
    setSelectedPreset("")
    setQueryName("")
  }

  const handleProfileChange = (name: string) => {
    setCurrentProfileName(name)
    const data = getProfilesData()
    data.activeProfile = name
    saveProfilesData(data)
    refreshProfiles()
    setSelectedPreset("")
    setQueryName("")
  }

  const handleCreateProfile = () => {
    const name = window.prompt("Enter a name for the new profile:")
    if (!name?.trim()) return
    const data = getProfilesData()
    if (data.profiles.some((p) => p.name === name.trim())) return
    data.profiles.push({ name: name.trim(), queries: [] })
    data.activeProfile = name.trim()
    saveProfilesData(data)
    setCurrentProfileName(name.trim())
    refreshProfiles()
  }

  const handleDeleteProfile = () => {
    const data = getProfilesData()
    if (data.profiles.length <= 1) return
    if (!window.confirm(`Delete profile "${currentProfileName}"?`)) return
    data.profiles = data.profiles.filter((p) => p.name !== currentProfileName)
    const newActive = data.profiles[0].name
    data.activeProfile = newActive
    saveProfilesData(data)
    setCurrentProfileName(newActive)
    refreshProfiles()
  }

  const handleDownloadCsv = () => {
    if (!result?.rows?.length || !result?.columns?.length) return
    const escCsv = (val: unknown) => {
      if (val == null) return ""
      const str = String(val)
      if (str.includes(",") || str.includes('"') || str.includes("\n")) return '"' + str.replace(/"/g, '""') + '"'
      return str
    }
    const header = result.columns.map(escCsv).join(",")
    const body = result.rows.map((row) => result.columns.map((col) => escCsv(row[col] ?? "")).join(",")).join("\n")
    const csv = header + "\n" + body
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "kql-results-" + new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-") + ".csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatCellValue = (col: string, val: unknown): string => {
    if (val == null) return "--"
    if (col === "TimeGenerated" && typeof val === "string") return new Date(val).toLocaleString()
    if (typeof val === "number") return val.toLocaleString(undefined, { maximumFractionDigits: 2 })
    return String(val)
  }

  return (
    <div className="space-y-4">
      <h2 className="aurora-section-title">KQL Query Mode</h2>

      {/* Profile bar */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="aurora-label">Profile:</label>
        <select
          className="aurora-select w-40"
          value={currentProfileName}
          onChange={(e) => handleProfileChange(e.target.value)}
        >
          {profilesData.profiles.map((p) => (
            <option key={p.name} value={p.name}>{p.name}</option>
          ))}
        </select>
        <Button variant="outline" size="xs" onClick={handleCreateProfile}>+ New</Button>
        <Button variant="outline" size="xs" onClick={handleDeleteProfile} disabled={profilesData.profiles.length <= 1}>Delete</Button>
      </div>

      {/* Query editor */}
      <div className="aurora-panel space-y-3 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[200px]">
            <select
              className="aurora-select w-full"
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
            >
              <option value="">Load a query...</option>
              {Object.entries(KQL_PRESETS).map(([key, preset]) => (
                <option key={key} value={`preset:${key}`}>{preset.label}</option>
              ))}
              {currentProfile.queries.length > 0 && (
                <>
                  <option value="" disabled>-- Saved Queries --</option>
                  {currentProfile.queries.map((q, i) => (
                    <option key={`saved:${i}`} value={`saved:${i}`}>{q.name}</option>
                  ))}
                </>
              )}
            </select>
          </div>
          <input
            className="aurora-input w-40"
            value={queryName}
            onChange={(e) => setQueryName(e.target.value)}
            placeholder="Query name..."
          />
          <Button variant="outline" size="sm" onClick={handleSaveQuery} disabled={!queryName.trim() || !query.trim()}>
            <Save className="h-3.5 w-3.5" /> Save
          </Button>
          {selectedPreset.startsWith("saved:") && (
            <Button variant="destructive" size="sm" onClick={handleDeleteQuery}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          )}
          <Button onClick={handleRun} disabled={running || !query.trim()} style={{ color: "#000" }}>
            <Play className="h-4 w-4" /> {running ? "Running..." : "Run Query"}
          </Button>
        </div>
        <textarea
          className="aurora-textarea"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          rows={6}
          placeholder={"W3CIISLog\n| where TimeGenerated > ago(1h)\n| take 100"}
        />
      </div>

      {/* Loading */}
      {running && <LoadingSpinner message="Executing KQL query..." />}

      {/* Error */}
      {error && <p className="text-sm" style={{ color: "var(--lcc-red)" }}>{error}</p>}

      {/* Results */}
      {result && !running && (
        <div className="aurora-panel overflow-hidden">
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ borderBottom: "1px solid var(--glass-border)" }}
          >
            <span className="aurora-text-faint text-xs">
              {result.count} rows
              {queryDurationMs !== null && ` in ${formatQueryDuration(queryDurationMs)}`}
            </span>
            <div className="flex items-center gap-2">
              {result.rows.length > 0 && (
                <Button variant="outline" size="xs" onClick={handleDownloadCsv}>
                  <Download className="h-3 w-3" /> CSV
                </Button>
              )}
              <div className="flex">
                <Button
                  variant={viewMode === "table" ? "default" : "outline"}
                  size="xs"
                  onClick={() => setViewMode("table")}
                  className="rounded-r-none"
                  style={viewMode === "table" ? { color: "#000" } : undefined}
                >
                  Table
                </Button>
                <Button
                  variant={viewMode === "json" ? "default" : "outline"}
                  size="xs"
                  onClick={() => setViewMode("json")}
                  className="rounded-l-none"
                  style={viewMode === "json" ? { color: "#000" } : undefined}
                >
                  JSON
                </Button>
              </div>
            </div>
          </div>
          {viewMode === "table" ? (
            result.rows.length === 0 ? (
              <EmptyState icon={<Search size={36} />} title="No Results" description="The query returned no data." />
            ) : (
              <div className="overflow-x-auto max-h-[500px]">
                <table className="aurora-table">
                  <thead>
                    <tr>
                      {result.columns.map((col) => (
                        <th key={col}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, i) => (
                      <tr key={i}>
                        {result.columns.map((col) => {
                          const val = row[col]
                          const statusColor = col === "scStatus" ? getStatusColor(val) : undefined
                          return (
                            <td key={col} style={statusColor ? { color: statusColor, fontWeight: 500 } : undefined}>
                              {col === "scStatus" || typeof val === "number" ? (
                                <span className="aurora-num">{formatCellValue(col, val)}</span>
                              ) : (
                                formatCellValue(col, val)
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <pre className="aurora-pre max-h-[500px] m-0 rounded-none border-0">
              {JSON.stringify(result.raw, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
