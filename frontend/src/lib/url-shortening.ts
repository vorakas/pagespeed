/**
 * Shorten verbose URLs in user-facing text to compact, recognizable
 * labels. Used by the per-ticket drawer (and potentially other places
 * that render markdown bodies) to keep long Lampstrack / Asana URLs
 * from blowing out line lengths.
 *
 * Supported patterns:
 *
 *   https://lampstrack.lampsplus.com/secure/Tests.jspa#/testPlayer/<TOKEN>
 *   https://lampstrack.lampsplus.com/secure/Tests.jspa#/testCase/<TOKEN>
 *   https://lampstrack.lampsplus.com/browse/<TOKEN>
 *     → display the trailing ticket / test-case token (e.g. "TC-C1484",
 *       "LP-1234", "LAMPSPLUS-5678")
 *
 *   https://app.asana.com/<workspace>/<project>/task/<TASK_ID>(?...)
 *     → display "task/<TASK_ID>" (Asana has no human-friendly key)
 *
 * Anything else is left alone — callers can use {@link shortenKnownUrl}
 * directly or use {@link shortenLinksInHtml} to post-process a chunk of
 * HTML output in one pass.
 */

const LAMPSTRACK_PATTERN =
  /^https?:\/\/lampstrack\.lampsplus\.com\/(?:secure\/Tests\.jspa#\/(?:testPlayer|testCase)\/|browse\/)([^\s/?#]+)/i

const ASANA_TASK_PATTERN =
  /^https?:\/\/app\.asana\.com\/[^\s]*?\/task\/(\d+)(?:[\/?#]|$)/i

/**
 * Return a short display label for ``url``, or ``null`` if no known
 * pattern matches. The original URL is suitable as a fallback display
 * when this returns ``null``.
 */
export function shortenKnownUrl(url: string): string | null {
  const lampstrack = url.match(LAMPSTRACK_PATTERN)
  if (lampstrack) return lampstrack[1]

  const asana = url.match(ASANA_TASK_PATTERN)
  if (asana) return `task/${asana[1]}`

  return null
}

/**
 * Replace anchor inner text with a shortened label when (and only when)
 * the link's display text equals its ``href`` — i.e. it was an
 * autolinked or bare-URL link in the source markdown. Markdown links
 * with an explicit display text like ``[See it](https://…)`` are left
 * alone so the author's chosen label survives.
 */
export function shortenLinksInHtml(html: string): string {
  // marked's GFM-style auto-link output: <a href="X">X</a>
  // We use a permissive regex (no nested-tag handling needed since the
  // text content of an auto-link is just the URL).
  return html.replace(
    /<a([^>]*?)href="([^"]+)"([^>]*?)>([^<]+)<\/a>/g,
    (full, beforeAttrs: string, href: string, afterAttrs: string, text: string) => {
      // marked HTML-escapes `&` in URLs, so compare against the
      // unescaped form too before deciding the text matches the href.
      const decoded = text
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
      if (decoded !== href) return full
      const short = shortenKnownUrl(href)
      if (!short) return full
      return `<a${beforeAttrs}href="${href}"${afterAttrs}>${escapeHtml(short)}</a>`
    },
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
