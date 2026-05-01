import { BeaconLayout } from "../beacon-builds/BeaconLayout"
import { LaunchDashboardBody } from "@/pages/LaunchDashboard"

/**
 * Aurora-register port of the Launch Command Center (production
 * `/dashboard`). Mounts the existing `<LaunchDashboardBody />` inside
 * `BeaconLayout` with `register='aurora'`.
 *
 * No component fork. The body retains its `LaunchShell` wrapper, which
 * keeps the `.launch-dashboard` scope all the `.lcc-*` styles in
 * `aurora-glass.css` depend on. The legacy `--lcc-*` and `--glass-*`
 * tokens get re-pointed at the lifted-card register under `.beacon.aurora`
 * (see `aurora.css`), so every panel, chip, dot, and sticky rail picks
 * up the new palette and depth model — the slop tactics (animated drift
 * blobs, backdrop-filter blur, gradient text) are stripped, while the
 * hue / radii / type stack remain faithful to Claude Design's handoff.
 *
 * `LaunchShell`'s padding-strip useEffect targets the AppLayout main
 * (`main.ml-[232px]`) and silently no-ops here, since BeaconLayout's
 * main is `main.beacon-main.ml-[208px]`. The dashboard sits inside the
 * 12px BeaconLayout frame, mirroring the other ported pages.
 */
export function PrototypeAuroraLaunchDashboard() {
  return (
    <BeaconLayout
      title="Launch Dashboard"
      description="Adobe Commerce migration command center"
      activePath="/dashboard"
      activeBuildCount={0}
      polling={false}
      lastSync={null}
      register="aurora"
    >
      <LaunchDashboardBody />
    </BeaconLayout>
  )
}
