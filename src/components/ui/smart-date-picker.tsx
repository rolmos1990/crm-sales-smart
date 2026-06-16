"use client"

import * as React from "react"
import { addDays, addMonths, format, isSameDay } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type PresetId = "today" | "plus5" | "plus15" | "plus1m" | "plus2m" | "plus3m" | "custom"

const PRESETS: { id: PresetId; label: string }[] = [
  { id: "today",  label: "Hoy" },
  { id: "plus5",  label: "+5 días" },
  { id: "plus15", label: "+15 días" },
  { id: "plus1m", label: "+1 mes" },
  { id: "plus2m", label: "+2 meses" },
  { id: "plus3m", label: "+3 meses" },
  { id: "custom", label: "Personalizado" },
]

function resolverFecha(preset: PresetId): Date | null {
  const hoy = new Date()
  switch (preset) {
    case "today":  return hoy
    case "plus5":  return addDays(hoy, 5)
    case "plus15": return addDays(hoy, 15)
    case "plus1m": return addMonths(hoy, 1)
    case "plus2m": return addMonths(hoy, 2)
    case "plus3m": return addMonths(hoy, 3)
    default:       return null
  }
}

function detectarPreset(fecha: Date | undefined): PresetId | null {
  if (!fecha) return null
  const hoy = new Date()
  if (isSameDay(fecha, hoy))                return "today"
  if (isSameDay(fecha, addDays(hoy, 5)))    return "plus5"
  if (isSameDay(fecha, addDays(hoy, 15)))   return "plus15"
  if (isSameDay(fecha, addMonths(hoy, 1)))  return "plus1m"
  if (isSameDay(fecha, addMonths(hoy, 2)))  return "plus2m"
  if (isSameDay(fecha, addMonths(hoy, 3)))  return "plus3m"
  return "custom"
}

export interface SmartDatePickerProps {
  value?: Date
  onChange: (date: Date) => void
  disabled?: boolean
  minDate?: Date
  maxDate?: Date
  placeholder?: string
  className?: string
}

export function SmartDatePicker({
  value,
  onChange,
  disabled = false,
  minDate,
  maxDate,
  placeholder = "Selecciona una fecha",
  className,
}: SmartDatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const presetActivo = detectarPreset(value)

  const handlePreset = (id: PresetId) => {
    if (id === "custom") {
      setOpen(true)
      return
    }
    const fecha = resolverFecha(id)
    if (fecha) onChange(fecha)
  }

  const fechaFormateada = value
    ? format(value, "d MMMM yyyy", { locale: es })
    : null

  const estaDeshabilitada = (date: Date) => {
    if (minDate && date < minDate) return true
    if (maxDate && date > maxDate) return true
    return false
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Chips de acceso rápido */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={() => handlePreset(id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              "disabled:pointer-events-none disabled:opacity-50",
              presetActivo === id
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-muted"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Input con fecha formateada + calendario en Popover */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-sm",
            "transition-colors hover:bg-muted/50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground"
          )}
        >
          <span>{fechaFormateada ?? placeholder}</span>
          <CalendarIcon className="h-4 w-4 shrink-0 opacity-50" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              if (date) {
                onChange(date)
                setOpen(false)
              }
            }}
            captionLayout="dropdown"
            defaultMonth={value ?? new Date()}
            disabled={estaDeshabilitada}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            locale={es as any}
          />
        </PopoverContent>
      </Popover>

      {/* Texto descriptivo cuando no hay fecha */}
      {!value && (
        <p className="text-xs text-muted-foreground">{placeholder}</p>
      )}
    </div>
  )
}
