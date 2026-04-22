import type { MigrationHealthSnapshot } from "@/types"

interface HeroStripProps {
  health: MigrationHealthSnapshot
}

/**
 * Full-width hero banner: health badge + headline + reasons on the left,
 * oversized countdown with progress bar on the right.
 */
export function HeroStrip({ health }: HeroStripProps) {
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
        <ul className="lcc-hs-reasons">
          {health.reasons.slice(0, 3).map((r, i) => (
            <li key={i}>{stripEmphasis(r)}</li>
          ))}
        </ul>
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
  return new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

function stripEmphasis<T extends string | null | undefined>(text: T): T {
  if (text == null) return text
  const cleaned = (text as string)
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/<[^>]+>/g, "")
  return cleaned as T
}
