import { prisma } from "@/shared/db/prisma";
import type { IntegracionInstada } from "./types";

export async function obtenerInstanciaActiva(): Promise<string> {
  const instancia = await prisma.instancia.findFirst({
    where: { estado: "ACTIVA" },
    select: { id: true },
  });
  if (!instancia) throw new Error("No hay instancia activa configurada");
  return instancia.id;
}

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
