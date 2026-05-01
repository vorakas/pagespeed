import { useCallback, useEffect, useState } from "react"
import { BeaconLayout } from "./BeaconLayout"
import { MockBuildsPage } from "./MockBuildsPage"

interface PrototypeBeaconBuildsProps {
  register?: "beacon" | "aurora"
}

function formatLastSync(d: Date | null, now: number): string {
  if (!d) return "—"
  const diffSec = Math.floor((now - d.getTime()) / 1000)
  if (diffSec < 5) return "just now"
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  return `${diffHr}h ago`
}

/**
 * Builds status block — was the right side of the old BeaconHeader's
 * built-in stat triplet (ACTIVE / POLLING / LAST SYNC). Lifted out of
 * the header into a page-owned component so the header can stay
 * page-agnostic across all of Pharos.
 */
function BuildsStatusBlock({
  activeBuildCount,
  polling,
  lastSync,
}: {
  activeBuildCount: number
  polling: boolean
  lastSync: Date | null
}) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-center gap-7">
      <div className="beacon-header-stat">
        <span className="beacon-header-stat-label">ACTIVE</span>
        <span
          className={`beacon-header-stat-value ${
            activeBuildCount > 0 ? "beacon-header-stat-value--accent" : ""
          }`}
        >
          {activeBuildCount}
        </span>
      </div>
      <div className="beacon-header-stat">
        <span className="beacon-header-stat-label">POLLING</span>
        <span
          className="beacon-header-stat-value"
          style={polling ? { color: "var(--beacon-pass)" } : undefined}
        >
          {polling ? "LIVE" : "IDLE"}
        </span>
      </div>
      <div className="beacon-header-stat">
        <span className="beacon-header-stat-label">LAST SYNC</span>
        <span className="beacon-header-stat-value">
          {formatLastSync(lastSync, now)}
        </span>
      </div>
    </div>
  )
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
      actions={
        <BuildsStatusBlock
          activeBuildCount={activeBuildCount}
          polling={polling}
          lastSync={lastSync}
        />
      }
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
