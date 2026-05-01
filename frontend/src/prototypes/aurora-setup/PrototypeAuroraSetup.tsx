import { useState, useEffect, useCallback } from "react"
import { BeaconLayout } from "../beacon-builds/BeaconLayout"
import { SiteUrlManager } from "@/components/setup/SiteUrlManager"
import { TriggerForm } from "@/components/setup/TriggerForm"
import { TriggerList } from "@/components/setup/TriggerList"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { useSites } from "@/hooks/use-sites"
import { api } from "@/services/api"
import type { Trigger } from "@/types"

/**
 * Aurora-register port of the Setup page. Mounts the prototype shell
 * (BeaconLayout + register='aurora') around the real Setup body, which
 * still talks to the live backend through `useSites` + `api.getTriggers`
 * etc. No fork of the Setup components — they pick up Aurora styling via
 * the legacy `aurora-*` token re-map in `styles/aurora.css`.
 */
export function PrototypeAuroraSetup() {
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

  const handleDataChanged = () => refreshSites()

  const handleTriggerSaved = () => {
    setEditingTrigger(null)
    loadTriggers()
  }

  const handleEditTrigger = (trigger: Trigger) => {
    setEditingTrigger(trigger)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <BeaconLayout
      title="Setup"
      description="Manage sites, URLs, and scheduled triggers"
      activePath="/setup"
      activeBuildCount={0}
      polling={false}
      lastSync={null}
      register="aurora"
    >
      {sitesLoading ? (
        <div className="p-6">
          <LoadingSpinner message="Loading sites..." />
        </div>
      ) : (
        <div className="space-y-8 p-6">
          <SiteUrlManager sites={sites} onDataChanged={handleDataChanged} />

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
      )}
    </BeaconLayout>
  )
}
