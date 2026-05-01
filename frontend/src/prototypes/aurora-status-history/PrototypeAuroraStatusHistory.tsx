import { BeaconLayout } from "../beacon-builds/BeaconLayout"
import { StatusHistoryBody } from "@/pages/StatusHistory"

/**
 * Aurora-register port of the Status History page (production
 * `/dashboard/history`). Mounts the existing `<StatusHistoryBody />`
 * inside `BeaconLayout` with `register='aurora'`.
 *
 * The body retains its `LaunchShell` wrapper, so the `.launch-dashboard`
 * scope still resolves every `.lcc-*` rule. Inline styles on the page
 * read `--lcc-text`, `--lcc-text-dim`, `--lcc-text-faint`, `--lcc-red`,
 * `--lcc-amber`, `--lcc-green`, `--lcc-blue`, `--lcc-violet`, `--lcc-*-bg`,
 * and `--lcc-glass-border` — all re-pointed at the lifted-card register
 * by the legacy-token re-map under `.beacon.aurora` in `aurora.css`.
 *
 * The active filter pill in this page is rendered via inline
 * `linear-gradient(135deg, var(--lcc-violet), var(--lcc-blue))` plus a
 * `box-shadow: 0 0 14px rgba(176,140,255,0.4)` violet glow. Under the
 * Aurora register `--lcc-violet` becomes periwinkle blue (#7cb0ff), so
 * the gradient stays cool and on-palette; the hard-coded violet halo
 * is decorative and remains slightly off-register, but it's a single
 * inline style and not worth a non-slop substitution this pass.
 */
export function PrototypeAuroraStatusHistory() {
  return (
    <BeaconLayout
      title="Status History"
      description="Day-over-day snapshot deltas across the migration"
      activePath="/dashboard/history"
      activeBuildCount={0}
      polling={false}
      lastSync={null}
      register="aurora"
    >
      <StatusHistoryBody />
    </BeaconLayout>
  )
}
