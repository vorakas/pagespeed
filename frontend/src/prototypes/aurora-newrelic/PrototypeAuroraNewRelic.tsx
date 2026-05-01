import { BeaconLayout } from "../beacon-builds/BeaconLayout"
import { NewRelicBody } from "@/pages/NewRelic"

/**
 * Aurora-register port of the New Relic page. Renders the production
 * `<NewRelicBody />` (CWV percentiles, performance overview, APM metrics
 * tabs, custom NerdGraph query) inside `BeaconLayout` with
 * `register='aurora'`. All five sub-panels lean on legacy `aurora-*`
 * classes — skinned automatically by the legacy-token re-map under
 * `.beacon.aurora`. No new CSS.
 *
 * Configured-state UI requires New Relic API key + account ID + app
 * name in localStorage; verify on Railway production where they are set.
 */
export function PrototypeAuroraNewRelic() {
  return (
    <BeaconLayout
      title="New Relic"
      description="Core Web Vitals and APM metrics"
      activePath="/newrelic"
      register="aurora"
    >
      <NewRelicBody />
    </BeaconLayout>
  )
}
