import type { MigrationHealthSnapshot, MigrationKpis } from "@/types"

export type HeroIssueKpi = "prod" | "blocker" | "bug"

interface HeroStripProps {
  health: MigrationHealthSnapshot
  kpis: MigrationKpis | null
  onIssueKpiClick?: (kind: HeroIssueKpi) => void
}

/**
 * One-line operator brief: health badge · T−N · open blockers · prod failures.
 * Replaces the prior hero-metric template (5 KPI cards + 52px countdown +
 * gradient progress bar + "Project Status as of …" headline).
 */
export function HeroStrip({ health, kpis, onIssueKpiClick }: HeroStripProps) {
  const days = computeDaysUntil(health.launchWindow?.start)
  const launchLabel = health.launchWindow?.start ?? "no launch window"

  return (
    <div className="lcc-brief" role="group" aria-label="Operator brief">
      <span className="lcc-health-badge lg" data-health={health.overall ?? undefined}>
        {(health.overall ?? "unknown").replace("-", " ")}
      </span>
      <span className="lcc-brief-sep" aria-hidden="true" />
      <span className="lcc-brief-item">
        <span className="lcc-brief-num">{days === null ? "—" : `T−${days}`}</span>
        <span className="lcc-brief-label">{launchLabel}</span>
      </span>
      <span className="lcc-brief-sep" aria-hidden="true" />
      <BriefStat
        value={fmt(kpis?.openBlockers)}
        label="open blockers"
        tone="amber"
        onClick={onIssueKpiClick ? () => onIssueKpiClick("blocker") : undefined}
      />
      <span className="lcc-brief-sep" aria-hidden="true" />
      <BriefStat
        value={fmt(kpis?.productionFailures)}
        label="prod failures"
        tone="red"
        onClick={onIssueKpiClick ? () => onIssueKpiClick("prod") : undefined}
      />
    </div>
  )
}

interface BriefStatProps {
  value: string
  label: string
  tone: "amber" | "red"
  onClick?: () => void
}

function BriefStat({ value, label, tone, onClick }: BriefStatProps) {
  const body = (
    <>
      <span className="lcc-brief-num" data-tone={tone}>{value}</span>
      <span className="lcc-brief-label">{label}</span>
    </>
  )
  if (onClick) {
    return (
      <button
        type="button"
        className="lcc-brief-item lcc-brief-item-btn"
        onClick={onClick}
        aria-label={`Open ${label} triage panel`}
      >
        {body}
      </button>
    )
  }
  return <span className="lcc-brief-item">{body}</span>
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
