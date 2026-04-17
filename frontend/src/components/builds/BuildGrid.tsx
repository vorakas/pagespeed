import { BuildCard } from "./BuildCard"
import { SpreadsheetWidget } from "./SpreadsheetWidget"
import type { DevOpsBuild } from "@/types"
import type { SheetEntry } from "@/services/spreadsheetExport"

interface BuildRole {
  key: string
  label: string
  type: "WarmUp" | "Functional" | "Visual"
}

const WARMUP_ROLE: BuildRole = { key: "WarmUp", label: "Warm Up", type: "WarmUp" }

const PLATFORM_ROLES: { platform: string; functional: BuildRole; visual: BuildRole }[] = [
  {
    platform: "Windows",
    functional: { key: "Windows_Functional", label: "Windows Functional", type: "Functional" },
    visual: { key: "Windows_Visual", label: "Windows Visual", type: "Visual" },
  },
  {
    platform: "Mac",
    functional: { key: "Mac_Functional", label: "Mac Functional", type: "Functional" },
    visual: { key: "Mac_Visual", label: "Mac Visual", type: "Visual" },
  },
  {
    platform: "iPhone",
    functional: { key: "iPhone_Functional", label: "iPhone Functional", type: "Functional" },
    visual: { key: "iPhone_Visual", label: "iPhone Visual", type: "Visual" },
  },
  {
    platform: "Android",
    functional: { key: "Android_Functional", label: "Android Functional", type: "Functional" },
    visual: { key: "Android_Visual", label: "Android Visual", type: "Visual" },
  },
]

interface EffectiveResult {
  effectiveResult: string
  hasRerun: boolean
}

interface BuildGridProps {
  builds: Record<string, DevOpsBuild | null>
  recentBuilds: Record<string, DevOpsBuild[]>
  buildOverrides: Record<string, number>
  onSelectBuild: (roleKey: string, buildId: number | null) => void
  effectiveResults: Record<string, EffectiveResult>
  branches: string[]
  globalBranch: string
  globalTargetInstance: string
  overrides: Record<string, { branch?: string; targetInstance?: string }>
  onOverrideChange: (roleKey: string, field: "branch" | "targetInstance", value: string) => void
  onTrigger: (roleKey: string) => void
  onStop: (roleKey: string) => void
  onShowResults: (build: DevOpsBuild) => void
  onShowSkipped: (build: DevOpsBuild) => void
  onAddToSheet: (roleKey: string) => void
  sheetData: Map<string, SheetEntry>
  onSheetClear: () => void
  prefetchingTests: boolean
  triggeringKeys: Set<string>
  cancellingKeys: Set<string>
  selectedBuildId?: number
}

export function BuildGrid({
  builds, recentBuilds, buildOverrides, onSelectBuild,
  effectiveResults, branches, globalBranch, globalTargetInstance,
  overrides, onOverrideChange, onTrigger, onStop, onShowResults, onShowSkipped,
  onAddToSheet, sheetData, onSheetClear, prefetchingTests,
  triggeringKeys, cancellingKeys, selectedBuildId,
}: BuildGridProps) {
  return (
    <div className="space-y-6">
      {/* WarmUp row + Spreadsheet Widget */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          WarmUp
        </h3>
        <div className="grid grid-cols-[24rem_1fr] gap-4 items-stretch">
          <div>
            <BuildCard
              roleKey={WARMUP_ROLE.key}
              roleLabel={WARMUP_ROLE.label}
              typeBadge={WARMUP_ROLE.type}
              build={builds[WARMUP_ROLE.key] ?? null}
              recentBuilds={recentBuilds[WARMUP_ROLE.key] ?? []}
              selectedBuildOverrideId={buildOverrides[WARMUP_ROLE.key] ?? null}
              onSelectBuild={(id) => onSelectBuild(WARMUP_ROLE.key, id)}
              effectiveResult={effectiveResults[WARMUP_ROLE.key]}
              branches={branches}
              globalBranch={globalBranch}
              globalTargetInstance={globalTargetInstance}
              override={overrides[WARMUP_ROLE.key]}
              onOverrideChange={onOverrideChange}
              onTrigger={() => onTrigger(WARMUP_ROLE.key)}
              onStop={() => onStop(WARMUP_ROLE.key)}
              cancelling={cancellingKeys.has(WARMUP_ROLE.key)}
              onShowResults={onShowResults}
              onShowSkipped={onShowSkipped}
              onAddToSheet={onAddToSheet}
              addedToSheet={sheetData.has(WARMUP_ROLE.key)}
              triggering={triggeringKeys.has(WARMUP_ROLE.key)}
              selected={builds[WARMUP_ROLE.key]?.id === selectedBuildId}
            />
          </div>
          <div className="min-w-0">
            <SpreadsheetWidget sheetData={sheetData} onClear={onSheetClear} prefetchingTests={prefetchingTests} />
          </div>
        </div>
      </div>

      {/* Platform rows: Functional -> Visual */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
          Functional &rarr; Visual
        </h3>
        <div className="space-y-3 max-w-4xl">
          {PLATFORM_ROLES.map(({ platform, functional, visual }) => (
            <div key={platform} className="flex items-start gap-3">
              <p className="w-16 shrink-0 pt-3 text-xs font-medium text-muted-foreground">
                {platform}
              </p>
              <div className="flex-1">
                <BuildCard
                  roleKey={functional.key}
                  roleLabel={functional.label}
                  typeBadge={functional.type}
                  build={builds[functional.key] ?? null}
                  recentBuilds={recentBuilds[functional.key] ?? []}
                  selectedBuildOverrideId={buildOverrides[functional.key] ?? null}
                  onSelectBuild={(id) => onSelectBuild(functional.key, id)}
                  effectiveResult={effectiveResults[functional.key]}
                  branches={branches}
                  globalBranch={globalBranch}
                  globalTargetInstance={globalTargetInstance}
                  override={overrides[functional.key]}
                  onOverrideChange={onOverrideChange}
                  onTrigger={() => onTrigger(functional.key)}
                  onStop={() => onStop(functional.key)}
                  cancelling={cancellingKeys.has(functional.key)}
                  onShowResults={onShowResults}
                  onShowSkipped={onShowSkipped}
                  onAddToSheet={onAddToSheet}
                  addedToSheet={sheetData.has(functional.key)}
                  triggering={triggeringKeys.has(functional.key)}
                  selected={builds[functional.key]?.id === selectedBuildId}
                />
              </div>
              <div className="flex items-center pt-6 shrink-0">
                <span className="text-muted-foreground text-lg">&rarr;</span>
              </div>
              <div className="flex-1">
                <BuildCard
                  roleKey={visual.key}
                  roleLabel={visual.label}
                  typeBadge={visual.type}
                  build={builds[visual.key] ?? null}
                  recentBuilds={recentBuilds[visual.key] ?? []}
                  selectedBuildOverrideId={buildOverrides[visual.key] ?? null}
                  onSelectBuild={(id) => onSelectBuild(visual.key, id)}
                  effectiveResult={effectiveResults[visual.key]}
                  branches={branches}
                  globalBranch={globalBranch}
                  globalTargetInstance={globalTargetInstance}
                  override={overrides[visual.key]}
                  onOverrideChange={onOverrideChange}
                  onTrigger={() => onTrigger(visual.key)}
                  onStop={() => onStop(visual.key)}
                  cancelling={cancellingKeys.has(visual.key)}
                  onShowResults={onShowResults}
                  onShowSkipped={onShowSkipped}
                  onAddToSheet={onAddToSheet}
                  addedToSheet={sheetData.has(visual.key)}
                  triggering={triggeringKeys.has(visual.key)}
                  selected={builds[visual.key]?.id === selectedBuildId}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dependency notes */}
      <div className="rounded-lg border border-dashed border-muted-foreground/30 p-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-semibold">Orchestrator dependency chain:</span>{" "}
          WarmUp &rarr; Win/Mac/iPhone Functional (parallel) &rarr; Android Functional &rarr;
          Win/Mac Visual (parallel) &rarr; iPhone Visual &rarr; Android Visual.{" "}
          iPhone &amp; Android share LambdaTest devices and cannot run simultaneously.
        </p>
      </div>
    </div>
  )
}
