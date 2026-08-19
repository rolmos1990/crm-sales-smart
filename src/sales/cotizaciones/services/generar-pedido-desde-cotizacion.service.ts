import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { EventosSistema } from "@/eventos/catalogo";
import { publicadorEventos } from "@/shared/rabbitmq";
import { generarNumeroPedido } from "@/sales/pedidos/queries";
import { obtenerFlujoVenta } from "@/sales/flujo-venta/queries";

export interface GenerarPedidoDesdeCotizacionResult {
  pedidoId: string;
  numeroPedido: string;
  /** true si el pedido ya existía (llamada idempotente, no se creó nada nuevo) */
  yaExistia: boolean;
}

/**
 * Único punto donde se genera un Pedido a partir de una Cotización aprobada.
 * Lo usan tanto el manejador del evento CotizacionAprobada (flujo normal)
 * como la acción de reintento manual — misma lógica siempre, sin importar
 * desde qué módulo se disparó la aprobación.
 *
 * Idempotente: si ya existe un Pedido para esta cotización, lo devuelve tal
 * cual en vez de crear uno nuevo. Si algo fallara a mitad de camino y esto se
 * vuelve a invocar (reintento automático de RabbitMQ o manual), no duplica.
 */
export async function generarPedidoDesdeCotizacion(
  cotizacionId: string,
  instanciaId: string,
  usuarioId: string | null = null,
): Promise<GenerarPedidoDesdeCotizacionResult> {
  const pedidoExistente = await prisma.pedido.findFirst({
    where: { cotizacionId, instanciaId },
    select: { id: true, numero: true },
  });
  if (pedidoExistente) {
    return { pedidoId: pedidoExistente.id, numeroPedido: pedidoExistente.numero, yaExistia: true };
  }

  const cotizacion = await prisma.cotizacion.findFirst({
    where: { id: cotizacionId, instanciaId },
    include: {
      lineas: {
        include: {
          producto: { select: { id: true, nombre: true, manejaStock: true, cantidadDisponible: true } },
        },
      },
      entrega: true,
    },
  });
  if (!cotizacion) {
    throw new Error(`Cotización ${cotizacionId} no encontrada (instancia ${instanciaId})`);
  }
  if (cotizacion.estado !== "APROBADA") {
    // No debería pasar (la acción de aprobar publica el evento recién
    // después de cambiar el estado) — si pasa, algo llamó a este servicio
    // fuera de orden y es mejor fallar fuerte que generar un pedido inválido.
    throw new Error(`La cotización ${cotizacionId} no está en estado APROBADA (actual: ${cotizacion.estado})`);
  }

  // Revalidación defensiva de stock: la acción de aprobar ya lo valida antes
  // de publicar el evento, pero entre ese chequeo y este puede haber pasado
  // stock vendido por otra cotización/pedido procesado mientras tanto.
  const erroresStock: string[] = [];
  for (const linea of cotizacion.lineas) {
    if (!linea.producto?.manejaStock) continue;
    const disponible = Number(linea.producto.cantidadDisponible);
    const solicitado = Number(linea.cantidad);
    if (disponible < solicitado) {
      erroresStock.push(`"${linea.producto.nombre}": disponible ${disponible}, solicitado ${solicitado}`);
    }
  }
  if (erroresStock.length > 0) {
    // Lanzar (no devolver un ResultadoAccion) a propósito: el suscriptor que
    // llama a este servicio necesita que la excepción se propague para que
    // RabbitMQ registre el error y reintente el mensaje.
    throw new Error(`Stock insuficiente al generar el pedido — ${erroresStock.join(" · ")}`);
  }

  // Datos de la oportunidad relacionada, si existe — campos personalizados
  // que se copian al pedido como snapshot (no se pierde nada al aprobar).
  const camposOportunidad = cotizacion.oportunidadId
    ? await prisma.campoPersonalizadoValor.findMany({
        where: { oportunidadId: cotizacion.oportunidadId },
        select: { campoId: true, valor: true },
      })
    : [];

  const [numeroPedido, flujoTenant] = await Promise.all([
    generarNumeroPedido(instanciaId),
    obtenerFlujoVenta(instanciaId),
  ]);

  const etapaInicial = flujoTenant?.etapas.length
    ? (flujoTenant.etapas.find((e) => e.esInicial) ?? flujoTenant.etapas[0])
    : null;

  const dest = (cotizacion.metadata as Record<string, unknown> | null)?.destinatario as Record<string, string | null> | undefined ?? {};

  const pedido = await prisma.$transaction(async (tx) => {
    const nuevoPedido = await tx.pedido.create({
      data: {
        numero:             numeroPedido,
        estado:             "CONFIRMADO",
        instanciaId,
        moneda:             cotizacion.moneda,
        subtotal:           cotizacion.subtotal,
        descuento:          cotizacion.descuento,
        impuesto:           cotizacion.impuesto,
        total:              cotizacion.total,
        notas:              cotizacion.notas,
        contactoId:         cotizacion.contactoId,
        empresaId:          cotizacion.empresaId,
        cotizacionId:       cotizacion.id,
        // Relación con la oportunidad — antes se perdía porque nunca se
        // asignaba acá, sin importar desde qué módulo se aprobara.
        oportunidadId:      cotizacion.oportunidadId,
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
            // La cotización no captura número de guía ni URL de seguimiento
            // (todavía no existen a esa altura) — quedan vacíos en el
            // pedido, listos para completarse ahí.
            numeroGuia:      null,
            urlSeguimiento:  null,
          },
        } : undefined,
        // Campos personalizados heredados de la oportunidad — mismo campoId
        // y valor, como snapshot al momento de aprobar.
        campos: camposOportunidad.length > 0 ? {
          create: camposOportunidad.map((c) => ({
            campoId: c.campoId,
            valor: c.valor as Prisma.InputJsonValue,
          })),
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
          usuarioId,
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

  await publicadorEventos.publicar(EventosSistema.PedidoCreado, instanciaId, {
    instanciaId,
    pedidoId: pedido.id,
    numero: numeroPedido,
    total: Number(cotizacion.total),
    usuarioId,
    usuarioNombre: null,
  });

  return { pedidoId: pedido.id, numeroPedido, yaExistia: false };
}
