import { prisma } from "@/shared/db/prisma";
import type { Etapa } from "@/generated/prisma/enums";

export async function obtenerOportunidades(instanciaId: string) {
  return prisma.oportunidad.findMany({
    where: { instanciaId },
    include: {
      empresa: { select: { id: true, nombre: true } },
      contactos: { include: { contacto: { select: { id: true, nombre: true, apellido: true } } } },
      // Etapa real cuando la oportunidad vive en un pipeline dinámico — el
      // enum legacy `etapa` no se mantiene sincronizado con el stage actual.
      stage: { select: { id: true, nombre: true, color: true } },
    },
    orderBy: { creadoEn: "desc" },
  });
}

// Últimas oportunidades del contacto distintas de la actual — para el
// historial "Oportunidades anteriores" del panel de contacto en el Inbox.
export async function obtenerOportunidadesAnterioresContacto(
  contactoId: string,
  instanciaId: string,
  excluirId?: string | null,
  limite = 5
) {
  return prisma.oportunidad.findMany({
    where: {
      instanciaId,
      contactos: { some: { contactoId, principal: true } },
      ...(excluirId ? { id: { not: excluirId } } : {}),
    },
    select: {
      id: true,
      titulo: true,
      etapa: true,
      fechaGanada: true,
      fechaPerdida: true,
      actualizadoEn: true,
      stage: { select: { nombre: true, esGanado: true, esPerdido: true, color: true } },
    },
    orderBy: { actualizadoEn: "desc" },
    take: limite,
  });
}

export async function obtenerOportunidadesPorEtapa(instanciaId: string) {
  const oportunidades = await prisma.oportunidad.findMany({
    where: { instanciaId, etapa: { notIn: ["GANADO", "PERDIDO"] }, pipelineId: null },
    include: {
      empresa: { select: { id: true, nombre: true } },
      contactos: { include: { contacto: { select: { id: true, nombre: true, apellido: true } } } },
      tags: { select: { tagId: true, tag: { select: { id: true, nombre: true, color: true } } } },
    },
    orderBy: { actualizadoEn: "desc" },
  });

  const agrupadas = new Map<Etapa, typeof oportunidades>();
  for (const o of oportunidades) {
    if (!agrupadas.has(o.etapa)) agrupadas.set(o.etapa, []);
    agrupadas.get(o.etapa)!.push(o);
  }
  return agrupadas;
}

export async function obtenerOportunidadPorId(id: string, instanciaId: string) {
  return prisma.oportunidad.findFirst({
    where: { id, instanciaId },
    include: {
      empresa: {
        select: {
          id: true, nombre: true, ruc: true, industria: true,
          sitioWeb: true, telefono: true, email: true, notas: true,
        },
      },
      contactos: {
        include: {
          contacto: {
            select: {
              id: true, nombre: true, apellido: true, email: true,
              telefonoPrincipal: true, telefonoSecundario: true,
              cargo: true, notas: true, estado: true,
              empresa: { select: { id: true, nombre: true } },
            },
          },
        },
      },
      productos: { include: { producto: true } },
      actividades: { orderBy: { fecha: "desc" }, take: 10 },
      tags: { include: { tag: true } },
      campos: { include: { campo: true }, orderBy: { campo: { orden: "asc" } } },
      stage: { select: { id: true, nombre: true, color: true } },
    },
  });
}
