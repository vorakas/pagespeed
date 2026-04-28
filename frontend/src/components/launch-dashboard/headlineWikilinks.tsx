import type React from "react"

// Render Obsidian wikilinks ([[Stem|ID]] / [[Stem\|ID]]) inline as
// styled chips. The orchestrator sometimes leaks the table-cell form
// (with backslash-escaped pipe) into the status-page headline, which
// is prose. Without this the dashboard would show raw `[[…]]` markup.
//
// Used by both `DailyStatusSummary` (Daily Status panel bullets) and
// `HeroStrip` (Project Status reasons under the AT RISK badge). They
// consume the same `snap.headline` field in the snapshot payload, so
// the rendering rule lives here to stay consistent across both views.
//
// Works on historical payloads — cleanup happens at render time,
// independent of what the parser stored.

const HEADLINE_WIKILINK_RE = /\[\[([^\]]+?)\]\]/g

export function renderHeadlineSegments(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  HEADLINE_WIKILINK_RE.lastIndex = 0
  while ((match = HEADLINE_WIKILINK_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push(text.slice(lastIndex, match.index))
    }
    out.push(
      <code key={`wl-${match.index}`} style={inlineTaskIdStyle}>
        {wikilinkDisplay(match[1])}
      </code>
    )
    lastIndex = HEADLINE_WIKILINK_RE.lastIndex
  }
  if (lastIndex < text.length) {
    out.push(text.slice(lastIndex))
  }
  // Collapse to bare string when no wikilinks were found, so the DOM
  // doesn't gain a one-element array wrapper for every plain bullet.
  return out.length === 0 ? [text] : out
}

function wikilinkDisplay(inner: string): string {
  // `inner` is the text between `[[` and `]]`. Forms in the wild:
  //   "904692 - Title\|904692"  (table-cell form leaked into prose)
  //   "904692 - Title|904692"   (correct prose form)
  //   "904692 - Title"          (no display alias)
  // Strip backslash escape first so the partition on `|` works uniformly.
  const cleaned = inner.replace(/\\\|/g, "|")
  const pipeIdx = cleaned.indexOf("|")
  if (pipeIdx !== -1) {
    return cleaned.slice(pipeIdx + 1).trim() || cleaned.slice(0, pipeIdx).trim()
  }
  // No alias — keep just the leading ID token (everything before " - ").
  const dashIdx = cleaned.indexOf(" - ")
  return (dashIdx !== -1 ? cleaned.slice(0, dashIdx) : cleaned).trim()
}

const inlineTaskIdStyle: React.CSSProperties = {
  fontFamily: "var(--font-mono, monospace)",
  fontSize: "0.92em",
  padding: "1px 6px",
  borderRadius: 4,
  background: "rgba(255,255,255,0.06)",
  color: "var(--lcc-text)",
  border: "1px solid var(--lcc-glass-border, rgba(255,255,255,0.1))",
  whiteSpace: "nowrap",
}
