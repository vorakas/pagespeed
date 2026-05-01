import { useState, useEffect, useCallback } from "react"
import { Header } from "@/components/layout/Header"
import { WorstPerformersSection } from "@/components/dashboard/WorstPerformersSection"
import { CwvReferenceSection } from "@/components/dashboard/CwvReferenceSection"
import { LighthouseExplanation } from "@/components/dashboard/LighthouseExplanation"
import type { Strategy, WorstPerformer } from "@/types"
import { api } from "@/services/api"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Monitor, Smartphone } from "lucide-react"

interface DashboardBodyProps {
  data: Record<string, WorstPerformer[]>
  loading: boolean
  error: string | null
}

/**
 * Pure body — props-driven. The Aurora prototype at
 * `/prototype/dashboard/aurora` reuses this body with its own copy of
 * the data-fetching effect, so the toggle can move out of the Header
 * actions slot (which BeaconHeader doesn't have) into the body itself.
 */
export function DashboardBody({ data, loading, error }: DashboardBodyProps) {
  return (
    <div className="space-y-8 p-6">
      <WorstPerformersSection data={data} loading={loading} error={error} />
      <CwvReferenceSection />
      <LighthouseExplanation />
    </div>
  )
}

/**
 * Reusable desktop/mobile toggle. Exported so the Aurora prototype can
 * render the same control inline above the body.
 */
export function DashboardStrategyToggle({
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

/**
 * Hook owning the worst-performers fetch keyed by strategy. Both the
 * production wrapper and the Aurora prototype call this so the data
 * lifecycle stays in one place.
 */
export function useWorstPerformersByStrategy(strategy: Strategy) {
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

  return { data, loading, error }
}

export function Dashboard() {
  const [strategy, setStrategy] = useState<Strategy>("desktop")
  const { data, loading, error } = useWorstPerformersByStrategy(strategy)
  return (
    <>
      <Header
        title="Dashboard"
        description="Monitor and compare website performance over time"
        actions={
          <DashboardStrategyToggle strategy={strategy} onStrategyChange={setStrategy} />
        }
      />
      <DashboardBody data={data} loading={loading} error={error} />
    </>
  )
}
