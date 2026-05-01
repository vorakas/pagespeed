import { useParams } from "react-router-dom"
import { BeaconLayout } from "../beacon-builds/BeaconLayout"
import { ProjectDashboardBody } from "@/pages/ProjectDashboard"

/**
 * Aurora-register port of the per-project dashboard (production
 * `/dashboard/projects/:key`). Mounts the existing
 * `<ProjectDashboardBody />` inside `BeaconLayout` with `register='aurora'`.
 *
 * The body retains its `LaunchShell` wrapper, so the `.launch-dashboard`
 * scope still resolves every `.lcc-*` rule and the page's many inline
 * `--lcc-*` token references re-skin via the legacy-token re-map under
 * `.beacon.aurora` in `aurora.css`.
 *
 * No sidebar entry exists for "Project Dashboard" — it's reached by
 * drilling into a project from Launch Dashboard. `activePath` is left
 * pointing at the parent Launch Dashboard so the closest sidebar item
 * stays highlighted while the user is inside a project view.
 */
export function PrototypeAuroraProjectDashboard() {
  const { key = "" } = useParams<{ key: string }>()
  const decoded = key ? decodeURIComponent(key) : ""
  return (
    <BeaconLayout
      title="Project Dashboard"
      description={decoded ? `Project: ${decoded}` : "Per-project view"}
      activePath="/dashboard"
      activeBuildCount={0}
      polling={false}
      lastSync={null}
      register="aurora"
    >
      <ProjectDashboardBody />
    </BeaconLayout>
  )
}
