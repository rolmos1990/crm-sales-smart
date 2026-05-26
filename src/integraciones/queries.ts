import { prisma } from "@/shared/db/prisma";
import type { IntegracionInstada } from "./types";

export async function obtenerIntegracionesInstaladas(instanciaId: string): Promise<IntegracionInstada[]> {
  const rows = await prisma.integracionInstancia.findMany({
    where: { instanciaId },
    orderBy: { creadoEn: "asc" },
  });
  return rows.map((r) => ({
    id:            r.id,
    clave:         r.clave,
    estado:        r.estado as IntegracionInstada["estado"],
    configuracion: r.configuracion as Record<string, unknown> | null,
    creadoEn:      r.creadoEn,
    actualizadoEn: r.actualizadoEn,
  }));
}
