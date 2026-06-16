"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { EtapaSchema, ReglaSchema, FlujoVentaSchema } from "./schema";
import { moverPedidoAEtapa, validarTransicion } from "./motor";

type Resultado<T = void> = { exito: true; datos: T } | { exito: false; error: string };

// ── Flujo ─────────────────────────────────────────────────────────

export async function crearOActualizarFlujoVenta(datos: unknown): Promise<Resultado<{ id: string }>> {
  const validado = FlujoVentaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const sesion = await requireSesion();

  const existente = await prisma.flujoVenta.findFirst({ where: { instanciaId: sesion.instanciaId } });

  if (existente) {
    await prisma.flujoVenta.update({ where: { id: existente.id }, data: validado.data });
    revalidatePath("/sales/flujo-venta");
    return { exito: true, datos: { id: existente.id } };
  }

  const flujo = await prisma.flujoVenta.create({
    data: {
      ...validado.data,
      instanciaId: sesion.instanciaId,
      esDefault: true,
    },
  });
  revalidatePath("/sales/flujo-venta");
  return { exito: true, datos: { id: flujo.id } };
}

// ── Etapas ────────────────────────────────────────────────────────

export async function crearEtapa(flujoVentaId: string, datos: unknown): Promise<Resultado<{ id: string }>> {
  const validado = EtapaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const sesion = await requireSesion();
  const flujo = await prisma.flujoVenta.findFirst({ where: { id: flujoVentaId, instanciaId: sesion.instanciaId } });
  if (!flujo) return { exito: false, error: "Flujo no encontrado" };

  try {
    const etapa = await prisma.flujoVentaEtapa.create({
      data: {
        ...validado.data,
        flujoVentaId,
        esInicial: validado.data.esInicial ?? false,
        esFinal: validado.data.esFinal ?? false,
        esCancelacion: validado.data.esCancelacion ?? false,
        activo: validado.data.activo ?? true,
        parentId: validado.data.parentId ?? null,
      },
    });
    revalidatePath("/sales/flujo-venta");
    return { exito: true, datos: { id: etapa.id } };
  } catch (e) {
    console.error("[crearEtapa] error:", e);
    return { exito: false, error: "Error al crear la etapa" };
  }
}

export async function actualizarEtapa(etapaId: string, datos: unknown): Promise<Resultado> {
  const validado = EtapaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const sesion = await requireSesion();
  const etapa = await prisma.flujoVentaEtapa.findFirst({
    where: { id: etapaId, flujoVenta: { instanciaId: sesion.instanciaId } },
  });
  if (!etapa) return { exito: false, error: "Etapa no encontrada" };

  try {
    await prisma.flujoVentaEtapa.update({ where: { id: etapaId }, data: validado.data });
    revalidatePath("/sales/flujo-venta");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al actualizar la etapa" };
  }
}

export async function eliminarEtapa(etapaId: string): Promise<Resultado> {
  const sesion = await requireSesion();
  const etapa = await prisma.flujoVentaEtapa.findFirst({
    where: { id: etapaId, flujoVenta: { instanciaId: sesion.instanciaId } },
    include: { _count: { select: { pedidos: true } } },
  });
  if (!etapa) return { exito: false, error: "Etapa no encontrada" };
  if (etapa._count.pedidos > 0) return { exito: false, error: `No se puede eliminar: ${etapa._count.pedidos} pedido(s) en esta etapa` };

  await prisma.flujoVentaEtapa.delete({ where: { id: etapaId } });
  revalidatePath("/sales/flujo-venta");
  return { exito: true, datos: undefined };
}

export async function reordenarEtapas(
  items: { id: string; parentId: string | null; orden: number }[]
): Promise<Resultado> {
  await prisma.$transaction(
    items.map(({ id, parentId, orden }) =>
      prisma.flujoVentaEtapa.update({ where: { id }, data: { parentId, orden } })
    )
  );
  revalidatePath("/sales/flujo-venta");
  return { exito: true, datos: undefined };
}

// ── Reglas ────────────────────────────────────────────────────────

export async function crearRegla(datos: unknown): Promise<Resultado<{ id: string }>> {
  const validado = ReglaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const { condiciones, ...resto } = validado.data;

  try {
    const regla = await prisma.flujoVentaRegla.create({
      data: {
        ...resto,
        activo: resto.activo ?? true,
        condiciones: { create: condiciones },
      },
    });
    revalidatePath("/sales/flujo-venta");
    return { exito: true, datos: { id: regla.id } };
  } catch {
    return { exito: false, error: "Error al crear la regla" };
  }
}

export async function actualizarRegla(reglaId: string, datos: unknown): Promise<Resultado> {
  const validado = ReglaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const { condiciones, ...resto } = validado.data;

  try {
    await prisma.$transaction([
      prisma.flujoVentaReglaCondicion.deleteMany({ where: { reglaId } }),
      prisma.flujoVentaRegla.update({
        where: { id: reglaId },
        data: {
          ...resto,
          condiciones: { create: condiciones },
        },
      }),
    ]);
    revalidatePath("/sales/flujo-venta");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al actualizar la regla" };
  }
}

export async function eliminarRegla(reglaId: string): Promise<Resultado> {
  await prisma.flujoVentaRegla.delete({ where: { id: reglaId } });
  revalidatePath("/sales/flujo-venta");
  return { exito: true, datos: undefined };
}

export async function toggleRegla(reglaId: string, activo: boolean): Promise<Resultado> {
  await prisma.flujoVentaRegla.update({ where: { id: reglaId }, data: { activo } });
  revalidatePath("/sales/flujo-venta");
  return { exito: true, datos: undefined };
}

// ── Movimiento de pedido ──────────────────────────────────────────

export async function moverPedidoAction(pedidoId: string, etapaDestinoId: string): Promise<Resultado<void>> {
  const sesion = await requireSesion();

  const validacion = await validarTransicion(pedidoId, etapaDestinoId);
  if (!validacion.permitido) {
    return { exito: false, error: validacion.motivo ?? "Requisito no cumplido" };
  }

  const resultado = await moverPedidoAEtapa(pedidoId, etapaDestinoId, sesion.usuarioId);
  if (!resultado.exito) return resultado;
  return { exito: true, datos: undefined };
}
