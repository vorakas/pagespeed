import { Calendar } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { EmptyState } from "@/components/shared/EmptyState"
import { LoadingSpinner } from "@/components/shared/LoadingSpinner"
import { TriggerCard } from "./TriggerCard"
import type { Trigger } from "@/types"

interface TriggerListProps {
  triggers: Trigger[]
  loading: boolean
  error: string | null
  onEdit: (trigger: Trigger) => void
  onChanged: () => void
}

export function TriggerList({ triggers, loading, error, onEdit, onChanged }: TriggerListProps) {
  if (loading) {
    return <LoadingSpinner message="Loading triggers..." />
  }

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-center text-sm text-destructive">{error}</p>
      </Card>
    )
  }

  if (triggers.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={<Calendar size={40} />}
            title="No Triggers Created"
            description="Create a trigger above to automate your PageSpeed testing."
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-2">
      {triggers.map((trigger) => (
        <TriggerCard
          key={trigger.id}
          trigger={trigger}
          onEdit={onEdit}
          onDeleted={onChanged}
          onToggled={onChanged}
        />
      ))}
    </div>
  )
}
