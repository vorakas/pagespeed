import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface LoadingSpinnerProps {
  message?: string
  className?: string
  size?: number
}

export function LoadingSpinner({ message, className, size = 24 }: LoadingSpinnerProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-12", className)}>
      <Loader2 className="animate-spin text-primary" size={size} />
      {message && (
        <p className="mt-3 text-sm text-muted-foreground">{message}</p>
      )}
    </div>
  )
}
