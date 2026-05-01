import type { ReactNode } from "react"

interface BeaconHeaderProps {
  title: string
  description?: string
  /**
   * Optional right-aligned slot for page-specific status, controls, or
   * filters. Replaces the Builds-specific ACTIVE/POLLING/LAST_SYNC
   * triplet that used to live here — pages that want those stats now
   * render their own block and pass it through this slot, keeping the
   * header itself page-agnostic.
   */
  actions?: ReactNode
}

/**
 * Application header — sticky title strip rendered above page bodies.
 * Page-agnostic: title + description on the left, optional `actions`
 * slot on the right. The visual register (radii, shadows, type stack)
 * is owned by `aurora-glass.css`'s `.beacon-header` class, scoped to
 * either the prototype shell or the production AppLayout depending on
 * where this is mounted.
 */
export function BeaconHeader({ title, description, actions }: BeaconHeaderProps) {
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
