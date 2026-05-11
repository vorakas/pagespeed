/**
 * Source-level repairs for Jira / Confluence rich-text markdown
 * exports before they reach :func:`marked.parse`.
 *
 * These fixes operate on the raw markdown string. HTML-level fixes
 * (table normalization, link shortening) live in their own modules
 * and run *after* parsing.
 */

/**
 * Repair common malformations in Jira's markdown export.
 *
 * Currently handles:
 *
 * 1. **Doubled link syntax** — Jira sometimes emits ``[TEXT](TEXT)(URL)``
 *    instead of ``[TEXT](URL)``. The link text appears both in the
 *    brackets *and* as the first paren group, with the real URL as a
 *    trailing second paren. Marked then renders this as a broken
 *    local-href link plus a second autolinked URL right after, which
 *    looks like duplicate content to the user. Collapse to the
 *    standard form so only one link survives.
 *
 * 2. **Non-breaking spaces** (`` ``) — Confluence-flavored exports
 *    pepper these between every word in some cells. Browsers refuse to
 *    break on them, so a paragraph full of NBSP becomes one
 *    horizontally-scrolling line. Convert back to regular spaces for
 *    layout sanity. (If we ever want NBSP for legitimate reasons —
 *    "Mr. Smith" etc. — the source format isn't trustworthy enough to
 *    preserve them anyway.)
 *
 * 3. **Spaced bold labels** — Jira comments sometimes emit label-style
 *    bold text as ``**AC7: **Next words``. CommonMark does not treat a
 *    delimiter preceded by whitespace as a closing delimiter, so the
 *    raw asterisks leak into the UI. Move the trailing space outside
 *    the bold marker: ``**AC7:** Next words``.
 */
export function repairJiraMarkdownSource(md: string): string {
  if (!md) return md

  let out = md

  // 1. Doubled link syntax: [TEXT](TEXT)(URL) → [TEXT](URL).
  //    `\1` backreferences the bracket text; we only collapse when the
  //    first paren equals the bracket text exactly, so a legitimate
  //    sequence like `[See it](page)(extra note)` is left untouched.
  //    URL is matched up to the first closing paren — Jira test-cycle
  //    URLs don't contain literal `)` (they encode `}` as `%7D`), so
  //    this is safe in practice.
  out = out.replace(
    /\[([^\]\n]+)\]\(([^)\n]+)\)\((https?:\/\/[^)\s]+)\)/g,
    (full, text: string, dupText: string, url: string) =>
      text.trim() === dupText.trim() ? `[${text}](${url})` : full,
  )

  // 2. Non-breaking spaces → regular spaces.
  out = out.replace(/\u00A0/g, " ")

  // 3. Spaced bold labels: **AC7: **Text → **AC7:** Text.
  out = out.replace(/\*\*([^*\n]{1,80}?:)\s+\*\*(?=\S)/g, "**$1** ")

  return out
}
