import * as React from "react"
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

function PopoverContent({
  className,
  align = "start",
  children,
  ...props
}: PopoverContentProps) {
  const { open } = React.useContext(PopoverContext)
  if (!open) return null

  return (
    <div
      data-popover-content
      className={cn(
        "absolute top-full z-50 mt-1 rounded-lg border border-border bg-card p-0 shadow-lg",
        align === "start" && "left-0",
        align === "center" && "left-1/2 -translate-x-1/2",
        align === "end" && "right-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
