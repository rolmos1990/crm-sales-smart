"use client";

import { cn } from "@/lib/utils";
import { usePreferenciasFecha } from "./contexto";
import {
  formatearFecha,
  formatearFechaCorta,
  formatearFechaHora,
  formatearFechaLarga,
  formatearFechaRelativa,
  formatearHora,
} from "./formato";

export type ModoFechaHora = "fecha" | "fechaHora" | "hora" | "larga" | "corta" | "relativa";

export interface FechaHoraProps {
  valor: Date | string | number | null | undefined;
  modo?: ModoFechaHora;
  /** Qué mostrar cuando no hay valor. */
  vacio?: string;
  className?: string;
}

/**
 * Renderiza un instante en la zona de presentación efectiva.
 *
 * Reemplaza a `format(d, "dd MMM yyyy", { locale: es })` y a
 * `d.toLocaleDateString("es-PE", …)`, que renderizan en la zona del proceso o
 * del navegador — no en la del negocio.
 *
 * Emite un `<time>` con el instante ISO completo en `dateTime` y en `title`:
 * eso es lo que hace auditable un "hace 3 días" y le da semántica al valor.
 */
export function FechaHora({ valor, modo = "fecha", vacio = "—", className }: FechaHoraProps) {
  const preferencias = usePreferenciasFecha();

  const fecha = normalizar(valor);
  if (!fecha) return <span className={cn("text-muted-foreground", className)}>{vacio}</span>;

  const texto = {
    fecha: formatearFecha,
    fechaHora: formatearFechaHora,
    hora: formatearHora,
    larga: formatearFechaLarga,
    corta: formatearFechaCorta,
    relativa: formatearFechaRelativa,
  }[modo](fecha, preferencias);

  return (
    <time
      dateTime={fecha.toISOString()}
      title={formatearFechaHora(fecha, preferencias)}
      className={className}
    >
      {texto}
    </time>
  );
}

function normalizar(valor: Date | string | number | null | undefined): Date | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const d = valor instanceof Date ? valor : new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}
