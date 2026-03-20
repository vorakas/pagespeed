import { Header } from "@/components/layout/Header"

export function NewRelic() {
  return (
    <>
      <Header
        title="New Relic"
        description="Core Web Vitals and APM metrics"
      />
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          New Relic — Phase 5
        </div>
      </div>
    </>
  )
}
