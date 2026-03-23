import { cn, getScoreRating, formatScore } from "@/lib/utils"

interface ScoreBadgeProps {
  score: number | null
  className?: string
}

const ratingStyles: Record<string, string> = {
  good: "bg-score-good/20 text-score-good",
  average: "bg-score-average/20 text-score-average",
  poor: "bg-score-poor/20 text-score-poor",
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  const rating = getScoreRating(score)

  return (
    <span
      className={cn(
        "inline-flex w-10 items-center justify-center rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums",
        ratingStyles[rating],
        className
      )}
    >
      {formatScore(score)}
    </span>
  )
}
