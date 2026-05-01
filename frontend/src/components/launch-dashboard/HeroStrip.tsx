import type { MigrationHealthSnapshot, MigrationKpis } from "@/types"
import { formatPacificDateLong } from "@/lib/datetime"

interface HeroStripProps {
  health: MigrationHealthSnapshot
  kpis: MigrationKpis | null
}

/**
 * Full-width hero banner: health badge + status header on the left,
 * oversized countdown with progress bar on the right.
 *
 * The headline stack also carries the at-a-glance KPI row (combined
 * unique tasks, resolved %, prod fail, blockers, new/24h) — this is
 * the primary bird's-eye number set, and lifting it out of the left
 * rail frees that rail to be a pure project navigator.
 */
export function HeroStrip({ health, kpis }: HeroStripProps) {
  const days = computeDaysUntil(health.launchWindow?.start)
  const percent = days === null ? 0 : clamp01(((7 - days) / 7) * 100)

  return (
    <div className="lcc-hero-strip">
      <div className="lcc-hs-main">
        <div className="lcc-hs-status">
          <span className="lcc-health-badge lg" data-health={health.overall ?? undefined}>
            {(health.overall ?? "unknown").replace("-", " ")}
          </span>
          <div className="lcc-hs-headline">Project Status as of {formatToday()}</div>
        </div>
        {kpis && (
          <div className="lcc-hs-kpis">
            <HeroKpi value={fmt(kpis.combinedUnique)} label="Combined unique tasks" tone="primary" />
            <HeroKpi value={`${kpis.resolvedPct ?? "—"}%`} label="Resolved" tone="green" />
            <HeroKpi value={fmt(kpis.productionFailures)} label="Prod fail" tone="red" />
            <HeroKpi value={fmt(kpis.openBlockers)} label="Blockers" tone="amber" />
            <HeroKpi value={fmt(kpis.newBugs24h)} label="New / 24h" tone="red" />
          </div>
        )}
      </div>
      <div className="lcc-hs-countdown">
        <div className="lcc-hs-cd-label">Launch in</div>
        <div className="lcc-hs-cd-num">
          {days ?? "—"}
          <span>d</span>
        </div>
        <div className="lcc-hs-cd-bar">
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className="lcc-hs-cd-sub">
          {health.launchWindow ? `${health.launchWindow.start}${health.launchWindow.end ? ` → ${health.launchWindow.end}` : ""}` : "no launch window"}
        </div>
      </div>
    </div>
  )
}

interface HeroKpiProps {
  value: string
  label: string
  tone: "primary" | "green" | "amber" | "red"
}

function HeroKpi({ value, label, tone }: HeroKpiProps) {
  return (
    <div className="lcc-hs-kpi" data-tone={tone}>
      <div className="lcc-hs-kpi-v">{value}</div>
      <div className="lcc-hs-kpi-l">{label}</div>
    </div>
  )
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—"
  return Number(n).toLocaleString()
}

function computeDaysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const target = new Date(iso).getTime()
  if (Number.isNaN(target)) return null
  return Math.ceil((target - Date.now()) / 86_400_000)
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(100, value))
}

function formatToday(): string {
  return formatPacificDateLong(new Date())
}
