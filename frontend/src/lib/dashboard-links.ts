/**
 * Centralized path builders for the Launch Dashboard cluster.
 *
 * Was previously a `useDashboardLinks()` hook that detected prototype
 * context from `useLocation()` and rewrote targets to the matching
 * `/prototype/...` route. Phase 2C of the Aurora rollout deleted the
 * prototype routes — production and prototype URLs collapsed into a
 * single set, so detection and rewriting are no longer needed.
 *
 * Kept as a tiny module of pure functions (rather than inlining the
 * template strings everywhere) so a future move of the migration
 * cluster to a different URL prefix lands in one place. The signatures
 * match the previous hook's shape so consumers didn't have to change
 * call sites — they simply stopped reading from `useLocation` under
 * the hood.
 *
 * SOLID — Single Responsibility: this module only translates IDs to
 * paths; it does not navigate, render, or mutate.
 */

const PROJECT_ROUTE = "/dashboard/projects"
const WORKSTREAM_ROUTE = "/dashboard/workstreams"
const LAUNCH_ROUTE = "/dashboard"

export interface DashboardLinks {
  projectPath: (key: string) => string
  workstreamPath: (id: string) => string
  launchDashboardPath: (hash?: string) => string
}

const LINKS: DashboardLinks = {
  projectPath: (key) => `${PROJECT_ROUTE}/${encodeURIComponent(key)}`,
  workstreamPath: (id) => `${WORKSTREAM_ROUTE}/${id}`,
  launchDashboardPath: (hash) =>
    hash ? `${LAUNCH_ROUTE}#${hash}` : LAUNCH_ROUTE,
}

/**
 * Returns path builders for project / workstream / launch-dashboard
 * routes. Stable identity across renders — safe to destructure inside
 * effects and useCallback deps.
 */
export function useDashboardLinks(): DashboardLinks {
  return LINKS
}
