export type LinkedTextPart =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string }

const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi
const TRAILING_PUNCTUATION_PATTERN = /[),.;:!?]+$/

export function splitLinkedText(value: string): LinkedTextPart[] {
  const parts: LinkedTextPart[] = []
  let cursor = 0

  for (const match of value.matchAll(URL_PATTERN)) {
    const rawUrl = match[0]
    const start = match.index ?? 0
    const trailingPunctuation = rawUrl.match(TRAILING_PUNCTUATION_PATTERN)?.[0] ?? ""
    const url = trailingPunctuation ? rawUrl.slice(0, -trailingPunctuation.length) : rawUrl

    if (!url) continue

    if (start > cursor) {
      parts.push({ type: "text", text: value.slice(cursor, start) })
    }

    parts.push({ type: "link", text: url, href: url })
    cursor = start + url.length
  }

  if (cursor < value.length) {
    parts.push({ type: "text", text: value.slice(cursor) })
  }

  return parts
}
