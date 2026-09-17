"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { publicadorEventos } from "@/shared/rabbitmq";
import { EventosSistema } from "@/eventos/catalogo";
import {
  AvanceLineaSchema,
  EditarColumnaSchema,
  EstadoPreparacionSchema,
  EtapasEntradaSchema,
  NotaPreparacionSchema,
  OrdenEstadosSchema,
  PreferenciasTableroSchema,
} from "./schema";
import { asegurarFlujoPreparacion } from "./servicios/asegurar-flujo-preparacion";
import { moverPreparacion } from "./servicios/mover-preparacion";
import { pedidoCompleto, validarCantidadPreparada } from "./utils/avance";
import type { ResultadoAccion } from "./types";

async function requireModificar() {
  const sesion = await requireSesion();
  const acceso = verificarAcceso(sesion, "preparacion", "modificar");
  return { sesion, acceso };
}

function revalidarTablero() {
  revalidatePath("/sales/preparacion");
}

function revalidarPedido(pedidoId: string) {
  revalidatePath("/sales/pedidos");
  revalidatePath(`/sales/pedidos/${pedidoId}`);
}

// ── Operación del tablero ──────────────────────────────────────────

/**
 * Mueve un pedido de columna. `estadoEsperadoId` es el estado que el cliente
 * tenía en pantalla: si ya no coincide, otro usuario ganó la carrera y no se
 * aplica nada (FR-017).
 */
export async function moverPreparacionAction(
  pedidoId: string,
  estadoDestinoId: string,
  estadoEsperadoId: string,
): Promise<ResultadoAccion<void>> {
  const { sesion, acceso } = await requireModificar();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };
  if (!pedidoId || !estadoDestinoId || !estadoEsperadoId) {
    return { exito: false, error: "Datos incompletos para mover el pedido" };
  }

  // El pedido tiene que ser de la instancia de la sesión — nunca se confía en
  // el id que llega del cliente.
  const pedido = await prisma.pedido.findFirst({
    where: { id: pedidoId, instanciaId: sesion.instanciaId },
    select: { id: true },
  });
  if (!pedido) return { exito: false, error: "Pedido no encontrado" };

  const resultado = await moverPreparacion({
    pedidoId,
    estadoDestinoId,
    estadoEsperadoId,
    instanciaId: sesion.instanciaId,
    usuarioId: sesion.usuarioId ?? null,
  });

  if (!resultado.ok) {
    if (resultado.motivo === "CONFLICTO") {
      return { exito: false, error: "Otro usuario movió este pedido. Actualizamos la pantalla con el estado real." };
    }
    if (resultado.motivo === "ESTADO_INVALIDO") {
      return { exito: false, error: "El estado de destino no existe o está desactivado" };
    }
    return { exito: false, error: "No encontramos la preparación de este pedido" };
  }

  revalidarTablero();
  revalidarPedido(pedidoId);
  return { exito: true, datos: undefined };
}

/** Registra cuántas unidades de una línea están preparadas (admite parciales). */
export async function registrarAvanceLineaAction(
  pedidoLineaId: string,
  cantidadPreparada: number,
): Promise<ResultadoAccion<{ avanceCompleto: boolean }>> {
  const { sesion, acceso } = await requireModificar();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const validado = AvanceLineaSchema.safeParse({ pedidoLineaId, cantidadPreparada });
  if (!validado.success) {
    return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const linea = await prisma.pedidoLinea.findFirst({
    where: { id: pedidoLineaId, pedido: { instanciaId: sesion.instanciaId } },
    select: {
      id: true,
      cantidad: true,
      productoId: true,
      pedido: { select: { id: true, numero: true } },
    },
  });
  if (!linea) return { exito: false, error: "Línea de pedido no encontrada" };

  const cantidadPedida = Number(linea.cantidad);
  const validacion = validarCantidadPreparada(validado.data.cantidadPreparada, cantidadPedida);
  if (!validacion.valido) return { exito: false, error: validacion.error };

  const nueva = validado.data.cantidadPreparada;
  const completa = nueva >= cantidadPedida && cantidadPedida > 0;

  await prisma.pedidoLinea.update({
    where: { id: linea.id },
    data: {
      cantidadPreparada: nueva,
      // Volver a cero borra el sello: la línea queda como si no se hubiera
      // tocado, que es lo que el usuario espera al deshacer.
      preparadaEn: nueva > 0 ? new Date() : null,
      preparadaPorId: nueva > 0 ? (sesion.usuarioId ?? null) : null,
    },
  });

  const lineas = await prisma.pedidoLinea.findMany({
    where: { pedidoId: linea.pedido.id },
    select: { cantidad: true, cantidadPreparada: true },
  });
  const avanceCompleto = pedidoCompleto(
    lineas.map((l) => ({ cantidad: Number(l.cantidad), cantidadPreparada: Number(l.cantidadPreparada) })),
  );

  // Solo la línea completa emite evento: un mensaje por clic parcial sería ruido.
  if (completa) {
    await publicadorEventos.publicar(EventosSistema.LineaPedidoPreparada, sesion.instanciaId, {
      instanciaId: sesion.instanciaId,
      pedidoId: linea.pedido.id,
      numero: linea.pedido.numero,
      pedidoLineaId: linea.id,
      productoId: linea.productoId,
      cantidad: cantidadPedida,
      preparadaPorId: sesion.usuarioId ?? null,
    });
  }

  // A propósito NO se revalida el tablero acá. Marcar un ítem es la acción más
  // repetida del módulo (decenas por sesión) y revalidar dispararía la consulta
  // completa del tablero en cada clic. La tarjeta ya refleja el cambio de forma
  // optimista en el cliente, y el resumen por producto se actualiza al cambiar
  // de rango, buscar, mover una tarjeta o recargar.
  revalidatePath(`/sales/pedidos/${linea.pedido.id}`);
  return { exito: true, datos: { avanceCompleto } };
}

export async function registrarNotaPreparacionAction(
  pedidoId: string,
  notas: string,
): Promise<ResultadoAccion<void>> {
  const { sesion, acceso } = await requireModificar();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const validado = NotaPreparacionSchema.safeParse({ pedidoId, notas });
  if (!validado.success) return { exito: false, error: "Nota inválida" };

  const { count } = await prisma.preparacionPedido.updateMany({
    where: { pedidoId, pedido: { instanciaId: sesion.instanciaId } },
    data: { notas: validado.data.notas || null },
  });
  if (count === 0) return { exito: false, error: "No encontramos la preparación de este pedido" };

  revalidarTablero();
  return { exito: true, datos: undefined };
}

// ── Configuración de estados ───────────────────────────────────────

// Mismo patrón que src/crm/datos/actions.ts:101 para tipar el cliente de
// transacción sin importar tipos internos del cliente generado.
type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Un solo estado inicial y un solo estado final por flujo: al marcar uno, el
 *  anterior se desmarca en la misma transacción. */
async function normalizarMarcasUnicas(
  tx: PrismaTransactionClient,
  flujoId: string,
  estadoId: string,
  datos: { esInicial: boolean; esFinal: boolean },
) {
  if (datos.esInicial) {
    await tx.estadoPreparacion.updateMany({
      where: { flujoPreparacionId: flujoId, id: { not: estadoId }, esInicial: true },
      data: { esInicial: false },
    });
  }
  if (datos.esFinal) {
    await tx.estadoPreparacion.updateMany({
      where: { flujoPreparacionId: flujoId, id: { not: estadoId }, esFinal: true },
      data: { esFinal: false },
    });
  }
}

export async function crearEstadoPreparacionAction(datos: unknown): Promise<ResultadoAccion<{ id: string }>> {
  const { sesion, acceso } = await requireModificar();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const validado = EstadoPreparacionSchema.safeParse(datos);
  if (!validado.success) {
    return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const flujo = await asegurarFlujoPreparacion(sesion.instanciaId);
  const nombre = validado.data.nombre.trim();

  const duplicado = await prisma.estadoPreparacion.findFirst({
    where: { flujoPreparacionId: flujo.id, nombre: { equals: nombre, mode: "insensitive" }, activo: true },
    select: { id: true },
  });
  if (duplicado) return { exito: false, error: `Ya existe un estado llamado "${nombre}"` };

  const ultimo = await prisma.estadoPreparacion.findFirst({
    where: { flujoPreparacionId: flujo.id },
    orderBy: { orden: "desc" },
    select: { orden: true },
  });

  const creado = await prisma.$transaction(async (tx) => {
    const estado = await tx.estadoPreparacion.create({
      data: {
        flujoPreparacionId: flujo.id,
        nombre,
        color: validado.data.color || null,
        orden: (ultimo?.orden ?? -1) + 1,
        esInicial: validado.data.esInicial,
        marcaInicio: validado.data.marcaInicio,
        esFinal: validado.data.esFinal,
      },
    });
    await normalizarMarcasUnicas(tx, flujo.id, estado.id, validado.data);
    return estado;
  });

  revalidarTablero();
  return { exito: true, datos: { id: creado.id } };
}

/** Edita nombre y color de una columna, sin tocar sus marcas. */
export async function editarColumnaPreparacionAction(
  estadoId: string,
  datos: unknown,
): Promise<ResultadoAccion<void>> {
  const { sesion, acceso } = await requireModificar();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const validado = EditarColumnaSchema.safeParse(datos);
  if (!validado.success) {
    return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const estado = await prisma.estadoPreparacion.findFirst({
    where: { id: estadoId, flujoPreparacion: { instanciaId: sesion.instanciaId } },
    select: { id: true, flujoPreparacionId: true },
  });
  if (!estado) return { exito: false, error: "Estado no encontrado" };

  const nombre = validado.data.nombre.trim();
  const duplicado = await prisma.estadoPreparacion.findFirst({
    where: {
      flujoPreparacionId: estado.flujoPreparacionId,
      id: { not: estadoId },
      nombre: { equals: nombre, mode: "insensitive" },
      activo: true,
    },
    select: { id: true },
  });
  if (duplicado) return { exito: false, error: `Ya existe una columna llamada "${nombre}"` };

  await prisma.estadoPreparacion.update({
    where: { id: estadoId },
    data: { nombre, color: validado.data.color || null },
  });

  revalidarTablero();
  return { exito: true, datos: undefined };
}

export async function actualizarEstadoPreparacionAction(
  estadoId: string,
  datos: unknown,
): Promise<ResultadoAccion<void>> {
  const { sesion, acceso } = await requireModificar();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const validado = EstadoPreparacionSchema.safeParse(datos);
  if (!validado.success) {
    return { exito: false, error: validado.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const estado = await prisma.estadoPreparacion.findFirst({
    where: { id: estadoId, flujoPreparacion: { instanciaId: sesion.instanciaId } },
    select: { id: true, flujoPreparacionId: true },
  });
  if (!estado) return { exito: false, error: "Estado no encontrado" };

  const nombre = validado.data.nombre.trim();
  const duplicado = await prisma.estadoPreparacion.findFirst({
    where: {
      flujoPreparacionId: estado.flujoPreparacionId,
      id: { not: estadoId },
      nombre: { equals: nombre, mode: "insensitive" },
      activo: true,
    },
    select: { id: true },
  });
  if (duplicado) return { exito: false, error: `Ya existe un estado llamado "${nombre}"` };

  await prisma.$transaction(async (tx) => {
    await tx.estadoPreparacion.update({
      where: { id: estadoId },
      data: {
        nombre,
        color: validado.data.color || null,
        esInicial: validado.data.esInicial,
        marcaInicio: validado.data.marcaInicio,
        esFinal: validado.data.esFinal,
      },
    });
    await normalizarMarcasUnicas(tx, estado.flujoPreparacionId, estadoId, validado.data);
  });

  revalidarTablero();
  return { exito: true, datos: undefined };
}

/**
 * Elimina una columna del tablero.
 *
 * El estado inicial y el final NO se pueden borrar: son los dos extremos de la
 * máquina de estados (dónde entran los pedidos y dónde se sella la
 * finalización), así que sin ellos el tablero no tiene a dónde mover nada.
 *
 * Cualquier otra columna sí se borra, y los pedidos que estén ahí se mueven a
 * la columna inicial dejando traza en el historial. El historial de la columna
 * borrada sobrevive: `estadoId` es nullable con SetNull y los nombres están
 * guardados como snapshot.
 */
export async function eliminarEstadoPreparacionAction(
  estadoId: string,
): Promise<ResultadoAccion<{ pedidosMovidos: number; estadoDestinoNombre: string | null }>> {
  const { sesion, acceso } = await requireModificar();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const estado = await prisma.estadoPreparacion.findFirst({
    where: { id: estadoId, flujoPreparacion: { instanciaId: sesion.instanciaId } },
    select: {
      id: true,
      nombre: true,
      esInicial: true,
      esFinal: true,
      flujoPreparacionId: true,
      _count: { select: { preparaciones: true } },
    },
  });
  if (!estado) return { exito: false, error: "Estado no encontrado" };

  if (estado.esInicial) {
    return {
      exito: false,
      error: "No se puede eliminar el estado inicial: es donde entran los pedidos al tablero.",
    };
  }
  if (estado.esFinal) {
    return {
      exito: false,
      error: "No se puede eliminar el estado final: es el que sella la finalización de la preparación.",
    };
  }

  const inicial = await prisma.estadoPreparacion.findFirst({
    where: { flujoPreparacionId: estado.flujoPreparacionId, esInicial: true, activo: true },
    select: { id: true, nombre: true },
  });
  if (!inicial && estado._count.preparaciones > 0) {
    return {
      exito: false,
      error: "No hay estado inicial donde mover los pedidos de esta columna. Marcá uno como inicial primero.",
    };
  }

  const usuarioNombre = sesion.usuarioId
    ? await prisma.usuario
        .findFirst({ where: { id: sesion.usuarioId }, select: { nombre: true } })
        .then((u) => u?.nombre ?? null)
    : null;

  const pedidosMovidos = await prisma.$transaction(async (tx) => {
    let movidos = 0;

    if (inicial) {
      const afectadas = await tx.preparacionPedido.findMany({ where: { estadoId }, select: { id: true } });
      if (afectadas.length > 0) {
        await tx.preparacionPedido.updateMany({ where: { estadoId }, data: { estadoId: inicial.id } });
        await tx.preparacionHistorial.createMany({
          data: afectadas.map((p) => ({
            preparacionId: p.id,
            estadoId: inicial.id,
            estadoNombre: inicial.nombre,
            estadoAnteriorNombre: estado.nombre,
            tipo: "AUTOMATICO" as const,
            usuarioId: sesion.usuarioId ?? null,
            usuarioNombre,
          })),
        });
        movidos = afectadas.length;
      }
    }

    await tx.estadoPreparacion.delete({ where: { id: estadoId } });
    return movidos;
  });

  revalidarTablero();
  return { exito: true, datos: { pedidosMovidos, estadoDestinoNombre: inicial?.nombre ?? null } };
}

/** Desactivar exige destino: los pedidos se migran en la misma transacción y
 *  cada migración queda en el historial como AUTOMATICO (FR-004). */
export async function desactivarEstadoPreparacionAction(
  estadoId: string,
  estadoDestinoId: string,
): Promise<ResultadoAccion<{ pedidosMigrados: number }>> {
  const { sesion, acceso } = await requireModificar();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };
  if (estadoId === estadoDestinoId) {
    return { exito: false, error: "El estado destino debe ser distinto del que se desactiva" };
  }

  const [estado, destino] = await Promise.all([
    prisma.estadoPreparacion.findFirst({
      where: { id: estadoId, flujoPreparacion: { instanciaId: sesion.instanciaId } },
      select: { id: true, nombre: true, flujoPreparacionId: true, esInicial: true, esFinal: true },
    }),
    prisma.estadoPreparacion.findFirst({
      where: { id: estadoDestinoId, activo: true, flujoPreparacion: { instanciaId: sesion.instanciaId } },
      select: { id: true, nombre: true, flujoPreparacionId: true },
    }),
  ]);
  if (!estado) return { exito: false, error: "Estado no encontrado" };
  if (!destino || destino.flujoPreparacionId !== estado.flujoPreparacionId) {
    return { exito: false, error: "El estado destino no es válido" };
  }

  const activos = await prisma.estadoPreparacion.count({
    where: { flujoPreparacionId: estado.flujoPreparacionId, activo: true },
  });
  if (activos <= 1) return { exito: false, error: "El tablero necesita al menos un estado activo" };
  if (estado.esInicial || estado.esFinal) {
    return {
      exito: false,
      error: "Antes de desactivarlo, marcá otro estado como inicial o final según corresponda",
    };
  }

  const usuarioNombre = sesion.usuarioId
    ? await prisma.usuario
        .findFirst({ where: { id: sesion.usuarioId }, select: { nombre: true } })
        .then((u) => u?.nombre ?? null)
    : null;

  const pedidosMigrados = await prisma.$transaction(async (tx) => {
    const afectadas = await tx.preparacionPedido.findMany({
      where: { estadoId },
      select: { id: true },
    });

    if (afectadas.length > 0) {
      await tx.preparacionPedido.updateMany({ where: { estadoId }, data: { estadoId: destino.id } });
      await tx.preparacionHistorial.createMany({
        data: afectadas.map((p) => ({
          preparacionId: p.id,
          estadoId: destino.id,
          estadoNombre: destino.nombre,
          estadoAnteriorNombre: estado.nombre,
          tipo: "AUTOMATICO" as const,
          usuarioId: sesion.usuarioId ?? null,
          usuarioNombre,
        })),
      });
    }

    await tx.estadoPreparacion.update({ where: { id: estadoId }, data: { activo: false } });
    return afectadas.length;
  });

  revalidarTablero();
  return { exito: true, datos: { pedidosMigrados } };
}

export async function reordenarEstadosPreparacionAction(
  orden: Array<{ id: string; orden: number }>,
): Promise<ResultadoAccion<void>> {
  const { sesion, acceso } = await requireModificar();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const validado = OrdenEstadosSchema.safeParse({ orden });
  if (!validado.success) return { exito: false, error: "Orden inválido" };

  const ids = validado.data.orden.map((o) => o.id);
  const propios = await prisma.estadoPreparacion.count({
    where: { id: { in: ids }, flujoPreparacion: { instanciaId: sesion.instanciaId } },
  });
  if (propios !== ids.length) return { exito: false, error: "Alguno de los estados no pertenece a tu tablero" };

  await prisma.$transaction(
    validado.data.orden.map((o) =>
      prisma.estadoPreparacion.update({ where: { id: o.id }, data: { orden: o.orden } }),
    ),
  );

  revalidarTablero();
  return { exito: true, datos: undefined };
}

// ── Configuración de la vista ──────────────────────────────────────

/** Qué etapas del flujo de venta hacen entrar pedidos al tablero. Sin ninguna,
 *  el default es "todo lo que no está cerrado ni cancelado". */
export async function configurarEtapasEntradaAction(etapaIds: string[]): Promise<ResultadoAccion<void>> {
  const { sesion, acceso } = await requireModificar();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const validado = EtapasEntradaSchema.safeParse({ etapaIds });
  if (!validado.success) return { exito: false, error: "Etapas inválidas" };

  const flujo = await asegurarFlujoPreparacion(sesion.instanciaId);
  const ids = [...new Set(validado.data.etapaIds)];

  if (ids.length > 0) {
    const propias = await prisma.flujoVentaEtapa.count({
      where: { id: { in: ids }, flujoVenta: { instanciaId: sesion.instanciaId } },
    });
    if (propias !== ids.length) {
      return { exito: false, error: "Alguna de las etapas no pertenece a tu flujo de venta" };
    }
  }

  await prisma.$transaction([
    prisma.flujoPreparacionEntrada.deleteMany({ where: { flujoPreparacionId: flujo.id } }),
    ...(ids.length > 0
      ? [prisma.flujoPreparacionEntrada.createMany({
          data: ids.map((flujoVentaEtapaId) => ({ flujoPreparacionId: flujo.id, flujoVentaEtapaId })),
        })]
      : []),
  ]);

  revalidarTablero();
  return { exito: true, datos: undefined };
}

export async function actualizarPreferenciasTableroAction(datos: unknown): Promise<ResultadoAccion<void>> {
  const { sesion, acceso } = await requireModificar();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const validado = PreferenciasTableroSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Preferencias inválidas" };

  const flujo = await asegurarFlujoPreparacion(sesion.instanciaId);
  await prisma.flujoPreparacion.update({
    where: { id: flujo.id },
    data: {
      agrupacionDefecto: validado.data.agrupacionDefecto,
      rangoDefecto: validado.data.rangoDefecto,
    },
  });

  revalidarTablero();
  return { exito: true, datos: undefined };
}
