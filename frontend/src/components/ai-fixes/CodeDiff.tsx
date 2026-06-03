interface CodeDiffProps {
  oldCode: string
  newCode: string
  startLine: number | null
  endLine: number | null
}

/** A single code block with an optional left line-number gutter. When
 *  `startLineNumber` is null no gutter is shown (graceful degrade). */
function CodeBlock({
  code,
  startLineNumber,
  tone,
}: {
  code: string
  startLineNumber: number | null
  tone: "removed" | "added"
}) {
  const lines = code.split("\n")
  const color = tone === "removed" ? "var(--beacon-fail)" : "var(--beacon-pass)"
  return (
    <pre
      className="beacon-mono overflow-x-auto rounded border px-0 py-2 text-xs leading-relaxed"
      style={{ borderColor: color, background: "var(--beacon-ground)" }}
    >
      {lines.map((line, index) => (
        <div key={index} className="flex">
          {startLineNumber !== null && (
            <span
              className="select-none px-2 text-right"
              style={{ minWidth: "2.5rem", color: "var(--beacon-text-faint)" }}
              aria-hidden
            >
              {startLineNumber + index}
            </span>
          )}
          <span className="px-2" style={{ color: "var(--beacon-text)" }}>
            <span style={{ color }}>{tone === "removed" ? "- " : "+ "}</span>
            {line || " "}
          </span>
        </div>
      ))}
    </pre>
  )
}

export function CodeDiff({ oldCode, newCode, startLine, endLine }: CodeDiffProps) {
  const hasLines = startLine !== null && endLine !== null
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="beacon-label">DIFF</span>
        <span className="text-xs" style={{ color: "var(--beacon-text-faint)" }}>
          {hasLines
            ? startLine === endLine
              ? `replaces line ${startLine}`
              : `replaces lines ${startLine}–${endLine}`
            : "location not found in file"}
        </span>
      </div>
      <CodeBlock code={oldCode} startLineNumber={hasLines ? startLine : null} tone="removed" />
      <CodeBlock code={newCode} startLineNumber={hasLines ? startLine : null} tone="added" />
    </div>
  )
}
