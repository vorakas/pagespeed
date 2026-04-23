import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import type { MigrationWorkstream } from "@/types"

interface WorkstreamRailProps {
  workstreams: MigrationWorkstream[] | null
  activeId: string
}

/**
 * Sticky left rail for the workstream detail page.
 *
 * Shows the currently-selected workstream's at-a-glance counts at the top,
 * then lists every workstream the dashboard knows about, grouped by ``area``.
 * Clicking a row navigates to ``/dashboard/workstreams/<id>`` so the user
 * can jump between workstreams without going back to the launch dashboard.
 *
 * Mirrors the handoff design's ``WsLeftRail`` (handoff/design/workstream.jsx).
 */
export function WorkstreamRail({ workstreams, activeId }: WorkstreamRailProps) {
  const navigate = useNavigate()

  const groups = useMemo(() => {
    const byArea: Record<string, MigrationWorkstream[]> = {}
    for (const ws of workstreams ?? []) {
      const area = resolveArea(ws)
      ;(byArea[area] ||= []).push(ws)
    }
    // Sort workstream rows within each area alphabetically for readability.
    for (const key of Object.keys(byArea)) {
      byArea[key].sort((a, b) => a.name.localeCompare(b.name))
    }
    // Canonical area ordering matches the handoff sidebar (by product area),
    // with any unknown buckets appended alphabetically at the end.
    const knownOrder = [
      "Storefront",
      "Checkout",
      "Data & Infra",
      "EDS",
      "User & Account",
      "Integrations",
      "Post-Launch",
      "QA",
      "Other",
    ]
    const entries = Object.entries(byArea)
    entries.sort(([a], [b]) => {
      const ai = knownOrder.indexOf(a)
      const bi = knownOrder.indexOf(b)
      if (ai >= 0 && bi >= 0) return ai - bi
      if (ai >= 0) return -1
      if (bi >= 0) return 1
      return a.localeCompare(b)
    })
    return entries
  }, [workstreams])

  const active = workstreams?.find((w) => w.id === activeId) ?? null

  return (
    // This page has no Launch Dashboard topbar, so override the default
    // sticky offset that the shared `.lcc-left-rail` class inherits
    // (`top: calc(--lcc-topbar-h + 14px)` = 74px) to align with the
    // outer Pharos sidebar.
    <aside className="lcc-left-rail" style={{ top: 14, maxHeight: "calc(100vh - 28px)" }}>
      <div className="lcc-lr-section">
        <div className="lcc-lr-label">Selected workstream</div>
        <div className="lcc-lr-stat">
          <div className="lcc-lr-stat-num" style={{ fontSize: 18, lineHeight: 1.2 }}>
            {active?.name || "—"}
          </div>
          <div className="lcc-lr-stat-sub">{active?.area || ""}</div>
        </div>
        {active && (
          <>
            <div className="lcc-lr-stat-row">
              <div className="lcc-lr-stat-mini">
                <div className="v">{active.tasks}</div>
                <div className="l">Tasks</div>
              </div>
              <div className="lcc-lr-stat-mini" data-tone="green">
                <div className="v">{active.closed}</div>
                <div className="l">Closed</div>
              </div>
            </div>
            <div className="lcc-lr-stat-row">
              <div className="lcc-lr-stat-mini" data-tone="red">
                <div className="v">{active.failedQa}</div>
                <div className="l">Failed QA</div>
              </div>
              <div className="lcc-lr-stat-mini" data-tone="amber">
                <div className="v">{active.blockedCount}</div>
                <div className="l">Blocked</div>
              </div>
            </div>
          </>
        )}
      </div>

      {groups.map(([area, list]) => (
        <div className="lcc-lr-section" key={area}>
          <div className="lcc-lr-label">{area}</div>
          {list.map((w) => {
            const isActive = w.id === activeId
            return (
              <button
                key={w.id}
                type="button"
                className={`lcc-lr-area${isActive ? " active" : ""}`}
                onClick={() => navigate(`/dashboard/workstreams/${w.id}`)}
                title={w.name}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: statusDot(w.status),
                    boxShadow: `0 0 6px ${statusDot(w.status)}`,
                    flex: "0 0 auto",
                  }}
                />
                <span className="lcc-lr-area-name" style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {w.name}
                </span>
                <span className="lcc-lr-area-meta">
                  {w.blockedCount > 0 && <span className="lcc-lr-area-risk">{w.blockedCount}</span>}
                  <span className="lcc-lr-area-count">{w.tasks}</span>
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </aside>
  )
}

// Fallback area map for workstreams whose status page hasn't assigned a
// product area yet. Keeps the rail usable even when the vault's Project
// Health by Area table is sparse (common after a fresh sync — the table
// typically only lists the workstreams the editor called out this week).
const AREA_FALLBACK: Record<string, string> = {
  "ws-pdp": "Storefront",
  "ws-plp": "Storefront",
  "ws-homepage-navigation": "Storefront",
  "ws-cms": "Storefront",
  "ws-other-pages-cms": "Storefront",
  "ws-checkout": "Checkout",
  "ws-cart": "Checkout",
  "ws-payments": "Checkout",
  "ws-payments-card-swipe": "Checkout",
  "ws-data-platform": "Data & Infra",
  "ws-tealium-tags": "Data & Infra",
  "ws-infrastructure": "Data & Infra",
  "ws-infrastructure-ci": "Data & Infra",
  "ws-eds": "EDS",
  "ws-app-builder": "EDS",
  "ws-commerce-implementation": "EDS",
  "ws-bloomreach-feed": "EDS",
  "ws-wish-list": "User & Account",
  "ws-user-management": "User & Account",
  "ws-privacy-compliance": "User & Account",
  "ws-integrations": "Integrations",
  "ws-pixels-analytics": "Integrations",
  "ws-gift-card": "Integrations",
  "ws-email-communications": "Integrations",
  "ws-dynamic-yield": "Integrations",
  "ws-managed-services": "Post-Launch",
  "ws-new-epics": "Post-Launch",
}

function resolveArea(ws: MigrationWorkstream): string {
  if (ws.area && ws.area.trim()) return ws.area.trim()
  return AREA_FALLBACK[ws.id] || "Other"
}

function statusDot(status: string | null | undefined): string {
  switch ((status || "").toLowerCase()) {
    case "blocked":
    case "off-track":
    case "at-risk":
      return "var(--lcc-red)"
    case "in-progress":
      return "var(--lcc-blue)"
    case "near-complete":
    case "on-track":
    case "improving":
      return "var(--lcc-green)"
    default:
      return "rgba(255,255,255,0.3)"
  }
}
