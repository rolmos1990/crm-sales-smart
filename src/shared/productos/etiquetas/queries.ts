import { prisma } from "@/shared/db/prisma";
import type { EtiquetaProducto } from "./types";

export async function obtenerEtiquetasProducto(instanciaId: string): Promise<EtiquetaProducto[]> {
  const etiquetas = await prisma.etiquetaProducto.findMany({
    where: { instanciaId },
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, color: true, _count: { select: { productos: true } } },
  });
  return etiquetas.map(({ _count, ...e }) => ({ ...e, totalProductos: _count.productos }));
}
