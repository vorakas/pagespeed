import { useRef, type CSSProperties } from "react"

/**
 * Live syntax-highlighted NRQL editor.
 *
 * A <textarea> cannot render colored text, so we layer a transparent textarea
 * (visible caret + selection) over a scroll-synced <pre> that paints the
 * tokenized, colored query underneath. Both share identical typography and
 * box metrics so the glyphs line up exactly.
 */

interface NrqlEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  minHeight?: number
}

type TokenType = "kw" | "fn" | "str" | "num" | "punc" | "text" | "ws"

const KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "FACET", "SINCE", "UNTIL", "LIMIT", "TIMESERIES",
  "AS", "AND", "OR", "NOT", "IN", "LIKE", "IS", "NULL", "WITH", "COMPARE",
  "EXTRAPOLATE", "ORDER", "BY", "OFFSET", "AGO", "SHOW", "EVENT", "TYPES",
  "AUTO", "TODAY", "YESTERDAY", "WEEK", "MONTH", "DAY", "HOUR", "MINUTE",
  "MINUTES", "HOURS", "DAYS", "SECONDS", "TRUE", "FALSE", "ASC", "DESC",
])

const TOKEN_COLORS: Record<TokenType, string> = {
  kw: "var(--lcc-violet)",
  fn: "var(--lcc-blue)",
  str: "var(--lcc-green)",
  num: "var(--lcc-amber)",
  punc: "var(--lcc-text-dim)",
  text: "var(--lcc-text)",
  ws: "inherit",
}

const TOKEN_RE =
  /('(?:[^'\\]|\\.)*'?)|("(?:[^"\\]|\\.)*"?)|(\d+(?:\.\d+)?)|([A-Za-z_][A-Za-z0-9_.]*)|(\s+)|([^\sA-Za-z0-9_'"]+)/g

interface Token {
  value: string
  type: TokenType
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let match: RegExpExecArray | null
  TOKEN_RE.lastIndex = 0

  while ((match = TOKEN_RE.exec(source)) !== null) {
    const [whole, str1, str2, num, word, ws, punc] = match
    if (str1 ?? str2) {
      tokens.push({ value: whole, type: "str" })
    } else if (num) {
      tokens.push({ value: whole, type: "num" })
    } else if (word) {
      const nextIsParen = source[TOKEN_RE.lastIndex] === "("
      if (nextIsParen) {
        tokens.push({ value: whole, type: "fn" })
      } else if (KEYWORDS.has(word.toUpperCase())) {
        tokens.push({ value: whole, type: "kw" })
      } else {
        tokens.push({ value: whole, type: "text" })
      }
    } else if (ws) {
      tokens.push({ value: whole, type: "ws" })
    } else if (punc) {
      tokens.push({ value: whole, type: "punc" })
    }
  }
  return tokens
}

export function NrqlEditor({ value, onChange, placeholder, minHeight = 90 }: NrqlEditorProps) {
  const preRef = useRef<HTMLPreElement>(null)

  const shared: CSSProperties = {
    margin: 0,
    padding: "8px 10px",
    fontFamily: "var(--aurora-font-mono)",
    fontSize: 12,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    overflowWrap: "break-word",
    border: 0,
    boxSizing: "border-box",
  }

  const tokens = tokenize(value)

  return (
    <div
      className="aurora-nrql-editor"
      style={{
        position: "relative",
        background: "var(--glass-hi)",
        border: "1px solid var(--glass-border)",
        borderRadius: "var(--lcc-radius-sm)",
      }}
    >
      <pre
        ref={preRef}
        aria-hidden="true"
        style={{
          ...shared,
          position: "absolute",
          inset: 0,
          color: "var(--lcc-text)",
          pointerEvents: "none",
          overflow: "hidden",
        }}
      >
        {tokens.map((token, index) => (
          <span key={index} style={{ color: TOKEN_COLORS[token.type] }}>
            {token.value}
          </span>
        ))}
        {/* keep the final blank line visible while typing */}
        {value.endsWith("\n") ? "​" : null}
      </pre>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={(event) => {
          if (preRef.current) preRef.current.scrollTop = event.currentTarget.scrollTop
        }}
        placeholder={placeholder}
        spellCheck={false}
        style={{
          ...shared,
          position: "relative",
          display: "block",
          width: "100%",
          minHeight,
          resize: "vertical",
          background: "transparent",
          color: "transparent",
          caretColor: "var(--lcc-text)",
          outline: "none",
        }}
      />
    </div>
  )
}
