import { useState, useCallback } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/shared/EmptyState"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Play, Save, Trash2, Download, Search } from "lucide-react"
import { api } from "@/services/api"
import { escapeHtml } from "@/lib/utils"
import type { AzureConfig } from "@/types"

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

const statusClasses: Record<string, string> = {
  "2": "text-score-good",
  "3": "text-primary",
  "4": "text-score-average",
  "5": "text-score-poor",
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
    try {
      const data = await api.executeAzureQuery(config, query.trim()) as Record<string, unknown>
      if (data.success) {
        setResult(data as unknown as KqlResult)
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
      <h2 className="text-lg font-semibold text-foreground">KQL Query Mode</h2>

      {/* Profile bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs">Profile:</Label>
        <Select value={currentProfileName} onValueChange={handleProfileChange}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {profilesData.profiles.map((p) => (
              <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="xs" onClick={handleCreateProfile}>+ New</Button>
        <Button variant="outline" size="xs" onClick={handleDeleteProfile} disabled={profilesData.profiles.length <= 1}>Delete</Button>
      </div>

      {/* Query editor */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex-1 min-w-[200px]">
              <Select value={selectedPreset} onValueChange={handlePresetChange}>
                <SelectTrigger><SelectValue placeholder="Load a query..." /></SelectTrigger>
                <SelectContent>
                  {Object.entries(KQL_PRESETS).map(([key, preset]) => (
                    <SelectItem key={key} value={`preset:${key}`}>{preset.label}</SelectItem>
                  ))}
                  {currentProfile.queries.length > 0 && (
                    <>
                      <SelectItem value="__sep__" disabled>-- Saved Queries --</SelectItem>
                      {currentProfile.queries.map((q, i) => (
                        <SelectItem key={`saved:${i}`} value={`saved:${i}`}>{q.name}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <Input value={queryName} onChange={(e) => setQueryName(e.target.value)} placeholder="Query name..." className="w-40" />
            <Button variant="outline" size="sm" onClick={handleSaveQuery} disabled={!queryName.trim() || !query.trim()}>
              <Save className="h-3.5 w-3.5" /> Save
            </Button>
            {selectedPreset.startsWith("saved:") && (
              <Button variant="destructive" size="sm" onClick={handleDeleteQuery}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
            <Button onClick={handleRun} disabled={running || !query.trim()}>
              <Play className="h-4 w-4" /> {running ? "Running..." : "Run Query"}
            </Button>
          </div>
          <Textarea value={query} onChange={(e) => setQuery(e.target.value)} rows={6} placeholder={"W3CIISLog\n| where TimeGenerated > ago(1h)\n| take 100"} className="font-mono text-xs" />
        </CardContent>
      </Card>

      {/* Loading */}
      {running && <LoadingSpinner message="Executing KQL query..." />}

      {/* Error */}
      {error && <p className="text-sm text-score-poor">{error}</p>}

      {/* Results */}
      {result && !running && (
        <Card>
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="text-xs text-muted-foreground">{result.count} rows</span>
            <div className="flex items-center gap-2">
              {result.rows.length > 0 && (
                <Button variant="outline" size="xs" onClick={handleDownloadCsv}>
                  <Download className="h-3 w-3" /> CSV
                </Button>
              )}
              <div className="flex">
                <Button variant={viewMode === "table" ? "default" : "outline"} size="xs" onClick={() => setViewMode("table")} className="rounded-r-none">Table</Button>
                <Button variant={viewMode === "json" ? "default" : "outline"} size="xs" onClick={() => setViewMode("json")} className="rounded-l-none">JSON</Button>
              </div>
            </div>
          </div>
          <CardContent className="p-0">
            {viewMode === "table" ? (
              result.rows.length === 0 ? (
                <EmptyState icon={<Search size={36} />} title="No Results" description="The query returned no data." />
              ) : (
                <div className="overflow-x-auto max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        {result.columns.map((col) => (
                          <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.rows.map((row, i) => (
                        <TableRow key={i}>
                          {result.columns.map((col) => {
                            const val = row[col]
                            const statusClass = col === "scStatus" && val ? (statusClasses[String(val).charAt(0)] || "") : ""
                            return (
                              <TableCell key={col} className={`py-1.5 text-xs ${statusClass}`}>
                                {formatCellValue(col, val)}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : (
              <pre className="max-h-[500px] overflow-auto p-4 text-xs font-mono">
                {JSON.stringify(result.raw, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
