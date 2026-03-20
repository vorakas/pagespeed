import { Header } from "@/components/layout/Header"

export function IisLogs() {
  return (
    <>
      <Header
        title="IIS Logs"
        description="Azure Log Analytics and KQL queries"
      />
      <div className="p-6">
        <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
          IIS Logs — Phase 7
        </div>
      </div>
    </>
  )
}
