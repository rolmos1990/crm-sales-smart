"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { SchemaDisparador } from "@/crm/pipeline/disparadores/schema";
import type { DisparadorFlujo } from "./types";

export async function obtenerDisparadoresFlujoAction(
  flujoVentaId: string,
): Promise<DisparadorFlujo[]> {
  const sesion = await requireSesion();
  const rows = await prisma.disparador.findMany({
    where: {
      flujoVentaId,
      flujoVenta: { instanciaId: sesion.instanciaId },
      activo: true,
    },
    orderBy: [{ flujoVentaEtapaId: "asc" }, { orden: "asc" }],
    include: {
      jobs: {
        select: { id: true, estado: true, ejecutarEn: true, creadoEn: true },
        orderBy: { creadoEn: "desc" },
        take: 5,
      },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    activo: r.activo,
    orden: r.orden,
    delayMinutos: r.delayMinutos,
    tipo: r.tipo,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config: r.config as any,
    flujoVentaEtapaId: r.flujoVentaEtapaId!,
    flujoVentaId: r.flujoVentaId!,
    creadoEn: r.creadoEn,
    jobs: r.jobs.map((j) => ({ ...j, estado: j.estado })),
  }));
}

export async function crearDisparadorFlujo(
  flujoVentaId: string,
  etapaId: string,
  datos: unknown,
) {
  const parsed = SchemaDisparador.safeParse(datos);
  if (!parsed.success)
    return { exito: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    const last = await prisma.disparador.findFirst({
      where: { flujoVentaEtapaId: etapaId, activo: true },
      orderBy: { orden: "desc" },
      select: { orden: true },
    });

    const d = await prisma.disparador.create({
      data: {
        nombre: parsed.data.nombre,
        activo: parsed.data.activo,
        delayMinutos: parsed.data.delayMinutos ?? null,
        tipo: parsed.data.tipo,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: parsed.data.config as any,
        orden: (last?.orden ?? -1) + 1,
        flujoVentaEtapaId: etapaId,
        flujoVentaId,
      },
    });
    revalidatePath("/sales/flujo-venta");
    return { exito: true as const, id: d.id };
  } catch {
    return { exito: false as const, error: "Error al crear el disparador" };
  }
}

export async function actualizarDisparadorFlujo(id: string, datos: unknown) {
  const parsed = SchemaDisparador.safeParse(datos);
  if (!parsed.success)
    return { exito: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  try {
    await prisma.disparador.update({
      where: { id },
      data: {
        nombre: parsed.data.nombre,
        activo: parsed.data.activo,
        delayMinutos: parsed.data.delayMinutos ?? null,
        tipo: parsed.data.tipo,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        config: parsed.data.config as any,
      },
    });
    revalidatePath("/sales/flujo-venta");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al actualizar el disparador" };
  }
}

export async function toggleDisparadorFlujo(id: string, activo: boolean) {
  try {
    await prisma.disparador.update({ where: { id }, data: { activo } });
    revalidatePath("/sales/flujo-venta");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al cambiar estado" };
  }
}

export async function eliminarDisparadorFlujo(id: string) {
  try {
    await prisma.disparador.update({ where: { id }, data: { activo: false } });
    revalidatePath("/sales/flujo-venta");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al eliminar el disparador" };
  }
}

export async function reordenarDisparadoresFlujo(etapaId: string, ids: string[]) {
  try {
    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.disparador.update({ where: { id }, data: { orden: index } }),
      ),
    );
    revalidatePath("/sales/flujo-venta");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al reordenar" };
  }
}

export async function obtenerEtapasFlujoParaDisparadorAction(flujoVentaId: string) {
  const sesion = await requireSesion();
  return prisma.flujoVentaEtapa.findMany({
    where: { flujoVentaId, flujoVenta: { instanciaId: sesion.instanciaId }, activo: true },
    select: { id: true, nombre: true, color: true, orden: true },
    orderBy: { orden: "asc" },
  });
}
