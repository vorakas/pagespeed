import { useState, useCallback, useEffect, useRef } from "react"
import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { SiteConfigCard } from "@/components/newrelic/NewRelicConfig"
import { UrlFavoritesInput } from "@/components/newrelic/UrlFavoritesInput"
import { CwvMetrics } from "@/components/newrelic/CwvMetrics"
import { PerformanceOverview } from "@/components/newrelic/PerformanceOverview"
import { ApmMetrics } from "@/components/newrelic/ApmMetrics"
import { CustomQuery } from "@/components/newrelic/CustomQuery"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { useLocalConfig } from "@/hooks/use-local-config"
import {
  buildRelativeTimeRange,
  formatRelativeTimeRangeLabel,
  normalizeRelativeTimeRange,
  type RelativeTimeRange,
  type RelativeTimeUnit,
} from "@/lib/newRelicTimeRange"
import { api } from "@/services/api"
import type { NewRelicConfig } from "@/types"
import { CalendarDays, Loader2, Settings } from "lucide-react"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

type SiteKey = "lampsplus" | "adobe"
type ViewMode = "comparison" | SiteKey

const SITE_LABELS: Record<SiteKey, string> = {
  lampsplus: "LampsPlus",
  adobe: "Adobe Commerce",
}

const TIME_RANGES = [
  { value: "30 minutes ago", label: "Last 30 minutes" },
  { value: "1 hour ago", label: "Last 1 hour" },
  { value: "3 hours ago", label: "Last 3 hours" },
  { value: "6 hours ago", label: "Last 6 hours" },
  { value: "12 hours ago", label: "Last 12 hours" },
  { value: "24 hours ago", label: "Last 24 hours" },
  { value: "3 days ago", label: "Last 3 days" },
  { value: "5 days ago", label: "Last 5 days" },
  { value: "7 days ago", label: "Last 7 days" },
]

const DEFAULT_CONFIG: NewRelicConfig = { apiKey: "", accountId: "", appName: "" }
const DEFAULT_CUSTOM_RANGE: RelativeTimeRange = { value: 5, unit: "days" }
const RELATIVE_UNITS: RelativeTimeUnit[] = ["minutes", "hours", "days", "weeks"]

interface SiteData {
  cwv: Record<string, unknown> | null
  perf: Record<string, unknown> | null
  apm: Record<string, unknown> | null
}

// ---------------------------------------------------------------------------
// Migrate legacy single-site config (runs once at module load)
// ---------------------------------------------------------------------------

if (localStorage.getItem("nrConfig") && !localStorage.getItem("nrConfigLampsPlus")) {
  localStorage.setItem("nrConfigLampsPlus", localStorage.getItem("nrConfig")!)
  localStorage.removeItem("nrConfig")
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractCwv(data: SiteData | null) {
  if (!data?.cwv) return { metrics: null, metadata: null, interactionsCount: null }
  const metrics = data.cwv.metrics as Record<
    string,
    { p50: number | null; p75: number | null; p90: number | null }
  > | undefined
  const metadata = (data.cwv.metadata as Record<string, string>) ?? null
  const interactionsCount = (metrics?.interactions as unknown as number) ?? null
  return { metrics: metrics ?? null, metadata, interactionsCount }
}

function isConfigured(config: NewRelicConfig): boolean {
  return Boolean(config.apiKey && config.accountId && config.appName)
}

// ---------------------------------------------------------------------------
// View mode segmented control
// ---------------------------------------------------------------------------

const VIEW_OPTIONS: { key: ViewMode; label: string }[] = [
  { key: "comparison", label: "Comparison" },
  { key: "lampsplus", label: "LampsPlus" },
  { key: "adobe", label: "Adobe Commerce" },
]

function ViewModeToggle({
  value,
  onChange,
}: {
  value: ViewMode
  onChange: (v: ViewMode) => void
}) {
  return (
    <div className="inline-flex gap-1.5">
      {VIEW_OPTIONS.map(({ key, label }) => (
        <button
          key={key}
          className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
          style={{
            border: `1px solid ${value === key ? "var(--lcc-amber)" : "var(--lcc-border)"}`,
            backgroundColor: value === key ? "var(--lcc-amber)" : "transparent",
            color: value === key ? "#000" : "var(--lcc-text-dim)",
          }}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

function TimeRangePicker({
  value,
  customRange,
  onChange,
  onCustomRangeChange,
}: {
  value: string
  customRange: RelativeTimeRange
  onChange: (value: string) => void
  onCustomRangeChange: (value: RelativeTimeRange) => void
}) {
  const isCustomActive = !TIME_RANGES.some((range) => range.value === value)
  const normalizedCustomRange = normalizeRelativeTimeRange(customRange)
  const customLabel = formatRelativeTimeRangeLabel(normalizedCustomRange)

  const applyCustomRange = (nextRange: RelativeTimeRange) => {
    const normalized = normalizeRelativeTimeRange(nextRange)
    onCustomRangeChange(normalized)
    onChange(buildRelativeTimeRange(normalized.value, normalized.unit))
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <div className="aurora-text-faint flex items-center gap-1.5 text-xs font-medium">
        <CalendarDays className="h-3.5 w-3.5" />
        Time frame
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TIME_RANGES.map((range) => {
          const active = value === range.value
          return (
            <button
              key={range.value}
              type="button"
              className="rounded-full px-2.5 py-1 text-xs font-medium transition-colors"
              style={{
                border: `1px solid ${active ? "var(--lcc-amber)" : "var(--lcc-border)"}`,
                backgroundColor: active ? "var(--lcc-amber)" : "transparent",
                color: active ? "#000" : "var(--lcc-text-dim)",
              }}
              onClick={() => onChange(range.value)}
            >
              {range.label.replace("Last ", "")}
            </button>
          )
        })}
      </div>
      <div
        className="flex items-center gap-1.5 rounded-full px-2 py-1"
        style={{
          border: `1px solid ${isCustomActive ? "var(--lcc-amber)" : "var(--lcc-border)"}`,
          backgroundColor: isCustomActive ? "color-mix(in oklch, var(--lcc-amber) 14%, transparent)" : "transparent",
        }}
      >
        <span className="aurora-text-faint text-xs">Last</span>
        <input
          aria-label="Custom New Relic time range value"
          className="aurora-input h-7 w-16 px-2 py-0 text-xs tabular-nums"
          type="number"
          min={1}
          value={normalizedCustomRange.value}
          onChange={(e) => {
            const nextValue = Number(e.target.value)
            if (Number.isFinite(nextValue) && nextValue > 0) {
              applyCustomRange({ ...normalizedCustomRange, value: nextValue })
            }
          }}
          onFocus={() => onChange(buildRelativeTimeRange(normalizedCustomRange.value, normalizedCustomRange.unit))}
        />
        <select
          aria-label="Custom New Relic time range unit"
          className="aurora-select h-7 w-24 px-2 py-0 text-xs"
          value={normalizedCustomRange.unit}
          onChange={(e) => {
            applyCustomRange({
              ...normalizedCustomRange,
              unit: e.target.value as RelativeTimeUnit,
            })
          }}
          onFocus={() => onChange(buildRelativeTimeRange(normalizedCustomRange.value, normalizedCustomRange.unit))}
        >
          {RELATIVE_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
        <span className="aurora-text-faint max-w-28 truncate text-xs">{customLabel}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Comparison column
// ---------------------------------------------------------------------------

function ComparisonColumn({
  label,
  data,
  loading,
  configured,
}: {
  label: string
  data: SiteData | null
  loading: boolean
  configured: boolean
}) {
  const cwv = extractCwv(data)

  return (
    <div className="space-y-4 min-w-0">
      <div className="flex items-center gap-2">
        <h2 className="aurora-section-title whitespace-nowrap">{label}</h2>
        <hr className="flex-1" style={{ borderColor: "var(--lcc-border)" }} />
      </div>

      {loading && (
        <div className="aurora-panel flex items-center justify-center p-12">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--lcc-text-faint)" }} />
        </div>
      )}

      {!loading && data?.cwv && (
        <>
          <CwvMetrics
            metrics={cwv.metrics}
            metadata={cwv.metadata}
            interactionsCount={cwv.interactionsCount}
          />
          {data.perf && <PerformanceOverview data={data.perf} />}
        </>
      )}

      {!loading && !data?.cwv && (
        <div className="aurora-panel p-8 text-center">
          <p className="aurora-text-faint text-sm">
            {configured ? "No data loaded yet" : `Configure ${label} to enable comparison`}
          </p>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export function NewRelic() {
  // Persisted per-site configs
  const [lpConfig, setLpConfig] = useLocalConfig<NewRelicConfig>(
    "nrConfigLampsPlus",
    DEFAULT_CONFIG,
  )
  const [adobeConfig, setAdobeConfig] = useLocalConfig<NewRelicConfig>(
    "nrConfigAdobe",
    DEFAULT_CONFIG,
  )

  // Persisted URLs
  const [lpUrl, setLpUrl] = useLocalConfig<string>(
    "nrUrlLampsPlus",
    "https://www.lampsplus.com/",
  )
  const [adobeUrl, setAdobeUrl] = useLocalConfig<string>(
    "nrUrlAdobe",
    "https://mcprod.lampsplus.com/",
  )

  // Persisted favorites
  const [lpFavorites, setLpFavorites] = useLocalConfig<string[]>("nrFavoritesLampsPlus", [])
  const [adobeFavorites, setAdobeFavorites] = useLocalConfig<string[]>("nrFavoritesAdobe", [])

  // View state
  const [viewMode, setViewMode] = useLocalConfig<ViewMode>("nrViewMode", "comparison")
  const [timeRange, setTimeRange] = useLocalConfig<string>("nrTimeRange", "30 minutes ago")
  const [customRange, setCustomRange] = useLocalConfig<RelativeTimeRange>(
    "nrCustomTimeRange",
    DEFAULT_CUSTOM_RANGE,
  )
  const [configOpen, setConfigOpen] = useState(
    () => !isConfigured(lpConfig) || !isConfigured(adobeConfig),
  )

  // Per-site metric data
  const [lpData, setLpData] = useState<SiteData | null>(null)
  const [adobeData, setAdobeData] = useState<SiteData | null>(null)
  const [lpLoading, setLpLoading] = useState(false)
  const [adobeLoading, setAdobeLoading] = useState(false)
  const [lpError, setLpError] = useState<string | null>(null)
  const [adobeError, setAdobeError] = useState<string | null>(null)

  // Derived
  const lpConfigured = isConfigured(lpConfig)
  const adobeConfigured = isConfigured(adobeConfig)
  const anyLoading = lpLoading || adobeLoading
  const isSingleSite = viewMode !== "comparison"
  const activeSite = isSingleSite ? (viewMode as SiteKey) : null

  const configs: Record<SiteKey, NewRelicConfig> = {
    lampsplus: lpConfig,
    adobe: adobeConfig,
  }

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  const loadSiteMetrics = useCallback(
    async (siteKey: SiteKey, includeApm: boolean) => {
      const config = siteKey === "lampsplus" ? lpConfig : adobeConfig
      const url = siteKey === "lampsplus" ? lpUrl : adobeUrl
      const setData = siteKey === "lampsplus" ? setLpData : setAdobeData
      const setLoading = siteKey === "lampsplus" ? setLpLoading : setAdobeLoading
      const setError = siteKey === "lampsplus" ? setLpError : setAdobeError

      if (!isConfigured(config)) {
        setError(`Configure ${SITE_LABELS[siteKey]} settings first`)
        return
      }
      if (!url.trim()) {
        setError("Enter a page URL to monitor")
        return
      }

      setLoading(true)
      setError(null)

      try {
        const cwvResult = await api.getNewRelicCwv(config, url, timeRange)

        const [perfResult, apmResult] = await Promise.all([
          api.getNewRelicPerformance(config, timeRange).catch(() => null),
          includeApm ? api.getNewRelicApm(config, timeRange).catch(() => null) : null,
        ])

        setData({ cwv: cwvResult, perf: perfResult, apm: apmResult })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load metrics")
      } finally {
        setLoading(false)
      }
    },
    [lpConfig, adobeConfig, lpUrl, adobeUrl, timeRange],
  )

  const loadAllMetrics = useCallback(async () => {
    if (viewMode === "comparison") {
      const promises: Promise<void>[] = []
      if (lpConfigured) promises.push(loadSiteMetrics("lampsplus", false))
      if (adobeConfigured) promises.push(loadSiteMetrics("adobe", false))
      if (promises.length === 0) {
        setLpError("Configure at least one site to load metrics")
        return
      }
      await Promise.all(promises)
    } else {
      await loadSiteMetrics(viewMode as SiteKey, true)
    }
  }, [viewMode, loadSiteMetrics, lpConfigured, adobeConfigured])

  // -----------------------------------------------------------------------
  // Auto-reload when switching to single-site (need APM data)
  // -----------------------------------------------------------------------

  const previousViewMode = useRef(viewMode)
  useEffect(() => {
    const prev = previousViewMode.current
    previousViewMode.current = viewMode

    // Only trigger when switching TO a single-site view
    if (viewMode === "comparison" || viewMode === prev) return

    const siteKey = viewMode as SiteKey
    const config = siteKey === "lampsplus" ? lpConfig : adobeConfig
    const data = siteKey === "lampsplus" ? lpData : adobeData

    // Only auto-load if the site is configured and either has no data or is missing APM
    if (isConfigured(config) && (!data || !data.apm)) {
      loadSiteMetrics(siteKey, true)
    }
  }, [viewMode, lpConfig, adobeConfig, lpData, adobeData, loadSiteMetrics])

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <>
      <PageHeader title="New Relic" description="Core Web Vitals and APM metrics" />
      <div className="space-y-6 p-6">
        {/* ---- Configuration ---- */}
        <details
          open={configOpen}
          onToggle={(e) => setConfigOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary
            className="cursor-pointer select-none list-none"
            style={{ color: "var(--lcc-text-dim)" }}
          >
            <span className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-widest">
              <Settings className="h-3.5 w-3.5" />
              API Configuration
              <span className="aurora-text-faint text-[10px] normal-case tracking-normal">
                {lpConfigured && adobeConfigured
                  ? "Both sites configured"
                  : lpConfigured || adobeConfigured
                    ? "1 of 2 sites configured"
                    : "Not configured"}
              </span>
            </span>
          </summary>
          <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <SiteConfigCard label="LampsPlus" config={lpConfig} onConfigChange={setLpConfig} />
            <SiteConfigCard
              label="Adobe Commerce"
              config={adobeConfig}
              onConfigChange={setAdobeConfig}
            />
          </div>
        </details>

        {/* ---- Query Controls ---- */}
        <div className="aurora-panel space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <ViewModeToggle value={viewMode} onChange={setViewMode} />

            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-3">
              <TimeRangePicker
                value={timeRange}
                customRange={customRange}
                onChange={setTimeRange}
                onCustomRangeChange={setCustomRange}
              />
              <Button onClick={loadAllMetrics} disabled={anyLoading} style={{ color: "#000" }}>
                {anyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {anyLoading ? "Loading..." : "Load Metrics"}
              </Button>
            </div>
          </div>

          {/* URL inputs */}
          <div className={viewMode === "comparison" ? "grid gap-4 lg:grid-cols-2" : ""}>
            {(viewMode === "comparison" || viewMode === "lampsplus") && (
              <UrlFavoritesInput
                id="lpUrl"
                label={viewMode === "comparison" ? "LampsPlus URL" : "Page URL to Monitor"}
                url={lpUrl}
                onUrlChange={setLpUrl}
                favorites={lpFavorites}
                onFavoritesChange={setLpFavorites}
                placeholder="https://www.lampsplus.com/"
              />
            )}
            {(viewMode === "comparison" || viewMode === "adobe") && (
              <UrlFavoritesInput
                id="adobeUrl"
                label={viewMode === "comparison" ? "Adobe Commerce URL" : "Page URL to Monitor"}
                url={adobeUrl}
                onUrlChange={setAdobeUrl}
                favorites={adobeFavorites}
                onFavoritesChange={setAdobeFavorites}
                placeholder="https://mcprod.lampsplus.com/"
              />
            )}
          </div>
        </div>

        {/* ---- Errors ---- */}
        {lpError && (viewMode === "comparison" || viewMode === "lampsplus") && (
          <p className="text-sm" style={{ color: "var(--lcc-red)" }}>
            {viewMode === "comparison" ? `LampsPlus: ${lpError}` : lpError}
          </p>
        )}
        {adobeError && (viewMode === "comparison" || viewMode === "adobe") && (
          <p className="text-sm" style={{ color: "var(--lcc-red)" }}>
            {viewMode === "comparison" ? `Adobe Commerce: ${adobeError}` : adobeError}
          </p>
        )}

        {/* ---- Comparison Mode ---- */}
        {viewMode === "comparison" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <ComparisonColumn
              label="LampsPlus"
              data={lpData}
              loading={lpLoading}
              configured={lpConfigured}
            />
            <ComparisonColumn
              label="Adobe Commerce"
              data={adobeData}
              loading={adobeLoading}
              configured={adobeConfigured}
            />
          </div>
        )}

        {/* ---- Single-Site Mode ---- */}
        {isSingleSite && activeSite && (() => {
          const data = activeSite === "lampsplus" ? lpData : adobeData
          const loading = activeSite === "lampsplus" ? lpLoading : adobeLoading
          const cwv = extractCwv(data)

          if (loading) {
            return (
              <LoadingSpinner message={`Loading ${SITE_LABELS[activeSite]} metrics...`} />
            )
          }

          return (
            <>
              {data?.cwv && (
                <div>
                  <h2 className="aurora-section-title mb-3">Core Web Vitals</h2>
                  <CwvMetrics
                    metrics={cwv.metrics}
                    metadata={cwv.metadata}
                    interactionsCount={cwv.interactionsCount}
                  />
                </div>
              )}

              {data?.perf && (
                <div>
                  <h2 className="aurora-section-title mb-3">Performance Overview</h2>
                  <PerformanceOverview data={data.perf} />
                </div>
              )}

              {data?.apm && (
                <div>
                  <h2 className="aurora-section-title mb-3">
                    Application Performance Monitoring
                  </h2>
                  <ApmMetrics data={data.apm} />
                </div>
              )}

              <div>
                <h2 className="aurora-section-title mb-3">Custom NerdGraph Query</h2>
                <CustomQuery configs={configs} activeSite={activeSite} />
              </div>
            </>
          )
        })()}
      </div>
    </>
  )
}
