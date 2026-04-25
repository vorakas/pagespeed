import { useState, useCallback, useEffect, useRef } from "react"
import { Monitor, Smartphone, Rocket, RefreshCw } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { TestResultsTable } from "@/components/test-urls/TestResultsTable"
import { TestProgressPanel, type TestProgressEntry } from "@/components/test-urls/TestProgressPanel"
import { TestDetailDialog } from "@/components/test-urls/TestDetailDialog"
import { EmptyState } from "@/components/shared/EmptyState"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { useSites } from "@/hooks/use-sites"
import { api } from "@/services/api"
import type { Strategy, LatestResult, TestDetail, SiteWithUrls } from "@/types"

export function TestUrls() {
  const { sites, loading: sitesLoading, error: sitesError } = useSites()
  const [strategy, setStrategy] = useState<Strategy>("desktop")
  const [activeSiteId, setActiveSiteId] = useState<number | null>(null)
  const [results, setResults] = useState<LatestResult[]>([])
  const [resultsLoading, setResultsLoading] = useState(false)
  const [resultsError, setResultsError] = useState<string | null>(null)

  // Testing state
  const [testing, setTesting] = useState(false)
  const [testProgress, setTestProgress] = useState({
    completed: 0,
    total: 0,
    successful: 0,
    failed: 0,
    currentUrl: null as string | null,
    finished: false,
  })
  const [recentResults, setRecentResults] = useState<TestProgressEntry[]>([])
  const [retestingUrlId, setRetestingUrlId] = useState<number | null>(null)
  const abortRef = useRef(false)

  // Detail dialog state
  const [detailOpen, setDetailOpen] = useState(false)
  const [detail, setDetail] = useState<TestDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState<string | null>(null)

  // Set first site as active when sites load
  useEffect(() => {
    if (sites.length > 0 && activeSiteId === null) {
      setActiveSiteId(sites[0].id)
    }
  }, [sites, activeSiteId])

  // Load results when active site or strategy changes
  const loadResults = useCallback(async (siteId: number, selectedStrategy: Strategy) => {
    setResultsLoading(true)
    setResultsError(null)
    try {
      const data = await api.getLatestResults(siteId, selectedStrategy)
      setResults(data)
    } catch (err) {
      setResultsError(err instanceof Error ? err.message : "Failed to load results")
    } finally {
      setResultsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeSiteId !== null) {
      loadResults(activeSiteId, strategy)
    }
  }, [activeSiteId, strategy, loadResults])

  const handleStrategyChange = (values: string[]) => {
    const value = values[0]
    if (value === "desktop" || value === "mobile") {
      setStrategy(value)
    }
  }

  const handleSiteChange = (value: string) => {
    const siteId = parseInt(value)
    if (!isNaN(siteId)) {
      setActiveSiteId(siteId)
    }
  }

  // Batch test all URLs
  const handleTestAll = useCallback(async () => {
    const allUrls: Array<{ id: number; url: string; siteName: string }> = []
    for (const site of sites) {
      for (const url of site.urls) {
        allUrls.push({ id: url.id, url: url.url, siteName: site.name })
      }
    }

    if (allUrls.length === 0) return

    abortRef.current = false
    setTesting(true)
    setRecentResults([])
    setTestProgress({
      completed: 0,
      total: allUrls.length,
      successful: 0,
      failed: 0,
      currentUrl: null,
      finished: false,
    })

    let successful = 0
    let failed = 0
    const entries: TestProgressEntry[] = []

    for (let i = 0; i < allUrls.length; i++) {
      if (abortRef.current) break

      const urlData = allUrls[i]
      setTestProgress((prev) => ({
        ...prev,
        currentUrl: urlData.url,
      }))

      try {
        const response = await api.testUrl(urlData.id, urlData.url, strategy)
        if (response.success) {
          successful++
          entries.unshift({ url: urlData.url, siteName: urlData.siteName, status: "success" })
        } else {
          failed++
          entries.unshift({
            url: urlData.url,
            siteName: urlData.siteName,
            status: "failed",
            error: response.error || "Test failed",
          })
        }
      } catch (err) {
        failed++
        entries.unshift({
          url: urlData.url,
          siteName: urlData.siteName,
          status: "failed",
          error: err instanceof Error ? err.message : "Network error",
        })
      }

      // Keep only last 5 visible
      setRecentResults(entries.slice(0, 5))
      setTestProgress((prev) => ({
        ...prev,
        completed: i + 1,
        successful,
        failed,
      }))
    }

    setTestProgress((prev) => ({ ...prev, currentUrl: null, finished: true }))

    // Refresh results for current site
    if (activeSiteId !== null) {
      loadResults(activeSiteId, strategy)
    }

    // Auto-hide after 5 seconds
    setTimeout(() => {
      setTesting(false)
    }, 5000)
  }, [sites, strategy, activeSiteId, loadResults])

  // Retest single URL
  const handleRetestUrl = useCallback(async (urlId: number, url: string) => {
    setRetestingUrlId(urlId)
    try {
      await api.testUrl(urlId, url, strategy)
      if (activeSiteId !== null) {
        await loadResults(activeSiteId, strategy)
      }
    } catch {
      // Error handled silently — the user sees the spinner stop
    } finally {
      setRetestingUrlId(null)
    }
  }, [strategy, activeSiteId, loadResults])

  // Delete URL
  const handleDeleteUrl = useCallback(async (urlId: number, url: string) => {
    if (!window.confirm(`Delete "${url}"?\n\nThis will also delete all test results for this URL.`)) {
      return
    }
    try {
      await api.deleteUrl(urlId)
      if (activeSiteId !== null) {
        await loadResults(activeSiteId, strategy)
      }
    } catch {
      // Deletion error
    }
  }, [activeSiteId, strategy, loadResults])

  // View details
  const handleViewDetails = useCallback(async (urlId: number) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetailError(null)
    setDetail(null)
    try {
      const data = await api.getTestDetails(urlId)
      setDetail(data)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Failed to load details")
    } finally {
      setDetailLoading(false)
    }
  }, [])

  // Refresh current results
  const handleRefresh = useCallback(() => {
    if (activeSiteId !== null) {
      loadResults(activeSiteId, strategy)
    }
  }, [activeSiteId, strategy, loadResults])

  const strategyLabel = strategy === "mobile" ? "Mobile" : "Desktop"
  const hasUrls = sites.some((site) => site.urls.length > 0)

  if (sitesLoading) {
    return (
      <>
        <Header title="Test URLs" description="Run PageSpeed tests on monitored URLs" />
        <div className="p-6">
          <LoadingSpinner message="Loading sites..." />
        </div>
      </>
    )
  }

  return (
    <>
      <Header
        title="Test URLs"
        description="Run PageSpeed tests on monitored URLs"
        actions={
          <ToggleGroup
            value={[strategy]}
            onValueChange={handleStrategyChange}
            className="bg-muted rounded-lg p-0.5"
          >
            <ToggleGroupItem
              value="desktop"
              aria-label="Desktop"
              className="gap-1.5 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              <Monitor size={14} />
              Desktop
            </ToggleGroupItem>
            <ToggleGroupItem
              value="mobile"
              aria-label="Mobile"
              className="gap-1.5 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              <Smartphone size={14} />
              Mobile
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />
      <div className="space-y-6 p-6">
        {/* Test Controls */}
        <div className="flex items-center gap-3">
          <Button onClick={handleTestAll} disabled={testing || !hasUrls}>
            <Rocket className="h-4 w-4" />
            Test All URLs
          </Button>
          <Button variant="outline" onClick={handleRefresh} disabled={testing}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Progress Panel */}
        <TestProgressPanel
          visible={testing}
          completed={testProgress.completed}
          total={testProgress.total}
          successful={testProgress.successful}
          failed={testProgress.failed}
          currentUrl={testProgress.currentUrl}
          strategyLabel={strategyLabel}
          finished={testProgress.finished}
          recentResults={recentResults}
        />

        {/* Site Tabs + Results */}
        {sites.length === 0 ? (
          <div className="aurora-panel overflow-hidden">
            <EmptyState
              icon={<Monitor size={40} />}
              title="No Sites Configured"
              description="Add your first site and URLs to start monitoring performance."
              actionText="Go to Setup"
              actionHref="/setup"
            />
          </div>
        ) : (
          <Tabs
            value={activeSiteId?.toString()}
            onValueChange={handleSiteChange}
            defaultValue={sites[0]?.id.toString()}
          >
            <TabsList className="aurora-tabs-list">
              {sites.map((site) => (
                <TabsTrigger
                  key={site.id}
                  value={site.id.toString()}
                  className="aurora-tabs-trigger"
                >
                  {site.name}
                  <span className="aurora-text-faint ml-1 text-xs">
                    ({site.urls.length})
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>

            {sites.map((site) => (
              <TabsContent key={site.id} value={site.id.toString()}>
                <TestResultsTable
                  results={results}
                  loading={resultsLoading}
                  error={resultsError}
                  onViewDetails={handleViewDetails}
                  onRetestUrl={handleRetestUrl}
                  onDeleteUrl={handleDeleteUrl}
                  retestingUrlId={retestingUrlId}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>

      {/* Detail Dialog */}
      <TestDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        detail={detail}
        loading={detailLoading}
        error={detailError}
      />
    </>
  )
}
