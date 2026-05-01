import { useState } from "react"
import { BeaconLayout } from "../beacon-builds/BeaconLayout"
import {
  DashboardBody,
  DashboardStrategyToggle,
  useWorstPerformersByStrategy,
} from "@/pages/Dashboard"
import type { Strategy } from "@/types"

/**
 * Aurora-register port of the PageSpeed Dashboard (the home `/` route
 * in production). Reuses the same `useWorstPerformersByStrategy` hook
 * and `DashboardBody` from `pages/Dashboard.tsx`. The desktop/mobile
 * toggle moves from the production Header actions slot to inline
 * above the body, since `BeaconHeader` has no actions slot.
 */
export function PrototypeAuroraDashboard() {
  const [strategy, setStrategy] = useState<Strategy>("desktop")
  const { data, loading, error } = useWorstPerformersByStrategy(strategy)
  return (
    <BeaconLayout
      title="Dashboard"
      description="Monitor and compare website performance over time"
      activePath="/"
      activeBuildCount={0}
      polling={false}
      lastSync={null}
      register="aurora"
    >
      <div className="flex items-center justify-end px-6 pt-6">
        <DashboardStrategyToggle strategy={strategy} onStrategyChange={setStrategy} />
      </div>
      <DashboardBody data={data} loading={loading} error={error} />
    </BeaconLayout>
  )
}
