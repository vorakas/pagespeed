import { useState } from "react"
import { Monitor, Smartphone } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { PageComparison } from "@/components/metrics/PageComparison"
import { HistoricalChart } from "@/components/metrics/HistoricalChart"
import type { Strategy } from "@/types"

export function Metrics() {
  const [strategy, setStrategy] = useState<Strategy>("desktop")

  const handleStrategyChange = (values: string[]) => {
    const value = values[0]
    if (value === "desktop" || value === "mobile") {
      setStrategy(value)
    }
  }

  return (
    <>
      <Header
        title="Performance Metrics"
        description="Historical performance data and comparisons"
        actions={
          <ToggleGroup
            value={[strategy]}
            onValueChange={handleStrategyChange}
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
        }
      />
      <div className="space-y-8 p-6">
        <PageComparison />
        <HistoricalChart strategy={strategy} />
      </div>
    </>
  )
}
