import { useState, useCallback } from "react"
import { BeaconHeader } from "@/components/layout/BeaconHeader"
import { Button } from "@/components/ui/button"
import { NewRelicConfigPanel } from "@/components/newrelic/NewRelicConfig"
import { CwvMetrics } from "@/components/newrelic/CwvMetrics"
import { PerformanceOverview } from "@/components/newrelic/PerformanceOverview"
import { ApmMetrics } from "@/components/newrelic/ApmMetrics"
import { CustomQuery } from "@/components/newrelic/CustomQuery"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { useLocalConfig } from "@/hooks/use-local-config"
import { api } from "@/services/api"
import type { NewRelicConfig } from "@/types"
import { Loader2 } from "lucide-react"

const TIME_RANGES = [
  { value: "30 minutes ago", label: "Last 30 minutes" },
  { value: "1 hour ago", label: "Last 1 hour" },
  { value: "3 hours ago", label: "Last 3 hours" },
  { value: "6 hours ago", label: "Last 6 hours" },
  { value: "12 hours ago", label: "Last 12 hours" },
  { value: "24 hours ago", label: "Last 24 hours" },
]

const DEFAULT_CONFIG: NewRelicConfig = {
  apiKey: "",
  accountId: "",
  appName: "",
}

export function NewRelicBody() {
  const [config, setConfig] = useLocalConfig<NewRelicConfig>("nrConfig", DEFAULT_CONFIG)
  const [, setConnected] = useState(false)
  const [pageUrl, setPageUrl] = useState("https://www.lampsplus.com/")
  const [timeRange, setTimeRange] = useState("30 minutes ago")

  // Data states
  const [cwvData, setCwvData] = useState<Record<string, unknown> | null>(null)
  const [perfData, setPerfData] = useState<Record<string, unknown> | null>(null)
  const [apmData, setApmData] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAllMetrics = useCallback(async () => {
    if (!config.apiKey || !config.accountId || !config.appName) {
      setError("Please configure all API settings first")
      return
    }
    if (!pageUrl.trim()) {
      setError("Please enter a page URL to monitor")
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Load CWV first
      const cwvResult = await api.getNewRelicCwv(config, pageUrl, timeRange)
      setCwvData(cwvResult)

      // Load performance overview and APM in parallel
      const [perfResult, apmResult] = await Promise.all([
        api.getNewRelicPerformance(config, timeRange).catch(() => null),
        api.getNewRelicApm(config, timeRange).catch(() => null),
      ])
      setPerfData(perfResult)
      setApmData(apmResult)
      setConnected(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics")
    } finally {
      setLoading(false)
    }
  }, [config, pageUrl, timeRange])

  const cwvMetrics = cwvData?.metrics as Record<string, unknown> | undefined
  const cwvMetadata = cwvData?.metadata as Record<string, string> | undefined
  const interactionsCount = (cwvMetrics?.interactions as number) ?? null

  return (
    <div className="space-y-6 p-6">
        {/* Configuration */}
        <NewRelicConfigPanel
          config={config}
          onConfigChange={setConfig}
          onConnected={() => setConnected(true)}
        />

        {/* Query Controls */}
        <div className="aurora-panel p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
              <label htmlFor="pageUrl" className="aurora-label block">Page URL to Monitor</label>
              <input
                id="pageUrl"
                className="aurora-input w-full"
                value={pageUrl}
                onChange={(e) => setPageUrl(e.target.value)}
                placeholder="https://www.lampsplus.com/"
              />
            </div>
            <div className="flex flex-col gap-1.5 w-48">
              <label className="aurora-label block">Time Range</label>
              <select
                className="aurora-select w-full"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
              >
                {TIME_RANGES.map((tr) => (
                  <option key={tr.value} value={tr.value}>
                    {tr.label}
                  </option>
                ))}
              </select>
            </div>
            <Button onClick={loadAllMetrics} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Loading..." : "Load Metrics"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--lcc-red)" }}>{error}</p>
        )}

        {loading && <LoadingSpinner message="Loading Core Web Vitals data from New Relic..." />}

        {/* Core Web Vitals */}
        {!loading && cwvData && (
          <div>
            <h2 className="aurora-section-title mb-3">Core Web Vitals</h2>
            <CwvMetrics
              metrics={cwvMetrics as Record<string, { p50: number | null; p75: number | null; p90: number | null }> | null ?? null}
              metadata={cwvMetadata ?? null}
              interactionsCount={interactionsCount}
            />
          </div>
        )}

        {/* Performance Overview */}
        {!loading && perfData && (
          <div>
            <h2 className="aurora-section-title mb-3">Performance Overview</h2>
            <PerformanceOverview data={perfData} />
          </div>
        )}

        {/* APM Metrics */}
        {!loading && apmData && (
          <div>
            <h2 className="aurora-section-title mb-3">Application Performance Monitoring</h2>
            <ApmMetrics data={apmData} />
          </div>
        )}

        {/* Custom Query */}
        <div>
          <h2 className="aurora-section-title mb-3">Custom NerdGraph Query</h2>
          <CustomQuery config={config} />
        </div>
    </div>
  )
}

/**
 * Production page — Header + body. The Aurora prototype at
 * `/prototype/newrelic/aurora` renders `<NewRelicBody />` inside
 * `BeaconLayout` instead.
 */
export function NewRelic() {
  return (
    <>
      <BeaconHeader title="New Relic" description="Core Web Vitals and APM metrics" />
      <NewRelicBody />
    </>
  )
}
