import { useState } from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CodeDiff } from "@/components/ai-fixes/CodeDiff"
import type { AutofixFix } from "@/types"
import { Check, Copy } from "lucide-react"

interface FixCardProps {
  fix: AutofixFix
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
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Copied" : label}
    </Button>
  )
}

export function FixCard({ fix }: FixCardProps) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="beacon-headline text-sm">{fix.testName}</span>
          <span className="beacon-typebadge">{fix.category || "unknown"}</span>
          <span
            className="beacon-status"
            style={{ color: confidenceColor(fix.confidence) }}
          >
            {fix.confidence || "—"} confidence
          </span>
        </div>

        {/* File path + signature */}
        <div className="space-y-0.5">
          <div className="beacon-mono text-xs" style={{ color: "var(--beacon-text-muted)" }}>
            {fix.filePath || "—"}
          </div>
          <div className="text-xs" style={{ color: "var(--beacon-text-faint)" }}>
            {fix.signature}
          </div>
        </div>

        {/* Collapsible diagnosis + reasoning */}
        <details className="rounded border border-border">
          <summary className="beacon-summary cursor-pointer px-3 py-2 text-muted-foreground hover:text-foreground">
            DIAGNOSIS &amp; REASONING
          </summary>
          <div className="space-y-2 px-3 pb-3 text-sm text-foreground">
            <p>{fix.diagnosis}</p>
            {fix.reasoning && (
              <p style={{ color: "var(--beacon-text-muted)" }}>{fix.reasoning}</p>
            )}
            {fix.description && (
              <p style={{ color: "var(--beacon-text-muted)" }}>{fix.description}</p>
            )}
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
      </CardContent>
    </Card>
  )
}
