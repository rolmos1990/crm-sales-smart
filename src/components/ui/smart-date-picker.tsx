"use client"

import * as React from "react"
import { es } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { usePreferenciasFecha } from "@/shared/fechas/contexto"
import { formatearFechaLarga } from "@/shared/fechas/formato"
import {
  aFechaCalendario,
  desdeFechaCalendario,
  hoyEnZona,
  parseYMD,
  sumarDias,
} from "@/shared/fechas/zona"

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

/**
 * Días que suma cada preset. Los de "meses" se resuelven sobre componentes de
 * calendario, no sumando 30 días.
 */
const PRESET_DIAS: Partial<Record<PresetId, number>> = { today: 0, plus5: 5, plus15: 15 }
const PRESET_MESES: Partial<Record<PresetId, number>> = { plus1m: 1, plus2m: 2, plus3m: 3 }

/**
 * Fecha del preset como "YYYY-MM-DD" en la zona indicada.
 *
 * Antes esto era `addDays(new Date(), n)`, que resolvía "hoy" en la zona del
 * navegador y además arrastraba la hora actual: por eso las columnas de fecha
 * de calendario terminaron con horas arbitrarias pegadas.
 */
function ymdDePreset(preset: PresetId, zona: string): string | null {
  const hoy = hoyEnZona(zona)

  const dias = PRESET_DIAS[preset]
  if (dias !== undefined) return formatearYMD(sumarDias(hoy, dias))

  const meses = PRESET_MESES[preset]
  if (meses !== undefined) {
    // Date normaliza el desborde de mes (31 de enero + 1 mes → 3 de marzo),
    // igual que hacía addMonths.
    const d = new Date(Date.UTC(hoy.anio, hoy.mes - 1 + meses, hoy.dia))
    return formatearYMD({ anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate() })
  }
  return null
}

function formatearYMD({ anio, mes, dia }: { anio: number; mes: number; dia: number }): string {
  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
}

function detectarPreset(fecha: Date | undefined, zona: string): PresetId | null {
  if (!fecha) return null
  const ymd = aFechaCalendario(fecha, zona)
  for (const { id } of PRESETS) {
    if (id === "custom") continue
    if (ymdDePreset(id, zona) === ymd) return id
  }
  return "custom"
}

/**
 * react-day-picker razona en `Date` locales del navegador. Estos dos helpers
 * traducen entre ese mundo y el día calendario de la zona de negocio, para que
 * el día resaltado sea el correcto aunque el navegador esté en otra zona.
 */
function aProxyLocal(ymd: string): Date {
  const { anio, mes, dia } = parseYMD(ymd)
  return new Date(anio, mes - 1, dia)
}

function desdeProxyLocal(proxy: Date): string {
  return formatearYMD({ anio: proxy.getFullYear(), mes: proxy.getMonth() + 1, dia: proxy.getDate() })
}

export interface SmartDatePickerProps {
  value?: Date
  onChange: (date: Date) => void
  disabled?: boolean
  minDate?: Date
  maxDate?: Date
  placeholder?: string
  className?: string
  /** Subconjunto de chips a mostrar (por defecto, todos). Útil para reducir
   *  ruido visual en formularios donde no hacen falta todos los accesos. */
  presets?: PresetId[]
}

export function SmartDatePicker({
  value,
  onChange,
  disabled = false,
  minDate,
  maxDate,
  placeholder = "Selecciona una fecha",
  className,
  presets,
}: SmartDatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const preferencias = usePreferenciasFecha()
  const zona = preferencias.zonaHoraria

  const presetActivo = detectarPreset(value, zona)
  const presetsAMostrar = presets
    ? PRESETS.filter((p) => presets.includes(p.id))
    : PRESETS

  const handlePreset = (id: PresetId) => {
    if (id === "custom") {
      setOpen(true)
      return
    }
    const ymd = ymdDePreset(id, zona)
    // Medianoche en la zona de negocio, no "ahora mismo": esto es una fecha de
    // calendario, no un instante.
    if (ymd) onChange(desdeFechaCalendario(ymd, zona))
  }

  const fechaFormateada = value ? formatearFechaLarga(value, preferencias) : null

  // El calendario trabaja con Date locales del navegador, así que los límites
  // también se traducen a ese mundo antes de comparar.
  const proxySeleccionado = value ? aProxyLocal(aFechaCalendario(value, zona)) : undefined
  const proxyMin = minDate ? aProxyLocal(aFechaCalendario(minDate, zona)) : undefined
  const proxyMax = maxDate ? aProxyLocal(aFechaCalendario(maxDate, zona)) : undefined

  const estaDeshabilitada = (date: Date) => {
    if (proxyMin && date < proxyMin) return true
    if (proxyMax && date > proxyMax) return true
    return false
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Chips de acceso rápido */}
      <div className="flex flex-wrap gap-2">
        {presetsAMostrar.map(({ id, label }) => (
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
            selected={proxySeleccionado}
            onSelect={(date) => {
              if (date) {
                onChange(desdeFechaCalendario(desdeProxyLocal(date), zona))
                setOpen(false)
              }
            }}
            captionLayout="dropdown"
            defaultMonth={proxySeleccionado ?? new Date()}
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
