export type RichTextFormat =
  | "bold"
  | "italic"
  | "underline"
  | "bullet-list"
  | "numbered-list"
  | "color"

export type TextSelection = {
  start: number
  end: number
}

const DEFAULT_SAMPLE_TEXT = "text"

export function applyRichTextFormat(
  value: string,
  selection: TextSelection,
  format: RichTextFormat,
  color = "#2563eb"
): { value: string; selection: TextSelection } {
  if (format === "bullet-list") return applyLinePrefix(value, selection, "- ")
  if (format === "numbered-list") return applyNumberedList(value, selection)

  const selectedText = value.slice(selection.start, selection.end)
  const text = selectedText || DEFAULT_SAMPLE_TEXT
  const wrapper = getInlineWrapper(format, color)
  const replacement = `${wrapper.before}${text}${wrapper.after}`
  const nextValue = replaceSelection(value, selection, replacement)
  const cursorStart = selection.start + wrapper.before.length
  const cursorEnd = cursorStart + text.length

  return {
    value: nextValue,
    selection: { start: cursorStart, end: cursorEnd },
  }
}

export function renderRichTextHtml(value: string): string {
  const lines = value.replace(/\r\n/g, "\n").split("\n")
  const blocks: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(`<li>${renderInlineRichText(lines[index].replace(/^\s*[-*]\s+/, ""))}</li>`)
        index += 1
      }
      blocks.push(`<ul>${items.join("")}</ul>`)
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = []
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(`<li>${renderInlineRichText(lines[index].replace(/^\s*\d+\.\s+/, ""))}</li>`)
        index += 1
      }
      blocks.push(`<ol>${items.join("")}</ol>`)
      continue
    }

    if (!line.trim()) {
      blocks.push("<br />")
      index += 1
      continue
    }

    const paragraphLines: string[] = []
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index])
    ) {
      paragraphLines.push(renderInlineRichText(lines[index]))
      index += 1
    }
    blocks.push(`<p>${paragraphLines.join("<br />")}</p>`)
  }

  return blocks.join("")
}

function applyLinePrefix(value: string, selection: TextSelection, prefix: string) {
  const range = getSelectedLineRange(value, selection)
  const chunk = value.slice(range.start, range.end)
  const replacement =
    chunk === ""
      ? prefix
      : chunk
          .split("\n")
          .map((line) => (line.trim() ? `${prefix}${stripListPrefix(line)}` : line))
          .join("\n")

  return {
    value: replaceSelection(value, range, replacement),
    selection: { start: range.start, end: range.start + replacement.length },
  }
}

function applyNumberedList(value: string, selection: TextSelection) {
  const range = getSelectedLineRange(value, selection)
  const chunk = value.slice(range.start, range.end)
  let itemNumber = 1
  const replacement =
    chunk === ""
      ? "1. "
      : chunk
          .split("\n")
          .map((line) => {
            if (!line.trim()) return line
            return `${itemNumber++}. ${stripListPrefix(line)}`
          })
          .join("\n")

  return {
    value: replaceSelection(value, range, replacement),
    selection: { start: range.start, end: range.start + replacement.length },
  }
}

function getSelectedLineRange(value: string, selection: TextSelection): TextSelection {
  const lineStart = value.lastIndexOf("\n", Math.max(0, selection.start - 1)) + 1
  const nextBreak = value.indexOf("\n", selection.end)
  return {
    start: lineStart,
    end: nextBreak === -1 ? value.length : nextBreak,
  }
}

function stripListPrefix(line: string) {
  return line.replace(/^\s*(?:[-*]|\d+\.)\s+/, "")
}

function getInlineWrapper(format: RichTextFormat, color: string) {
  switch (format) {
    case "bold":
      return { before: "**", after: "**" }
    case "italic":
      return { before: "*", after: "*" }
    case "underline":
      return { before: "<u>", after: "</u>" }
    case "color":
      return { before: `<span style="color: ${normalizeColor(color)}">`, after: "</span>" }
    default:
      return { before: "", after: "" }
  }
}

function replaceSelection(value: string, selection: TextSelection, replacement: string) {
  return `${value.slice(0, selection.start)}${replacement}${value.slice(selection.end)}`
}

function renderInlineRichText(value: string): string {
  let html = escapeHtml(value)

  html = html.replace(
    /&lt;span style=&quot;color:\s*(#[0-9a-fA-F]{6})&quot;&gt;([\s\S]*?)&lt;\/span&gt;/g,
    '<span style="color: $1">$2</span>'
  )
  html = html.replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, "<u>$1</u>")
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  html = html.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")

  return html
}

function normalizeColor(color: string) {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#2563eb"
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}
