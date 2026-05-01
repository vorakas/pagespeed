import { useState, useEffect, useCallback } from "react"
import { BeaconHeader } from "@/components/layout/BeaconHeader"
import { SiteUrlManager } from "@/components/setup/SiteUrlManager"
import { TriggerForm } from "@/components/setup/TriggerForm"
import { TriggerList } from "@/components/setup/TriggerList"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { useSites } from "@/hooks/use-sites"
import { api } from "@/services/api"
import type { Trigger } from "@/types"

export function Setup() {
  const { sites, loading: sitesLoading, refreshSites } = useSites()
  const [triggers, setTriggers] = useState<Trigger[]>([])
  const [triggersLoading, setTriggersLoading] = useState(true)
  const [triggersError, setTriggersError] = useState<string | null>(null)
  const [editingTrigger, setEditingTrigger] = useState<Trigger | null>(null)

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
        <BeaconHeader title="Setup" description="Manage sites, URLs, and scheduled triggers" />
        <div className="p-6">
          <LoadingSpinner message="Loading sites..." />
        </div>
      </>
    )
  }

  return (
    <>
      <BeaconHeader
        title="Setup"
        description="Manage sites, URLs, and scheduled triggers"
      />
      <div className="space-y-8 p-6">
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
