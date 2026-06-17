import { prisma } from "@/shared/db/prisma";
import type { EntidadImportable } from "./types";

const ENTIDAD_CAMPO_PERSONALIZADO: Partial<
  Record<EntidadImportable, string>
> = {
  CONTACTO: "CONTACTO",
  EMPRESA: "EMPRESA",
  OPORTUNIDAD: "OPORTUNIDAD",
  PEDIDO: "PEDIDO",
  PRODUCTO: "PRODUCTO",
};

export async function obtenerCamposPersonalizadosPorEntidad(
  instanciaId: string,
  entidad: EntidadImportable,
) {
  const entidadEnum = ENTIDAD_CAMPO_PERSONALIZADO[entidad];
  if (!entidadEnum) return [];

  return prisma.campoPersonalizado.findMany({
    where: {
      instanciaId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      entidad: entidadEnum as any,
      activo: true,
    },
    select: { id: true, nombre: true, clave: true, tipo: true },
    orderBy: { orden: "asc" },
  });
}

export async function obtenerHistorialImportaciones(instanciaId: string) {
  return prisma.historialImportacion.findMany({
    where: { instanciaId },
    orderBy: { fechaCreacion: "desc" },
    take: 20,
  });
}
