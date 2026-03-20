import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
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
    <Card ref={formRef}>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          {editingTrigger ? "Edit Trigger" : "Create Trigger"}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name + Schedule */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="triggerName">Trigger Name</Label>
              <Input
                id="triggerName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Daily Morning Test"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label>Schedule</Label>
              <Select value={scheduleType} onValueChange={(v) => setScheduleType(v as "preset" | "custom")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="preset">Use a preset schedule</SelectItem>
                  <SelectItem value="custom">Custom cron expression</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Preset selector or Cron input */}
          {scheduleType === "preset" ? (
            <div className="space-y-1.5">
              <Label>Preset</Label>
              <Select value={presetValue} onValueChange={setPresetValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a preset..." />
                </SelectTrigger>
                <SelectContent>
                  {builtinPresets.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                  {customPresets.length > 0 && (
                    <>
                      <SelectItem value="__separator__" disabled>
                        -- Custom Presets --
                      </SelectItem>
                      {customPresets.map((p) => (
                        <SelectItem key={`custom-${p.id}`} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              {presetValue && (
                <p className="text-xs text-muted-foreground">{describeCron(presetValue)}</p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="cronExpr">Cron Expression</Label>
              <Input
                id="cronExpr"
                value={cronExpression}
                onChange={(e) => setCronExpression(e.target.value)}
                placeholder="0 2 * * *"
              />
              {cronExpression.trim() && (
                <p className="text-xs text-muted-foreground">{describeCron(cronExpression.trim())}</p>
              )}
              <button
                type="button"
                className="text-xs text-primary hover:underline"
                onClick={() => setShowCronRef(!showCronRef)}
              >
                Cron syntax reference {showCronRef ? "▴" : "▾"}
              </button>
              {showCronRef && (
                <div className="rounded-md border border-border bg-muted/50 p-3 text-xs space-y-2">
                  <p className="font-mono">minute hour day-of-month month day-of-week</p>
                  <div className="grid grid-cols-2 gap-1 text-muted-foreground">
                    <span><code>0 2 * * *</code> Daily 2 AM</span>
                    <span><code>*/30 * * * *</code> Every 30 min</span>
                    <span><code>0 6 * * 1</code> Mon 6 AM</span>
                    <span><code>0 */6 * * *</code> Every 6 hrs</span>
                    <span><code>0 9 * * 1-5</code> Weekdays 9 AM</span>
                    <span><code>0 8,20 * * *</code> 8 AM &amp; 8 PM</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Strategy */}
          <div className="space-y-1.5">
            <Label>Strategy</Label>
            <div className="flex gap-4">
              {(["desktop", "mobile", "both"] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="triggerStrategy"
                    value={opt}
                    checked={strategy === opt}
                    onChange={() => setStrategy(opt)}
                    className="accent-primary"
                  />
                  {opt === "both" ? "Both" : opt.charAt(0).toUpperCase() + opt.slice(1)}
                </label>
              ))}
            </div>
          </div>

          {/* URL Selection */}
          <div className="space-y-1.5">
            <Label>Select URLs to Test</Label>
            {allUrls.length === 0 ? (
              <p className="text-sm text-muted-foreground">No URLs configured. Add URLs above first.</p>
            ) : (
              <div className="rounded-md border border-border p-3 space-y-3 max-h-[300px] overflow-y-auto">
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
                        <span className="text-sm font-medium">{site.name}</span>
                        <span className="text-xs text-muted-foreground">({site.urls.length} URLs)</span>
                      </label>
                      <div className="ml-6 mt-1 space-y-1">
                        {site.urls.map((url) => (
                          <label key={url.id} className="flex items-center gap-2 cursor-pointer">
                            <Checkbox
                              checked={selectedUrlIds.has(url.id)}
                              onCheckedChange={() => toggleUrl(url.id)}
                            />
                            <span className="text-xs text-muted-foreground truncate" title={url.url}>
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
      </CardContent>
    </Card>
  )
}
