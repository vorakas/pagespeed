import { BeaconLayout } from "../beacon-builds/BeaconLayout"
import { LoadTestingBody } from "@/pages/LoadTesting"

/**
 * Aurora-register port of the Load Testing page. Renders the production
 * `<LoadTestingBody />` (real BlazeMeter API + state + handlers) inside
 * `BeaconLayout` with `register='aurora'`. The Body is unchanged — its
 * shadcn primitives (Card, Table, Select, Badge, Button) inherit Aurora
 * tokens via the shadcn variable overrides in `aurora.css`. No legacy
 * `aurora-*` classes are used on this page, so the legacy token re-map
 * doesn't come into play.
 */
export function PrototypeAuroraLoadTesting() {
  return (
    <BeaconLayout
      title="Load Testing"
      description="Queue and orchestrate BlazeMeter load tests sequentially"
      activePath="/load-testing"
      register="aurora"
    >
      <LoadTestingBody />
    </BeaconLayout>
  )
}
