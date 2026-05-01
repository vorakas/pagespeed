import type { ReactNode } from "react"
import "@/styles/aurora-glass.css"

type Theme = "dark" | "light"
type Palette = "traffic" | "muted" | "mono"
type Density = "compact" | "normal" | "roomy"

interface LaunchShellProps {
  children: ReactNode
  theme?: Theme
  palette?: Palette
  density?: Density
}

/**
 * Page-scoped wrapper for the Launch Command Center cluster
 * (`/dashboard`, `/dashboard/history`, `/dashboard/workstreams/:id`,
 * `/dashboard/projects/:key`).
 *
 * Carries two responsibilities:
 *
 *   1. Applies the `.launch-dashboard` class so all the
 *      `.launch-dashboard .lcc-*` rules in `aurora-glass.css` resolve.
 *      Every panel, chip, dot, sticky rail, and inline `--lcc-*` token
 *      reference inside the cluster depends on this scope.
 *   2. Forwards `data-theme`, `data-palette`, `data-density` attributes
 *      so the cluster's CSS can pick up palette / density variants.
 *
 * Phase 2 of the Aurora rollout removed an obsolete `useEffect` that
 * stripped the legacy AppLayout main's padding to let the dashboard
 * bleed edge-to-edge. The new BeaconLayout main has no padding to
 * strip, so the effect was a no-op — deleted.
 */
export function LaunchShell({
  children,
  theme = "dark",
  palette = "traffic",
  density = "normal",
}: LaunchShellProps) {
  return (
    <div
      className="launch-dashboard"
      data-theme={theme}
      data-palette={palette}
      data-density={density}
    >
      {children}
    </div>
  )
}
