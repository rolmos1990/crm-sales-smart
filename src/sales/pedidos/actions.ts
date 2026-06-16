"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { busEventos, TIPOS_EVENTO } from "@/shared/eventos";
import { CrearPedidoSchema, ActualizarEstadoPedidoSchema } from "./schema";
import { generarNumeroPedido } from "./queries";
import { obtenerFlujoVenta } from "@/sales/flujo-venta/queries";
import type { ResultadoAccion, Pedido } from "./types";

export async function crearPedido(datos: unknown): Promise<ResultadoAccion<Pedido>> {
  const validado = CrearPedidoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const sesion = await requireSesion();
    const {
      lineas, contactoId, empresaId, cotizacionId, notas, impuesto,
      nombre, apellido, telefono, email, ruc, empresaNombre,
      ...resto
    } = validado.data;
    const numero = await generarNumeroPedido(sesion.instanciaId);

    // Cargar y validar stock de productos que lo manejan
    const idsProducto = lineas.map(l => l.productoId).filter(Boolean) as string[];
    const productosConStock: { id: string; nombre: string; cantidadDisponible: number }[] = [];

    if (idsProducto.length > 0) {
      const productosDB = await prisma.producto.findMany({
        where: { id: { in: idsProducto }, manejaStock: true },
        select: { id: true, nombre: true, cantidadDisponible: true },
      });

      for (const linea of lineas) {
        if (!linea.productoId) continue;
        const prod = productosDB.find(p => p.id === linea.productoId);
        if (!prod) continue;
        const disponible = Number(prod.cantidadDisponible);
        if (disponible < linea.cantidad) {
          return {
            exito: false,
            error: `Stock insuficiente para "${prod.nombre}". Disponible: ${disponible} — solicitado: ${linea.cantidad}`,
          };
        }
        productosConStock.push({ id: prod.id, nombre: prod.nombre, cantidadDisponible: disponible });
      }
    }

    const subtotal = lineas.reduce((acc, l) => {
      return acc + l.cantidad * l.precioUnitario * (1 - l.descuento / 100);
    }, 0);
    const impuestoMonto = subtotal * (impuesto / 100);
    const total = subtotal + impuestoMonto;

    const pedido = await prisma.pedido.create({
      data: {
        ...resto,
        instanciaId: sesion.instanciaId,
        numero,
        subtotal,
        impuesto: impuestoMonto,
        total,
        notas: notas || null,
        contactoId: contactoId || null,
        empresaId: empresaId || null,
        cotizacionId: cotizacionId || null,
        nombre: nombre || null,
        apellido: apellido || null,
        telefono: telefono || null,
        email: email || null,
        ruc: ruc || null,
        empresaNombre: empresaNombre || null,
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

    // Descontar stock de los productos que lo manejan
    if (productosConStock.length > 0) {
      await Promise.all(
        lineas
          .filter(l => l.productoId && productosConStock.some(p => p.id === l.productoId))
          .map(l =>
            prisma.producto.update({
              where: { id: l.productoId! },
              data: { cantidadDisponible: { decrement: l.cantidad } },
            })
          )
      );
    }

    // Vincular al FlujoVenta del tenant si existe
    const flujoTenant = await obtenerFlujoVenta(sesion.instanciaId);
    if (flujoTenant && flujoTenant.etapas.length > 0) {
      const etapaInicial = flujoTenant.etapas.find((e) => e.esInicial) ?? flujoTenant.etapas[0];
      await prisma.$transaction([
        prisma.pedido.update({
          where: { id: pedido.id },
          data: { flujoVentaId: flujoTenant.id, flujoVentaEtapaId: etapaInicial.id },
        }),
        prisma.pedidoHistorialEtapa.create({
          data: {
            pedidoId: pedido.id,
            etapaId: etapaInicial.id,
            etapaNombre: etapaInicial.nombre,
            tipo: "AUTOMATICO",
            usuarioId: sesion.usuarioId,
          },
        }),
      ]);
    }

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
