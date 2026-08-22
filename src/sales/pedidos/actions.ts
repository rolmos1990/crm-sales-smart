"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { EventosSistema } from "@/eventos/catalogo";
import { publicadorEventos } from "@/shared/rabbitmq";
import {
  CrearPedidoSchema, ActualizarEstadoPedidoSchema, EditarPedidoSchema, ActualizarEntregaPedidoSchema,
  ActualizarServicioPedidoSchema, ActualizarEntregaDigitalPedidoSchema,
} from "./schema";
import type { LineaPedidoInput, LineaPedidoEditInput } from "./schema";
import { generarNumeroPedido } from "./queries";
import { obtenerFlujoVenta } from "@/sales/flujo-venta/queries";
import { resolverCodigoEfectivo } from "@/shared/lib/codigo-sensible";
import type { ResultadoAccion, Pedido } from "./types";
import type { TipoProducto } from "@/shared/productos/types";

/**
 * Igual que resolverTipoCumplimiento en cotizaciones/actions.ts: primera
 * línea con producto vinculado decide el bloque de cumplimiento; sin
 * producto en ninguna línea, FISICO por defecto. Se resuelve una sola vez
 * al crear/editar y se guarda — no se recalcula en cada lectura.
 */
async function resolverTipoCumplimiento(lineas: (LineaPedidoInput | LineaPedidoEditInput)[]): Promise<TipoProducto> {
  const productoIds = lineas.map(l => l.productoId).filter((id): id is string => !!id);
  if (productoIds.length === 0) return "FISICO";

  const productos = await prisma.producto.findMany({
    where: { id: { in: productoIds } },
    select: { id: true, tipo: true },
  });
  const tipoPorId = new Map(productos.map(p => [p.id, p.tipo]));

  const primeraConProducto = lineas.find(l => l.productoId && tipoPorId.has(l.productoId));
  if (!primeraConProducto?.productoId) return "FISICO";
  return tipoPorId.get(primeraConProducto.productoId) as TipoProducto;
}

export async function crearPedido(datos: unknown): Promise<ResultadoAccion<Pedido>> {
  const validado = CrearPedidoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("pedidos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;
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
    const tipoCumplimiento = await resolverTipoCumplimiento(lineas);

    const pedido = await prisma.pedido.create({
      data: {
        ...resto,
        instanciaId: sesion.instanciaId,
        numero,
        subtotal,
        impuesto: impuestoMonto,
        total,
        tipoCumplimiento,
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

    const usuarioNombre = sesion.usuarioId
      ? await prisma.usuario.findFirst({ where: { id: sesion.usuarioId }, select: { nombre: true } }).then(u => u?.nombre ?? null)
      : null;
    await publicadorEventos.publicar(EventosSistema.PedidoCreado, sesion.instanciaId, {
      instanciaId: sesion.instanciaId,
      pedidoId: pedido.id,
      numero: pedido.numero,
      total,
      usuarioId: sesion.usuarioId,
      usuarioNombre,
    });
    revalidatePath("/sales/pedidos");
    return {
      exito: true,
      datos: { ...pedido, subtotal, total, impuesto: impuestoMonto, descuento: Number(pedido.descuento), costoEnvio: Number(pedido.costoEnvio) } as unknown as Pedido,
    };
  } catch {
    return { exito: false, error: "Error al crear el pedido" };
  }
}

export async function actualizarEstadoPedido(id: string, datos: unknown): Promise<ResultadoAccion> {
  const validado = ActualizarEstadoPedidoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("pedidos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    await prisma.pedido.update({ where: { id }, data: { estado: validado.data.estado } });

    const instanciaId = auth.sesion.instanciaId;
    if (validado.data.estado === "ENTREGADO") {
      await publicadorEventos.publicar(EventosSistema.PedidoEntregado, instanciaId, { instanciaId, pedidoId: id, numero: "" });
    } else {
      await publicadorEventos.publicar(EventosSistema.PedidoActualizado, instanciaId, { instanciaId, pedidoId: id, usuarioId: null, usuarioNombre: null, cambios: [] });
    }

    revalidatePath("/sales/pedidos");
    revalidatePath(`/sales/pedidos/${id}`);
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al actualizar el estado" };
  }
}

export async function eliminarPedido(id: string): Promise<ResultadoAccion> {
  const auth = await requirePermisoAction("pedidos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    await prisma.pedido.delete({ where: { id } });
    revalidatePath("/sales/pedidos");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al eliminar el pedido" };
  }
}

export async function editarPedido(id: string, datos: unknown): Promise<ResultadoAccion> {
  const validado = EditarPedidoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("pedidos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  try {
    const sesion = auth.sesion;

    const usuarioNombre = sesion.usuarioId
      ? await prisma.usuario.findFirst({ where: { id: sesion.usuarioId }, select: { nombre: true } }).then(u => u?.nombre ?? null)
      : null;

    const pedidoActual = await prisma.pedido.findFirst({
      where: { id, instanciaId: sesion.instanciaId },
      include: {
        flujoVentaEtapa: { select: { permiteEditarPedido: true } },
        lineas: { include: { producto: { select: { id: true, nombre: true, manejaStock: true, cantidadDisponible: true } } } },
      },
    });

    if (!pedidoActual) return { exito: false, error: "Pedido no encontrado" };

    if (pedidoActual.flujoVentaEtapa && !pedidoActual.flujoVentaEtapa.permiteEditarPedido) {
      return { exito: false, error: "Este pedido no puede ser modificado en la etapa actual." };
    }

    const {
      lineas: lineasNuevas,
      impuesto,
      notas,
      contactoId,
      empresaId,
      nombre,
      apellido,
      telefono,
      email,
      ruc,
      empresaNombre,
      moneda,
      fechaEntrega,
      fechaExpiracion,
      estado,
    } = validado.data;
    const lineasActuales = pedidoActual.lineas;

    const idsNuevas = new Set(lineasNuevas.filter(l => l.id).map(l => l.id!));
    const lineasEliminadas = lineasActuales.filter(l => !idsNuevas.has(l.id));
    const lineasConId = lineasNuevas.filter(l => l.id);
    const lineasSinId = lineasNuevas.filter(l => !l.id);

    // Stock reconciliation: restaurar stock de eliminadas
    const productosManejanStock = await prisma.producto.findMany({
      where: { id: { in: [...new Set([...lineasActuales.map(l => l.productoId), ...lineasNuevas.map(l => l.productoId)].filter(Boolean) as string[])] }, manejaStock: true },
      select: { id: true, nombre: true, cantidadDisponible: true },
    });
    const stockMap = new Map(productosManejanStock.map(p => [p.id, p]));

    // Verificar stock para líneas nuevas
    for (const linea of lineasSinId) {
      if (!linea.productoId) continue;
      const prod = stockMap.get(linea.productoId);
      if (!prod) continue;
      const disponible = Number(prod.cantidadDisponible);
      if (disponible < linea.cantidad) {
        return { exito: false, error: `Stock insuficiente para "${prod.nombre}". Disponible: ${disponible} — solicitado: ${linea.cantidad}` };
      }
    }

    // Verificar stock para líneas modificadas (diferencia de cantidad)
    for (const linea of lineasConId) {
      if (!linea.productoId) continue;
      const prod = stockMap.get(linea.productoId);
      if (!prod) continue;
      const lineaActual = lineasActuales.find(l => l.id === linea.id);
      const cantidadAnterior = lineaActual ? Number(lineaActual.cantidad) : 0;
      const diferencia = linea.cantidad - cantidadAnterior;
      if (diferencia > 0 && Number(prod.cantidadDisponible) < diferencia) {
        return { exito: false, error: `Stock insuficiente para "${prod.nombre}". Disponible: ${Number(prod.cantidadDisponible)} — adicional requerido: ${diferencia}` };
      }
    }

    const subtotal = lineasNuevas.reduce((acc, l) => acc + l.cantidad * l.precioUnitario * (1 - l.descuento / 100), 0);
    const impuestoMonto = subtotal * (impuesto / 100);
    // El costo de envío no se edita desde acá (vive en "Entrega y
    // seguimiento") — se conserva tal cual para no perderlo al editar líneas.
    const total = subtotal + impuestoMonto + Number(pedidoActual.costoEnvio);
    // Puede cambiar si se reemplaza el producto de alguna línea — mismo
    // criterio que en Cotización (ver resolverTipoCumplimiento arriba).
    const tipoCumplimiento = await resolverTipoCumplimiento(lineasNuevas);

    // Consolidar todos los cambios en una sola entrada de historial
    const valorAnt: Record<string, unknown> = {};
    const valorNvo: Record<string, unknown> = {};

    // Líneas eliminadas
    if (lineasEliminadas.length > 0) {
      valorAnt.lineasEliminadas = lineasEliminadas.map(l => ({
        descripcion: l.descripcion, productoId: l.productoId,
        cantidad: Number(l.cantidad), precioUnitario: Number(l.precioUnitario), descuento: Number(l.descuento),
      }));
    }

    // Líneas agregadas
    if (lineasSinId.length > 0) {
      valorNvo.lineasAgregadas = lineasSinId.map(l => ({
        descripcion: l.descripcion, productoId: l.productoId,
        cantidad: l.cantidad, precioUnitario: l.precioUnitario, descuento: l.descuento,
      }));
    }

    // Líneas modificadas (cantidad o descuento)
    const modifAnt: Record<string, { cantidad?: number; descuento?: number }> = {};
    const modifNvo: Record<string, { cantidad?: number; descuento?: number }> = {};
    for (const linea of lineasConId) {
      const lineaActual = lineasActuales.find(l => l.id === linea.id);
      if (!lineaActual) continue;
      const ant: { cantidad?: number; descuento?: number } = {};
      const nvo: { cantidad?: number; descuento?: number } = {};
      if (Number(lineaActual.cantidad) !== linea.cantidad) { ant.cantidad = Number(lineaActual.cantidad); nvo.cantidad = linea.cantidad; }
      if (Number(lineaActual.descuento) !== linea.descuento) { ant.descuento = Number(lineaActual.descuento); nvo.descuento = linea.descuento; }
      if (Object.keys(ant).length > 0) { modifAnt[linea.id!] = ant; modifNvo[linea.id!] = nvo; }
    }
    if (Object.keys(modifAnt).length > 0) {
      valorAnt.lineasModificadas = modifAnt;
      valorNvo.lineasModificadas = modifNvo;
    }

    // Campos escalares
    const diffCampo = (key: string, anterior: unknown, nuevo: unknown) => {
      if (String(anterior ?? "") !== String(nuevo ?? "")) {
        valorAnt[key] = anterior ?? null;
        valorNvo[key] = nuevo ?? null;
      }
    };
    diffCampo("nombre", pedidoActual.nombre, nombre || null);
    diffCampo("apellido", pedidoActual.apellido, apellido || null);
    diffCampo("telefono", pedidoActual.telefono, telefono || null);
    diffCampo("email", pedidoActual.email, email || null);
    diffCampo("ruc", pedidoActual.ruc, ruc || null);
    diffCampo("empresaNombre", pedidoActual.empresaNombre, empresaNombre || null);
    diffCampo("moneda", pedidoActual.moneda, moneda ?? null);
    diffCampo("fechaEntrega", pedidoActual.fechaEntrega?.toISOString() ?? null, fechaEntrega?.toISOString() ?? null);
    diffCampo("fechaExpiracion", pedidoActual.fechaExpiracion?.toISOString() ?? null, fechaExpiracion?.toISOString() ?? null);
    diffCampo("notas", pedidoActual.notas, notas || null);
    diffCampo("contactoId", pedidoActual.contactoId, contactoId || null);
    diffCampo("empresaId", pedidoActual.empresaId, empresaId || null);
    diffCampo("estado", pedidoActual.estado, estado ?? null);

    const entradasHistorial: { accion: string; valorAnterior?: Record<string, unknown>; valorNuevo?: Record<string, unknown> }[] = [];
    if (Object.keys(valorAnt).length > 0 || Object.keys(valorNvo).length > 0) {
      entradasHistorial.push({ accion: "PEDIDO_EDITADO", valorAnterior: valorAnt, valorNuevo: valorNvo });
    }

    await prisma.$transaction(async (tx) => {
      await tx.pedido.update({
        where: { id },
        data: {
          notas: notas || null,
          contactoId: contactoId || null,
          empresaId: empresaId || null,
          nombre: nombre || null,
          apellido: apellido || null,
          telefono: telefono || null,
          email: email || null,
          ruc: ruc || null,
          empresaNombre: empresaNombre || null,
          moneda: moneda ?? undefined,
          fechaEntrega: fechaEntrega ?? null,
          fechaExpiracion: fechaExpiracion ?? null,
          estado: estado ?? undefined,
          subtotal,
          impuesto: impuestoMonto,
          total,
          tipoCumplimiento,
        },
      });

      if (lineasEliminadas.length > 0) {
        await tx.pedidoLinea.deleteMany({ where: { id: { in: lineasEliminadas.map(l => l.id) } } });
      }

      for (const linea of lineasSinId) {
        await tx.pedidoLinea.create({
          data: {
            pedidoId: id,
            productoId: linea.productoId || null,
            descripcion: linea.descripcion || null,
            cantidad: linea.cantidad,
            precioUnitario: linea.precioUnitario,
            descuento: linea.descuento,
            subtotal: linea.cantidad * linea.precioUnitario * (1 - linea.descuento / 100),
          },
        });
      }

      for (const linea of lineasConId) {
        await tx.pedidoLinea.update({
          where: { id: linea.id },
          data: {
            productoId: linea.productoId || null,
            descripcion: linea.descripcion || null,
            cantidad: linea.cantidad,
            precioUnitario: linea.precioUnitario,
            descuento: linea.descuento,
            subtotal: linea.cantidad * linea.precioUnitario * (1 - linea.descuento / 100),
          },
        });
      }

    });

    // Ajustar stock fuera de la transacción principal
    const ajustesStock: Promise<unknown>[] = [];
    for (const linea of lineasEliminadas) {
      if (linea.productoId && stockMap.has(linea.productoId)) {
        ajustesStock.push(prisma.producto.update({ where: { id: linea.productoId }, data: { cantidadDisponible: { increment: Number(linea.cantidad) } } }));
      }
    }
    for (const linea of lineasSinId) {
      if (linea.productoId && stockMap.has(linea.productoId)) {
        ajustesStock.push(prisma.producto.update({ where: { id: linea.productoId }, data: { cantidadDisponible: { decrement: linea.cantidad } } }));
      }
    }
    for (const linea of lineasConId) {
      if (linea.productoId && stockMap.has(linea.productoId)) {
        const lineaActual = lineasActuales.find(l => l.id === linea.id);
        if (lineaActual && Number(lineaActual.cantidad) !== linea.cantidad) {
          const diferencia = linea.cantidad - Number(lineaActual.cantidad);
          if (diferencia > 0) {
            ajustesStock.push(prisma.producto.update({ where: { id: linea.productoId }, data: { cantidadDisponible: { decrement: diferencia } } }));
          } else if (diferencia < 0) {
            ajustesStock.push(prisma.producto.update({ where: { id: linea.productoId }, data: { cantidadDisponible: { increment: -diferencia } } }));
          }
        }
      }
    }
    if (ajustesStock.length > 0) await Promise.all(ajustesStock);

    await publicadorEventos.publicar(EventosSistema.PedidoActualizado, sesion.instanciaId, {
      instanciaId: sesion.instanciaId,
      pedidoId: id,
      usuarioId: sesion.usuarioId,
      usuarioNombre,
      cambios: entradasHistorial,
    });
    revalidatePath("/sales/pedidos");
    revalidatePath(`/sales/pedidos/${id}`);
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al editar el pedido" };
  }
}

export async function actualizarEntregaPedido(datos: unknown): Promise<ResultadoAccion<undefined>> {
  const validado = ActualizarEntregaPedidoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("configuracion", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const { pedidoId, transportistaId, fechaEstimada, costoEnvio, ...campos } = validado.data;

  const [pedido, usuarioNombre, nuevoTransportista] = await Promise.all([
    prisma.pedido.findFirst({
      where: { id: pedidoId, instanciaId: auth.sesion.instanciaId },
      select: {
        subtotal: true,
        impuesto: true,
        costoEnvio: true,
        flujoVentaEtapa: { select: { permiteEditarEntrega: true } },
        entrega: {
          select: {
            metodoEntrega: true, estadoEntrega: true, numeroGuia: true,
            fechaEstimada: true,
            transportista: { select: { nombre: true } },
          },
        },
      },
    }),
    auth.sesion.usuarioId
      ? prisma.usuario.findFirst({ where: { id: auth.sesion.usuarioId }, select: { nombre: true } }).then(u => u?.nombre ?? null)
      : Promise.resolve(null),
    transportistaId
      ? prisma.transportista.findUnique({ where: { id: transportistaId }, select: { nombre: true } }).then(t => t?.nombre ?? null)
      : Promise.resolve(null),
  ]);

  if (!pedido) return { exito: false, error: "Pedido no encontrado" };
  if (!pedido.flujoVentaEtapa?.permiteEditarEntrega) {
    return { exito: false, error: "La etapa actual del pedido no permite editar la entrega" };
  }

  const esNueva = !pedido.entrega;
  const nuevaFechaEstimada = fechaEstimada ? new Date(fechaEstimada) : null;
  const nuevoCostoEnvio = costoEnvio ?? 0;
  const nuevoTotal = Number(pedido.subtotal) + Number(pedido.impuesto) + nuevoCostoEnvio;

  // `EntregaPedido.fechaEstimada` (seguimiento de envío) y `Pedido.fechaEntrega`
  // (columna "Entrega estimada" del listado, filtro y KPIs) son campos
  // distintos que deben mantenerse en sync — de lo contrario esta sección
  // "guarda" sin que el listado se entere (ver queries.ts:construirWhere y
  // lista-pedidos.tsx, que solo leen Pedido.fechaEntrega). Lo mismo aplica a
  // `Pedido.costoEnvio`/`total`: el costo de envío vive en Pedido (no en
  // EntregaPedido) para que el KPI "Total ventas" lo pueda restar con un
  // simple _sum sin join — ver obtenerPedidosKpis.
  await prisma.$transaction([
    prisma.entregaPedido.upsert({
      where: { pedidoId },
      create: {
        pedidoId,
        ...campos,
        transportistaId: transportistaId ?? null,
        fechaEstimada: nuevaFechaEstimada,
      },
      update: {
        ...campos,
        transportistaId: transportistaId ?? null,
        fechaEstimada: nuevaFechaEstimada,
      },
    }),
    prisma.pedido.update({
      where: { id: pedidoId },
      data: { fechaEntrega: nuevaFechaEstimada, costoEnvio: nuevoCostoEnvio, total: nuevoTotal },
    }),
  ]);

  const valorAnterior = esNueva ? undefined : {
    estadoEntrega:  pedido.entrega!.estadoEntrega,
    metodoEntrega:  pedido.entrega!.metodoEntrega,
    transportista:  pedido.entrega!.transportista?.nombre ?? null,
    numeroGuia:     pedido.entrega!.numeroGuia ?? null,
    fechaEstimada:  pedido.entrega!.fechaEstimada?.toISOString() ?? null,
    costoEnvio:     Number(pedido.costoEnvio),
  };

  const valorNuevo = {
    estadoEntrega:  campos.estadoEntrega,
    metodoEntrega:  campos.metodoEntrega,
    transportista:  nuevoTransportista ?? null,
    numeroGuia:     campos.numeroGuia ?? null,
    fechaEstimada:  fechaEstimada ?? null,
    costoEnvio:     nuevoCostoEnvio,
  };

  await prisma.pedidoHistorial.create({
    data: {
      pedidoId,
      accion: esNueva ? "ENTREGA_REGISTRADA" : "ENTREGA_ACTUALIZADA",
      usuarioId:     auth.sesion.usuarioId ?? null,
      usuarioNombre: usuarioNombre ?? null,
      ...(valorAnterior && { valorAnterior }),
      valorNuevo,
    },
  });

  revalidatePath("/sales/pedidos");
  revalidatePath(`/sales/pedidos/${pedidoId}`);
  return { exito: true, datos: undefined };
}

/**
 * Igual patrón que actualizarEntregaPedido, para pedidos cuyo
 * tipoCumplimiento es SERVICIO (ver ServicioPedido en schema.prisma).
 */
export async function actualizarServicioPedido(datos: unknown): Promise<ResultadoAccion<undefined>> {
  const validado = ActualizarServicioPedidoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("configuracion", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const { pedidoId, fecha, ...campos } = validado.data;

  const [pedido, usuarioNombre] = await Promise.all([
    prisma.pedido.findFirst({
      where: { id: pedidoId, instanciaId: auth.sesion.instanciaId },
      select: {
        flujoVentaEtapa: { select: { permiteEditarEntrega: true } },
        servicio: {
          select: {
            modalidad: true, fecha: true, hora: true, duracion: true, ubicacion: true,
            direccion: true, responsable: true, instrucciones: true, observaciones: true,
          },
        },
      },
    }),
    auth.sesion.usuarioId
      ? prisma.usuario.findFirst({ where: { id: auth.sesion.usuarioId }, select: { nombre: true } }).then(u => u?.nombre ?? null)
      : Promise.resolve(null),
  ]);

  if (!pedido) return { exito: false, error: "Pedido no encontrado" };
  if (!pedido.flujoVentaEtapa?.permiteEditarEntrega) {
    return { exito: false, error: "La etapa actual del pedido no permite editar el servicio" };
  }

  const esNuevo = !pedido.servicio;
  const nuevaFecha = fecha ? new Date(fecha) : null;

  await prisma.servicioPedido.upsert({
    where: { pedidoId },
    create: { pedidoId, ...campos, fecha: nuevaFecha },
    update: { ...campos, fecha: nuevaFecha },
  });

  const valorAnterior = esNuevo ? undefined : {
    modalidad:     pedido.servicio!.modalidad,
    fecha:         pedido.servicio!.fecha?.toISOString() ?? null,
    hora:          pedido.servicio!.hora,
    duracion:      pedido.servicio!.duracion,
    ubicacion:     pedido.servicio!.ubicacion,
    direccion:     pedido.servicio!.direccion,
    responsable:   pedido.servicio!.responsable,
    instrucciones: pedido.servicio!.instrucciones,
    observaciones: pedido.servicio!.observaciones,
  };

  await prisma.pedidoHistorial.create({
    data: {
      pedidoId,
      accion: esNuevo ? "SERVICIO_REGISTRADO" : "SERVICIO_ACTUALIZADO",
      usuarioId:     auth.sesion.usuarioId ?? null,
      usuarioNombre: usuarioNombre ?? null,
      ...(valorAnterior && { valorAnterior }),
      valorNuevo: { ...campos, fecha: fecha ?? null },
    },
  });

  revalidatePath("/sales/pedidos");
  revalidatePath(`/sales/pedidos/${pedidoId}`);
  return { exito: true, datos: undefined };
}

/**
 * Igual patrón que actualizarEntregaPedido, para líneas de pedido cuyo
 * producto es DIGITAL (ver EntregaDigitalPedido en schema.prisma) — por
 * línea, no por pedido completo, porque un pedido puede tener varios
 * productos DIGITAL distintos, cada uno con su propia entrega.
 *
 * `codigo` nunca viaja del cliente en texto plano: el servidor resuelve el
 * valor efectivo vía resolverCodigoEfectivo (CONSERVAR dejA el que ya
 * había, REEMPLAZAR usa codigoNuevo) — ver src/shared/lib/codigo-sensible.ts.
 */
export async function actualizarEntregaDigitalPedido(datos: unknown): Promise<ResultadoAccion<undefined>> {
  const validado = ActualizarEntregaDigitalPedidoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const auth = await requirePermisoAction("configuracion", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const { pedidoLineaId, fechaEntrega, fechaExpiracion, codigoAccion, codigoNuevo, ...campos } = validado.data;

  const [linea, usuarioNombre] = await Promise.all([
    prisma.pedidoLinea.findFirst({
      where: { id: pedidoLineaId, pedido: { instanciaId: auth.sesion.instanciaId } },
      select: {
        pedidoId: true,
        pedido: { select: { flujoVentaEtapa: { select: { permiteEditarEntrega: true } } } },
        entregaDigital: {
          select: {
            metodo: true, email: true, url: true, archivo: true, codigo: true, usuarioAcceso: true,
            fechaEntrega: true, fechaExpiracion: true, instrucciones: true, observaciones: true,
          },
        },
      },
    }),
    auth.sesion.usuarioId
      ? prisma.usuario.findFirst({ where: { id: auth.sesion.usuarioId }, select: { nombre: true } }).then(u => u?.nombre ?? null)
      : Promise.resolve(null),
  ]);

  if (!linea) return { exito: false, error: "Línea de pedido no encontrada" };
  if (!linea.pedido.flujoVentaEtapa?.permiteEditarEntrega) {
    return { exito: false, error: "La etapa actual del pedido no permite editar la entrega digital" };
  }

  const esNueva = !linea.entregaDigital;
  const nuevaFechaEntrega = fechaEntrega ? new Date(fechaEntrega) : null;
  const nuevaFechaExpiracion = fechaExpiracion ? new Date(fechaExpiracion) : null;
  const codigoEfectivo = resolverCodigoEfectivo({ codigoAccion, codigoNuevo }, linea.entregaDigital?.codigo ?? null);

  await prisma.entregaDigitalPedido.upsert({
    where: { pedidoLineaId },
    create: { pedidoLineaId, ...campos, codigo: codigoEfectivo, fechaEntrega: nuevaFechaEntrega, fechaExpiracion: nuevaFechaExpiracion },
    update: { ...campos, codigo: codigoEfectivo, fechaEntrega: nuevaFechaEntrega, fechaExpiracion: nuevaFechaExpiracion },
  });

  // Sin `codigo` real en el historial — no se registran códigos/licencias
  // sensibles en logs/auditoría, solo si había/hay uno configurado.
  const valorAnterior = esNueva ? undefined : {
    metodo:              linea.entregaDigital!.metodo,
    email:               linea.entregaDigital!.email,
    url:                 linea.entregaDigital!.url,
    archivo:             linea.entregaDigital!.archivo,
    codigoConfigurado:   !!linea.entregaDigital!.codigo,
    usuarioAcceso:       linea.entregaDigital!.usuarioAcceso,
    fechaEntrega:        linea.entregaDigital!.fechaEntrega?.toISOString() ?? null,
    fechaExpiracion:     linea.entregaDigital!.fechaExpiracion?.toISOString() ?? null,
    instrucciones:       linea.entregaDigital!.instrucciones,
    observaciones:       linea.entregaDigital!.observaciones,
  };

  await prisma.pedidoHistorial.create({
    data: {
      pedidoId: linea.pedidoId,
      accion: esNueva ? "ENTREGA_DIGITAL_REGISTRADA" : "ENTREGA_DIGITAL_ACTUALIZADA",
      usuarioId:     auth.sesion.usuarioId ?? null,
      usuarioNombre: usuarioNombre ?? null,
      ...(valorAnterior && { valorAnterior }),
      valorNuevo: { ...campos, codigoConfigurado: !!codigoEfectivo, fechaEntrega: fechaEntrega ?? null, fechaExpiracion: fechaExpiracion ?? null },
    },
  });

  revalidatePath("/sales/pedidos");
  revalidatePath(`/sales/pedidos/${linea.pedidoId}`);
  return { exito: true, datos: undefined };
}
