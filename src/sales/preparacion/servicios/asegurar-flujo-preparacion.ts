import { prisma } from "@/shared/db/prisma";
import { ESTADOS_PREPARACION_DEFECTO } from "../constantes";

/**
 * Devuelve el flujo de preparación de la instancia, creándolo con dos estados
 * por defecto si nunca se configuró.
 *
 * Es perezoso a propósito (en vez de un backfill por migración): una instancia
 * creada mañana queda cubierta por el mismo camino, sin script de datos que
 * mantener. Idempotente: la carrera entre dos requests simultáneos la resuelve
 * el `@@unique([instanciaId])` — el segundo cae en el catch y vuelve a leer.
 */
export async function asegurarFlujoPreparacion(instanciaId: string) {
  const existente = await prisma.flujoPreparacion.findUnique({
    where: { instanciaId },
    include: {
      estados: { where: { activo: true }, orderBy: { orden: "asc" } },
      etapasEntrada: { include: { flujoVentaEtapa: { select: { id: true, nombre: true, color: true, activo: true } } } },
    },
  });
  if (existente) return existente;

  try {
    return await prisma.flujoPreparacion.create({
      data: {
        instanciaId,
        estados: { create: ESTADOS_PREPARACION_DEFECTO.map((e) => ({ ...e })) },
      },
      include: {
        estados: { where: { activo: true }, orderBy: { orden: "asc" } },
        etapasEntrada: { include: { flujoVentaEtapa: { select: { id: true, nombre: true, color: true, activo: true } } } },
      },
    });
  } catch {
    // Otro request lo creó entre el find y el create: releer es la respuesta
    // correcta, no reintentar la escritura.
    const recien = await prisma.flujoPreparacion.findUnique({
      where: { instanciaId },
      include: {
        estados: { where: { activo: true }, orderBy: { orden: "asc" } },
        etapasEntrada: { include: { flujoVentaEtapa: { select: { id: true, nombre: true, color: true, activo: true } } } },
      },
    });
    if (!recien) throw new Error("No se pudo crear el flujo de preparación");
    return recien;
  }
}

export type FlujoPreparacionCompleto = Awaited<ReturnType<typeof asegurarFlujoPreparacion>>;
