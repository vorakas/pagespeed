import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  description?: string
  /**
   * Optional right-aligned slot for page-specific status, controls, or
   * filters. Pages that want page-scoped chrome on the right (toggles,
   * sync status, batch counts) pass them through this slot — the
   * header itself stays page-agnostic.
   */
  actions?: ReactNode
}

/**
 * Sticky title strip rendered at the top of every page's body. Title +
 * description on the left, optional `actions` slot on the right.
 *
 * The visual register (radii, shadows, type stack) is owned by the
 * `.beacon-header` class in `styles/aurora.css`. Class name is kept
 * across the component rename — the register is the cross-cutting
 * visual spec, the component is its mount point.
 *
 * Was named `BeaconHeader` during the prototype phase. Phase 3C of
 * the Aurora rollout renamed it to `PageHeader` for code clarity.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="beacon-header sticky top-0 z-30">
      <div className="flex items-center justify-between gap-6 px-6 py-3.5">
        <div className="min-w-0">
          <h1 className="beacon-header-title leading-tight">{title}</h1>
          {description && (
            <p className="beacon-header-description mt-0.5">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-3 shrink-0">{actions}</div>
        )}
      </div>
    </header>
  )
}
