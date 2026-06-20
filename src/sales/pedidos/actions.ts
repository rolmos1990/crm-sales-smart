"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { EventosSistema } from "@/eventos/catalogo";
import { publicadorEventos } from "@/shared/rabbitmq";
import { CrearPedidoSchema, ActualizarEstadoPedidoSchema, EditarPedidoSchema, ActualizarEntregaPedidoSchema } from "./schema";
import { generarNumeroPedido } from "./queries";
import { obtenerFlujoVenta } from "@/sales/flujo-venta/queries";
import type { ResultadoAccion, Pedido } from "./types";

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
    return { exito: true, datos: { ...pedido, subtotal, total, impuesto: impuestoMonto } as unknown as Pedido };
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
    const total = subtotal + impuestoMonto;

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
          estado: estado ?? undefined,
          subtotal,
          impuesto: impuestoMonto,
          total,
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

  const { pedidoId, transportistaId, fechaEstimada, ...campos } = validado.data;

  const [pedido, usuarioNombre, nuevoTransportista] = await Promise.all([
    prisma.pedido.findFirst({
      where: { id: pedidoId, instanciaId: auth.sesion.instanciaId },
      select: {
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

  await prisma.entregaPedido.upsert({
    where: { pedidoId },
    create: {
      pedidoId,
      ...campos,
      transportistaId: transportistaId ?? null,
      fechaEstimada: fechaEstimada ? new Date(fechaEstimada) : null,
    },
    update: {
      ...campos,
      transportistaId: transportistaId ?? null,
      fechaEstimada: fechaEstimada ? new Date(fechaEstimada) : null,
    },
  });

  const valorAnterior = esNueva ? undefined : {
    estadoEntrega:  pedido.entrega!.estadoEntrega,
    metodoEntrega:  pedido.entrega!.metodoEntrega,
    transportista:  pedido.entrega!.transportista?.nombre ?? null,
    numeroGuia:     pedido.entrega!.numeroGuia ?? null,
    fechaEstimada:  pedido.entrega!.fechaEstimada?.toISOString() ?? null,
  };

  const valorNuevo = {
    estadoEntrega:  campos.estadoEntrega,
    metodoEntrega:  campos.metodoEntrega,
    transportista:  nuevoTransportista ?? null,
    numeroGuia:     campos.numeroGuia ?? null,
    fechaEstimada:  fechaEstimada ?? null,
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

  revalidatePath(`/sales/pedidos/${pedidoId}`);
  return { exito: true, datos: undefined };
}
