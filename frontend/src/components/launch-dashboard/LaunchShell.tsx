import { useEffect } from "react"
import type { ReactNode } from "react"
import "@/styles/aurora-glass.css"

type Theme = "dark" | "light"
type Palette = "traffic" | "muted" | "mono"
type Density = "compact" | "normal" | "roomy"

interface LaunchShellProps {
  children: ReactNode
  theme?: Theme
  palette?: Palette
  density?: Density
}

/**
 * Aurora Glass wrapper for the Launch Command Center.
 *
 * Applies the design's animated gradient background, token overrides,
 * and glass-panel styles — all scoped under `.launch-dashboard` so
 * nothing leaks into the rest of Pharos. Tweaks-panel persistence
 * will hook into these attributes in a later phase.
 */
export function LaunchShell({
  children,
  theme = "dark",
  palette = "traffic",
  density = "normal",
}: LaunchShellProps) {
  useEffect(() => {
    // AppLayout's main element has ml-[232px] + min-h-screen + pb-3. We
    // want the dashboard to bleed edge-to-edge inside that main, so strip
    // the bottom padding only while this page is mounted.
    const main = document.querySelector<HTMLElement>("main.ml-\\[232px\\]")
    if (!main) return
    const prev = main.style.padding
    main.style.padding = "0"
    return () => {
      main.style.padding = prev
    }
  }, [])

  return (
    <div
      className="launch-dashboard"
      data-theme={theme}
      data-palette={palette}
      data-density={density}
    >
      {children}
    </div>
  )
}
