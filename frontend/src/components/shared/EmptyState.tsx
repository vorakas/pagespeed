import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { ReactNode } from "react"

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  actionText?: string
  actionHref?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actionText,
  actionHref,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      {icon && (
        <div className="mb-4 text-muted-foreground">{icon}</div>
      )}
      <h3 className="text-lg font-medium text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-md">{description}</p>
      )}
      {actionText && (actionHref || onAction) && (
        actionHref ? (
          <a href={actionHref}>
            <Button variant="outline" className="mt-4">
              {actionText}
            </Button>
          </a>
        ) : (
          <Button variant="outline" className="mt-4" onClick={onAction}>
            {actionText}
          </Button>
        )
      )}
    </div>
  )
}
