import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { Clock } from "lucide-react";
import type { MovimientoPreparacion } from "../types";

/** Se alimenta de PreparacionHistorial — la misma traza que audita los
 *  movimientos, sin tabla ni log aparte. */
export function ActividadReciente({ movimientos }: { movimientos: MovimientoPreparacion[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <header className="mb-3 flex items-center gap-2">
        <Clock className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-foreground">Actividad reciente</h2>
      </header>

      {movimientos.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">Todavía no hay movimientos registrados.</p>
      ) : (
        <ul className="space-y-2.5">
          {movimientos.map((m) => (
            <li key={m.id} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="mt-1.5 size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: m.estadoColor ?? undefined }}
              />
              <div className="min-w-0 flex-1">
                <Link href={`/sales/pedidos/${m.pedidoId}`} className="font-mono text-xs font-medium hover:underline">
                  {m.pedidoNumero}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {m.estadoAnteriorNombre ? `${m.estadoAnteriorNombre} → ${m.estadoNombre}` : `Marcado como ${m.estadoNombre}`}
                  {m.usuarioNombre ? ` · ${m.usuarioNombre}` : ""}
                </p>
              </div>
              <time className="shrink-0 text-[11px] text-muted-foreground" dateTime={m.creadoEn.toISOString()}>
                {formatDistanceToNow(new Date(m.creadoEn), { locale: es, addSuffix: true })}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
