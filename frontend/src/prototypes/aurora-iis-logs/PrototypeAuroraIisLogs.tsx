import { BeaconLayout } from "../beacon-builds/BeaconLayout"
import { IisLogsBody } from "@/pages/IisLogs"

/**
 * Aurora-register port of the IIS Logs page. Renders the production
 * `<IisLogsBody />` (Azure Log Analytics + KQL queries + dashboard
 * summary) inside `BeaconLayout` with `register='aurora'`. All four
 * sub-panels (AzureConfigPanel, LogSearchPanel, DashboardSummary,
 * KqlQueryPanel) use legacy `aurora-*` classes that inherit Aurora
 * colors via the legacy-token re-map in `aurora.css` — no new CSS.
 *
 * Like the BlazeMeter Load Testing page, the configured-state UI
 * (search results, KQL output, dashboard cards) only renders when the
 * Azure tenant/client/workspace creds are populated in localStorage.
 * Local dev typically shows just the AzureConfigPanel.
 */
export function PrototypeAuroraIisLogs() {
  return (
    <BeaconLayout
      title="IIS Logs"
      description="Azure Log Analytics and KQL queries"
      activePath="/iislogs"
      activeBuildCount={0}
      polling={false}
      lastSync={null}
      register="aurora"
    >
      <IisLogsBody />
    </BeaconLayout>
  )
}
