import { Bold, Eye, Italic, List, ListOrdered, Underline } from "lucide-react"
import type { ReactNode } from "react"
import { useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { applyRichTextFormat, renderRichTextHtml, type RichTextFormat } from "@/lib/rich-text-formatting"
import { cn } from "@/lib/utils"

const COLOR_SWATCHES = ["#2563eb", "#16a34a", "#dc2626", "#ca8a04", "#9333ea"]

interface RichTextTextareaProps {
  value: string
  onChange: (value: string) => void
  rows?: number
  placeholder?: string
  disabled?: boolean
  "aria-label"?: string
  className?: string
}

export function RichTextTextarea({
  value,
  onChange,
  rows = 5,
  placeholder,
  disabled = false,
  "aria-label": ariaLabel,
  className,
}: RichTextTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  const applyFormat = (format: RichTextFormat, color?: string) => {
    const textarea = textareaRef.current
    const selection = textarea
      ? { start: textarea.selectionStart, end: textarea.selectionEnd }
      : { start: value.length, end: value.length }
    const next = applyRichTextFormat(value, selection, format, color)

    onChange(next.value)
    requestAnimationFrame(() => {
      textarea?.focus()
      textarea?.setSelectionRange(next.selection.start, next.selection.end)
    })
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/30 p-1">
        <ToolbarButton label="Bold" disabled={disabled} onClick={() => applyFormat("bold")}>
          <Bold className="size-3.5" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Italic" disabled={disabled} onClick={() => applyFormat("italic")}>
          <Italic className="size-3.5" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Underline" disabled={disabled} onClick={() => applyFormat("underline")}>
          <Underline className="size-3.5" aria-hidden="true" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <ToolbarButton label="Bullet list" disabled={disabled} onClick={() => applyFormat("bullet-list")}>
          <List className="size-3.5" aria-hidden="true" />
        </ToolbarButton>
        <ToolbarButton label="Numbered list" disabled={disabled} onClick={() => applyFormat("numbered-list")}>
          <ListOrdered className="size-3.5" aria-hidden="true" />
        </ToolbarButton>
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        {COLOR_SWATCHES.map((color) => (
          <button
            key={color}
            type="button"
            title={`Text color ${color}`}
            aria-label={`Text color ${color}`}
            disabled={disabled}
            onClick={() => applyFormat("color", color)}
            className="size-6 rounded-md border border-border shadow-xs transition-opacity hover:opacity-80 disabled:pointer-events-none disabled:opacity-40"
            style={{ backgroundColor: color }}
          />
        ))}
        <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />
        <ToolbarButton label="Preview formatting" onClick={() => setShowPreview((current) => !current)}>
          <Eye className="size-3.5" aria-hidden="true" />
        </ToolbarButton>
      </div>
      <Textarea
        ref={textareaRef}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={rows}
        aria-label={ariaLabel}
      />
      {showPreview ? <RichTextPreview value={value} /> : null}
    </div>
  )
}

export function RichTextPreview({ value, className }: { value: string; className?: string }) {
  return (
    <div
      className={cn(
        "min-h-16 rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground",
        "[&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_u]:underline [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
        className
      )}
      dangerouslySetInnerHTML={{ __html: renderRichTextHtml(value) }}
    />
  )
}

function ToolbarButton({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
