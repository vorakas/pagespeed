import { useEffect, useState } from "react"
import { Loader2, RotateCw } from "lucide-react"
import { api } from "@/services/api"
import { formatPacificDateTime, formatPacificTime } from "@/lib/datetime"
import type { MigrationHealthSnapshot } from "@/types"

interface TopBarProps {
  health: MigrationHealthSnapshot | null
  onRefresh?: () => void
  refreshing?: boolean
}

/**
 * Sticky top bar: sync status + manual refresh.
 *
 * Brand block and T−N countdown lived here previously but they
 * triple-branded the page (sidebar + top bar + hero) and duplicated the
 * countdown carried by the operator brief. Branding moves to the
 * sidebar; the countdown lives in the hero brief.
 */
export function TopBar({ health, onRefresh, refreshing }: TopBarProps) {
  const [now, setNow] = useState(() => Date.now())
  const [autoRefreshedAt, setAutoRefreshedAt] = useState<number | null>(null)
  const [lastOrchestrationAt, setLastOrchestrationAt] = useState<number | null>(null)

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
        if (cancelled || !s.enabled) return
        if (typeof s.lastRefreshedAt === "number") {
          setAutoRefreshedAt(s.lastRefreshedAt * 1000)
        }
        if (typeof s.lastOrchestrationPushAt === "number") {
          setLastOrchestrationAt(s.lastOrchestrationPushAt * 1000)
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

  const syncedAgo = computeSyncedAgo(health?.lastSynced, now)

  return (
    <div className="lcc-topbar">
      <div className="lcc-spacer" />

      <div className="lcc-sync">
        <span className="lcc-status-dot" />
        <div>
          <div>{refreshing ? "syncing vault…" : `synced ${syncedAgo ?? "—"}`}</div>
          <div className="lcc-sync-sub">
            {refreshing
              ? "pulling Jira + Asana"
              : formatPacificDateTime(health?.lastSynced)}
          </div>
          {autoRefreshedAt && (
            <div
              className="lcc-sync-sub"
              style={{ marginTop: 2, color: "var(--lcc-text-faint)" }}
              title="Last automatic vault pull from origin"
            >
              auto-refreshed {formatPacificTime(autoRefreshedAt)}
            </div>
          )}
          {lastOrchestrationAt && (
            <div
              className="lcc-sync-sub"
              style={{ marginTop: 2, color: "var(--lcc-text-faint)" }}
              title="When the orchestrator last pushed an [orchestrate] commit to GitHub"
            >
              orchestrated {formatPacificTime(lastOrchestrationAt)}
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
