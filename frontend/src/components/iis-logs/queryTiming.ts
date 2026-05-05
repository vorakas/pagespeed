export function formatQueryDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${Math.max(1, Math.round(durationMs))}ms`
  }
  return `${(durationMs / 1000).toFixed(2)}s`
}
