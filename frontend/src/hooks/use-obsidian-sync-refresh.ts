import { useEffect, useRef } from "react"
import { api } from "@/services/api"
import type { ObsidianSyncJobSummary } from "@/types"

interface SyncRefreshOptions {
  pollMs?: number
  reingestSnapshots?: boolean
}

const DEFAULT_POLL_MS = 10_000

function isTerminal(job: ObsidianSyncJobSummary): boolean {
  return job.status !== "queued" && job.status !== "running"
}

function jobKey(job: ObsidianSyncJobSummary): string {
  return `${job.jobId}:${job.status}:${job.endedAt ?? ""}`
}

async function refreshKey(): Promise<string | null> {
  const [{ jobs }, vault] = await Promise.all([
    api.getObsidianSyncHistory(1),
    api.getVaultAutoRefreshStatus().catch(() => null),
  ])
  const latest = jobs.find(isTerminal)
  const syncKey = latest ? jobKey(latest) : "no-sync"
  const vaultKey = vault
    ? `${vault.lastRefreshedHead ?? "no-head"}:${vault.lastOrchestrationPushAt ?? "no-orchestration"}`
    : "no-vault"

  return `${syncKey}|${vaultKey}`
}

async function refreshDashboardCaches(reingestSnapshots: boolean): Promise<void> {
  await fetch("/api/dashboard/cache/invalidate", { method: "POST" }).catch(() => null)
  if (reingestSnapshots) {
    await api.reingestMigrationSnapshots().catch(() => null)
  }
}

export function useObsidianSyncRefresh(
  onRefresh: () => void | Promise<void>,
  options: SyncRefreshOptions = {},
): void {
  const pollMs = options.pollMs ?? DEFAULT_POLL_MS
  const reingestSnapshots = options.reingestSnapshots ?? false
  const onRefreshRef = useRef(onRefresh)
  const initialKeyRef = useRef<string | null>(null)

  useEffect(() => {
    onRefreshRef.current = onRefresh
  }, [onRefresh])

  useEffect(() => {
    let cancelled = false

    async function checkLatestSync(): Promise<void> {
      try {
        const latestKey = await refreshKey()
        if (cancelled) return
        if (!latestKey) return
        if (initialKeyRef.current === null) {
          initialKeyRef.current = latestKey
          return
        }

        if (latestKey !== initialKeyRef.current) {
          initialKeyRef.current = latestKey
          await refreshDashboardCaches(reingestSnapshots)
          if (!cancelled) await onRefreshRef.current()
        }
      } catch {
        // Sync polling is opportunistic; the page's normal load path owns errors.
      }
    }

    void checkLatestSync()
    const intervalId = window.setInterval(() => void checkLatestSync(), pollMs)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [pollMs, reingestSnapshots])
}
