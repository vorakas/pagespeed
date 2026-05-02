import type React from "react"

// Render Obsidian wikilinks ([[Stem|ID]] / [[Stem\|ID]]) inline as
// styled chips, plus highlight known team-member names so prose like
// "Leslie 02:28 UTC replied to Miguel Garrido…" reads as a sequence
// of named actors instead of a wall of identical white text.
//
// Used by both `DailyStatusSummary` (Daily Status panel bullets) and
// `HeroStrip` (Project Status reasons under the AT RISK badge), and
// `StatusHistory` (per-snapshot headlines). They all consume the same
// `snap.headline` field in the snapshot payload, so the rendering
// rule lives here to stay consistent across views.
//
// Works on historical payloads — cleanup happens at render time,
// independent of what the parser stored.

const HEADLINE_WIKILINK_RE = /\[\[([^\]]+?)\]\]/g

// Curated list of teammates that appear in the vault's status-page
// prose. Curated rather than regex-detected because a generic
// "two consecutive Capitalized words" pattern false-matches every
// proper noun in the codebase ("MAO Order Integration", "Cybersource
// Failover", "Asana Export", etc.). Add new names here as the team
// grows.
const KNOWN_TEAM = [
  "Leslie Manzanera Ornelas",
  "Harry Donihue",
  "Miguel Garrido",
  "Tan Nguyen",
  "Eilat Vardi",
  "Saurabh Wawarkar",
  "Jagrit Raizada",
  "Adam Blais",
  "Kyle Walters",
  "Kyle Williams",
  "Seth Wilde",
  "Denzel Perez",
  "Estele Kim",
  // First-name-only references that appear independently in prose.
  // Listed last so the longer full names match first via length sort.
  "Leslie",
  "Harry",
  "Miguel",
  "Tan",
  "Eilat",
  "Saurabh",
  "Jagrit",
  "Adam",
  "Kyle",
  "Seth",
  "Denzel",
  "Estele",
  "Sakshi",
  "Héctor",
] as const

const NAME_PATTERN = new RegExp(
  `\\b(${[...KNOWN_TEAM]
    .sort((a, b) => b.length - a.length)
    .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})\\b`,
  "g",
)

export function renderHeadlineSegments(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  HEADLINE_WIKILINK_RE.lastIndex = 0
  while ((match = HEADLINE_WIKILINK_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      out.push(...renderTextWithNames(text.slice(lastIndex, match.index), `pre-${match.index}`))
    }
    out.push(
      <code key={`wl-${match.index}`} style={inlineTaskIdStyle}>
        {wikilinkDisplay(match[1])}
      </code>,
    )
    lastIndex = HEADLINE_WIKILINK_RE.lastIndex
  }
  if (lastIndex < text.length) {
    out.push(...renderTextWithNames(text.slice(lastIndex), `tail-${lastIndex}`))
  }
  // Collapse to bare string when no wikilinks or names were found, so
  // the DOM doesn't gain a one-element array wrapper for every plain
  // bullet.
  if (out.length === 1 && typeof out[0] === "string") return out
  return out.length === 0 ? [text] : out
}

function renderTextWithNames(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  NAME_PATTERN.lastIndex = 0
  while ((match = NAME_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) out.push(text.slice(lastIndex, match.index))
    out.push(
      <span key={`${keyPrefix}-${match.index}`} style={inlineNameStyle}>
        {match[0]}
      </span>,
    )
    lastIndex = NAME_PATTERN.lastIndex
  }
  if (lastIndex < text.length) out.push(text.slice(lastIndex))
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

const inlineNameStyle: React.CSSProperties = {
  color: "var(--lcc-violet)",
  fontWeight: 500,
  whiteSpace: "nowrap",
}
