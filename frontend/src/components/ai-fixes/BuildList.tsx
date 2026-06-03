import type { AutofixBuild } from "@/types"

interface BuildListProps {
  builds: AutofixBuild[]
  selectedBuildId: string | null
  onSelect: (buildId: string) => void
}

function formatDate(value: string | null): string {
  if (!value) return "—"
  const parsed = new Date(value.replace(" ", "T"))
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** "3/5 applied" — applied count over total fixes for the build. */
function progressLabel(build: AutofixBuild): string {
  return `${build.appliedCount}/${build.fixesCount} applied`
}

export function BuildList({ builds, selectedBuildId, onSelect }: BuildListProps) {
  return (
    <div className="flex flex-col gap-2">
      {builds.map((build) => {
        const isSelected = build.buildId === selectedBuildId
        return (
          <button
            key={build.buildId}
            type="button"
            onClick={() => onSelect(build.buildId)}
            data-active={isSelected}
            className="w-full rounded border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-[var(--beacon-amber-line)] data-[active=true]:border-[var(--beacon-amber)] data-[active=true]:bg-[var(--beacon-amber-soft)]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="beacon-mono text-sm text-foreground">#{build.buildNumber}</span>
              <span className="beacon-typebadge">{build.pipelineName || "pipeline"}</span>
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground" title={build.branch}>
              {build.branch || "—"}
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className="text-xs" style={{ color: "var(--beacon-text-faint)" }}>
                {formatDate(build.fetchedAt)}
              </span>
              <span
                className="beacon-status"
                style={{
                  color:
                    build.fixesCount === 0
                      ? "var(--beacon-text-faint)"
                      : build.appliedCount === build.fixesCount
                        ? "var(--beacon-pass)"
                        : "var(--beacon-amber)",
                }}
              >
                {progressLabel(build)}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
