import { describe, expect, it } from "vitest"

import { applyRichTextFormat, renderRichTextHtml } from "./rich-text-formatting"

describe("applyRichTextFormat", () => {
  it("wraps selected text for inline emphasis", () => {
    expect(applyRichTextFormat("Change this", { start: 7, end: 11 }, "bold")).toEqual({
      value: "Change **this**",
      selection: { start: 9, end: 13 },
    })

    expect(applyRichTextFormat("Change this", { start: 7, end: 11 }, "italic").value).toBe(
      "Change *this*"
    )
    expect(applyRichTextFormat("Change this", { start: 7, end: 11 }, "underline").value).toBe(
      "Change <u>this</u>"
    )
  })

  it("adds bullet and numbered prefixes to selected lines", () => {
    expect(applyRichTextFormat("first\nsecond", { start: 0, end: 12 }, "bullet-list").value).toBe(
      "- first\n- second"
    )

    expect(applyRichTextFormat("first\nsecond", { start: 0, end: 12 }, "numbered-list").value).toBe(
      "1. first\n2. second"
    )
  })

  it("adds list prefixes to blank selected lines", () => {
    expect(
      applyRichTextFormat("first\n\nsecond", { start: 6, end: 6 }, "bullet-list").value
    ).toBe("first\n- \nsecond")

    expect(
      applyRichTextFormat("first\n\nsecond", { start: 6, end: 6 }, "numbered-list").value
    ).toBe("first\n1. \nsecond")
  })

  it("strips bullet prefixes when converting to numbered lists", () => {
    expect(applyRichTextFormat("- item", { start: 0, end: 6 }, "numbered-list").value).toBe(
      "1. item"
    )
  })

  it("wraps selected text with a sanitized color span", () => {
    expect(
      applyRichTextFormat("Use red", { start: 4, end: 7 }, "color", "#dc2626").value
    ).toBe('Use <span style="color: #dc2626">red</span>')

    expect(applyRichTextFormat("Use red", { start: 4, end: 7 }, "color", "red").value).toBe(
      'Use <span style="color: #2563eb">red</span>'
    )
  })
})

describe("renderRichTextHtml", () => {
  it("renders allowed formatting and escapes unsafe HTML", () => {
    expect(
      renderRichTextHtml(
        '**Bold** *italic* <u>under</u> <span style="color: #16a34a">green</span> <script>x</script>'
      )
    ).toBe(
      '<p><strong>Bold</strong> <em>italic</em> <u>under</u> <span style="color: #16a34a">green</span> &lt;script&gt;x&lt;/script&gt;</p>'
    )
  })

  it("renders bullet and numbered lists", () => {
    expect(renderRichTextHtml("- one\n- two\n\n1. first\n2. second")).toBe(
      "<ul><li>one</li><li>two</li></ul><br /><ol><li>first</li><li>second</li></ol>"
    )
  })
})
