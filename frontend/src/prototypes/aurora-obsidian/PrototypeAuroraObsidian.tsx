import { BeaconLayout } from "../beacon-builds/BeaconLayout"
import { ObsidianBody } from "@/pages/Obsidian"

/**
 * Aurora-register port of the Obsidian Bridge page. Renders the
 * production `<ObsidianBody />` (real Jira + Asana sync, log streaming,
 * vault tree, page preview) inside `BeaconLayout` with `register='aurora'`.
 *
 * The body uses raw shadcn primitives (`bg-card`, `text-muted-foreground`,
 * `border-destructive/40`, etc.), all of which inherit Aurora colors via
 * the shadcn-token overrides in `aurora.css`. No additional CSS needed.
 */
export function PrototypeAuroraObsidian() {
  return (
    <BeaconLayout
      title="Obsidian Bridge"
      description="Sync Jira and Asana into the LLM-maintained Adobe Commerce migration vault"
      activePath="/obsidian"
      register="aurora"
    >
      <ObsidianBody />
    </BeaconLayout>
  )
}
