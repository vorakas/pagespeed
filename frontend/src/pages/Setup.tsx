import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/layout/PageHeader"
import { SiteUrlManager } from "@/components/setup/SiteUrlManager"
import { TriggerForm } from "@/components/setup/TriggerForm"
import { TriggerList } from "@/components/setup/TriggerList"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useSites } from "@/hooks/use-sites"
import { api } from "@/services/api"
import type { AiUsageSummary, Trigger } from "@/types"

export function Setup() {
  const { sites, loading: sitesLoading, refreshSites } = useSites()
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [triggersLoading, setTriggersLoading] = useState(true)
  const [triggersError, setTriggersError] = useState<string | null>(null)
  const [editingTrigger, setEditingTrigger] = useState<Trigger | null>(null)
  const [aiUsage, setAiUsage] = useState<AiUsageSummary | null>(null)
  const [aiUsageError, setAiUsageError] = useState<string | null>(null)

  const loadTriggers = useCallback(async () => {
    setTriggersLoading(true)
    setTriggersError(null)
    try {
      const data = await api.getTriggers()
      setTriggers(data)
    } catch (err) {
      setTriggersError(err instanceof Error ? err.message : "Failed to load triggers")
    } finally {
      setTriggersLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTriggers()
  }, [loadTriggers])

  useEffect(() => {
    api.getAiUsageSummary()
      .then(setAiUsage)
      .catch((err) => setAiUsageError(err instanceof Error ? err.message : "Failed to load AI usage"))
  }, [])

  const handleDataChanged = () => {
    refreshSites()
  }

  const handleTriggerSaved = () => {
    setEditingTrigger(null)
    loadTriggers()
  }

  const handleEditTrigger = (trigger: Trigger) => {
    setEditingTrigger(trigger)
    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (sitesLoading) {
    return (
      <>
        <PageHeader title="Setup" description="Manage sites, URLs, and scheduled triggers" />
        <div className="p-6">
          <LoadingSpinner message="Loading sites..." />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Setup"
        description="Manage sites, URLs, and scheduled triggers"
      />
      <div className="space-y-8 p-6">
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle>AI API Usage</CardTitle>
            <CardDescription>Estimated spend from Pharos-tracked AI calls. Provider invoices remain the billing source of truth.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {aiUsageError ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{aiUsageError}</div>
            ) : !aiUsage ? (
              <LoadingSpinner message="Loading AI usage..." />
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estimated Total</p>
                    <p className="mt-1 text-2xl font-semibold">${aiUsage.estimatedCost.toFixed(6)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">API Calls</p>
                    <p className="mt-1 text-2xl font-semibold">{aiUsage.totals.reduce((sum, row) => sum + row.callCount, 0)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tokens</p>
                    <p className="mt-1 text-2xl font-semibold">
                      {aiUsage.totals.reduce((sum, row) => sum + row.inputTokens + row.outputTokens, 0).toLocaleString()}
                    </p>
                  </div>
                </div>
                {aiUsage.totals.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">No tracked AI API calls yet.</div>
                ) : (
                  <div className="overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 text-left">Provider</th>
                          <th className="px-3 py-2 text-left">Model</th>
                          <th className="px-3 py-2 text-right">Calls</th>
                          <th className="px-3 py-2 text-right">Input</th>
                          <th className="px-3 py-2 text-right">Output</th>
                          <th className="px-3 py-2 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {aiUsage.totals.map((row) => (
                          <tr key={`${row.provider}-${row.model}-${row.feature}`} className="border-t">
                            <td className="px-3 py-2 capitalize">{row.provider}</td>
                            <td className="px-3 py-2">{row.model}</td>
                            <td className="px-3 py-2 text-right">{row.callCount}</td>
                            <td className="px-3 py-2 text-right">{row.inputTokens.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">{row.outputTokens.toLocaleString()}</td>
                            <td className="px-3 py-2 text-right">${row.estimatedCost.toFixed(6)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Sites & URLs Section */}
        <SiteUrlManager sites={sites} onDataChanged={handleDataChanged} />

        {/* Triggers Section */}
        <div className="space-y-4">
          <div>
            <h2 className="aurora-section-title">Scheduled Test Triggers</h2>
            <p className="aurora-section-subtitle">
              Set up automatic PageSpeed testing on a schedule
            </p>
          </div>

          <TriggerForm
            sites={sites}
            editingTrigger={editingTrigger}
            onSaved={handleTriggerSaved}
            onCancel={() => setEditingTrigger(null)}
          />

          <h3 className="aurora-text text-sm font-semibold">Active Triggers</h3>
          <TriggerList
            triggers={triggers}
            loading={triggersLoading}
            error={triggersError}
            onEdit={handleEditTrigger}
            onChanged={loadTriggers}
          />
        </div>
      </div>
    </>
  )
}
