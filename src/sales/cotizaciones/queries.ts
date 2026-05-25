import { prisma } from "@/shared/db/prisma";

const incluirRelaciones = {
  contacto: { select: { id: true, nombre: true, apellido: true } },
  empresa: { select: { id: true, nombre: true } },
} as const;

export async function obtenerCotizaciones() {
  return prisma.cotizacion.findMany({
    include: incluirRelaciones,
    orderBy: { creadoEn: "desc" },
  });
}

export async function obtenerCotizacionPorId(id: string) {
  return prisma.cotizacion.findUnique({
    where: { id },
    include: {
      ...incluirRelaciones,
      lineas: { include: { producto: { select: { id: true, nombre: true } } } },
    },
  });
}

export async function generarNumeroCotizacion(): Promise<string> {
  const count = await prisma.cotizacion.count();
  const año = new Date().getFullYear();
  return `COT-${año}-${String(count + 1).padStart(4, "0")}`;
}
