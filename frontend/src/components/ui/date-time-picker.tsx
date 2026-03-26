import { useState, useCallback, useMemo } from "react"
import { format, parse } from "date-fns"
import { CalendarIcon, ChevronUp, ChevronDown } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface DateTimePickerProps {
  value: string // "YYYY-MM-DDTHH:mm" format
  onChange: (value: string) => void
  className?: string
}

function TimeSegment({
  value,
  onChange,
  min,
  max,
  pad = true,
}: {
  value: number
  onChange: (value: number) => void
  min: number
  max: number
  pad?: boolean
}) {
  const increment = () => onChange(value >= max ? min : value + 1)
  const decrement = () => onChange(value <= min ? max : value - 1)

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={increment}
        className="flex h-5 w-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-medium tabular-nums text-foreground">
        {pad ? String(value).padStart(2, "0") : value}
      </span>
      <button
        type="button"
        onClick={decrement}
        className="flex h-5 w-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

function AmPmToggle({ value, onChange }: { value: "AM" | "PM"; onChange: (value: "AM" | "PM") => void }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        type="button"
        onClick={() => onChange("AM")}
        className="flex h-5 w-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-medium text-foreground">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange("PM")}
        className="flex h-5 w-8 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

export function DateTimePicker({ value, onChange, className }: DateTimePickerProps) {
  const [open, setOpen] = useState(false)

  const dateValue = value ? new Date(value) : new Date()
  const timeValue = value ? value.slice(11, 16) : "00:00"

  const { hour12, minute, period } = useMemo(() => {
    const [hourStr, minStr] = timeValue.split(":")
    const hour24 = parseInt(hourStr, 10)
    const isPm = hour24 >= 12
    const displayHour = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
    return {
      hour12: displayHour,
      minute: parseInt(minStr, 10),
      period: (isPm ? "PM" : "AM") as "AM" | "PM",
    }
  }, [timeValue])

  const buildTimeString = useCallback(
    (newHour12: number, newMinute: number, newPeriod: "AM" | "PM") => {
      let hour24 = newHour12
      if (newPeriod === "AM" && newHour12 === 12) hour24 = 0
      else if (newPeriod === "PM" && newHour12 !== 12) hour24 = newHour12 + 12
      return `${String(hour24).padStart(2, "0")}:${String(newMinute).padStart(2, "0")}`
    },
    []
  )

  const handleDateSelect = useCallback(
    (day: Date | undefined) => {
      if (!day) return
      const formatted = format(day, "yyyy-MM-dd")
      onChange(`${formatted}T${timeValue}`)
    },
    [timeValue, onChange]
  )

  const updateTime = useCallback(
    (newHour12: number, newMinute: number, newPeriod: "AM" | "PM") => {
      const datePart = value ? value.slice(0, 10) : format(new Date(), "yyyy-MM-dd")
      onChange(`${datePart}T${buildTimeString(newHour12, newMinute, newPeriod)}`)
    },
    [value, onChange, buildTimeString]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-foreground" />
          {value
            ? format(parse(value, "yyyy-MM-dd'T'HH:mm", new Date()), "MMM d, yyyy  h:mm a")
            : "Pick a date"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={handleDateSelect}
          defaultMonth={dateValue}
        />
        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center justify-center gap-1">
            <TimeSegment
              value={hour12}
              onChange={(h) => updateTime(h, minute, period)}
              min={1}
              max={12}
            />
            <span className="flex h-8 items-center text-sm font-medium text-muted-foreground">:</span>
            <TimeSegment
              value={minute}
              onChange={(m) => updateTime(hour12, m, period)}
              min={0}
              max={59}
            />
            <div className="ml-1">
              <AmPmToggle
                value={period}
                onChange={(p) => updateTime(hour12, minute, p)}
              />
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
