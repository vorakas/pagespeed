import { useParams } from "react-router-dom"
import { BeaconLayout } from "../beacon-builds/BeaconLayout"
import { WorkstreamDetailBody } from "@/pages/WorkstreamDetail"

/**
 * Aurora-register port of the Workstream Detail page (production
 * `/dashboard/workstreams/:id`). Mounts the existing
 * `<WorkstreamDetailBody />` inside `BeaconLayout` with `register='aurora'`.
 *
 * The body retains its `LaunchShell` wrapper, so the `.launch-dashboard`
 * scope still resolves every `.lcc-*` rule and the page's many inline
 * `--lcc-*` token references re-skin via the legacy-token re-map under
 * `.beacon.aurora` in `aurora.css`.
 *
 * `activePath="/dashboard/workstreams/ws-data-platform"` matches the
 * sidebar's "Workstreams" nav item exactly so the active indicator
 * lights up regardless of which workstream id the route resolves to —
 * the sidebar item points at one canonical workstream but the page
 * accepts any id via `useParams`.
 */
export function PrototypeAuroraWorkstreamDetail() {
  const { id = "" } = useParams<{ id: string }>()
  return (
    <BeaconLayout
      title="Workstream Detail"
      description={id ? `Workstream: ${id}` : "Workstream view"}
      activePath="/dashboard/workstreams/ws-data-platform"
      activeBuildCount={0}
      polling={false}
      lastSync={null}
      register="aurora"
    >
      <WorkstreamDetailBody />
    </BeaconLayout>
  )
}
