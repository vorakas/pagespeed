import { Calendar } from "lucide-react"
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
      <div className="aurora-panel p-6">
        <p className="text-center text-sm" style={{ color: "var(--lcc-red)" }}>{error}</p>
      </div>
    )
  }

  if (triggers.length === 0) {
    return (
      <div className="aurora-panel overflow-hidden">
        <EmptyState
          icon={<Calendar size={40} />}
          title="No Triggers Created"
          description="Create a trigger above to automate your PageSpeed testing."
        />
      </div>
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
