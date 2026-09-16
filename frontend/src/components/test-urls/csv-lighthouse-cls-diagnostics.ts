import type { CsvLighthouseClsDiagnostics } from "@/types"

interface ClsDiagnosticDisplay {
  summary: string
  title: string
}

export function buildCsvLighthouseClsDiagnosticDisplay(
  diagnostics: CsvLighthouseClsDiagnostics | null | undefined,
): ClsDiagnosticDisplay | null {
  if (!diagnostics) {
    return null
  }

  const count = Math.max(0, Number(diagnostics.observed_shift_count) || 0)
  const liveProbe = diagnostics.live_probe
  const liveProbeCls = typeof liveProbe?.cls === "number" ? liveProbe.cls : null
  const liveProbeShiftCount = Math.max(0, Number(liveProbe?.shift_count) || 0)
  if (count === 0 && (liveProbeShiftCount > 0 || (liveProbeCls ?? 0) > 0)) {
    const lines = [`Live CLS probe: ${liveProbeCls ?? "n/a"}`]
    if (typeof liveProbe?.samples_with_shifts === "number") {
      lines.push(`Samples with shifts: ${liveProbe.samples_with_shifts}`)
    }
    lines.push(`Live probe shift entries: ${liveProbeShiftCount}`)
    if (typeof liveProbe?.largest_shift_score === "number") {
      lines.push(`Largest live shift: ${liveProbe.largest_shift_score}`)
    }
    if (liveProbe?.largest_shift_node) {
      lines.push(`Largest live shift node: ${liveProbe.largest_shift_node}`)
    }
    if (typeof liveProbe?.observation_ms === "number") {
      lines.push(`Load observation: ${liveProbe.observation_ms}ms`)
    }
    if (typeof liveProbe?.scroll_steps === "number") {
      lines.push(`Scroll steps: ${liveProbe.scroll_steps}`)
    }
    if (typeof liveProbe?.scroll_pause_ms === "number") {
      lines.push(`Scroll pause: ${liveProbe.scroll_pause_ms}ms`)
    }

    return {
      summary: `Probe ${liveProbeCls ?? "shift"}`,
      title: lines.join("\n"),
    }
  }

  if (count === 0) {
    return {
      summary: "No shifts",
      title: "Lighthouse layout-shifts audit observed no layout-shift entries.",
    }
  }

  const plural = count === 1 ? "shift" : "shifts"
  const lines = [`Observed layout-shift entries: ${count}`]
  if (typeof diagnostics.largest_shift_score === "number") {
    lines.push(`Largest shift score: ${diagnostics.largest_shift_score}`)
  }
  if (diagnostics.largest_shift_node) {
    lines.push(`Largest shift node: ${diagnostics.largest_shift_node}`)
  }

  return {
    summary: `${count} ${plural}`,
    title: lines.join("\n"),
  }
}
