"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  FiltroRangoFechas,
  PRESETS_RANGO_FUTURO,
  type RangoFechasYmd,
} from "@/shared/fechas/components/filtro-rango-fechas";
import { useNavegacionFiltros } from "@/shared/ui/navegacion-filtros";
import { cn } from "@/lib/utils";
import { RANGO_PREPARACION_LABELS } from "../constantes";
import type { RangoPreparacion } from "../types";

type Vista = "kanban" | "lista";

interface Props {
  rangoActivo: RangoPreparacion;
  /** Extremos crudos "YYYY-MM-DD" de la URL, solo relevantes en PERSONALIZADO. */
  desde: string | null;
  hasta: string | null;
  contadores: { hoy: number; manana: number; semana: number; atrasados: number; sinFecha: number };
  busqueda?: string;
  vista: Vista;
  zonaNegocio: string;
}

interface Seleccion {
  rango: RangoPreparacion;
  desde: string | null;
  hasta: string | null;
  vista: Vista;
}

const RANGOS_FIJOS: RangoPreparacion[] = ["HOY", "MANANA", "SEMANA"];

// "Atrasados" no aplica: el tablero ya muestra los vencidos en cualquier rango,
// y `resolverRango` no soporta un PERSONALIZADO abierto por la izquierda.
const PRESETS = PRESETS_RANGO_FUTURO.filter((p) => p.etiqueta !== "Atrasados");

/** El rango, la vista y la búsqueda viven en la URL: así el estado sobrevive al
 *  refresh y el link se puede compartir con el equipo.
 *
 *  La selección se pinta localmente antes de que responda el servidor: el tab
 *  queda marcado en el clic y el tablero se atenúa mientras carga, en vez de
 *  esperar el round-trip para dar feedback. */
export function PreparacionTabsRango({ rangoActivo, desde, hasta, contadores, busqueda, vista, zonaNegocio }: Props) {
  const { navegar, pendiente } = useNavegacionFiltros();
  const searchParams = useSearchParams();
  const [texto, setTexto] = useState(busqueda ?? "");

  const delServidor: Seleccion = {
    rango: rangoActivo,
    desde: rangoActivo === "PERSONALIZADO" ? desde : null,
    hasta: rangoActivo === "PERSONALIZADO" ? hasta : null,
    vista,
  };
  const claveServidor = `${delServidor.rango}|${delServidor.desde}|${delServidor.hasta}|${delServidor.vista}`;
  const [seleccion, setSeleccion] = useState<Seleccion>(delServidor);
  const [claveSincronizada, setClaveSincronizada] = useState(claveServidor);
  // Solo se resincroniza con las props cuando no hay navegación en vuelo: si
  // el usuario encadena clics, una respuesta intermedia no debe pisar la
  // selección más reciente.
  if (!pendiente && claveSincronizada !== claveServidor) {
    setClaveSincronizada(claveServidor);
    setSeleccion(delServidor);
  }

  // Se parte de la selección local y no solo de la URL: con clics encadenados
  // la URL todavía no refleja el cambio anterior y se perdería.
  const aplicar = (nueva: Seleccion, extra: Record<string, string | null> = {}) => {
    setSeleccion(nueva);
    const params = new URLSearchParams(searchParams.toString());
    const valores: Record<string, string | null> = {
      rango: nueva.rango,
      desde: nueva.desde,
      hasta: nueva.hasta,
      vista: nueva.vista,
      ...extra,
    };
    for (const [clave, valor] of Object.entries(valores)) {
      if (valor === null || valor === "") params.delete(clave);
      else params.set(clave, valor);
    }
    navegar(params);
  };

  const seleccionarRango = (rango: RangoPreparacion) =>
    aplicar({ ...seleccion, rango, desde: null, hasta: null });

  const aplicarPersonalizado = (r: RangoFechasYmd) => {
    if (!r.desde && !r.hasta) return seleccionarRango("HOY");
    aplicar({ ...seleccion, rango: "PERSONALIZADO", desde: r.desde, hasta: r.hasta });
  };

  const contadorDe = (r: RangoPreparacion) =>
    r === "HOY" ? contadores.hoy : r === "MANANA" ? contadores.manana : contadores.semana;

  const rangoPersonalizado: RangoFechasYmd =
    seleccion.rango === "PERSONALIZADO"
      ? { desde: seleccion.desde, hasta: seleccion.hasta }
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
            const activo = r === seleccion.rango;
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
        {pendiente && (
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
            aplicar(seleccion, { q: texto || null });
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
              onClick={() => seleccion.vista !== v && aplicar({ ...seleccion, vista: v })}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm capitalize transition-colors",
                seleccion.vista === v ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
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
