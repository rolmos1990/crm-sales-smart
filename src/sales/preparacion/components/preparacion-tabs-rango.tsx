"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  FiltroRangoFechas,
  PRESETS_RANGO_FUTURO,
  type RangoFechasYmd,
} from "@/shared/fechas/components/filtro-rango-fechas";
import { cn } from "@/lib/utils";
import { RANGO_PREPARACION_LABELS } from "../constantes";
import type { FiltrosVistaPreparacion } from "../schema";
import type { RangoPreparacion } from "../types";

export type VistaTablero = "kanban" | "lista";

interface Props {
  filtros: FiltrosVistaPreparacion;
  onCambiar: (cambios: Partial<FiltrosVistaPreparacion>) => void;
  vista: VistaTablero;
  onVista: (vista: VistaTablero) => void;
  contadores: { hoy: number; manana: number; semana: number; atrasados: number; sinFecha: number };
  /** Hay una consulta en vuelo para los filtros recién elegidos. */
  actualizando: boolean;
  zonaNegocio: string;
}

const RANGOS_FIJOS: RangoPreparacion[] = ["HOY", "MANANA", "SEMANA"];

// "Atrasados" no aplica: el tablero ya muestra los vencidos en cualquier rango,
// y `resolverRango` no soporta un PERSONALIZADO abierto por la izquierda.
const PRESETS = PRESETS_RANGO_FUTURO.filter((p) => p.etiqueta !== "Atrasados");

/** El rango y la búsqueda son estado del padre (nunca la URL): el tab queda
 *  marcado en el clic y el tablero se atenúa mientras llega la consulta. La
 *  vista kanban/lista es solo presentación y no vuelve a consultar. */
export function PreparacionTabsRango({ filtros, onCambiar, vista, onVista, contadores, actualizando, zonaNegocio }: Props) {
  const [texto, setTexto] = useState(filtros.q ?? "");

  // Cambiar de rango reinicia la paginación: los límites expandidos eran de
  // otro conjunto de tarjetas.
  const seleccionarRango = (rango: RangoPreparacion) =>
    onCambiar({ rango, desde: null, hasta: null, limites: {} });

  const aplicarPersonalizado = (r: RangoFechasYmd) => {
    if (!r.desde && !r.hasta) return seleccionarRango("HOY");
    onCambiar({ rango: "PERSONALIZADO", desde: r.desde, hasta: r.hasta, limites: {} });
  };

  const contadorDe = (r: RangoPreparacion) =>
    r === "HOY" ? contadores.hoy : r === "MANANA" ? contadores.manana : contadores.semana;

  const rangoPersonalizado: RangoFechasYmd =
    filtros.rango === "PERSONALIZADO"
      ? { desde: filtros.desde, hasta: filtros.hasta }
      : { desde: null, hasta: null };

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <nav className="flex flex-wrap items-center gap-1 rounded-xl border border-border bg-muted/30 p-1" aria-label="Rango de entrega">
          {/* Los atrasados no son un rango: se muestran en todos. El contador
              está acá para que se vea cuántos hay sin tener que buscarlos. */}
          {contadores.atrasados > 0 && (
            <span
              title="Pedidos con entrega vencida — se muestran en cualquier rango"
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-sm text-red-600 dark:text-red-400"
            >
              Atrasados
              <span className="rounded-full bg-red-500/15 px-1.5 text-[11px] tabular-nums">{contadores.atrasados}</span>
            </span>
          )}
          {contadores.sinFecha > 0 && (
            <span
              title="Pedidos sin fecha de entrega — se muestran en cualquier rango"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-sm text-muted-foreground"
            >
              Sin fecha
              <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums">{contadores.sinFecha}</span>
            </span>
          )}
          {RANGOS_FIJOS.map((r) => {
            const activo = r === filtros.rango;
            return (
              <button
                key={r}
                type="button"
                aria-current={activo ? "page" : undefined}
                onClick={() => !activo && seleccionarRango(r)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                  activo ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {RANGO_PREPARACION_LABELS[r]}
                <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", activo ? "bg-muted" : "bg-muted/60")}>
                  {contadorDe(r)}
                </span>
              </button>
            );
          })}
          <FiltroRangoFechas
            valor={rangoPersonalizado}
            onChange={aplicarPersonalizado}
            onLimpiar={() => seleccionarRango("HOY")}
            zonaNegocio={zonaNegocio}
            placeholder={RANGO_PREPARACION_LABELS.PERSONALIZADO}
            presets={PRESETS}
            compacto
          />
        </nav>

        {/* Los controles siguen habilitados mientras carga, para poder
            encadenar cambios sin esperar cada round-trip. */}
        {actualizando && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Actualizando…
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCambiar({ q: texto || null, limites: {} });
          }}
          className="relative"
        >
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar pedido, cliente o producto..."
            aria-label="Buscar en el tablero"
            className="w-full pl-8 md:w-72"
          />
        </form>

        <div className="flex rounded-xl border border-border bg-muted/30 p-1">
          {(["kanban", "lista"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onVista(v)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm capitalize transition-colors",
                vista === v ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
