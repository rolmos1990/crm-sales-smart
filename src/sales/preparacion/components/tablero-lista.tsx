"use client";

import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { ColumnaTablero, TarjetaPreparacion as Tarjeta } from "../types";

interface Props {
  columnas: ColumnaTablero[];
}

/** Misma información que el kanban, en tabla — para quien prefiere leer todo
 *  junto o trabaja con muchos pedidos por columna. */
export function TableroLista({ columnas }: Props) {
  const filas = columnas.flatMap((c) => c.tarjetas.map((t) => ({ tarjeta: t, estado: c.estado })));

  if (filas.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Sin pedidos para preparar en este rango.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead className="border-b border-border text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Pedido</th>
            <th className="px-3 py-2 font-medium">Cliente</th>
            <th className="px-3 py-2 font-medium">Estado de preparación</th>
            <th className="px-3 py-2 font-medium">Avance</th>
            <th className="px-3 py-2 font-medium">Entrega</th>
            <th className="px-3 py-2 font-medium">Responsable</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(({ tarjeta, estado }) => {
            const completas = tarjeta.lineas.filter((l) => l.completa).length;
            return (
              <tr key={tarjeta.pedidoId} className="border-b border-border last:border-0">
                <td className="px-3 py-2">
                  <Link href={`/sales/pedidos/${tarjeta.pedidoId}`} className="font-mono font-medium hover:underline">
                    {tarjeta.numero}
                  </Link>
                </td>
                <td className="px-3 py-2 text-foreground">{tarjeta.cliente}</td>
                <td className="px-3 py-2">
                  {estado ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-foreground">
                      <span aria-hidden className="size-1.5 rounded-full" style={{ backgroundColor: estado.color ?? undefined }} />
                      {estado.nombre}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin fecha</span>
                  )}
                </td>
                <td className={cn("px-3 py-2 text-xs", tarjeta.avanceCompleto ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                  {completas}/{tarjeta.lineas.length} productos
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {tarjeta.fechaEntrega ? format(new Date(tarjeta.fechaEntrega), "dd MMM yyyy", { locale: es }) : "—"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">{tarjeta.asignadaA ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
