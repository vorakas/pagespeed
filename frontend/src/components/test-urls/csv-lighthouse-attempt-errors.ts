import type { CsvLighthouseAttemptErrorSummary } from "@/types"

interface AttemptErrorDisplay {
  summary: string
  title: string
  total: number
}

const categoryMatchers: Array<{ label: string; matches: (message: string) => boolean }> = [
  {
    label: "Resource exhaustion",
    matches: (message) =>
      /pthread_create|resource temporarily unavailable|spawnSync .* EAGAIN|uv_thread_create/i.test(message),
  },
  {
    label: "Chrome connection refused",
    matches: (message) => /ECONNREFUSED 127\.0\.0\.1/i.test(message),
  },
  {
    label: "Lighthouse timeout",
    matches: (message) => /Lighthouse timed out after \d+s|Timed out after waiting \d+ms/i.test(message),
  },
  {
    label: "Lighthouse exited without stderr",
    matches: (message) => /no stderr output/i.test(message),
  },
]

function labelForAttemptError(message: string) {
  return categoryMatchers.find((category) => category.matches(message))?.label || "Other Lighthouse error"
}

export function buildCsvLighthouseAttemptErrorDisplay(
  errors: CsvLighthouseAttemptErrorSummary[] | undefined,
): AttemptErrorDisplay | null {
  if (!errors?.length) {
    return null
  }

  const categoryCounts = new Map<string, number>()
  let total = 0
  for (const error of errors) {
    const count = Math.max(0, Number(error.count) || 0)
    if (count === 0) {
      continue
    }
    total += count
    const label = labelForAttemptError(error.error_message)
    categoryCounts.set(label, (categoryCounts.get(label) || 0) + count)
  }
  if (total === 0) {
    return null
  }

  const summary = Array.from(categoryCounts.entries())
    .map(([label, count]) => `${label} (${count})`)
    .join(", ")
  const title = errors
    .filter((error) => Number(error.count) > 0)
    .map((error) => `${error.count}x ${error.status}: ${error.error_message}`)
    .join("\n\n")

  return {
    summary: `Attempt errors: ${summary}`,
    title,
    total,
  }
}
