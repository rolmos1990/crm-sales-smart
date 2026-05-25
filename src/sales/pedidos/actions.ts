"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { busEventos, TIPOS_EVENTO } from "@/shared/eventos";
import { CrearPedidoSchema, ActualizarEstadoPedidoSchema } from "./schema";
import { generarNumeroPedido } from "./queries";
import type { ResultadoAccion, Pedido } from "./types";

export async function crearPedido(datos: unknown): Promise<ResultadoAccion<Pedido>> {
  const validado = CrearPedidoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const { lineas, contactoId, empresaId, cotizacionId, notas, impuesto, ...resto } = validado.data;
    const numero = await generarNumeroPedido();

    const subtotal = lineas.reduce((acc, l) => {
      return acc + l.cantidad * l.precioUnitario * (1 - l.descuento / 100);
    }, 0);
    const impuestoMonto = subtotal * (impuesto / 100);
    const total = subtotal + impuestoMonto;

    const pedido = await prisma.pedido.create({
      data: {
        ...resto,
        numero,
        subtotal,
        impuesto: impuestoMonto,
        total,
        notas: notas || null,
        contactoId: contactoId || null,
        empresaId: empresaId || null,
        cotizacionId: cotizacionId || null,
        lineas: {
          create: lineas.map(l => ({
            productoId: l.productoId || null,
            descripcion: l.descripcion || null,
            cantidad: l.cantidad,
            precioUnitario: l.precioUnitario,
            descuento: l.descuento,
            subtotal: l.cantidad * l.precioUnitario * (1 - l.descuento / 100),
          })),
        },
      },
      include: {
        contacto: { select: { id: true, nombre: true, apellido: true } },
        empresa: { select: { id: true, nombre: true } },
      },
    });

    busEventos.publicar(TIPOS_EVENTO.PEDIDO_CREADO, { pedidoId: pedido.id, numero: pedido.numero, total });
    revalidatePath("/sales/pedidos");
    return { exito: true, datos: { ...pedido, subtotal, total, impuesto: impuestoMonto } as unknown as Pedido };
  } catch {
    return { exito: false, error: "Error al crear el pedido" };
  }
}

export async function actualizarEstadoPedido(id: string, datos: unknown): Promise<ResultadoAccion> {
  const validado = ActualizarEstadoPedidoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    await prisma.pedido.update({ where: { id }, data: { estado: validado.data.estado } });

    if (validado.data.estado === "ENTREGADO") {
      busEventos.publicar(TIPOS_EVENTO.PEDIDO_ENTREGADO, { pedidoId: id, numero: "" });
    } else {
      busEventos.publicar(TIPOS_EVENTO.PEDIDO_ACTUALIZADO, { pedidoId: id, cambios: validado.data });
    }

    revalidatePath("/sales/pedidos");
    revalidatePath(`/sales/pedidos/${id}`);
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al actualizar el estado" };
  }
}

export async function eliminarPedido(id: string): Promise<ResultadoAccion> {
  try {
    await prisma.pedido.delete({ where: { id } });
    revalidatePath("/sales/pedidos");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar el pedido" };
  }
}
