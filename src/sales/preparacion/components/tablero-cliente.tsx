"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { ColumnaTablero } from "../types";

/**
 * Frontera cliente del tablero.
 *
 * El kanban arrastra dnd-kit, que no tiene sentido en el servidor y no debería
 * pesar en el bundle de las páginas que no lo usan. `ssr: false` solo se puede
 * declarar desde un Client Component, así que este archivo existe para eso: la
 * página (Server Component) importa este wrapper y no el kanban directo.
 */
const TableroKanban = dynamic(() => import("./tablero-kanban").then((m) => m.TableroKanban), {
  ssr: false,
  loading: () => (
    <div className="flex gap-3 overflow-hidden">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-64 w-[19rem] shrink-0 rounded-2xl" />
      ))}
    </div>
  ),
});

export function TableroCliente(props: {
  columnas: ColumnaTablero[];
  puedeMod: boolean;
  limitePorEstado: number;
  agrupacion: "POR_PEDIDO" | "POR_PRODUCTO";
}) {
  return <TableroKanban {...props} />;
}
