import { useCallback, useState } from "react"
import { BeaconLayout } from "./BeaconLayout"
import { MockBuildsPage } from "./MockBuildsPage"

interface PrototypeBeaconBuildsProps {
  register?: "beacon" | "aurora"
}

/**
 * Prototype root — the full Pharos shell rendering a fully-populated
 * Builds page from fixture data. Mounted at /prototype/builds (Beacon)
 * and /prototype/builds/aurora (Aurora), outside of AppLayout, so
 * production routes are unaffected.
 */
export function PrototypeBeaconBuilds({ register = "beacon" }: PrototypeBeaconBuildsProps) {
  const [polling, setPolling] = useState(false)
  const [activeBuildCount, setActiveBuildCount] = useState(0)
  const [lastSync, setLastSync] = useState<Date | null>(null)

  const onPollingChange = useCallback((p: boolean) => setPolling(p), [])
  const onActiveCountChange = useCallback((n: number) => setActiveBuildCount(n), [])
  const onLastSyncChange = useCallback((d: Date) => setLastSync(d), [])

  return (
    <BeaconLayout
      title="Automation Builds"
      description="Trigger and monitor Azure DevOps automation builds"
      activePath="/builds"
      activeBuildCount={activeBuildCount}
      polling={polling}
      lastSync={lastSync}
      register={register}
    >
      <MockBuildsPage
        onPollingChange={onPollingChange}
        onActiveCountChange={onActiveCountChange}
        onLastSyncChange={onLastSyncChange}
      />
    </BeaconLayout>
  )
}
