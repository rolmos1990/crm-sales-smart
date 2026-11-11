"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
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

const ERROR_NO_ENCONTRADO = "Disparador no encontrado";

// Los ids llegan desde el cliente: sin este filtro por instancia, un usuario
// podría modificar disparadores de otra empresa conociendo un id. Se acepta
// también vía etapa porque `flujoVentaId` es opcional en el modelo.
function filtroInstancia(instanciaId: string) {
  return {
    OR: [{ flujoVenta: { instanciaId } }, { flujoVentaEtapa: { flujoVenta: { instanciaId } } }],
  };
}

async function disparadorFlujoDeInstancia(id: string, instanciaId: string) {
  return prisma.disparador.findFirst({
    where: { id, ...filtroInstancia(instanciaId) },
    select: { id: true },
  });
}

export async function crearDisparadorFlujo(
  flujoVentaId: string,
  etapaId: string,
  datos: unknown,
) {
  const parsed = SchemaDisparador.safeParse(datos);
  if (!parsed.success)
    return { exito: false as const, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };

  const auth = await requirePermisoAction("flujo-venta", "modificar");
  if (!auth.ok) return { exito: false as const, error: auth.error };

  try {
    const etapa = await prisma.flujoVentaEtapa.findFirst({
      where: { id: etapaId, flujoVentaId, flujoVenta: { instanciaId: auth.sesion.instanciaId } },
      select: { id: true },
    });
    if (!etapa) return { exito: false as const, error: "Etapa no encontrada" };

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

  const auth = await requirePermisoAction("flujo-venta", "modificar");
  if (!auth.ok) return { exito: false as const, error: auth.error };

  try {
    if (!(await disparadorFlujoDeInstancia(id, auth.sesion.instanciaId)))
      return { exito: false as const, error: ERROR_NO_ENCONTRADO };

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
  const auth = await requirePermisoAction("flujo-venta", "modificar");
  if (!auth.ok) return { exito: false as const, error: auth.error };

  try {
    if (!(await disparadorFlujoDeInstancia(id, auth.sesion.instanciaId)))
      return { exito: false as const, error: ERROR_NO_ENCONTRADO };

    await prisma.disparador.update({ where: { id }, data: { activo } });
    revalidatePath("/sales/flujo-venta");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al cambiar estado" };
  }
}

export async function eliminarDisparadorFlujo(id: string) {
  const auth = await requirePermisoAction("flujo-venta", "modificar");
  if (!auth.ok) return { exito: false as const, error: auth.error };

  try {
    if (!(await disparadorFlujoDeInstancia(id, auth.sesion.instanciaId)))
      return { exito: false as const, error: ERROR_NO_ENCONTRADO };

    await prisma.disparador.update({ where: { id }, data: { activo: false } });
    revalidatePath("/sales/flujo-venta");
    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al eliminar el disparador" };
  }
}

export async function reordenarDisparadoresFlujo(etapaId: string, ids: string[]) {
  const auth = await requirePermisoAction("flujo-venta", "modificar");
  if (!auth.ok) return { exito: false as const, error: auth.error };

  try {
    const propios = await prisma.disparador.count({
      where: {
        id: { in: ids },
        flujoVentaEtapaId: etapaId,
        ...filtroInstancia(auth.sesion.instanciaId),
      },
    });
    if (propios !== new Set(ids).size) return { exito: false as const, error: ERROR_NO_ENCONTRADO };

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
