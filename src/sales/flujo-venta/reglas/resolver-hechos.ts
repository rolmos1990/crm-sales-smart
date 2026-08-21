import type { PrismaClient } from "@/generated/prisma/client";
import type { HechosPedido } from "./tipos";

/**
 * Arma el objeto de "hechos" de un pedido — una sola consulta con todo lo
 * que el catálogo de campos puede llegar a necesitar, evaluada una vez por
 * validación (nunca se vuelve a golpear la base por cada condición).
 *
 * Sin llamadas a proveedores externos: todo sale de esta consulta local.
 *
 * `db` se recibe inyectado (no se importa el singleton de
 * `@/shared/db/prisma` acá) porque este módulo también se usa desde el
 * ejecutor de disparadores (`src/crm/pipeline/disparadores/ejecutor.ts`),
 * que corre tanto dentro de Next.js como en el worker standalone (`tsx`) con
 * su propio PrismaClient — ese archivo evita a propósito los alias `@/` para
 * seguir funcionando en ambos contextos (ver su comentario de cabecera).
 */
export async function resolverHechosPedido(
  db: PrismaClient,
  pedidoId: string,
  instanciaId: string
): Promise<HechosPedido | null> {
  const pedido = await db.pedido.findFirst({
    where: { id: pedidoId, instanciaId },
    include: {
      lineas: { include: { producto: { select: { id: true, sku: true, categoria: true, manejaStock: true, cantidadDisponible: true } } } },
      entrega: { include: { transportista: { select: { nombre: true } } } },
      contacto: { select: { nombre: true, apellido: true, telefonoPrincipal: true, email: true, tags: { include: { tag: { select: { nombre: true } } } } } },
      empresa: { select: { nombre: true, ruc: true } },
      cotizacion: { select: { id: true, estado: true } },
      oportunidad: { select: { id: true, etapa: true, stage: { select: { nombre: true } }, usuarioId: true } },
      flujoVentaEtapa: { select: { nombre: true } },
      campos: { include: { campo: { select: { id: true } } } },
    },
  });
  if (!pedido) return null;

  const metadata = (pedido.metadata as Record<string, unknown>) ?? {};
  const metaPago = (metadata.pago as Record<string, unknown>) ?? {};
  const metaFacturacion = (metadata.facturacion as Record<string, unknown>) ?? {};

  const total = Number(pedido.total);
  const montoPagado = Number(metaPago.montoPagado ?? 0);
  const subtotal = Number(pedido.subtotal);
  const descuento = Number(pedido.descuento);

  const hechos: HechosPedido = {
    // General
    "general.etapaActual": pedido.flujoVentaEtapa?.nombre ?? pedido.estado,
    "metadata.tipoPedido": metadata.tipoPedido ?? null,
    "metadata.canalOrigen": metadata.canalOrigen ?? null,
    "general.moneda": pedido.moneda,
    "general.fechaCreacion": pedido.fechaPedido,
    "general.fechaEntrega": pedido.fechaEntrega,
    "general.fechaExpiracion": pedido.fechaExpiracion,
    "general.observaciones": pedido.notas,

    // Montos
    "montos.subtotal": subtotal,
    "montos.descuento": descuento,
    "montos.porcentajeDescuento": subtotal > 0 ? (descuento / subtotal) * 100 : 0,
    "montos.impuesto": Number(pedido.impuesto),
    "montos.costoEnvio": Number(pedido.costoEnvio),
    total,
    "montos.montoPagado": montoPagado,
    "montos.saldoPendiente": total - montoPagado,

    // Pago (metadata.pago.*)
    "metadata.estadoPago": metadata.estadoPago ?? null,
    "metadata.pago.metodo": metaPago.metodo ?? null,
    "metadata.pago.referencia": metaPago.referencia ?? null,
    "metadata.pago.comprobanteUrl": metaPago.comprobanteUrl ?? null,
    "metadata.pago.fecha": metaPago.fecha ?? null,
    "metadata.pago.parcial": metaPago.parcial ?? false,
    "metadata.pago.cantidadPagos": Array.isArray(metaPago.pagos) ? metaPago.pagos.length : 0,

    // Productos
    "productos.tiene": pedido.lineas.length > 0,
    "productos.cantidadLineas": pedido.lineas.length,
    "productos.unidadesTotales": pedido.lineas.reduce((acc, l) => acc + Number(l.cantidad), 0),
    "productos.ids": pedido.lineas.map((l) => l.productoId).filter((id): id is string => !!id),
    "productos.categorias": [...new Set(pedido.lineas.map((l) => l.producto?.categoria).filter((c): c is string => !!c))],
    "productos.skus": pedido.lineas.map((l) => l.producto?.sku).filter((s): s is string => !!s),
    "productos.todosConInventario": pedido.lineas.every(
      (l) => !l.producto?.manejaStock || Number(l.producto.cantidadDisponible) >= Number(l.cantidad)
    ),

    // Contacto y empresa
    "contacto.asignado": !!pedido.contactoId,
    "empresa.asignada": !!pedido.empresaId,
    "contacto.nombre": pedido.contacto ? `${pedido.contacto.nombre} ${pedido.contacto.apellido}`.trim() : (pedido.nombre ?? null),
    "contacto.telefono": pedido.contacto?.telefonoPrincipal ?? pedido.telefono ?? null,
    "contacto.email": pedido.contacto?.email ?? pedido.email ?? null,
    "empresa.razonSocial": pedido.empresa?.nombre ?? pedido.empresaNombre ?? null,
    "contacto.tags": pedido.contacto?.tags.map((t) => t.tag.nombre) ?? [],

    // Facturación (informal, vía metadata + campos sueltos de Pedido)
    "facturacion.documento": pedido.ruc ?? pedido.empresa?.ruc ?? null,
    "facturacion.datosCompletos": !!(pedido.ruc || pedido.empresa?.ruc) && !!(pedido.empresaNombre || pedido.empresa?.nombre),
    "metadata.facturacion.tipoComprobante": metaFacturacion.tipoComprobante ?? null,
    "metadata.facturacion.ordenCompra": metaFacturacion.ordenCompra ?? null,

    // Entrega
    "entrega.metodo": pedido.entrega?.metodoEntrega ?? null,
    "metadata.metodoEnvio": metadata.metodoEnvio ?? null,
    "entrega.estado": pedido.entrega?.estadoEntrega ?? null,
    "entrega.transportista": pedido.entrega?.transportista?.nombre ?? null,
    "entrega.numeroGuia": pedido.entrega?.numeroGuia ?? null,
    "entrega.urlSeguimiento": pedido.entrega?.urlSeguimiento ?? null,
    "entrega.fechaEstimada": pedido.entrega?.fechaEstimada ?? null,
    "entrega.direccion": (metadata.direccionEntrega as string | undefined) ?? null,
    "entrega.observaciones": pedido.entrega?.observaciones ?? null,

    // Relaciones
    "relaciones.tieneCotizacion": !!pedido.cotizacionId,
    "relaciones.estadoCotizacion": pedido.cotizacion?.estado ?? null,
    "relaciones.tieneOportunidad": !!pedido.oportunidadId,
    "relaciones.etapaOportunidad": pedido.oportunidad?.stage?.nombre ?? pedido.oportunidad?.etapa ?? null,
    "relaciones.vendedorAsignado": !!pedido.usuarioId,
  };

  // Campos personalizados — cada valor queda accesible como "custom.<campoId>"
  for (const valor of pedido.campos) {
    hechos[`custom.${valor.campo.id}`] = valor.valor;
  }

  return hechos;
}
