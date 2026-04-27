import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { api } from "@/services/api"
import { describeCron } from "@/lib/utils"
import type { SiteWithUrls, SchedulePreset, Trigger, TriggerStrategy } from "@/types"

interface TriggerFormProps {
  sites: SiteWithUrls[]
  editingTrigger: Trigger | null
  onSaved: () => void
  onCancel: () => void
}

export function TriggerForm({ sites, editingTrigger, onSaved, onCancel }: TriggerFormProps) {
  const [name, setName] = useState("")
  const [scheduleType, setScheduleType] = useState<"preset" | "custom">("preset")
  const [presetValue, setPresetValue] = useState("")
  const [cronExpression, setCronExpression] = useState("")
  const [strategy, setStrategy] = useState<TriggerStrategy>("desktop")
  const [selectedUrlIds, setSelectedUrlIds] = useState<Set<number>>(new Set())
  const [presets, setPresets] = useState<SchedulePreset[]>([])
  const [showCronRef, setShowCronRef] = useState(false)
  const [saving, setSaving] = useState(false)
  const formRef = useRef<HTMLDivElement>(null)

  // Load presets
  useEffect(() => {
    api.getTriggerPresets().then(setPresets).catch(() => {})
  }, [])

  // Populate form when editing
  useEffect(() => {
    if (editingTrigger) {
      setName(editingTrigger.name)
      setScheduleType("custom")
      setCronExpression(editingTrigger.schedule_value)
      setStrategy(editingTrigger.strategy)
      setSelectedUrlIds(new Set(editingTrigger.url_ids))
    } else {
      resetForm()
    }
  }, [editingTrigger])

  // Set default preset when presets load
  useEffect(() => {
    if (presets.length > 0 && !presetValue && !editingTrigger) {
      setPresetValue(presets[0].value)
    }
  }, [presets, presetValue, editingTrigger])

  const resetForm = () => {
    setName("")
    setScheduleType("preset")
    setPresetValue(presets.length > 0 ? presets[0].value : "")
    setCronExpression("")
    setStrategy("desktop")
    setSelectedUrlIds(new Set())
    setShowCronRef(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    const scheduleValue = scheduleType === "preset" ? presetValue : cronExpression.trim()
    if (!scheduleValue) return
    if (selectedUrlIds.size === 0) return

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        schedule_type: "custom" as const,
        schedule_value: scheduleValue,
        strategy,
        url_ids: Array.from(selectedUrlIds),
      }

      if (editingTrigger) {
        await api.updateTrigger(editingTrigger.id, payload)
      } else {
        await api.createTrigger(payload)
      }
      resetForm()
      onSaved()
    } catch {
      // Error handled by API client
    } finally {
      setSaving(false)
    }
  }

  const toggleUrl = (urlId: number) => {
    setSelectedUrlIds((prev) => {
      const next = new Set(prev)
      if (next.has(urlId)) {
        next.delete(urlId)
      } else {
        next.add(urlId)
      }
      return next
    })
  }

  const toggleSiteUrls = (site: SiteWithUrls) => {
    const siteUrlIds = site.urls.map((u) => u.id)
    const allSelected = siteUrlIds.every((id) => selectedUrlIds.has(id))
    setSelectedUrlIds((prev) => {
      const next = new Set(prev)
      if (allSelected) {
        siteUrlIds.forEach((id) => next.delete(id))
      } else {
        siteUrlIds.forEach((id) => next.add(id))
      }
      return next
    })
  }

  const getSiteCheckState = (site: SiteWithUrls) => {
    const siteUrlIds = site.urls.map((u) => u.id)
    const selectedCount = siteUrlIds.filter((id) => selectedUrlIds.has(id)).length
    if (selectedCount === 0) return "unchecked"
    if (selectedCount === siteUrlIds.length) return "checked"
    return "indeterminate"
  }

  const builtinPresets = presets.filter((p) => p.is_builtin)
  const customPresets = presets.filter((p) => !p.is_builtin)
  const allUrls = sites.flatMap((s) => s.urls)

  return (
    <div ref={formRef} className="aurora-panel p-4">
      <h3 className="aurora-text mb-4 text-sm font-semibold">
        {editingTrigger ? "Edit Trigger" : "Create Trigger"}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name + Schedule */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="triggerName" className="aurora-label block">Trigger Name</label>
            <input
              id="triggerName"
              className="aurora-input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Daily Morning Test"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="aurora-label block">Schedule</label>
            <select
              className="aurora-select w-full"
              value={scheduleType}
              onChange={(e) => setScheduleType(e.target.value as "preset" | "custom")}
            >
              <option value="preset">Use a preset schedule</option>
              <option value="custom">Custom cron expression</option>
            </select>
          </div>
        </div>

        {/* Preset selector or Cron input */}
        {scheduleType === "preset" ? (
          <div className="space-y-1.5">
            <label className="aurora-label block">Preset</label>
            <select
              className="aurora-select w-full"
              value={presetValue}
              onChange={(e) => setPresetValue(e.target.value)}
            >
              <option value="">Select a preset...</option>
              {builtinPresets.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
              {customPresets.length > 0 && (
                <>
                  <option value="" disabled>-- Custom Presets --</option>
                  {customPresets.map((p) => (
                    <option key={`custom-${p.id}`} value={p.value}>
                      {p.label}
                    </option>
                  ))}
                </>
              )}
            </select>
            {presetValue && (
              <p className="aurora-text-dim text-xs">{describeCron(presetValue)}</p>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <label htmlFor="cronExpr" className="aurora-label block">Cron Expression</label>
            <input
              id="cronExpr"
              className="aurora-input w-full"
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              placeholder="0 2 * * *"
            />
            {cronExpression.trim() && (
              <p className="aurora-text-dim text-xs">{describeCron(cronExpression.trim())}</p>
            )}
            <button
              type="button"
              className="text-xs hover:underline"
              style={{ color: "var(--lcc-violet)" }}
              onClick={() => setShowCronRef(!showCronRef)}
            >
              Cron syntax reference {showCronRef ? "▴" : "▾"}
            </button>
            {showCronRef && (
              <div className="aurora-callout space-y-2 text-xs">
                <p className="aurora-text font-mono">minute hour day-of-month month day-of-week</p>
                <div className="aurora-text-dim grid grid-cols-2 gap-1">
                  <span><code className="aurora-code">0 2 * * *</code> Daily 2 AM</span>
                  <span><code className="aurora-code">*/30 * * * *</code> Every 30 min</span>
                  <span><code className="aurora-code">0 6 * * 1</code> Mon 6 AM</span>
                  <span><code className="aurora-code">0 */6 * * *</code> Every 6 hrs</span>
                  <span><code className="aurora-code">0 9 * * 1-5</code> Weekdays 9 AM</span>
                  <span><code className="aurora-code">0 8,20 * * *</code> 8 AM &amp; 8 PM</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Strategy */}
        <div className="space-y-1.5">
          <label className="aurora-label block">Strategy</label>
          <div className="flex gap-2">
            {(["desktop", "mobile", "both"] as const).map((opt) => (
              <label
                key={opt}
                className="aurora-radio-pill"
                data-checked={strategy === opt}
              >
                <input
                  type="radio"
                  name="triggerStrategy"
                  value={opt}
                  checked={strategy === opt}
                  onChange={() => setStrategy(opt)}
                />
                {opt === "both" ? "Both" : opt.charAt(0).toUpperCase() + opt.slice(1)}
              </label>
            ))}
          </div>
        </div>

        {/* URL Selection */}
        <div className="space-y-1.5">
          <label className="aurora-label block">Select URLs to Test</label>
          {allUrls.length === 0 ? (
            <p className="aurora-text-dim text-sm">No URLs configured. Add URLs above first.</p>
          ) : (
            <div
              className="space-y-3 p-3 rounded-md max-h-[300px] overflow-y-auto"
              style={{ border: "1px solid var(--glass-border)", background: "var(--glass-hi)" }}
            >
              {sites.map((site) => {
                if (site.urls.length === 0) return null
                const checkState = getSiteCheckState(site)
                return (
                  <div key={site.id}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={checkState === "checked"}
                        indeterminate={checkState === "indeterminate"}
                        onCheckedChange={() => toggleSiteUrls(site)}
                      />
                      <span className="aurora-text text-sm font-medium">{site.name}</span>
                      <span className="aurora-text-faint text-xs">({site.urls.length} URLs)</span>
                    </label>
                    <div className="ml-6 mt-1 space-y-1">
                      {site.urls.map((url) => (
                        <label key={url.id} className="flex items-center gap-2 cursor-pointer">
                          <Checkbox
                            checked={selectedUrlIds.has(url.id)}
                            onCheckedChange={() => toggleUrl(url.id)}
                          />
                          <span className="aurora-text-dim truncate text-xs" title={url.url}>
                            {url.url}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button type="submit" disabled={saving || selectedUrlIds.size === 0}>
            {editingTrigger ? "Update Trigger" : "Create Trigger"}
          </Button>
          {editingTrigger && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
