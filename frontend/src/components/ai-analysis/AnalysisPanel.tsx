import { useRef, useEffect } from "react"
import { marked } from "marked"
import { Card, CardContent } from "@/components/ui/card"
import { escapeHtml } from "@/lib/utils"

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
    <Card className="flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">{provider}</h3>
        {model && (
          <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
            {model}
          </span>
        )}
      </div>
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[500px]"
      >
        {error && (
          <p className="text-sm text-score-poor">{error}</p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`rounded-lg p-3 ${
              msg.role === "user"
                ? "bg-primary/10 border border-primary/20"
                : "bg-muted/50"
            }`}
          >
            <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">
              {msg.label || (msg.role === "user" ? "You" : provider)}
            </p>
            {msg.role === "user" ? (
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {msg.content}
              </p>
            ) : (
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-sm [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_li]:my-0.5 [&_p]:my-1 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_code]:text-xs [&_pre]:text-xs [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded"
                dangerouslySetInnerHTML={{
                  __html: marked.parse(msg.content) as string,
                }}
              />
            )}
          </div>
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
            Thinking...
          </div>
        )}
      </div>
      {(tokenUsage.input > 0 || tokenUsage.output > 0) && (
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          Tokens: {tokenUsage.input.toLocaleString()} in / {tokenUsage.output.toLocaleString()} out
          {turnCount > 1 && (
            <span className="ml-1">({turnCount} turns)</span>
          )}
        </div>
      )}
    </Card>
  )
}
