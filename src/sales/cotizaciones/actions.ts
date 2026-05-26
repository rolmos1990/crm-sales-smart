"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { busEventos, TIPOS_EVENTO } from "@/shared/eventos";
import { CrearCotizacionSchema } from "./schema";
import { generarNumeroCotizacion } from "./queries";
import { generarNumeroPedido } from "@/sales/pedidos/queries";
import type { ResultadoAccion, Cotizacion } from "./types";

export async function crearCotizacion(datos: unknown): Promise<ResultadoAccion<Cotizacion>> {
  const validado = CrearCotizacionSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const { lineas, contactoId, empresaId, notas, impuesto, ...resto } = validado.data;
    const numero = await generarNumeroCotizacion();

    const subtotal = lineas.reduce((acc, l) => {
      const base = l.cantidad * l.precioUnitario;
      return acc + base * (1 - l.descuento / 100);
    }, 0);
    const impuestoMonto = subtotal * (impuesto / 100);
    const total = subtotal + impuestoMonto;

    const cotizacion = await prisma.cotizacion.create({
      data: {
        ...resto,
        numero,
        subtotal,
        impuesto: impuestoMonto,
        total,
        notas: notas || null,
        contactoId: contactoId || null,
        empresaId: empresaId || null,
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
      include: { contacto: { select: { id: true, nombre: true, apellido: true } }, empresa: { select: { id: true, nombre: true } } },
    });

    busEventos.publicar(TIPOS_EVENTO.COTIZACION_CREADA, { cotizacionId: cotizacion.id, numero: cotizacion.numero, total });
    revalidatePath("/sales/cotizaciones");
    return { exito: true, datos: { ...cotizacion, subtotal, total, impuesto: impuestoMonto } as unknown as Cotizacion };
  } catch {
    return { exito: false, error: "Error al crear la cotización" };
  }
}

export async function cambiarEstadoCotizacion(id: string, estado: string): Promise<ResultadoAccion> {
  try {
    await prisma.cotizacion.update({
      where: { id },
      data: { estado: estado as "BORRADOR" | "ENVIADA" | "APROBADA" | "RECHAZADA" | "VENCIDA" },
    });

    if (estado === "ENVIADA") {
      busEventos.publicar(TIPOS_EVENTO.COTIZACION_ENVIADA, { cotizacionId: id, numero: "" });
    }

    revalidatePath("/sales/cotizaciones");
    revalidatePath(`/sales/cotizaciones/${id}`);
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al cambiar el estado" };
  }
}

export async function aprobarCotizacion(id: string): Promise<ResultadoAccion<{ pedidoId: string; numeroPedido: string }>> {
  try {
    const cotizacion = await prisma.cotizacion.findUnique({
      where: { id },
      include: {
        lineas: {
          include: {
            producto: { select: { id: true, nombre: true, manejaStock: true, cantidadDisponible: true } },
          },
        },
      },
    });

    if (!cotizacion) return { exito: false, error: "Cotización no encontrada" };
    if (cotizacion.estado === "APROBADA") return { exito: false, error: "La cotización ya fue aprobada" };

    // Validar stock antes de hacer cualquier cambio
    const erroresStock: string[] = [];
    for (const linea of cotizacion.lineas) {
      if (!linea.producto?.manejaStock) continue;
      const disponible = Number(linea.producto.cantidadDisponible);
      const solicitado = Number(linea.cantidad);
      if (disponible < solicitado) {
        erroresStock.push(
          `"${linea.producto.nombre}": disponible ${disponible}, solicitado ${solicitado}`
        );
      }
    }
    if (erroresStock.length > 0) {
      return { exito: false, error: `Stock insuficiente — ${erroresStock.join(" · ")}` };
    }

    const numeroPedido = await generarNumeroPedido();

    const pedido = await prisma.$transaction(async (tx) => {
      // Aprobar cotización
      await tx.cotizacion.update({ where: { id }, data: { estado: "APROBADA" } });

      // Crear pedido vinculado
      const nuevoPedido = await tx.pedido.create({
        data: {
          numero:       numeroPedido,
          estado:       "CONFIRMADO",
          moneda:       cotizacion.moneda,
          subtotal:     cotizacion.subtotal,
          descuento:    cotizacion.descuento,
          impuesto:     cotizacion.impuesto,
          total:        cotizacion.total,
          notas:        cotizacion.notas,
          contactoId:   cotizacion.contactoId,
          empresaId:    cotizacion.empresaId,
          cotizacionId: cotizacion.id,
          lineas: {
            create: cotizacion.lineas.map((l) => ({
              productoId:     l.productoId,
              descripcion:    l.descripcion,
              cantidad:       l.cantidad,
              precioUnitario: l.precioUnitario,
              descuento:      l.descuento,
              impuesto:       l.impuesto,
              subtotal:       l.subtotal,
              total:          l.total,
            })),
          },
        },
      });

      // Descontar stock de productos que lo manejan
      const lineasConStock = cotizacion.lineas.filter((l) => l.producto?.manejaStock && l.productoId);
      if (lineasConStock.length > 0) {
        await Promise.all(
          lineasConStock.map((l) =>
            tx.producto.update({
              where: { id: l.productoId! },
              data: { cantidadDisponible: { decrement: l.cantidad } },
            })
          )
        );
      }

      return nuevoPedido;
    });

    busEventos.publicar(TIPOS_EVENTO.COTIZACION_ENVIADA, { cotizacionId: id, numero: cotizacion.numero });
    busEventos.publicar(TIPOS_EVENTO.PEDIDO_CREADO, { pedidoId: pedido.id, numero: numeroPedido, total: Number(cotizacion.total) });

    revalidatePath("/sales/cotizaciones");
    revalidatePath("/sales/pedidos");
    revalidatePath(`/sales/cotizaciones/${id}`);

    return { exito: true, datos: { pedidoId: pedido.id, numeroPedido } };
  } catch {
    return { exito: false, error: "Error al aprobar la cotización" };
  }
}

export async function eliminarCotizacion(id: string): Promise<ResultadoAccion> {
  try {
    await prisma.cotizacion.delete({ where: { id } });
    revalidatePath("/sales/cotizaciones");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar la cotización" };
  }
}
