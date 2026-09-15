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
