import { describe, expect, it } from "vitest"

import { splitLinkedText } from "./linkify"

describe("splitLinkedText", () => {
  it("separates http and https URLs from surrounding text", () => {
    expect(splitLinkedText("See https://example.com/a and http://example.test/b.")).toEqual([
      { type: "text", text: "See " },
      { type: "link", text: "https://example.com/a", href: "https://example.com/a" },
      { type: "text", text: " and " },
      { type: "link", text: "http://example.test/b", href: "http://example.test/b" },
      { type: "text", text: "." },
    ])
  })

  it("keeps trailing punctuation outside the link target", () => {
    expect(splitLinkedText("(https://example.com/path), then stop")).toEqual([
      { type: "text", text: "(" },
      { type: "link", text: "https://example.com/path", href: "https://example.com/path" },
      { type: "text", text: "), then stop" },
    ])
  })
})
