import * as React from "react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"

interface PopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
}

interface PopoverTriggerProps {
  children: React.ReactNode
  asChild?: boolean
}

interface PopoverContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "center" | "end"
  sideOffset?: number
}

const PopoverContext = React.createContext<{
  open: boolean
  onOpenChange: (open: boolean) => void
  triggerRef: React.RefObject<HTMLDivElement | null>
}>({
  open: false,
  onOpenChange: () => {},
  triggerRef: { current: null },
})

function Popover({ open, onOpenChange, children }: PopoverProps) {
  const triggerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      const popover = document.querySelector("[data-popover-content]")
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popover &&
        !popover.contains(target)
      ) {
        onOpenChange(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEscape)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEscape)
    }
  }, [open, onOpenChange])

  return (
    <PopoverContext.Provider value={{ open, onOpenChange, triggerRef }}>
      <div className="relative inline-block">{children}</div>
    </PopoverContext.Provider>
  )
}

function PopoverTrigger({ children }: PopoverTriggerProps) {
  const { onOpenChange, open, triggerRef } = React.useContext(PopoverContext)
  return (
    <div ref={triggerRef} onClick={() => onOpenChange(!open)} className="cursor-pointer">
      {children}
    </div>
  )
}

// Portal the popover content to <body> so it escapes any parent stacking
// context (notably aurora-panel's backdrop-filter, which would otherwise
// trap the popover behind sibling panels regardless of inner z-index).
function PopoverContent({
  className,
  align = "start",
  sideOffset = 4,
  children,
  ...props
}: PopoverContentProps) {
  const { open, triggerRef } = React.useContext(PopoverContext)
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setCoords(null)
      return
    }
    const computePosition = () => {
      const trigger = triggerRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const top = rect.bottom + sideOffset
      let left = rect.left
      const contentWidth = contentRef.current?.offsetWidth ?? 0
      if (align === "end") left = rect.right - contentWidth
      else if (align === "center") left = rect.left + rect.width / 2 - contentWidth / 2
      setCoords({ top, left })
    }
    computePosition()
    window.addEventListener("scroll", computePosition, true)
    window.addEventListener("resize", computePosition)
    return () => {
      window.removeEventListener("scroll", computePosition, true)
      window.removeEventListener("resize", computePosition)
    }
  }, [open, align, sideOffset, triggerRef])

  if (!open) return null

  const node = (
    <div
      ref={contentRef}
      data-popover-content
      style={{
        position: "fixed",
        top: coords?.top ?? -9999,
        left: coords?.left ?? -9999,
        visibility: coords ? "visible" : "hidden",
      }}
      className={cn(
        "z-50 rounded-lg border border-border bg-card p-0 shadow-lg",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )

  return createPortal(node, document.body)
}

export { Popover, PopoverTrigger, PopoverContent }
