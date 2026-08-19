"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { EventosSistema } from "@/eventos/catalogo";
import { publicadorEventos } from "@/shared/rabbitmq";
import { CrearCotizacionSchema, ActualizarCotizacionSchema } from "./schema";
import { generarNumeroCotizacion, obtenerCotizacionesPorOportunidad } from "./queries";
import { generarNumeroPedido } from "@/sales/pedidos/queries";
import { obtenerFlujoVenta } from "@/sales/flujo-venta/queries";
import { buscarEmpresas } from "@/crm/empresas/queries";
import { buscarContactos } from "@/crm/contactos/queries";
import { obtenerProductosCatalogo } from "@/shared/productos/queries";
import { obtenerMonedaPrincipal } from "@/configuracion/empresa/queries";
import { obtenerTransportistas } from "@/sales/transportistas/queries";
import type { OpcionCombobox } from "@/shared/ui/combobox";
import type { ProductoCatalogo } from "@/shared/productos/types";
import type { ResultadoAccion, Cotizacion } from "./types";

export async function crearCotizacion(datos: unknown): Promise<ResultadoAccion<Cotizacion>> {
  const validado = CrearCotizacionSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("cotizaciones", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const { lineas, contactoId, empresaId, notas, impuesto, oportunidadId, destinatario, entrega, ...resto } = validado.data;
    const numero = await generarNumeroCotizacion(sesion.instanciaId);

    const subtotal = lineas.reduce((acc, l) => {
      const base = l.cantidad * l.precioUnitario;
      return acc + base * (1 - l.descuento / 100);
    }, 0);
    const impuestoMonto = subtotal * (impuesto / 100);
    const total = subtotal + impuestoMonto;

    // Solo se registra la entrega si el usuario realmente tocó algo de esa
    // sección — evita crear una fila EntregaCotizacion vacía por defecto.
    const hayEntrega = entrega && (entrega.metodoEntrega || entrega.fechaEstimada || entrega.observaciones || entrega.transportistaId);

    const cotizacion = await prisma.cotizacion.create({
      data: {
        ...resto,
        instanciaId: sesion.instanciaId,
        numero,
        subtotal,
        impuesto: impuestoMonto,
        total,
        notas: notas || null,
        contactoId, // requerido por el schema — la cotización siempre nace ligada a un contacto
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
        entrega: hayEntrega ? {
          create: {
            metodoEntrega: entrega.metodoEntrega || "COURIER_EXTERNO",
            estadoEntrega: entrega.estadoEntrega || "PENDIENTE",
            transportistaId: entrega.transportistaId || null,
            fechaEstimada: entrega.fechaEstimada || null,
            observaciones: entrega.observaciones || null,
          },
        } : undefined,
      },
      include: { contacto: { select: { id: true, nombre: true, apellido: true } }, empresa: { select: { id: true, nombre: true } } },
    });

    await publicadorEventos.publicar(EventosSistema.CotizacionCreada, sesion.instanciaId, { instanciaId: sesion.instanciaId, cotizacionId: cotizacion.id, numero: cotizacion.numero, total });
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

  const auth = await requirePermisoAction("cotizaciones", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const cotizacionExistente = await prisma.cotizacion.findFirst({ where: { id, instanciaId: sesion.instanciaId } });
    if (!cotizacionExistente) return { exito: false, error: "Cotización no encontrada" };
    if (cotizacionExistente.estado !== "BORRADOR") {
      return { exito: false, error: "Solo se pueden modificar cotizaciones en estado borrador" };
    }

    const { lineas, contactoId, empresaId, notas, impuesto, oportunidadId, destinatario, entrega, ...resto } = validado.data;

    let updateData: Record<string, unknown> = {
      ...resto,
      notas: notas !== undefined ? notas || null : undefined,
      // contactoId nunca se limpia: el schema exige que, si viene, sea un id no vacío
      // (se puede cambiar de contacto, pero la cotización nunca se queda sin uno).
      contactoId: contactoId !== undefined ? contactoId : undefined,
      empresaId: empresaId !== undefined ? empresaId || null : undefined,
      oportunidadId: oportunidadId !== undefined ? oportunidadId || null : undefined,
    };

    if (destinatario !== undefined) {
      const metadataActual = (cotizacionExistente.metadata as Record<string, unknown>) ?? {};
      updateData.metadata = { ...metadataActual, destinatario };
    }

    if (entrega !== undefined) {
      const hayEntrega = entrega.metodoEntrega || entrega.fechaEstimada || entrega.observaciones || entrega.transportistaId;
      const datosEntrega = {
        metodoEntrega: entrega.metodoEntrega || "COURIER_EXTERNO",
        estadoEntrega: entrega.estadoEntrega || "PENDIENTE",
        transportistaId: entrega.transportistaId || null,
        fechaEstimada: entrega.fechaEstimada || null,
        observaciones: entrega.observaciones || null,
      };
      updateData.entrega = hayEntrega ? {
        upsert: { create: datosEntrega, update: datosEntrega },
      } : undefined;
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
  const auth = await requirePermisoAction("cotizaciones", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const sesion = auth.sesion;

  try {
    await prisma.cotizacion.update({
      where: { id, instanciaId: sesion.instanciaId },
      data: { estado: estado as "BORRADOR" | "ENVIADA" | "APROBADA" | "RECHAZADA" | "VENCIDA" },
    });

    if (estado === "ENVIADA") {
      await publicadorEventos.publicar(EventosSistema.CotizacionEnviada, sesion.instanciaId, { instanciaId: sesion.instanciaId, cotizacionId: id, numero: "" });
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
  const auth = await requirePermisoAction("cotizaciones", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const cotizacion = await prisma.cotizacion.findFirst({
      where: { id, instanciaId: sesion.instanciaId },
      include: {
        lineas: {
          include: {
            producto: { select: { id: true, nombre: true, manejaStock: true, cantidadDisponible: true } },
          },
        },
        entrega: true,
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

    const [numeroPedido, flujoTenant] = await Promise.all([
      generarNumeroPedido(sesion.instanciaId),
      obtenerFlujoVenta(sesion.instanciaId),
    ]);

    const etapaInicial = flujoTenant?.etapas.length
      ? (flujoTenant.etapas.find((e) => e.esInicial) ?? flujoTenant.etapas[0])
      : null;

    const pedido = await prisma.$transaction(async (tx) => {
      // Aprobar cotización
      await tx.cotizacion.update({ where: { id }, data: { estado: "APROBADA" } });

      const dest = (cotizacion.metadata as Record<string, unknown> | null)?.destinatario as Record<string, string | null> | undefined ?? {};

      // Crear pedido vinculado
      const nuevoPedido = await tx.pedido.create({
        data: {
          numero:             numeroPedido,
          estado:             "CONFIRMADO",
          instanciaId:        sesion.instanciaId,
          moneda:             cotizacion.moneda,
          subtotal:           cotizacion.subtotal,
          descuento:          cotizacion.descuento,
          impuesto:           cotizacion.impuesto,
          total:              cotizacion.total,
          notas:              cotizacion.notas,
          contactoId:         cotizacion.contactoId,
          empresaId:          cotizacion.empresaId,
          cotizacionId:       cotizacion.id,
          nombre:             dest.nombre || null,
          apellido:           dest.apellido || null,
          telefono:           dest.telefono || null,
          email:              dest.email || null,
          flujoVentaId:       flujoTenant?.id ?? null,
          flujoVentaEtapaId:  etapaInicial?.id ?? null,
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
          // La entrega ya capturada en la cotización pasa directo al pedido —
          // el usuario no tiene que volver a registrarla (ver EntregaCotizacion).
          entrega: cotizacion.entrega ? {
            create: {
              metodoEntrega:   cotizacion.entrega.metodoEntrega,
              estadoEntrega:   cotizacion.entrega.estadoEntrega,
              transportistaId: cotizacion.entrega.transportistaId,
              fechaEstimada:   cotizacion.entrega.fechaEstimada,
              observaciones:   cotizacion.entrega.observaciones,
              // La cotización no captura número de guía ni URL de
              // seguimiento (todavía no existen a esa altura) — quedan
              // vacíos en el pedido, listos para completarse ahí.
              numeroGuia:      null,
              urlSeguimiento:  null,
            },
          } : undefined,
        },
      });

      if (etapaInicial) {
        await tx.pedidoHistorialEtapa.create({
          data: {
            pedidoId:    nuevoPedido.id,
            etapaId:     etapaInicial.id,
            etapaNombre: etapaInicial.nombre,
            tipo:        "AUTOMATICO",
            usuarioId:   sesion.usuarioId,
          },
        });
      }

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

    await publicadorEventos.publicar(EventosSistema.CotizacionEnviada, sesion.instanciaId, { instanciaId: sesion.instanciaId, cotizacionId: id, numero: cotizacion.numero });
    await publicadorEventos.publicar(EventosSistema.PedidoCreado, sesion.instanciaId, { instanciaId: sesion.instanciaId, pedidoId: pedido.id, numero: numeroPedido, total: Number(cotizacion.total), usuarioId: sesion.usuarioId, usuarioNombre: null });

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
  const auth = await requirePermisoAction("cotizaciones", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
    const cotizacion = await prisma.cotizacion.findFirst({ where: { id, instanciaId: sesion.instanciaId } });
    if (!cotizacion) return { exito: false, error: "Cotización no encontrada" };
    if (cotizacion.estado !== "BORRADOR") {
      return { exito: false, error: "Solo se pueden eliminar cotizaciones en estado borrador" };
    }

    await prisma.cotizacion.delete({ where: { id } });
    revalidatePath("/sales/cotizaciones");
    if (cotizacion.oportunidadId) revalidatePath(`/crm/oportunidades/${cotizacion.oportunidadId}`);
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar la cotización" };
  }
}

export async function obtenerDatosFormularioCotizacion(): Promise<{
  empresas: OpcionCombobox[];
  contactos: OpcionCombobox[];
  contactosDetalle: Awaited<ReturnType<typeof buscarContactos>>;
  productos: ProductoCatalogo[];
  monedaDefault: string;
  transportistas: Awaited<ReturnType<typeof obtenerTransportistas>>;
}> {
  const sesion = await requireSesion();
  const [empresas, contactos, productos, monedaDefault, transportistas] = await Promise.all([
    buscarEmpresas("", sesion.instanciaId),
    buscarContactos("", sesion.instanciaId),
    obtenerProductosCatalogo(sesion.instanciaId),
    obtenerMonedaPrincipal(sesion.instanciaId),
    obtenerTransportistas(sesion.instanciaId),
  ]);
  return {
    empresas: empresas.map((e) => ({ valor: e.id, etiqueta: e.nombre })),
    contactos: contactos.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} ${c.apellido}` })),
    contactosDetalle: contactos,
    productos,
    monedaDefault,
    transportistas,
  };
}
