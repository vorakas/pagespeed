import { useState } from "react"
import { Monitor, Smartphone } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PageComparison } from "@/components/metrics/PageComparison"
import { HistoricalChart } from "@/components/metrics/HistoricalChart"
import type { Strategy } from "@/types"

/**
 * Pure body — takes the desktop/mobile strategy as a prop. The
 * production page keeps `strategy` state in the wrapper so the toggle
 * can live in the production `<Header actions={...}>` slot. The Aurora
 * prototype at `/prototype/metrics/aurora` owns its own copy of state
 * and renders the toggle inline above the body, since `BeaconHeader`
 * doesn't accept an actions slot.
 */
export function MetricsBody({ strategy }: { strategy: Strategy }) {
  return (
    <div className="space-y-8 p-6">
      <PageComparison />
      <HistoricalChart strategy={strategy} />
    </div>
  )
}

/**
 * Reusable desktop/mobile toggle — exported so the Aurora prototype
 * can render the same control inline above the body.
 */
export function MetricsStrategyToggle({
  strategy,
  onStrategyChange,
}: {
  strategy: Strategy
  onStrategyChange: (s: Strategy) => void
}) {
  const handleChange = (values: string[]) => {
    const value = values[0]
    if (value === "desktop" || value === "mobile") onStrategyChange(value)
  }
  return (
    <ToggleGroup
      value={[strategy]}
      onValueChange={handleChange}
      className="bg-muted rounded-lg p-0.5"
    >
      <ToggleGroupItem
        value="desktop"
        aria-label="Desktop"
        className="gap-1.5 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        <Monitor size={14} />
        Desktop
      </ToggleGroupItem>
      <ToggleGroupItem
        value="mobile"
        aria-label="Mobile"
        className="gap-1.5 px-3 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
      >
        <Smartphone size={14} />
        Mobile
      </ToggleGroupItem>
    </ToggleGroup>
  )
}

export function Metrics() {
  const [strategy, setStrategy] = useState<Strategy>("desktop")
  return (
    <>
      <Header
        title="Performance Metrics"
        description="Historical performance data and comparisons"
        actions={
          <MetricsStrategyToggle strategy={strategy} onStrategyChange={setStrategy} />
        }
      />
      <MetricsBody strategy={strategy} />
    </>
  )
}
