import { prisma } from "@/shared/db/prisma";

const incluirRelaciones = {
  contacto: { select: { id: true, nombre: true, apellido: true } },
  empresa: { select: { id: true, nombre: true } },
} as const;

export async function obtenerCotizaciones(instanciaId: string) {
  return prisma.cotizacion.findMany({
    where: { instanciaId },
    include: incluirRelaciones,
    orderBy: { creadoEn: "desc" },
  });
}

export async function obtenerCotizacionPorId(id: string, instanciaId: string) {
  return prisma.cotizacion.findFirst({
    where: { id, instanciaId },
    include: {
      ...incluirRelaciones,
      lineas: { include: { producto: { select: { id: true, nombre: true } } } },
    },
  });
}

export async function generarNumeroCotizacion(instanciaId: string): Promise<string> {
  const count = await prisma.cotizacion.count({ where: { instanciaId } });
  const año = new Date().getFullYear();
  return `COT-${año}-${String(count + 1).padStart(4, "0")}`;
}
