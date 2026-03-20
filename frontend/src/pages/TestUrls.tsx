import { Header } from "@/components/layout/Header"

export function TestUrls() {
  return (
    <>
      <Header
        title="Test URLs"
        description="Run PageSpeed tests on monitored URLs"
      />
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          Test URLs — Phase 3
        </div>
      </div>
    </>
  )
}
