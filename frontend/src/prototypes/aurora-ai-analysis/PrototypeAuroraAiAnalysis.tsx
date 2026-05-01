import { BeaconLayout } from "../beacon-builds/BeaconLayout"
import { AiAnalysisBody } from "@/pages/AiAnalysis"

/**
 * Aurora-register port of the AI Analysis page. Renders the production
 * `<AiAnalysisBody />` (parallel Claude + OpenAI orchestration, follow-up
 * conversations, NR / Azure data sourcing) inside `BeaconLayout` with
 * `register='aurora'`. Body uses legacy `aurora-*` classes + inline
 * `var(--lcc-*)` references — both inherit Aurora colors via the
 * legacy-token re-map in `aurora.css`. No new CSS needed.
 */
export function PrototypeAuroraAiAnalysis() {
  return (
    <BeaconLayout
      title="AI Analysis"
      description="AI-powered performance analysis"
      activePath="/ai-analysis"
      activeBuildCount={0}
      polling={false}
      lastSync={null}
      register="aurora"
    >
      <AiAnalysisBody />
    </BeaconLayout>
  )
}
