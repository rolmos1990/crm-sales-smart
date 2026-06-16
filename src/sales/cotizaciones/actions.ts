"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { busEventos, TIPOS_EVENTO } from "@/shared/eventos";
import { CrearCotizacionSchema, ActualizarCotizacionSchema } from "./schema";
import { generarNumeroCotizacion, obtenerCotizacionesPorOportunidad } from "./queries";
import { generarNumeroPedido } from "@/sales/pedidos/queries";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { obtenerProductosCatalogo } from "@/shared/productos/queries";
import { obtenerMonedaPrincipal } from "@/configuracion/empresa/queries";
import type { OpcionCombobox } from "@/shared/ui/combobox";
import type { ProductoCatalogo } from "@/shared/productos/types";
import type { ResultadoAccion, Cotizacion } from "./types";

export async function crearCotizacion(datos: unknown): Promise<ResultadoAccion<Cotizacion>> {
  const validado = CrearCotizacionSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const sesion = await requireSesion();
    const { lineas, contactoId, empresaId, notas, impuesto, oportunidadId, destinatario, ...resto } = validado.data;
    const numero = await generarNumeroCotizacion(sesion.instanciaId);

    const subtotal = lineas.reduce((acc, l) => {
      const base = l.cantidad * l.precioUnitario;
      return acc + base * (1 - l.descuento / 100);
    }, 0);
    const impuestoMonto = subtotal * (impuesto / 100);
    const total = subtotal + impuestoMonto;

    const cotizacion = await prisma.cotizacion.create({
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
        oportunidadId: oportunidadId || null,
        metadata: destinatario ? { destinatario } : undefined,
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
    if (oportunidadId) revalidatePath(`/crm/oportunidades/${oportunidadId}`);
    return { exito: true, datos: { ...cotizacion, subtotal, total, impuesto: impuestoMonto } as unknown as Cotizacion };
  } catch (e: unknown) {
    console.error("[crearCotizacion]", e);
    const detalle = e instanceof Error ? e.message : String(e);
    return { exito: false, error: `Error al crear la cotización: ${detalle}` };
  }
}

export async function actualizarCotizacion(id: string, datos: unknown): Promise<ResultadoAccion<Cotizacion>> {
  const validado = ActualizarCotizacionSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  try {
    const sesion = await requireSesion();
    const cotizacionExistente = await prisma.cotizacion.findFirst({ where: { id, instanciaId: sesion.instanciaId } });
    if (!cotizacionExistente) return { exito: false, error: "Cotización no encontrada" };

    const { lineas, contactoId, empresaId, notas, impuesto, oportunidadId, destinatario, ...resto } = validado.data;

    let updateData: Record<string, unknown> = {
      ...resto,
      notas: notas !== undefined ? notas || null : undefined,
      contactoId: contactoId !== undefined ? contactoId || null : undefined,
      empresaId: empresaId !== undefined ? empresaId || null : undefined,
      oportunidadId: oportunidadId !== undefined ? oportunidadId || null : undefined,
    };

    if (destinatario !== undefined) {
      const metadataActual = (cotizacionExistente.metadata as Record<string, unknown>) ?? {};
      updateData.metadata = { ...metadataActual, destinatario };
    }

    if (lineas) {
      const subtotal = lineas.reduce((acc, l) => {
        const base = (l.cantidad ?? 0) * (l.precioUnitario ?? 0);
        return acc + base * (1 - (l.descuento ?? 0) / 100);
      }, 0);
      const tasaImpuesto = impuesto ?? Number(cotizacionExistente.impuesto);
      const impuestoMonto = subtotal * (tasaImpuesto / 100);
      const total = subtotal + impuestoMonto;
      updateData = { ...updateData, subtotal, impuesto: impuestoMonto, total };

      await prisma.cotizacionLinea.deleteMany({ where: { cotizacionId: id } });
      await prisma.cotizacion.update({
        where: { id },
        data: {
          ...updateData,
          lineas: {
            create: lineas.map(l => ({
              productoId: l.productoId || null,
              descripcion: l.descripcion || null,
              cantidad: l.cantidad ?? 1,
              precioUnitario: l.precioUnitario ?? 0,
              descuento: l.descuento ?? 0,
              subtotal: (l.cantidad ?? 1) * (l.precioUnitario ?? 0) * (1 - (l.descuento ?? 0) / 100),
            })),
          },
        },
      });
    } else {
      await prisma.cotizacion.update({ where: { id }, data: updateData });
    }

    const cotizacionActualizada = await prisma.cotizacion.findFirst({
      where: { id },
      include: { contacto: { select: { id: true, nombre: true, apellido: true } }, empresa: { select: { id: true, nombre: true } } },
    });

    revalidatePath("/sales/cotizaciones");
    revalidatePath(`/sales/cotizaciones/${id}`);
    if (oportunidadId) revalidatePath(`/crm/oportunidades/${oportunidadId}`);
    const oId = oportunidadId ?? (cotizacionExistente as any).oportunidadId;
    if (oId) revalidatePath(`/crm/oportunidades/${oId}`);
    return { exito: true, datos: cotizacionActualizada as unknown as Cotizacion };
  } catch {
    return { exito: false, error: "Error al actualizar la cotización" };
  }
}

export async function cambiarEstadoCotizacion(id: string, estado: string): Promise<ResultadoAccion> {
  const sesion = await requireSesion();
  try {
    await prisma.cotizacion.update({
      where: { id, instanciaId: sesion.instanciaId },
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

export async function obtenerCotizacionesPorOportunidadAction(oportunidadId: string) {
  const sesion = await requireSesion();
  const datos = await obtenerCotizacionesPorOportunidad(oportunidadId, sesion.instanciaId);
  return datos.map((c) => ({ ...c, total: Number(c.total) }));
}

export async function aprobarCotizacion(id: string): Promise<ResultadoAccion<{ pedidoId: string; numeroPedido: string }>> {
  try {
    const sesion = await requireSesion();
    const cotizacion = await prisma.cotizacion.findFirst({
      where: { id, instanciaId: sesion.instanciaId },
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

    const numeroPedido = await generarNumeroPedido(sesion.instanciaId);

    const pedido = await prisma.$transaction(async (tx) => {
      // Aprobar cotización
      await tx.cotizacion.update({ where: { id }, data: { estado: "APROBADA" } });

      const dest = (cotizacion.metadata as Record<string, unknown> | null)?.destinatario as Record<string, string | null> | undefined ?? {};

      // Crear pedido vinculado
      const nuevoPedido = await tx.pedido.create({
        data: {
          numero:       numeroPedido,
          estado:       "CONFIRMADO",
          instanciaId:  sesion.instanciaId,
          moneda:       cotizacion.moneda,
          subtotal:     cotizacion.subtotal,
          descuento:    cotizacion.descuento,
          impuesto:     cotizacion.impuesto,
          total:        cotizacion.total,
          notas:        cotizacion.notas,
          contactoId:   cotizacion.contactoId,
          empresaId:    cotizacion.empresaId,
          cotizacionId: cotizacion.id,
          nombre:       dest.nombre || null,
          apellido:     dest.apellido || null,
          telefono:     dest.telefono || null,
          email:        dest.email || null,
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
    if ((cotizacion as any).oportunidadId) revalidatePath(`/crm/oportunidades/${(cotizacion as any).oportunidadId}`);

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

export async function obtenerDatosFormularioCotizacion(): Promise<{
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  productos: ProductoCatalogo[];
  monedaDefault: string;
}> {
  const sesion = await requireSesion();
  const [empresas, contactos, productos, monedaDefault] = await Promise.all([
    buscarEmpresas("", sesion.instanciaId),
    buscarContactos("", sesion.instanciaId),
    obtenerProductosCatalogo(sesion.instanciaId),
    obtenerMonedaPrincipal(sesion.instanciaId),
  ]);
  return {
    empresas: empresas.map((e) => ({ valor: e.id, etiqueta: e.nombre })),
    contactos: contactos.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} ${c.apellido}` })),
    productos,
    monedaDefault,
  };
}
