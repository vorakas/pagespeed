import { useState, useCallback } from "react"
import { format, parse } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface DateTimePickerProps {
  value: string // "YYYY-MM-DDTHH:mm" format
  onChange: (value: string) => void
  className?: string
}

export function DateTimePicker({ value, onChange, className }: DateTimePickerProps) {
  const [open, setOpen] = useState(false)

  const dateValue = value ? new Date(value) : new Date()
  const timeValue = value ? value.slice(11, 16) : "00:00"

  const handleDateSelect = useCallback(
    (day: Date | undefined) => {
      if (!day) return
      const formatted = format(day, "yyyy-MM-dd")
      onChange(`${formatted}T${timeValue}`)
    },
    [timeValue, onChange]
  )

  const handleTimeChange = useCallback(
    (newTime: string) => {
      const datePart = value ? value.slice(0, 10) : format(new Date(), "yyyy-MM-dd")
      onChange(`${datePart}T${newTime}`)
    },
    [value, onChange]
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
          <CalendarIcon className="mr-2 h-4 w-4" />
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
        <div className="border-t border-border px-3 py-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">Time</label>
            <Input
              type="time"
              value={timeValue}
              onChange={(e) => handleTimeChange(e.target.value)}
              className="h-8 w-auto text-sm"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
