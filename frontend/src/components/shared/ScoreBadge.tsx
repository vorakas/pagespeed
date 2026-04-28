import { cn, getScoreRating, formatScore } from "@/lib/utils"

interface ScoreBadgeProps {
  score: number | null
  className?: string
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  const rating = score == null ? "unknown" : getScoreRating(score)

  return (
    <span data-rating={rating} className={cn("aurora-score", className)}>
      {formatScore(score)}
    </span>
  )
}
