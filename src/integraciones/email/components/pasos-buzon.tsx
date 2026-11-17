"use client";

// Piezas de presentación del asistente de buzón. Viven aparte del modal para
// que ese archivo quede con el flujo y no con el markup.
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Indicador de pasos ──────────────────────────────────────────────────────

export interface PasoDefinicion {
  numero: number;
  etiqueta: string;
}

export function IndicadorPasos({
  pasos,
  actual,
  maximoAlcanzado,
  onIr,
}: {
  pasos: PasoDefinicion[];
  actual: number;
  /** Hasta dónde llegó el usuario: solo se puede volver, nunca saltar hacia adelante. */
  maximoAlcanzado: number;
  onIr: (numero: number) => void;
}) {
  return (
    <ol
      className="flex items-center gap-2 sm:gap-3"
      aria-label="Progreso de la configuración"
      data-slot="indicador-pasos"
    >
      {pasos.map((paso, i) => {
        const completado = paso.numero < maximoAlcanzado && paso.numero !== actual;
        const esActual = paso.numero === actual;
        const navegable = paso.numero < actual;

        return (
          <li
            key={paso.numero}
            className={cn("flex items-center gap-2 sm:gap-3", i < pasos.length - 1 && "flex-1")}
          >
            <button
              type="button"
              onClick={() => navegable && onIr(paso.numero)}
              disabled={!navegable}
              aria-current={esActual ? "step" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 transition-colors",
                navegable ? "cursor-pointer hover:bg-muted" : "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-colors",
                  esActual &&
                    "border-primary bg-primary text-primary-foreground ring-4 ring-primary/15",
                  completado && "border-border bg-muted text-foreground",
                  !esActual && !completado && "border-border bg-transparent text-muted-foreground",
                )}
              >
                {paso.numero}
              </span>
              <span
                className={cn(
                  "hidden items-center gap-1.5 text-sm whitespace-nowrap sm:flex",
                  esActual ? "font-semibold text-foreground" : "text-muted-foreground",
                  completado && "text-foreground",
                )}
              >
                {paso.etiqueta}
                {completado && <Check className="h-4 w-4 text-primary" aria-label="completado" />}
              </span>
            </button>
            {i < pasos.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors",
                  paso.numero < actual ? "bg-primary" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

// ── Tarjeta de opción (radio grande) ────────────────────────────────────────

export function TarjetaOpcion({
  seleccionada,
  onSeleccionar,
  titulo,
  descripcion,
  icono,
  disabled,
  className,
}: {
  seleccionada: boolean;
  onSeleccionar: () => void;
  titulo: string;
  descripcion: string;
  icono?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={seleccionada}
      disabled={disabled}
      onClick={onSeleccionar}
      data-slot="tarjeta-opcion"
      className={cn(
        "flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition-all",
        seleccionada
          ? "border-primary bg-primary/8 ring-1 ring-primary/40"
          : "border-border bg-card hover:border-border-strong hover:bg-muted/50",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      {icono && (
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg transition-colors",
            seleccionada ? "text-primary" : "text-foreground",
          )}
        >
          {icono}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{titulo}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
          {descripcion}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors",
          seleccionada ? "border-primary" : "border-muted-foreground/50",
        )}
      >
        {seleccionada && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
    </button>
  );
}

// ── Selector segmentado ─────────────────────────────────────────────────────

export function Segmentado<T extends string>({
  valor,
  opciones,
  onCambiar,
  etiquetaAccesible,
}: {
  valor: T;
  opciones: { valor: T; etiqueta: string }[];
  onCambiar: (v: T) => void;
  etiquetaAccesible: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={etiquetaAccesible}
      data-slot="segmentado"
      className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1"
    >
      {opciones.map((o) => {
        const activa = o.valor === valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={activa}
            onClick={() => onCambiar(o.valor)}
            className={cn(
              "flex-1 rounded-md border px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
              activa
                ? "border-primary bg-primary/12 text-foreground"
                : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {o.etiqueta}
          </button>
        );
      })}
    </div>
  );
}

// ── Fila del resumen final ──────────────────────────────────────────────────

export function FilaResumen({
  etiqueta,
  valor,
  tenue,
}: {
  etiqueta: string;
  valor: ReactNode;
  tenue?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-sm text-muted-foreground">{etiqueta}</span>
      <span
        className={cn(
          "min-w-0 text-right text-sm break-words",
          tenue ? "text-muted-foreground" : "font-medium text-foreground",
        )}
      >
        {valor}
      </span>
    </div>
  );
}
