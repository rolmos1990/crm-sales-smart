"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { PlaybookEstrategiaSchema, AsignarEstrategiaSchema } from "./schema";
import { listarAsignacionesDeAgente, listarEstrategias, listarSeleccionesRecientes } from "./queries";

type Resultado<T extends object = object> = ({ exito: true } & T) | { exito: false; error: string };

export async function crearEstrategia(datos: unknown): Promise<Resultado<{ id: string }>> {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error: error ?? "Sin permiso" };

  const validado = PlaybookEstrategiaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  const creada = await prisma.playbookEstrategia.create({
    data: {
      instanciaId: sesion.instanciaId,
      nombre: validado.data.nombre,
      descripcion: validado.data.descripcion ?? null,
      origen: "PERSONALIZADA",
      activo: false,
      contenido: validado.data.contenido as unknown as Prisma.InputJsonValue,
      condiciones: validado.data.condiciones as unknown as Prisma.InputJsonValue,
      prioridad: validado.data.prioridad ?? 0,
    },
    select: { id: true },
  });

  revalidatePath("/configuracion");
  return { exito: true, id: creada.id };
}

export async function editarEstrategia(id: string, datos: unknown): Promise<Resultado> {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error: error ?? "Sin permiso" };

  const estrategia = await prisma.playbookEstrategia.findFirst({ where: { id, instanciaId: sesion.instanciaId } });
  if (!estrategia) return { exito: false, error: "Estrategia no encontrada" };

  const validado = PlaybookEstrategiaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  // FR-004 — editar el contenido/condiciones de una plantilla está permitido (solo se distingue por origen en la UI)
  await prisma.playbookEstrategia.update({
    where: { id },
    data: {
      nombre: validado.data.nombre,
      descripcion: validado.data.descripcion ?? null,
      contenido: validado.data.contenido as unknown as Prisma.InputJsonValue,
      condiciones: validado.data.condiciones as unknown as Prisma.InputJsonValue,
      prioridad: validado.data.prioridad ?? estrategia.prioridad,
    },
  });

  revalidatePath("/configuracion");
  return { exito: true };
}

async function cambiarActivo(id: string, activo: boolean): Promise<Resultado> {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error: error ?? "Sin permiso" };

  const estrategia = await prisma.playbookEstrategia.findFirst({ where: { id, instanciaId: sesion.instanciaId } });
  if (!estrategia) return { exito: false, error: "Estrategia no encontrada" };

  await prisma.playbookEstrategia.update({ where: { id }, data: { activo } });
  revalidatePath("/configuracion");
  return { exito: true };
}

// Next.js exige que toda función exportada de un archivo "use server" sea
// una función async declarada directamente — un const que envuelve otra
// función (aunque devuelva una Promise) falla la validación de build.
export async function activarEstrategia(id: string): Promise<Resultado> {
  return cambiarActivo(id, true);
}
export async function desactivarEstrategia(id: string): Promise<Resultado> {
  return cambiarActivo(id, false);
}

export async function duplicarEstrategia(id: string): Promise<Resultado<{ nuevoId: string }>> {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error: error ?? "Sin permiso" };

  const original = await prisma.playbookEstrategia.findFirst({ where: { id, instanciaId: sesion.instanciaId } });
  if (!original) return { exito: false, error: "Estrategia no encontrada" };

  const copia = await prisma.playbookEstrategia.create({
    data: {
      instanciaId: sesion.instanciaId,
      nombre: `${original.nombre} (copia)`,
      descripcion: original.descripcion,
      origen: "PERSONALIZADA",
      activo: false,
      contenido: original.contenido as Prisma.InputJsonValue,
      condiciones: original.condiciones as Prisma.InputJsonValue,
      prioridad: original.prioridad,
    },
    select: { id: true },
  });

  revalidatePath("/configuracion");
  return { exito: true, nuevoId: copia.id };
}

export async function eliminarEstrategia(id: string): Promise<Resultado> {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error: error ?? "Sin permiso" };

  const estrategia = await prisma.playbookEstrategia.findFirst({ where: { id, instanciaId: sesion.instanciaId } });
  if (!estrategia) return { exito: false, error: "Estrategia no encontrada" };

  const asignaciones = await prisma.agentePlaybookAsignacion.count({ where: { playbookEstrategiaId: id } });
  if (asignaciones > 0) {
    return {
      exito: false,
      error: `No se puede eliminar: está asignada a ${asignaciones} agente(s). Quitá la asignación primero.`,
    };
  }

  await prisma.playbookEstrategia.delete({ where: { id } });
  revalidatePath("/configuracion");
  return { exito: true };
}

export async function asignarEstrategiaAAgente(datos: unknown): Promise<Resultado<{ asignacionId: string }>> {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error: error ?? "Sin permiso" };

  const validado = AsignarEstrategiaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  const [agente, estrategia] = await Promise.all([
    prisma.agenteIAConfig.findFirst({ where: { id: validado.data.agenteIAConfigId, instanciaId: sesion.instanciaId } }),
    prisma.playbookEstrategia.findFirst({ where: { id: validado.data.playbookEstrategiaId, instanciaId: sesion.instanciaId } }),
  ]);
  if (!agente) return { exito: false, error: "Agente no encontrado en esta instancia" };
  if (!estrategia) return { exito: false, error: "Estrategia no encontrada en esta instancia" };
  if (!estrategia.activo) return { exito: false, error: "No se puede asignar una estrategia inactiva" };

  const asignacion = await prisma.agentePlaybookAsignacion.upsert({
    where: {
      agenteIAConfigId_playbookEstrategiaId: {
        agenteIAConfigId: validado.data.agenteIAConfigId,
        playbookEstrategiaId: validado.data.playbookEstrategiaId,
      },
    },
    create: {
      agenteIAConfigId: validado.data.agenteIAConfigId,
      playbookEstrategiaId: validado.data.playbookEstrategiaId,
      prioridadEfectiva: validado.data.prioridadEfectiva ?? null,
      condicionesOverride: (validado.data.condicionesOverride as unknown as Prisma.InputJsonValue) ?? undefined,
    },
    update: {
      prioridadEfectiva: validado.data.prioridadEfectiva ?? null,
      condicionesOverride: (validado.data.condicionesOverride as unknown as Prisma.InputJsonValue) ?? undefined,
    },
    select: { id: true },
  });

  revalidatePath("/configuracion");
  return { exito: true, asignacionId: asignacion.id };
}

export async function obtenerAsignacionesDeAgente(agenteIAConfigId: string) {
  const sesion = await requireSesion();
  const agente = await prisma.agenteIAConfig.findFirst({ where: { id: agenteIAConfigId, instanciaId: sesion.instanciaId } });
  if (!agente) return [];
  return listarAsignacionesDeAgente(agenteIAConfigId);
}

export async function obtenerEstrategiasActivas() {
  const sesion = await requireSesion();
  const todas = await listarEstrategias(sesion.instanciaId);
  return todas.filter((e) => e.activo);
}

export async function obtenerSeleccionesRecientes(agenteIAConfigId: string) {
  const sesion = await requireSesion();
  const agente = await prisma.agenteIAConfig.findFirst({ where: { id: agenteIAConfigId, instanciaId: sesion.instanciaId } });
  if (!agente) return [];
  return listarSeleccionesRecientes(agenteIAConfigId);
}

export async function quitarAsignacionEstrategia(asignacionId: string): Promise<Resultado> {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error: error ?? "Sin permiso" };

  const asignacion = await prisma.agentePlaybookAsignacion.findFirst({
    where: { id: asignacionId, agenteIAConfig: { instanciaId: sesion.instanciaId } },
  });
  if (!asignacion) return { exito: false, error: "Asignación no encontrada" };

  await prisma.agentePlaybookAsignacion.delete({ where: { id: asignacionId } });
  revalidatePath("/configuracion");
  return { exito: true };
}
