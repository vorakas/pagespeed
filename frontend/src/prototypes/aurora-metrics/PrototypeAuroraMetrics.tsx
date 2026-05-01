import { useState } from "react"
import { BeaconLayout } from "../beacon-builds/BeaconLayout"
import { MetricsBody, MetricsStrategyToggle } from "@/pages/Metrics"
import type { Strategy } from "@/types"

/**
 * Aurora-register port of the Performance Metrics page. The production
 * route keeps the desktop/mobile toggle in the Header actions slot;
 * BeaconHeader has no such slot, so this wrapper renders the toggle
 * inline at the top of the body. State lives here, mirroring the
 * Test URLs prototype's pattern.
 */
export function PrototypeAuroraMetrics() {
  const [strategy, setStrategy] = useState<Strategy>("desktop")
  return (
    <BeaconLayout
      title="Performance Metrics"
      description="Historical performance data and comparisons"
      activePath="/metrics"
      activeBuildCount={0}
      polling={false}
      lastSync={null}
      register="aurora"
    >
      <div className="flex items-center justify-end px-6 pt-6">
        <MetricsStrategyToggle strategy={strategy} onStrategyChange={setStrategy} />
      </div>
      <MetricsBody strategy={strategy} />
    </BeaconLayout>
  )
}
