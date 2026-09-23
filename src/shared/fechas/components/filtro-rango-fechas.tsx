"use client";

import { useEffect, useState } from "react";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import { ArrowRight, CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { usePreferenciasFecha } from "../contexto";
import { formatearFechaCorta } from "../formato";
import {
  aDiaDeCalendario,
  cerrarRango,
  deDiaDeCalendario,
  diasDelRango,
  etiquetaRangoFechas,
  ymdAString,
  type RangoFechasYmd,
} from "../rango-ymd";
import { desdeFechaCalendario, hoyEnZona, sumarDias } from "../zona";
import type { FechaYMD } from "../tipos";

export type { RangoFechasYmd } from "../rango-ymd";

/**
 * Filtro de rango de fechas para barras de filtros.
 *
 * Los dos extremos viajan como fecha de calendario "YYYY-MM-DD" — el mismo
 * formato que ya consumen `parsearRangoDeSearchParams` /
 * `parsearExtremosDeSearchParams`, que los resuelven a instantes UTC en la
 * zona de negocio. Acá nunca se construye un instante para filtrar: solo se
 * manipulan días de calendario.
 *
 * Por qué existe en vez de un `<Calendar mode="range">` suelto: react-day-picker
 * devuelve `{ from, to }` ya completo en el **primer** clic (ver `addToRange`
 * con `min = 0`), así que los callers que cerraban el popover "cuando el rango
 * está completo" lo cerraban después de elegir el primer día — era imposible
 * elegir un rango de varios días sin reabrirlo. Y un segundo clic sobre el
 * mismo día deselecciona todo, o sea que tampoco se podía confirmar un rango
 * de un solo día. Este componente toma el control de esos dos clics.
 */

export interface PresetRangoFechas {
  etiqueta: string;
  /**
   * Recibe el día de hoy **en la zona de negocio**, no en la del navegador.
   * `null` en un extremo deja el rango abierto de ese lado ("todo lo anterior
   * a ayer"), que es lo que ya soportan los `where` parciales del servidor.
   */
  calcular: (hoy: FechaYMD) => { desde: FechaYMD | null; hasta: FechaYMD | null };
}

export interface FiltroRangoFechasProps {
  valor: RangoFechasYmd;
  onChange: (valor: RangoFechasYmd) => void;
  /**
   * Zona de negocio resuelta en el servidor (`sesion.zonaNegocio`). Define qué
   * día es "hoy" para los atajos. Nunca la del navegador: estos valores
   * terminan en un `where` de Prisma (ver docs/fechas-y-zonas-horarias.md).
   */
  zonaNegocio: string;
  /** Texto del trigger cuando no hay nada elegido. */
  placeholder?: string;
  presets?: PresetRangoFechas[];
  align?: "start" | "center" | "end";
  /** Variante chica, pensada para vivir dentro de un segmented control. */
  compacto?: boolean;
  /**
   * Qué hacer al limpiar. Por defecto vacía los dos extremos; un caller que
   * además tenga que resetear un modo ("entrega=personalizado" → "todos")
   * pasa el suyo.
   */
  onLimpiar?: () => void;
  className?: string;
}

// ── Atajos listos para usar ─────────────────────────────────────────────────

const soloDia = (d: FechaYMD) => ({ desde: d, hasta: d });

/** Para fechas que ya ocurrieron (fecha de pedido, de creación, de cierre). */
export const PRESETS_RANGO_PASADO: PresetRangoFechas[] = [
  { etiqueta: "Hoy", calcular: soloDia },
  { etiqueta: "Ayer", calcular: (hoy) => soloDia(sumarDias(hoy, -1)) },
  { etiqueta: "Últimos 7 días", calcular: (hoy) => ({ desde: sumarDias(hoy, -6), hasta: hoy }) },
  { etiqueta: "Últimos 30 días", calcular: (hoy) => ({ desde: sumarDias(hoy, -29), hasta: hoy }) },
  { etiqueta: "Este mes", calcular: (hoy) => ({ desde: { ...hoy, dia: 1 }, hasta: hoy }) },
  {
    etiqueta: "Mes pasado",
    calcular: (hoy) => {
      const ultimoDelPasado = sumarDias({ ...hoy, dia: 1 }, -1);
      return { desde: { ...ultimoDelPasado, dia: 1 }, hasta: ultimoDelPasado };
    },
  },
];

/** Para fechas que están por venir (entrega estimada, vencimiento). */
export const PRESETS_RANGO_FUTURO: PresetRangoFechas[] = [
  { etiqueta: "Hoy", calcular: soloDia },
  { etiqueta: "Mañana", calcular: (hoy) => soloDia(sumarDias(hoy, 1)) },
  { etiqueta: "Hoy y mañana", calcular: (hoy) => ({ desde: hoy, hasta: sumarDias(hoy, 1) }) },
  { etiqueta: "Próximos 7 días", calcular: (hoy) => ({ desde: hoy, hasta: sumarDias(hoy, 6) }) },
  { etiqueta: "Próximos 30 días", calcular: (hoy) => ({ desde: hoy, hasta: sumarDias(hoy, 29) }) },
  // Abierto por la izquierda a propósito: "atrasado" es todo lo anterior a
  // hoy, sin un piso arbitrario.
  { etiqueta: "Atrasados", calcular: (hoy) => ({ desde: null, hasta: sumarDias(hoy, -1) }) },
];

/** `true` en pantallas donde caben dos meses lado a lado. */
function useCabenDosMeses(): boolean {
  // Arranca en `true` (desktop-first) y el popover solo se monta al abrirlo,
  // ya en el cliente — no hay HTML de servidor con el que discrepar.
  const [caben, setCaben] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sincronizar = () => setCaben(mq.matches);
    sincronizar();
    mq.addEventListener("change", sincronizar);
    return () => mq.removeEventListener("change", sincronizar);
  }, []);
  return caben;
}

// ── Componente ──────────────────────────────────────────────────────────────

export function FiltroRangoFechas({
  valor: valorProp,
  onChange,
  zonaNegocio,
  placeholder = "Todas las fechas",
  presets = PRESETS_RANGO_PASADO,
  align = "start",
  compacto = false,
  onLimpiar,
  className,
}: FiltroRangoFechasProps) {
  const preferencias = usePreferenciasFecha();
  const dosMeses = useCabenDosMeses();

  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState<RangoFechasYmd>(valorProp);
  // Qué extremo edita el próximo clic del calendario. Es lo que convierte dos
  // clics sueltos en "de X a X" de forma predecible.
  const [editando, setEditando] = useState<"desde" | "hasta">("desde");

  // Lo último que eligió el usuario, pintado antes de que el caller termine de
  // navegar: sin esto el tag seguía visible con su X hasta que respondía el
  // servidor, y parecía que el clic no había hecho nada. Se descarta en cuanto
  // llega un `valor` nuevo del caller.
  const [optimista, setOptimista] = useState<RangoFechasYmd | null>(null);
  const [valorPrevio, setValorPrevio] = useState(valorProp);
  if (valorPrevio.desde !== valorProp.desde || valorPrevio.hasta !== valorProp.hasta) {
    setValorPrevio(valorProp);
    setOptimista(null);
  }
  const valor = optimista ?? valorProp;

  const activo = Boolean(valor.desde || valor.hasta);
  const etiqueta = etiquetaRangoFechas(valor, preferencias, placeholder);

  const cambiarApertura = (nuevoAbierto: boolean) => {
    if (nuevoAbierto) {
      setBorrador(valor);
      setEditando(valor.desde && valor.hasta ? "desde" : valor.desde ? "hasta" : "desde");
    }
    setAbierto(nuevoAbierto);
  };

  const aplicar = (rango: RangoFechasYmd) => {
    setAbierto(false);
    // Aplicar sin haber cambiado nada solo cierra: el caller navega en cada
    // `onChange` y una navegación a la misma URL igual cuesta un round-trip.
    if (rango.desde === valor.desde && rango.hasta === valor.hasta) return;
    setOptimista(rango);
    onChange(rango);
  };

  const limpiar = () => {
    setBorrador({ desde: null, hasta: null });
    setEditando("desde");
    setAbierto(false);
    setOptimista({ desde: null, hasta: null });
    if (onLimpiar) onLimpiar();
    else onChange({ desde: null, hasta: null });
  };

  const elegirDia = (_rango: DateRange | undefined, diaClickeado: Date | undefined) => {
    if (!diaClickeado) return;
    const ymd = deDiaDeCalendario(diaClickeado);

    if (editando === "desde") {
      // El primer clic deja un rango de un solo día, y el siguiente lo
      // extiende. Así "de X a X" es el caso natural, no una excepción.
      setBorrador({ desde: ymd, hasta: borrador.hasta && borrador.hasta >= ymd ? borrador.hasta : ymd });
      setEditando("hasta");
      return;
    }

    // Segundo clic: cierra el rango. Volver a clicar el día inicial confirma
    // el rango de un día en vez de deseleccionar (que es lo que haría
    // react-day-picker por su cuenta).
    //
    // No se aplica acá a propósito: elegir días solo pinta el borrador, y el
    // único commit es el botón "Aplicar". Auto-aplicar en este clic disparaba
    // la navegación antes de que el usuario pudiera corregir la selección, y
    // como cerraba el popover había que reabrirlo para ajustar un extremo.
    setBorrador(cerrarRango(borrador.desde, ymd));
    setEditando("desde");
  };

  const aplicarPreset = (preset: PresetRangoFechas) => {
    const { desde, hasta } = preset.calcular(hoyEnZona(zonaNegocio));
    aplicar({ desde: desde && ymdAString(desde), hasta: hasta && ymdAString(hasta) });
  };

  const seleccionCalendario: DateRange | undefined = borrador.desde || borrador.hasta
    ? {
        from: aDiaDeCalendario(borrador.desde ?? borrador.hasta!),
        to: aDiaDeCalendario(borrador.hasta ?? borrador.desde!),
      }
    : undefined;

  const total = borrador.desde && borrador.hasta ? diasDelRango(borrador.desde, borrador.hasta) : 0;
  const pista = editando === "hasta"
    ? "Elige la fecha final. Vuelve a hacer clic en el mismo día para un rango de un solo día."
    : total > 0
      ? `${total === 1 ? "1 día seleccionado" : `${total} días seleccionados`} · presiona Aplicar`
      : "Haz clic en el día inicial y luego en el final.";

  const textoExtremo = (ymd: string | null) =>
    ymd ? formatearFechaCorta(desdeFechaCalendario(ymd, preferencias.zonaHoraria), preferencias) : "";

  return (
    <Popover open={abierto} onOpenChange={cambiarApertura}>
      <div
        className={cn(
          "inline-flex items-center",
          compacto ? "rounded-lg" : "rounded-xl border transition-colors",
          // Inactivo: mismas superficies que `buttonVariants({ variant: "outline" })`,
          // que es lo que usan los botones vecinos de la barra de filtros.
          !compacto && (activo
            ? "border-primary-border bg-primary-muted"
            : "border-border bg-background dark:border-input dark:bg-input/30"),
          className
        )}
      >
        <PopoverTrigger
          className={cn(
            "inline-flex items-center gap-2 whitespace-nowrap font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50",
            compacto
              ? cn(
                  "rounded-lg px-2.5 py-1.5 text-xs",
                  activo ? "bg-primary-muted text-primary" : "text-muted-foreground hover:bg-muted"
                )
              : cn(
                  "h-8 rounded-xl px-2.5 text-sm font-normal",
                  activo ? "text-primary" : "text-foreground hover:bg-muted"
                ),
            activo && "rounded-r-none"
          )}
        >
          {!compacto && (
            <CalendarDays className={cn("h-4 w-4", activo ? "text-primary" : "text-muted-foreground")} />
          )}
          {etiqueta}
        </PopoverTrigger>

        {activo && (
          <button
            type="button"
            onClick={limpiar}
            aria-label={`Limpiar filtro de fecha (${placeholder})`}
            title="Limpiar filtro de fecha"
            className={cn(
              "inline-flex shrink-0 items-center justify-center rounded-r-lg text-primary/70 outline-none transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50",
              compacto ? "h-[26px] w-6 bg-primary-muted" : "h-8 w-7 rounded-r-xl"
            )}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <PopoverContent align={align} className="w-auto max-w-[calc(100vw-1.5rem)] p-0">
        <div className="flex flex-col sm:flex-row">
          {presets.length > 0 && (
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border p-2 sm:w-44 sm:flex-col sm:gap-0.5 sm:overflow-visible sm:border-r sm:border-b-0">
              <span className="hidden px-2 pt-1 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase sm:block">
                Atajos
              </span>
              {presets.map((preset) => (
                <button
                  key={preset.etiqueta}
                  type="button"
                  onClick={() => aplicarPreset(preset)}
                  className="rounded-lg px-2.5 py-1.5 text-left text-xs whitespace-nowrap text-foreground transition-colors hover:bg-muted sm:text-sm"
                >
                  {preset.etiqueta}
                </button>
              ))}
            </div>
          )}

          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-2 border-b border-border p-3">
              <ExtremoRango
                etiqueta="Desde"
                texto={textoExtremo(borrador.desde)}
                activo={editando === "desde"}
                onSeleccionar={() => setEditando("desde")}
                onLimpiar={() => {
                  setBorrador({ ...borrador, desde: null });
                  setEditando("desde");
                }}
              />
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <ExtremoRango
                etiqueta="Hasta"
                texto={textoExtremo(borrador.hasta)}
                activo={editando === "hasta"}
                onSeleccionar={() => setEditando("hasta")}
                onLimpiar={() => {
                  setBorrador({ ...borrador, hasta: null });
                  setEditando("hasta");
                }}
              />
            </div>

            <div className="overflow-x-auto">
              <Calendar
                mode="range"
                selected={seleccionCalendario}
                onSelect={elegirDia}
                defaultMonth={aDiaDeCalendario(borrador.desde ?? borrador.hasta ?? ymdAString(hoyEnZona(zonaNegocio)))}
                numberOfMonths={dosMeses ? 2 : 1}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                locale={es as any}
                className="p-3"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border p-3">
              <p className="max-w-[16rem] text-xs text-muted-foreground">{pista}</p>
              <div className="ml-auto flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={limpiar} disabled={!activo && !borrador.desde && !borrador.hasta}>
                  Limpiar
                </Button>
                <Button size="sm" onClick={() => aplicar(borrador)}>
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ExtremoRango({
  etiqueta,
  texto,
  activo,
  onSeleccionar,
  onLimpiar,
}: {
  etiqueta: string;
  texto: string;
  activo: boolean;
  onSeleccionar: () => void;
  onLimpiar: () => void;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 items-center gap-1 rounded-lg border px-2 py-1.5 transition-colors",
        activo ? "border-primary bg-primary-muted" : "border-border bg-background"
      )}
    >
      <button type="button" onClick={onSeleccionar} className="min-w-0 flex-1 text-left outline-none">
        <span className="block text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          {etiqueta}
        </span>
        <span className={cn("block truncate text-sm", texto ? "text-foreground" : "text-muted-foreground")}>
          {texto || "Sin definir"}
        </span>
      </button>
      {texto && (
        <button
          type="button"
          onClick={onLimpiar}
          aria-label={`Quitar fecha ${etiqueta.toLowerCase()}`}
          className="shrink-0 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
