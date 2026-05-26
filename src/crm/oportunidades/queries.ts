import { prisma } from "@/shared/db/prisma";
import type { Etapa } from "@/generated/prisma/enums";

export async function obtenerOportunidades() {
  return prisma.oportunidad.findMany({
    include: {
      empresa: { select: { id: true, nombre: true } },
      contactos: { include: { contacto: { select: { id: true, nombre: true, apellido: true } } } },
    },
    orderBy: { creadoEn: "desc" },
  });
}

export async function obtenerOportunidadesPorEtapa() {
  const oportunidades = await prisma.oportunidad.findMany({
    where: { etapa: { notIn: ["GANADO", "PERDIDO"] }, pipelineId: null },
    include: {
      empresa: { select: { id: true, nombre: true } },
      contactos: { include: { contacto: { select: { id: true, nombre: true, apellido: true } } } },
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

export async function obtenerOportunidadPorId(id: string) {
  return prisma.oportunidad.findUnique({
    where: { id },
    include: {
      empresa: { select: { id: true, nombre: true } },
      contactos: { include: { contacto: true } },
      productos: { include: { producto: true } },
      actividades: { orderBy: { fecha: "desc" }, take: 10 },
      tags: { include: { tag: true } },
    },
  });
}
