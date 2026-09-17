import { Boxes } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResumenProducto } from "../types";

/** Lista de picking: cuántas unidades de cada producto hay que tener listas
 *  para el rango, sin abrir un solo pedido (FR-031). */
export function ResumenPorProducto({ resumen }: { resumen: ResumenProducto[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <header className="mb-3 flex items-center gap-2">
        <Boxes className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-foreground">Resumen por producto</h2>
      </header>

      {resumen.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Sin productos en el rango seleccionado.</p>
      ) : (
        <ul className="space-y-2">
          {resumen.map((r) => {
            const completo = r.unidadesPreparadas >= r.unidadesRequeridas;
            const pendientes = Math.max(r.unidadesRequeridas - r.unidadesPreparadas, 0);
            return (
              <li key={r.productoId ?? r.nombre} className="flex items-center justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-xs text-foreground">{r.nombre}</span>
                <span
                  className={cn(
                    "shrink-0 text-xs tabular-nums",
                    completo ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
                  )}
                >
                  {r.unidadesPreparadas}/{r.unidadesRequeridas}
                  {!completo && pendientes > 0 && (
                    <span className="ml-1 text-amber-600 dark:text-amber-400">(faltan {pendientes})</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
