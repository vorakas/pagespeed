import { useRef, useEffect } from "react"
import { marked } from "marked"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  label?: string
}

interface AnalysisPanelProps {
  provider: string
  model: string
  messages: ChatMessage[]
  tokenUsage: { input: number; output: number }
  turnCount: number
  loading: boolean
  error: string | null
}

export function AnalysisPanel({
  provider,
  model,
  messages,
  tokenUsage,
  turnCount,
  loading,
  error,
}: AnalysisPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading])

  return (
    <div className="aurora-panel flex flex-col overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--glass-border)" }}
      >
        <h3 className="aurora-text text-sm font-semibold">{provider}</h3>
        {model && (
          <span
            className="rounded-md px-2 py-0.5 text-[10px] font-medium"
            style={{
              fontFamily: "var(--aurora-font-mono)",
              color: "var(--lcc-text-dim)",
              background: "var(--glass-hi)",
              border: "1px solid var(--glass-border)",
            }}
          >
            {model}
          </span>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto p-4 max-h-[500px]"
      >
        {error && (
          <p className="text-sm" style={{ color: "var(--lcc-red)" }}>{error}</p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className="rounded-lg p-3"
            style={{
              background: msg.role === "user" ? "var(--lcc-violet-bg)" : "var(--glass-hi)",
              border: msg.role === "user"
                ? "1px solid color-mix(in srgb, var(--lcc-violet) 30%, transparent)"
                : "1px solid var(--glass-border)",
            }}
          >
            <p className="aurora-eyebrow mb-1">
              {msg.label || (msg.role === "user" ? "You" : provider)}
            </p>
            {msg.role === "user" ? (
              <p className="aurora-text whitespace-pre-wrap text-sm">
                {msg.content}
              </p>
            ) : (
              <div
                className="aurora-text prose prose-sm dark:prose-invert max-w-none text-sm [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5 [&_p]:my-1 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_code]:text-xs [&_pre]:text-xs"
                style={{ color: "var(--lcc-text)" }}
                dangerouslySetInnerHTML={{
                  __html: marked.parse(msg.content) as string,
                }}
              />
            )}
          </div>
        ))}
        {loading && (
          <div className="aurora-text-dim flex items-center gap-2 text-sm">
            <span
              className="inline-block h-2 w-2 animate-pulse rounded-full"
              style={{ background: "var(--lcc-violet)" }}
            />
            Thinking...
          </div>
        )}
      </div>
      {(tokenUsage.input > 0 || tokenUsage.output > 0) && (
        <div
          className="aurora-text-faint px-4 py-2 text-xs"
          style={{ borderTop: "1px solid var(--glass-border)", fontFamily: "var(--aurora-font-mono)" }}
        >
          Tokens: {tokenUsage.input.toLocaleString()} in / {tokenUsage.output.toLocaleString()} out
          {turnCount > 1 && (
            <span className="ml-1">({turnCount} turns)</span>
          )}
        </div>
      )}
    </div>
  )
}
