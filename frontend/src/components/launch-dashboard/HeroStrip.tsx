import { useEffect, useState } from "react"
import { Loader2, RotateCw } from "lucide-react"
import { api } from "@/services/api"
import { formatPacificDateTime, formatPacificTime } from "@/lib/datetime"
import type { MigrationHealthSnapshot, MigrationKpis } from "@/types"

export type HeroIssueKpi = "prod" | "blocker" | "bug"

interface HeroStripProps {
  health: MigrationHealthSnapshot
  kpis: MigrationKpis | null
  onIssueKpiClick?: (kind: HeroIssueKpi) => void
  onRefresh?: () => void
  refreshing?: boolean
}

/**
 * One-line operator brief: health · T−N · open blockers · prod failures · sync.
 * Replaces both the prior hero-metric template and the standalone TopBar — the
 * sync indicator + manual refresh now ride at the end of the same row.
 */
export function HeroStrip({
  health,
  kpis,
  onIssueKpiClick,
  onRefresh,
  refreshing,
}: HeroStripProps) {
  const days = computeDaysUntil(health.launchWindow?.start)
  const launchLabel = health.launchWindow?.start ?? "no launch window"

  return (
    <div className="lcc-brief" role="group" aria-label="Operator brief">
      <span className="lcc-health-badge lg" data-health={health.overall ?? undefined}>
        {(health.overall ?? "unknown").replace("-", " ")}
      </span>
      <span className="lcc-brief-sep" aria-hidden="true" />
      <span className="lcc-brief-item">
        <span className="lcc-brief-num">{days === null ? "—" : `T−${days}`}</span>
        <span className="lcc-brief-label">{launchLabel}</span>
      </span>
      <span className="lcc-brief-sep" aria-hidden="true" />
      <BriefStat
        value={fmt(kpis?.openBlockers)}
        label="open blockers"
        tone="amber"
        onClick={onIssueKpiClick ? () => onIssueKpiClick("blocker") : undefined}
      />
      <span className="lcc-brief-sep" aria-hidden="true" />
      <BriefStat
        value={fmt(kpis?.productionFailures)}
        label="prod failures"
        tone="red"
        onClick={onIssueKpiClick ? () => onIssueKpiClick("prod") : undefined}
      />
      <span className="lcc-brief-flex" />
      <SyncIndicator
        lastSynced={health.lastSynced ?? null}
        refreshing={refreshing ?? false}
        onRefresh={onRefresh}
      />
    </div>
  )
}

interface BriefStatProps {
  value: string
  label: string
  tone: "amber" | "red"
  onClick?: () => void
}

function BriefStat({ value, label, tone, onClick }: BriefStatProps) {
  const body = (
    <>
      <span className="lcc-brief-num" data-tone={tone}>{value}</span>
      <span className="lcc-brief-label">{label}</span>
    </>
  )
  if (onClick) {
    return (
      <button
        type="button"
        className="lcc-brief-item lcc-brief-item-btn"
        onClick={onClick}
        aria-label={`Open ${label} triage panel`}
      >
        {body}
      </button>
    )
  }
  return <span className="lcc-brief-item">{body}</span>
}

interface SyncIndicatorProps {
  lastSynced: string | null
  refreshing: boolean
  onRefresh?: () => void
}

function SyncIndicator({ lastSynced, refreshing, onRefresh }: SyncIndicatorProps) {
  const [now, setNow] = useState(() => Date.now())
  const [autoRefreshedAt, setAutoRefreshedAt] = useState<number | null>(null)
  const [lastOrchestrationAt, setLastOrchestrationAt] = useState<number | null>(null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    // Poll backend auto-refresh status. Job runs every 10 min; 60s poll is plenty.
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

  const syncedAgo = computeSyncedAgo(lastSynced, now)

  return (
    <span className="lcc-brief-sync">
      <span className="lcc-status-dot" />
      <span className="lcc-brief-sync-stack">
        <span className="lcc-brief-sync-primary">
          {refreshing ? "syncing vault…" : `synced ${syncedAgo ?? "—"}`}
        </span>
        <span className="lcc-brief-sync-sub">
          {refreshing
            ? "pulling Jira + Asana"
            : formatPacificDateTime(lastSynced) || "—"}
        </span>
        {autoRefreshedAt && (
          <span
            className="lcc-brief-sync-sub"
            title="Last automatic vault pull from origin"
          >
            auto-refreshed {formatPacificTime(autoRefreshedAt)}
          </span>
        )}
        {lastOrchestrationAt && (
          <span
            className="lcc-brief-sync-sub"
            title="When the orchestrator last pushed an [orchestrate] commit to GitHub"
          >
            orchestrated {formatPacificTime(lastOrchestrationAt)}
          </span>
        )}
      </span>
      {onRefresh && (
        <button
          type="button"
          className="lcc-brief-refresh"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label="Sync vault and refresh dashboard"
          title="Sync — pull Jira+Asana into the vault and re-parse every panel"
        >
          {refreshing ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RotateCw size={13} />
          )}
        </button>
      )}
    </span>
  )
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—"
  return Number(n).toLocaleString()
}

function computeDaysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return null
  return Math.ceil((target - Date.now()) / 86_400_000)
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
