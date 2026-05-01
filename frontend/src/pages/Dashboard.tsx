import { useState, useEffect, useCallback } from "react"
import { PageHeader } from "@/components/layout/PageHeader"
import { WorstPerformersSection } from "@/components/dashboard/WorstPerformersSection"
import { CwvReferenceSection } from "@/components/dashboard/CwvReferenceSection"
import { LighthouseExplanation } from "@/components/dashboard/LighthouseExplanation"
import type { Strategy, WorstPerformer } from "@/types"
import { api } from "@/services/api"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Monitor, Smartphone } from "lucide-react"

/**
 * Desktop / mobile toggle rendered as the Dashboard's header actions.
 * Internal helper — kept as its own component so the toggle markup
 * stays out of the page-level return.
 */
function StrategyToggle({
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

export function Dashboard() {
  const [strategy, setStrategy] = useState<Strategy>("desktop")
  const [data, setData] = useState<Record<string, WorstPerformer[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (selectedStrategy: Strategy) => {
    setLoading(true)
    setError(null)
    try {
      const results = await api.getWorstPerforming(selectedStrategy, 5)
      setData(results)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load results")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData(strategy)
  }, [strategy, loadData])

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Monitor and compare website performance over time"
        actions={
          <StrategyToggle strategy={strategy} onStrategyChange={setStrategy} />
        }
      />
      <div className="space-y-8 p-6">
        <WorstPerformersSection data={data} loading={loading} error={error} />
        <CwvReferenceSection />
        <LighthouseExplanation />
      </div>
    </>
  )
}
