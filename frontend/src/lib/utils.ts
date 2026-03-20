import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---------- Score Helpers ----------

export type ScoreRating = "good" | "average" | "poor"

export function getScoreRating(score: number | null): ScoreRating {
  if (score === null) return "poor"
  if (score >= 90) return "good"
  if (score >= 50) return "average"
  return "poor"
}

export function formatScore(score: number | null): string {
  if (score === null) return "N/A"
  return score.toString()
}

// ---------- Metric Formatting ----------

export function formatMilliseconds(value: number | null): string {
  if (value === null) return "N/A"
  if (value >= 1000) return `${(value / 1000).toFixed(1)}s`
  return `${Math.round(value)}ms`
}

export function formatCls(value: number | null): string {
  if (value === null) return "N/A"
  return value.toFixed(3)
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return "N/A"
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

// ---------- Date Formatting ----------

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

// ---------- Cron Helpers ----------

export function describeCron(expression: string): string {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) return expression

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

  if (dayOfMonth === "*" && month === "*" && dayOfWeek === "*") {
    if (hour === "*") return `Every hour at minute ${minute}`
    if (hour.includes("/")) {
      const interval = hour.split("/")[1]
      return `Every ${interval} hours at :${minute.padStart(2, "0")}`
    }
    return `Daily at ${hour}:${minute.padStart(2, "0")} UTC`
  }

  if (dayOfWeek !== "*" && dayOfMonth === "*" && month === "*") {
    const dayIndex = parseInt(dayOfWeek)
    const dayName = dayNames[dayIndex] || dayOfWeek
    return `Weekly on ${dayName} at ${hour}:${minute.padStart(2, "0")} UTC`
  }

  return expression
}

// ---------- HTML Escaping ----------

export function escapeHtml(text: string): string {
  const div = document.createElement("div")
  div.textContent = text
  return div.innerHTML
}
