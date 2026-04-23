import { useEffect, useState } from "react"
import { Loader2, RotateCw } from "lucide-react"
import { api } from "@/services/api"
import type { MigrationHealthSnapshot } from "@/types"

const HEALTH_LABEL: Record<string, string> = {
  "at-risk": "AT RISK",
  blocked: "BLOCKED",
  "in-progress": "ON TRACK",
  "near-complete": "NEAR COMPLETE",
  improving: "IMPROVING",
  groomed: "NOT STARTED",
}

const FILTERS = ["all", "at-risk", "blocked", "in-progress", "near-complete"] as const
export type HealthFilter = (typeof FILTERS)[number]

interface TopBarProps {
  health: MigrationHealthSnapshot | null
  filter: HealthFilter
  onFilterChange: (next: HealthFilter) => void
  onRefresh?: () => void
  refreshing?: boolean
}

/**
 * Sticky top bar: brand / countdown / health pill / filters / sync status.
 *
 * The days-to-launch number is derived from real `Date.now()` — no
 * hardcoded anchor. "synced Nm ago" ticks every 30s.
 */
export function TopBar({ health, filter, onFilterChange, onRefresh, refreshing }: TopBarProps) {
  const [now, setNow] = useState(() => Date.now())
  const [autoRefreshedAt, setAutoRefreshedAt] = useState<number | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    // Poll the backend's auto-refresh timestamp so we can display when
    // Railway last pulled orchestrator commits from origin. The backend
    // job runs every 10 min; polling once a minute is plenty.
    let cancelled = false
    const tick = async () => {
      try {
        const s = await api.getVaultAutoRefreshStatus()
        if (!cancelled && s.enabled && typeof s.lastRefreshedAt === "number") {
          setAutoRefreshedAt(s.lastRefreshedAt * 1000)
        }
      } catch {
        // Endpoint may be disabled in local dev — silent fallback.
      }
    }
    void tick()
    const id = window.setInterval(tick, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  const daysToLaunch = computeDaysUntil(health?.launchWindow?.start, now)
  const syncedAgo = computeSyncedAgo(health?.lastSynced, now)

  return (
    <div className="lcc-topbar">
      <div className="lcc-brand">
        <div className="lcc-brand-dot" />
        <div>
          <div className="lcc-brand-name">LP / Adobe Migration</div>
          <div className="lcc-brand-sub">Dashboard</div>
        </div>
      </div>

      <div className="lcc-tb-divider" />

      <div className="lcc-tb-countdown">
        <div className="lcc-tb-countdown-num">
          {daysToLaunch === null ? "—" : `T−${daysToLaunch}`}
        </div>
        <div className="lcc-tb-countdown-sub">
          {health?.launchWindow?.start ?? "no launch date"}
        </div>
      </div>

      <div className="lcc-tb-divider" />

      <div className="lcc-tb-health">
        <span className="lcc-tb-health-dot" data-health={health?.overall ?? undefined} />
        {health?.overall ? HEALTH_LABEL[health.overall] ?? health.overall.toUpperCase() : "—"}
      </div>

      <div className="lcc-spacer" />

      <div className="lcc-tb-filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`lcc-tb-filter${filter === f ? " active" : ""}`}
            onClick={() => onFilterChange(f)}
          >
            {f === "all" ? "All" : HEALTH_LABEL[f] ?? f}
          </button>
        ))}
      </div>

      <div className="lcc-sync">
        <span className="lcc-pulse" />
        <div>
          <div>{refreshing ? "syncing vault…" : `synced ${syncedAgo ?? "—"}`}</div>
          <div className="lcc-sync-sub">
            {refreshing
              ? "pulling Jira + Asana"
              : health?.lastSynced
              ? new Date(health.lastSynced).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </div>
          {autoRefreshedAt && (
            <div
              className="lcc-sync-sub"
              style={{ marginTop: 2, color: "var(--lcc-text-faint)" }}
              title="Last automatic vault pull from origin"
            >
              auto-refreshed {formatPacific(autoRefreshedAt)}
            </div>
          )}
        </div>
      </div>

      {onRefresh && (
        <button
          type="button"
          className="lcc-tb-btn"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Sync vault and refresh dashboard"
          title="Sync — pull Jira+Asana into the vault and re-parse every panel"
          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {refreshing ? <Loader2 size={15} className="animate-spin" /> : <RotateCw size={14} />}
        </button>
      )}
    </div>
  )
}

function computeDaysUntil(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return null
  return Math.ceil((target - now) / 86_400_000)
}

/** Formats a UTC epoch-ms timestamp as `HH:MM PT` in Pacific time. */
function formatPacific(epochMs: number): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZoneName: "short",
    })
    // `short` yields e.g. "PST" or "PDT" — good enough; we keep it inline.
    return fmt.format(new Date(epochMs))
  } catch {
    return new Date(epochMs).toLocaleTimeString()
  }
}

function computeSyncedAgo(iso: string | null | undefined, now: number): string | null {
  if (!iso) return null
  const parsed = new Date(iso).getTime()
  if (Number.isNaN(parsed)) return null
  const minutes = Math.max(0, Math.floor((now - parsed) / 60_000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}
