import { useEffect, useMemo, useState } from "react"
import { marked } from "marked"
import { api } from "@/services/api"
import type {
  MigrationBlocker,
  MigrationWorkstream,
  MigrationWorkstreamDetail,
  ObsidianVaultPage,
  RawTaskRecord,
} from "@/types"

export type SidePanelTarget =
  | { kind: "workstream"; workstream: MigrationWorkstream }
  | { kind: "blocker"; blocker: MigrationBlocker }
  | { kind: "task"; task: RawTaskRecord }

interface SidePanelProps {
  target: SidePanelTarget | null
  onClose: () => void
}

/**
 * Slide-in drawer anchored to the right edge. When a workstream is
 * selected, fetches /api/dashboard/workstream/:id for blockers +
 * critical tasks. Blockers and task targets render without an extra
 * round-trip.
 */
export function SidePanel({ target, onClose }: SidePanelProps) {
  const [detail, setDetail] = useState<MigrationWorkstreamDetail | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setDetail(null)
    if (target?.kind !== "workstream") return
    const id = target.workstream.id
    setLoading(true)
    void api
      .getMigrationWorkstreamDetail(id)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false))
  }, [target])

  // Close on Escape
  useEffect(() => {
    if (!target) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [target, onClose])

  if (!target) {
    return (
      <>
        <div className="launch-dashboard-panel-backdrop" onClick={onClose} />
        <aside className="launch-dashboard-side-panel" aria-hidden="true" />
      </>
    )
  }

  return (
    <>
      <div className="launch-dashboard-panel-backdrop open" onClick={onClose} />
      <aside className="launch-dashboard-side-panel open" role="dialog" aria-modal="true">
        {target.kind === "workstream" && (
          <WorkstreamDetail ws={target.workstream} detail={detail} loading={loading} onClose={onClose} />
        )}
        {target.kind === "blocker" && (
          <BlockerDetail blocker={target.blocker} onClose={onClose} />
        )}
        {target.kind === "task" && <TaskDetail task={target.task} onClose={onClose} />}
      </aside>
    </>
  )
}

function WorkstreamDetail({
  ws,
  detail,
  loading,
  onClose,
}: {
  ws: MigrationWorkstream
  detail: MigrationWorkstreamDetail | null
  loading: boolean
  onClose: () => void
}) {
  return (
    <>
      <div className="sp-head">
        <div>
          <div className="sp-area">
            {ws.area ?? "Unsorted"} · {ws.id}
          </div>
          <div className="sp-title">{ws.name}</div>
          {ws.status && (
            <div style={{ marginTop: 6 }}>
              <span className="lcc-health-badge" data-health={ws.status}>
                {ws.status}
              </span>
            </div>
          )}
        </div>
        <button type="button" className="sp-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="sp-body">
        <div className="sp-stats">
          <div className="sp-stat">
            <div className="v">{ws.tasks.toLocaleString()}</div>
            <div className="l">Total</div>
          </div>
          <div className="sp-stat" data-tone="green">
            <div className="v">{ws.closed.toLocaleString()}</div>
            <div className="l">Closed</div>
          </div>
          <div className="sp-stat" data-tone="red">
            <div className="v">{ws.failedQa.toLocaleString()}</div>
            <div className="l">Failed QA</div>
          </div>
          <div className="sp-stat" data-tone="amber">
            <div className="v">{ws.blockers.length}</div>
            <div className="l">Blockers</div>
          </div>
        </div>
        {ws.note && <div className="sp-summary">{ws.note}</div>}

        {loading && <div style={{ color: "var(--lcc-text-faint)", fontSize: 12 }}>Loading detail…</div>}
        {detail && (
          <>
            {detail.blockers.length > 0 && (
              <>
                <h4>Blockers</h4>
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 6 }}>
                  {detail.blockers.map((b) => (
                    <li key={b.id} style={{ fontSize: 12 }}>
                      <span className="lcc-chip" data-severity={b.severity ?? undefined}>
                        {b.severity ?? "—"}
                      </span>{" "}
                      <strong>{b.name}</strong>
                      {b.note && (
                        <span style={{ color: "var(--lcc-text-dim)" }}> — {b.note}</span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {detail.criticalTasks.length > 0 && (
              <>
                <h4>
                  Critical tasks{" "}
                  <span style={{ color: "var(--lcc-text-dim)", fontFamily: "var(--font-mono)", letterSpacing: 0, textTransform: "none" }}>
                    {detail.criticalTasks.length} of {detail.referencedKeyCount} referenced
                  </span>
                </h4>
                <table className="t">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Summary</th>
                      <th>Status</th>
                      <th>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.criticalTasks.map((t) => (
                      <tr key={t.relPath}>
                        <td>
                          {t.url ? (
                            <a href={t.url} target="_blank" rel="noreferrer" className="id">
                              {t.key}
                            </a>
                          ) : (
                            <span className="id">{t.key}</span>
                          )}
                        </td>
                        <td>{t.summary ?? "—"}</td>
                        <td>{t.status ?? t.taskStatus ?? "—"}</td>
                        <td>{t.priority ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}

function BlockerDetail({ blocker, onClose }: { blocker: MigrationBlocker; onClose: () => void }) {
  const relPath = blocker.relPath ?? `wiki/blocker-${blocker.id}.md`
  return (
    <>
      <div className="sp-head">
        <div>
          <div className="sp-area">Blocker · {blocker.id}</div>
          <div className="sp-title">{blocker.name}</div>
          {blocker.severity && (
            <div style={{ marginTop: 6 }}>
              <span className="lcc-chip" data-severity={blocker.severity}>
                {blocker.severity}
              </span>
            </div>
          )}
        </div>
        <button type="button" className="sp-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="sp-body">
        {blocker.note && <div className="sp-summary">{blocker.note}</div>}
        <h4>Affects</h4>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 4 }}>
          {blocker.affects.length === 0 && <li style={{ color: "var(--lcc-text-faint)", fontSize: 12 }}>No linked workstreams.</li>}
          {blocker.affects.map((target) => (
            <li key={target} style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--lcc-text-dim)" }}>
              {target}
            </li>
          ))}
        </ul>
        <VaultPageSection relPath={relPath} />
      </div>
    </>
  )
}

function TaskDetail({ task, onClose }: { task: RawTaskRecord; onClose: () => void }) {
  const title = task.summary ?? task.key
  return (
    <>
      <div className="sp-head">
        <div>
          <div className="sp-area">
            {task.source} · {task.project}
          </div>
          <div className="sp-title">
            {task.key}: {title}
          </div>
        </div>
        <button type="button" className="sp-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="sp-body">
        <div className="sp-stats">
          <div className="sp-stat">
            <div className="v">{task.status ?? "—"}</div>
            <div className="l">Status</div>
          </div>
          <div className="sp-stat" data-tone="amber">
            <div className="v">{task.priority ?? "—"}</div>
            <div className="l">Priority</div>
          </div>
          {task.uatStatus && (
            <div className="sp-stat" data-tone="red">
              <div className="v" style={{ fontSize: 13 }}>{task.uatStatus}</div>
              <div className="l">UAT</div>
            </div>
          )}
          <div className="sp-stat">
            <div className="v" style={{ fontSize: 13 }}>{task.assignee ?? "Unassigned"}</div>
            <div className="l">Assignee</div>
          </div>
        </div>
        {task.url && (
          <>
            <h4>Source</h4>
            <a href={task.url} target="_blank" rel="noreferrer" style={{ color: "var(--lcc-blue)", fontSize: 12, wordBreak: "break-all" }}>
              {task.url}
            </a>
          </>
        )}
        {task.relPath && <VaultPageSection relPath={task.relPath} />}
      </div>
    </>
  )
}

function VaultPageSection({ relPath }: { relPath: string }) {
  const [page, setPage] = useState<ObsidianVaultPage | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setPage(null)
    setError(null)
    setLoading(true)
    void api
      .getObsidianVaultPage(relPath)
      .then((res) => {
        if (!cancelled) setPage(res.page)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load page")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [relPath])

  const html = useMemo(() => {
    if (!page) return ""
    return marked.parse(page.body, { async: false }) as string
  }, [page])

  return (
    <>
      <h4 style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span>Vault page</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 400,
            letterSpacing: 0,
            textTransform: "none",
            color: "var(--lcc-text-faint)",
          }}
        >
          {relPath}
        </span>
      </h4>
      {loading && (
        <div style={{ color: "var(--lcc-text-faint)", fontSize: 12 }}>Loading…</div>
      )}
      {error && (
        <div style={{ color: "var(--lcc-red)", fontSize: 12 }}>{error}</div>
      )}
      {page && (
        <div
          className="sp-vault-md"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </>
  )
}
