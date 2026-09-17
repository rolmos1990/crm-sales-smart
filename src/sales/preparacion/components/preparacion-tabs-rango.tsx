"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { RANGO_PREPARACION_LABELS } from "../constantes";
import type { RangoPreparacion } from "../types";

interface Props {
  rangoActivo: RangoPreparacion;
  contadores: { hoy: number; manana: number; semana: number; atrasados: number; sinFecha: number };
  busqueda?: string;
  vista: "kanban" | "lista";
}

const RANGOS: RangoPreparacion[] = ["HOY", "MANANA", "SEMANA", "PERSONALIZADO"];

/** El rango, la vista y la búsqueda viven en la URL: así el estado sobrevive al
 *  refresh y el link se puede compartir con el equipo. */
export function PreparacionTabsRango({ rangoActivo, contadores, busqueda, vista }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [texto, setTexto] = useState(busqueda ?? "");

  const navegar = (cambios: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "") params.delete(clave);
      else params.set(clave, valor);
    }
    router.push(`/sales/preparacion?${params.toString()}`);
  };

  const contadorDe = (r: RangoPreparacion) =>
    r === "HOY" ? contadores.hoy : r === "MANANA" ? contadores.manana : r === "SEMANA" ? contadores.semana : null;

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
        {RANGOS.map((r) => {
          const activo = r === rangoActivo;
          const conteo = contadorDe(r);
          return (
            <button
              key={r}
              type="button"
              aria-current={activo ? "page" : undefined}
              onClick={() => navegar({ rango: r })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                activo ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {RANGO_PREPARACION_LABELS[r]}
              {conteo !== null && (
                <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", activo ? "bg-muted" : "bg-muted/60")}>
                  {conteo}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="flex items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navegar({ q: texto || null });
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
              onClick={() => navegar({ vista: v })}
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
