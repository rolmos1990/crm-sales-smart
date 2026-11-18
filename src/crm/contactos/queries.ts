import { prisma } from "@/shared/db/prisma";
import { UMBRALES_SEGUIMIENTO_DEFECTO, type UmbralesSeguimiento } from "./segmentacion/cortes";

export async function obtenerContactos(instanciaId: string) {
  return prisma.contacto.findMany({
    where: { instanciaId },
    include: { empresa: { select: { id: true, nombre: true } } },
    orderBy: { creadoEn: "desc" },
  });
}

export async function obtenerContactoPorId(id: string, instanciaId: string) {
  return prisma.contacto.findFirst({
    where: { id, instanciaId },
    include: {
      empresa: { select: { id: true, nombre: true } },
      actividades: { orderBy: { fecha: "desc" }, take: 10 },
      oportunidades: {
        include: {
          oportunidad: {
            select: {
              id: true,
              titulo: true,
              etapa: true,
              valor: true,
              stage: { select: { esGanado: true, esPerdido: true, nombre: true, color: true } },
            },
          },
        },
      },
      tags: { include: { tag: true } },
    },
  });
}

export async function buscarContactos(query: string, instanciaId: string) {
  return prisma.contacto.findMany({
    where: {
      instanciaId,
      OR: [
        { nombre: { contains: query, mode: "insensitive" } },
        { apellido: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { telefonoPrincipal: { contains: query, mode: "insensitive" } },
        { telefonoSecundario: { contains: query, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      email: true,
      telefonoPrincipal: true,
      empresa: { select: { id: true, nombre: true } },
    },
    take: 10,
  });
}

// ── 041 ────────────────────────────────────────────────────────────────────

/** Umbrales de seguimiento de la cuenta; defaults si nunca se configuraron. */
export async function obtenerUmbralesSeguimiento(instanciaId: string): Promise<UmbralesSeguimiento> {
  const config = await prisma.configuracionEmpresa.findUnique({
    where: { instanciaId },
    select: { diasSeguimientoPendiente: true, diasSeguimientoRecuperar: true, diasSeguimientoInactivo: true },
  });
  if (!config) return UMBRALES_SEGUIMIENTO_DEFECTO;
  return {
    pendiente: config.diasSeguimientoPendiente,
    recuperar: config.diasSeguimientoRecuperar,
    inactivo: config.diasSeguimientoInactivo,
  };
}
