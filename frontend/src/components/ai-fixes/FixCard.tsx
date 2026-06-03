import { useEffect, useState } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CodeDiff } from "@/components/ai-fixes/CodeDiff"
import { api } from "@/services/api"
import type { AutofixFix, AutofixOutcome, AutofixStatus, AutofixFixPatch } from "@/types"
import { Check, Copy } from "lucide-react"

interface FixCardProps {
  fix: AutofixFix
  /** Called after a successful PATCH so the page can refresh rollups. */
  onPatched: () => void
}

function confidenceColor(confidence: string): string {
  switch (confidence.toLowerCase()) {
    case "high":
      return "var(--beacon-pass)"
    case "medium":
      return "var(--beacon-warn)"
    case "low":
      return "var(--beacon-fail)"
    default:
      return "var(--beacon-idle)"
  }
}

function CopyButton({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(id)
  }, [copied])

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value)
          setCopied(true)
        } catch {
          // clipboard unavailable (focus lost, non-HTTPS, permission denied)
        }
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : label}
    </Button>
  )
}

const STATUSES: { value: AutofixStatus; label: string }[] = [
  { value: "todo", label: "To Do" },
  { value: "applied", label: "Applied" },
  { value: "dismissed", label: "Dismissed" },
]

const OUTCOMES: Record<Exclude<AutofixStatus, "todo">, { value: AutofixOutcome; label: string }[]> = {
  applied: [
    { value: "worked_as_is", label: "Worked as-is" },
    { value: "worked_with_edits", label: "Worked with edits" },
  ],
  dismissed: [
    { value: "didnt_work", label: "Didn't work" },
    { value: "not_a_real_issue", label: "Not a real issue" },
  ],
}

/** Which outcomes reveal the "what actually fixed it" feedback block. */
const OUTCOMES_REVEALING_FEEDBACK: AutofixOutcome[] = [
  "worked_with_edits",
  "didnt_work",
  "not_a_real_issue",
]

export function FixCard({ fix, onPatched }: FixCardProps) {
  const [status, setStatus] = useState<AutofixStatus>(fix.status)
  const [outcome, setOutcome] = useState<AutofixOutcome | null>(fix.outcome)
  const [actualFixCode, setActualFixCode] = useState(fix.actualFixCode ?? "")
  const [note, setNote] = useState(fix.note ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [patchError, setPatchError] = useState<string | null>(null)

  useEffect(() => {
    if (!saved) return
    const id = setTimeout(() => setSaved(false), 1500)
    return () => clearTimeout(id)
  }, [saved])

  const patch = async (body: AutofixFixPatch) => {
    setPatchError(null)
    try {
      await api.patchAutofixFix(fix.buildId, fix.fixId, body)
      onPatched()
      return true
    } catch (err) {
      setPatchError(err instanceof Error ? err.message : "Save failed")
      return false
    }
  }

  const handleStatus = async (next: AutofixStatus) => {
    setStatus(next)
    if (next === "todo") setOutcome(null)
    await patch({ status: next })
  }

  const handleOutcome = async (next: AutofixOutcome) => {
    setOutcome(next)
    await patch({ outcome: next })
  }

  const handleSaveFeedback = async () => {
    setSaving(true)
    setSaved(false)
    const body: AutofixFixPatch = { actual_fix_code: actualFixCode, note }
    const ok = await patch(body)
    setSaving(false)
    if (ok) {
      setSaved(true)
    }
  }

  const showOutcomePrompt = status !== "todo"
  const showFeedback = outcome !== null && OUTCOMES_REVEALING_FEEDBACK.includes(outcome)

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="beacon-headline text-sm">{fix.testName}</span>
          <span className="beacon-typebadge">{fix.category || "unknown"}</span>
          <span className="beacon-status" style={{ color: confidenceColor(fix.confidence) }}>
            {fix.confidence || "—"} confidence
          </span>
        </div>

        {/* File path + signature */}
        <div className="space-y-0.5">
          <div className="beacon-mono text-xs" style={{ color: "var(--beacon-text-muted)" }}>
            {fix.filePath || "—"}
          </div>
          <div className="text-xs" style={{ color: "var(--beacon-text-faint)" }}>
            {fix.signature || "—"}
          </div>
        </div>

        {/* Collapsible diagnosis + reasoning */}
        <details className="rounded border border-border">
          <summary className="beacon-summary cursor-pointer px-3 py-2 text-muted-foreground hover:text-foreground">
            DIAGNOSIS &amp; REASONING
          </summary>
          <div className="space-y-2 px-3 pb-3 text-sm text-foreground">
            <p>{fix.diagnosis}</p>
            {fix.reasoning && <p style={{ color: "var(--beacon-text-muted)" }}>{fix.reasoning}</p>}
            {fix.description && <p style={{ color: "var(--beacon-text-muted)" }}>{fix.description}</p>}
          </div>
        </details>

        {/* Diff */}
        <CodeDiff
          oldCode={fix.oldCode}
          newCode={fix.newCode}
          startLine={fix.startLine}
          endLine={fix.endLine}
        />

        {/* Copy actions */}
        <div className="flex flex-wrap gap-2">
          <CopyButton label="Copy new code" value={fix.newCode} />
          <CopyButton label="Copy file path" value={fix.filePath} />
        </div>

        {/* Status control */}
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="beacon-label">STATUS</span>
          {STATUSES.map((s) => (
            <Button
              key={s.value}
              variant={status === s.value ? "default" : "outline"}
              size="sm"
              onClick={() => handleStatus(s.value)}
            >
              {s.label}
            </Button>
          ))}
        </div>

        {/* Outcome prompt */}
        {showOutcomePrompt && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs" style={{ color: "var(--beacon-text-muted)" }}>
              {status === "applied" ? "Did it work?" : "Why dismissed?"}
            </span>
            {OUTCOMES[status as Exclude<AutofixStatus, "todo">].map((o) => (
              <Button
                key={o.value}
                variant={outcome === o.value ? "default" : "outline"}
                size="sm"
                onClick={() => handleOutcome(o.value)}
              >
                {o.label}
              </Button>
            ))}
          </div>
        )}

        {/* Feedback block */}
        {showFeedback && (
          <div className="space-y-2 rounded border border-[var(--beacon-amber-line)] bg-[var(--beacon-amber-soft)] p-3">
            <label className="beacon-label block">WHAT ACTUALLY FIXED IT</label>
            <textarea
              value={actualFixCode}
              onChange={(e) => setActualFixCode(e.target.value)}
              rows={4}
              placeholder="Paste the code that actually fixed the failure…"
              className="beacon-mono w-full rounded border border-border bg-[var(--beacon-ground)] p-2 text-xs text-foreground"
            />
            <label className="beacon-label block">NOTE (OPTIONAL)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Anything the AI got wrong, context for next time…"
              className="w-full rounded border border-border bg-[var(--beacon-ground)] p-2 text-sm text-foreground"
            />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={handleSaveFeedback} disabled={saving}>
                {saving ? "Saving…" : saved ? "Saved" : "Save"}
              </Button>
              {patchError && (
                <span className="text-xs" style={{ color: "var(--beacon-fail)" }}>
                  {patchError}
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
