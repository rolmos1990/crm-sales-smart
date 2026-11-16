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
    <ol className="flex items-center gap-2" aria-label="Progreso de la configuración">
      {pasos.map((paso, i) => {
        const completado = paso.numero < maximoAlcanzado;
        const esActual = paso.numero === actual;
        const navegable = paso.numero < actual;

        return (
          <li key={paso.numero} className="flex flex-1 items-center gap-2">
            <button
              type="button"
              onClick={() => navegable && onIr(paso.numero)}
              disabled={!navegable}
              aria-current={esActual ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-lg px-1 py-1 transition-colors",
                navegable && "hover:bg-muted cursor-pointer",
                !navegable && "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                  esActual && "border-primary bg-primary text-primary-foreground",
                  completado && !esActual && "border-success/40 bg-success/15 text-success",
                  !esActual && !completado && "border-border bg-muted text-muted-foreground",
                )}
              >
                {completado && !esActual ? <Check className="h-3.5 w-3.5" /> : paso.numero}
              </span>
              <span
                className={cn(
                  "text-sm whitespace-nowrap",
                  esActual ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {paso.etiqueta}
              </span>
            </button>
            {i < pasos.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "h-px flex-1 transition-colors",
                  paso.numero < maximoAlcanzado ? "bg-success/40" : "bg-border",
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
}: {
  seleccionada: boolean;
  onSeleccionar: () => void;
  titulo: string;
  descripcion: string;
  icono?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={seleccionada}
      disabled={disabled}
      onClick={onSeleccionar}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors",
        seleccionada ? "border-primary bg-primary/8" : "border-border bg-card hover:bg-muted",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      {icono && <span className="mt-0.5 shrink-0">{icono}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{titulo}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {descripcion}
        </span>
      </span>
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
          seleccionada ? "border-primary" : "border-border",
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
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
              activa
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="text-xs text-muted-foreground">{etiqueta}</span>
      <span
        className={cn(
          "text-right text-xs",
          tenue ? "text-muted-foreground" : "font-medium text-foreground",
        )}
      >
        {valor}
      </span>
    </div>
  );
}
