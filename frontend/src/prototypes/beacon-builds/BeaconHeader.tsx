import { useEffect, useState } from "react"

interface BeaconHeaderProps {
  title: string
  description?: string
  /** Number of builds currently running or queued. */
  activeBuildCount: number
  /** Whether polling is currently active (drives the brand sweep + UI). */
  polling: boolean
  /** Last time data was synced from the server. */
  lastSync: Date | null
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

export function BeaconHeader({
  title,
  description,
  activeBuildCount,
  polling,
  lastSync,
}: BeaconHeaderProps) {
  // Tick once a second so the "last sync" relative time stays fresh
  // without forcing a re-render of the whole page.
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="beacon-header sticky top-0 z-30">
      <div className="flex items-end justify-between gap-6 px-6 py-3.5">
        {/* Left — page title + description */}
        <div className="min-w-0">
          <h1 className="beacon-header-title leading-tight">{title}</h1>
          {description && (
            <p className="beacon-header-description mt-0.5">{description}</p>
          )}
        </div>

        {/* Right — operational status block */}
        <div className="flex items-center gap-7 shrink-0">
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
      </div>
    </header>
  )
}
