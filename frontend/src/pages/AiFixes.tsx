import { useCallback, useEffect, useState } from "react"

import { PageHeader } from "@/components/layout/PageHeader"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { EmptyState } from "@/components/shared/EmptyState"
import { api } from "@/services/api"
import { BuildList } from "@/components/ai-fixes/BuildList"
import { FixCard } from "@/components/ai-fixes/FixCard"
import type { AutofixBuild, AutofixFix, AutofixStatus } from "@/types"
import { RefreshCw, Wand2 } from "lucide-react"

export function AiFixes() {
  const [builds, setBuilds] = useState<AutofixBuild[]>([])
  const [loadingBuilds, setLoadingBuilds] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedBuildId, setSelectedBuildId] = useState<string | null>(null)
  const [fixes, setFixes] = useState<AutofixFix[]>([])
  const [loadingFixes, setLoadingFixes] = useState(false)
  const [statusFilter, setStatusFilter] = useState<AutofixStatus | "all">("all")
  const [confidenceFilter, setConfidenceFilter] = useState<string>("all")

  const selectBuild = useCallback(async (buildId: string) => {
    setSelectedBuildId(buildId)
    setFixes([])
    setLoadingFixes(true)
    try {
      const result = await api.getAutofixFixes(buildId)
      setFixes(result.fixes)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load fixes")
    } finally {
      setLoadingFixes(false)
    }
  }, [])

  const loadBuilds = useCallback(async () => {
    setLoadingBuilds(true)
    setError(null)
    try {
      const result = await api.getAutofixBuilds()
      setBuilds(result.builds)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load builds")
    } finally {
      setLoadingBuilds(false)
    }
  }, [])

  useEffect(() => {
    void loadBuilds()
  }, [loadBuilds])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    setError(null)
    try {
      await api.refreshAutofix({})
      await loadBuilds()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed")
    } finally {
      setRefreshing(false)
    }
  }, [loadBuilds])

  const visibleFixes = fixes.filter((fix) => {
    if (statusFilter !== "all" && fix.status !== statusFilter) return false
    if (confidenceFilter !== "all" && fix.confidence.toLowerCase() !== confidenceFilter) return false
    return true
  })

  return (
    <div className="beacon min-h-screen">
      <PageHeader
        title="AI Fixes"
        description="Triage AI-suggested fixes for failed automation tests, by build."
        actions={
          <>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as AutofixStatus | "all")}
              className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground"
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="todo">To Do</option>
              <option value="applied">Applied</option>
              <option value="dismissed">Dismissed</option>
            </select>
            <select
              value={confidenceFilter}
              onChange={(e) => setConfidenceFilter(e.target.value)}
              className="rounded border border-border bg-card px-2 py-1 text-xs text-foreground"
              aria-label="Filter by confidence"
            >
              <option value="all">All confidence</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={refreshing ? "animate-spin" : ""} size={14} />
              {refreshing ? "Refreshing…" : "Refresh"}
            </Button>
          </>
        }
      />

      <div className="p-6">
        {error && (
          <div className="beacon-banner mb-4">
            <span className="beacon-dot" style={{ color: "var(--beacon-fail)" }} aria-hidden />
            <span>{error}</span>
          </div>
        )}

        {loadingBuilds && builds.length === 0 ? (
          <LoadingSpinner message="Loading builds…" />
        ) : builds.length === 0 ? (
          <EmptyState
            icon={<Wand2 size={32} aria-hidden />}
            title="No AI Fix reports yet"
            description="Click Refresh to scan recent Azure DevOps builds for Autofix reports."
            actionText="Refresh"
            onAction={handleRefresh}
          />
        ) : (
          <div className="flex gap-6 items-start">
            <div className="w-[320px] shrink-0 space-y-2">
              <p className="beacon-label">BUILDS</p>
              <BuildList
                builds={builds}
                selectedBuildId={selectedBuildId}
                onSelect={selectBuild}
              />
            </div>
            <div className="flex-1 min-w-0">
              {!selectedBuildId ? (
                <p className="text-sm text-muted-foreground">
                  Select a build to view its suggested fixes.
                </p>
              ) : loadingFixes ? (
                <LoadingSpinner message="Loading fixes…" />
              ) : fixes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No fixes for this build.</p>
              ) : visibleFixes.length === 0 ? (
                <p className="text-sm text-muted-foreground">No fixes match the current filters.</p>
              ) : (
                <div className="space-y-4">
                  {visibleFixes.map((fix) => (
                    <FixCard key={fix.fixId} fix={fix} onPatched={loadBuilds} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
