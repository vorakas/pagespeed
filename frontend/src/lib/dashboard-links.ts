import { useLocation } from "react-router-dom"

/**
 * In-page navigation helper for the Launch Dashboard cluster.
 *
 * When the user is viewing the Aurora prototype shell (any path under
 * `/prototype/`), in-page links to projects and workstreams must route
 * to the prototype-shell variants instead of the production paths —
 * otherwise clicking a project in the LeftRail or a workstream chip in
 * the SidePanel boots the user out of the prototype mid-session.
 *
 * SOLID — Single Responsibility: this hook only translates resource
 * IDs into paths; it does not navigate, render, or mutate. Each
 * consumer reads the appropriate `*Path()` builder and feeds it into
 * `<Link to=…>` or `navigate(…)`.
 *
 * Detection is via `useLocation().pathname` — no provider, no prop
 * threading. Callers that don't live under a `BrowserRouter` would
 * crash; every consumer here is mounted within `App.tsx`'s router.
 */
export interface DashboardLinks {
  /** Path to the per-project dashboard for a given project key. */
  projectPath: (key: string) => string
  /** Path to the workstream-detail view for a given workstream id. */
  workstreamPath: (id: string) => string
  /** Path to the Launch Dashboard root (with optional hash). */
  launchDashboardPath: (hash?: string) => string
}

const PROTOTYPE_PROJECT_ROUTE = "/prototype/dashboard-project/aurora"
const PROTOTYPE_WORKSTREAM_ROUTE = "/prototype/dashboard-workstream/aurora"
const PROTOTYPE_LAUNCH_ROUTE = "/prototype/dashboard-launch/aurora"

const PRODUCTION_PROJECT_ROUTE = "/dashboard/projects"
const PRODUCTION_WORKSTREAM_ROUTE = "/dashboard/workstreams"
const PRODUCTION_LAUNCH_ROUTE = "/dashboard"

export function useDashboardLinks(): DashboardLinks {
  const { pathname } = useLocation()
  const inPrototype = pathname.startsWith("/prototype/")

  if (inPrototype) {
    return {
      projectPath: (key) =>
        `${PROTOTYPE_PROJECT_ROUTE}/${encodeURIComponent(key)}`,
      workstreamPath: (id) => `${PROTOTYPE_WORKSTREAM_ROUTE}/${id}`,
      launchDashboardPath: (hash) =>
        hash ? `${PROTOTYPE_LAUNCH_ROUTE}#${hash}` : PROTOTYPE_LAUNCH_ROUTE,
    }
  }

  return {
    projectPath: (key) =>
      `${PRODUCTION_PROJECT_ROUTE}/${encodeURIComponent(key)}`,
    workstreamPath: (id) => `${PRODUCTION_WORKSTREAM_ROUTE}/${id}`,
    launchDashboardPath: (hash) =>
      hash ? `${PRODUCTION_LAUNCH_ROUTE}#${hash}` : PRODUCTION_LAUNCH_ROUTE,
  }
}
