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
      entrega: { include: { transportista: { select: { id: true, nombre: true, tipo: true } } } },
    },
  });
}

export async function obtenerCotizacionesPorContacto(contactoId: string, instanciaId: string) {
  return prisma.cotizacion.findMany({
    where: { contactoId, instanciaId },
    orderBy: { creadoEn: "desc" },
    select: { id: true, numero: true, estado: true, total: true, moneda: true, creadoEn: true },
  });
}

/**
 * Cotizaciones "de una oportunidad" — en realidad se resuelven por el contacto
 * principal de esa oportunidad, no por el id de la oportunidad puntual. Así, si
 * el mismo contacto abre una nueva oportunidad, su historial de cotizaciones se
 * mantiene visible en vez de quedar huérfano en la oportunidad anterior.
 */
export async function obtenerCotizacionesPorOportunidad(oportunidadId: string, instanciaId: string) {
  const oportunidad = await prisma.oportunidad.findFirst({
    where: { id: oportunidadId, instanciaId },
    select: {
      contactos: {
        orderBy: { principal: "desc" },
        select: { contactoId: true },
        take: 1,
      },
    },
  });

  const contactoId = oportunidad?.contactos[0]?.contactoId;
  if (!contactoId) return [];

  return obtenerCotizacionesPorContacto(contactoId, instanciaId);
}

export async function generarNumeroCotizacion(instanciaId: string): Promise<string> {
  const count = await prisma.cotizacion.count({ where: { instanciaId } });
  const año = new Date().getFullYear();
  return `COT-${año}-${String(count + 1).padStart(4, "0")}`;
}
