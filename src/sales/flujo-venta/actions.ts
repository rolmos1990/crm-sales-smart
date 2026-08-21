"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { EtapaSchema, ReglaSchema, ArbolCondicionesSchema, FlujoVentaSchema } from "./schema";
import { moverPedidoAEtapa, validarTransicion } from "./motor";
import { obtenerCatalogoCampos } from "./reglas/catalogo-campos";
import { resolverHechosPedido } from "./reglas/resolver-hechos";
import { evaluarArbol } from "./reglas/evaluador";
import type { ConditionTree, ResultadoEvaluacion } from "./reglas/tipos";
import { obtenerConfiguracionEmpresa } from "@/configuracion/empresa/queries";
import { obtenerPedidos } from "@/sales/pedidos/queries";
import type { OpcionCombobox } from "@/shared/ui/combobox";

type Resultado<T = void> = { exito: true; datos: T } | { exito: false; error: string };

async function requireAdminFlujo() {
  const sesion = await requireSesion();
  const acceso = verificarAcceso(sesion, "flujo-venta", "modificar");
  return { sesion, acceso };
}

async function requireLectorFlujo() {
  const sesion = await requireSesion();
  const acceso = verificarAcceso(sesion, "flujo-venta", "ver");
  return { sesion, acceso };
}

// ── Flujo ─────────────────────────────────────────────────────────

export async function crearOActualizarFlujoVenta(datos: unknown): Promise<Resultado<{ id: string }>> {
  const validado = FlujoVentaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const { sesion, acceso } = await requireAdminFlujo();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const existente = await prisma.flujoVenta.findFirst({ where: { instanciaId: sesion.instanciaId } });

  if (existente) {
    await prisma.flujoVenta.update({ where: { id: existente.id }, data: validado.data });
    revalidatePath("/sales/flujo-venta");
    return { exito: true, datos: { id: existente.id } };
  }

  const flujo = await prisma.flujoVenta.create({
    data: {
      ...validado.data,
      instanciaId: sesion.instanciaId,
      esDefault: true,
    },
  });
  revalidatePath("/sales/flujo-venta");
  return { exito: true, datos: { id: flujo.id } };
}

// ── Etapas ────────────────────────────────────────────────────────

export async function crearEtapa(flujoVentaId: string, datos: unknown): Promise<Resultado<{ id: string }>> {
  const validado = EtapaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const { sesion, acceso } = await requireAdminFlujo();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const flujo = await prisma.flujoVenta.findFirst({ where: { id: flujoVentaId, instanciaId: sesion.instanciaId } });
  if (!flujo) return { exito: false, error: "Flujo no encontrado" };

  try {
    const esInicial = validado.data.esInicial ?? false;
    const esFinal = validado.data.esFinal ?? false;
    const esCancelacion = validado.data.esCancelacion ?? false;
    const permiteEditarPedido = (esFinal || esCancelacion)
      ? false
      : esInicial
        ? true
        : (validado.data.permiteEditarPedido ?? true);

    const permiteEditarEntrega = (esFinal || esCancelacion)
      ? false
      : (validado.data.permiteEditarEntrega ?? false);

    const etapa = await prisma.flujoVentaEtapa.create({
      data: {
        ...validado.data,
        flujoVentaId,
        esInicial,
        esFinal,
        esCancelacion,
        permiteEditarPedido,
        permiteEditarEntrega,
        activo: validado.data.activo ?? true,
        parentId: validado.data.parentId ?? null,
      },
    });
    revalidatePath("/sales/flujo-venta");
    return { exito: true, datos: { id: etapa.id } };
  } catch (e) {
    console.error("[crearEtapa] error:", e);
    return { exito: false, error: "Error al crear la etapa" };
  }
}

export async function actualizarEtapa(etapaId: string, datos: unknown): Promise<Resultado> {
  const validado = EtapaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const { sesion, acceso } = await requireAdminFlujo();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const etapa = await prisma.flujoVentaEtapa.findFirst({
    where: { id: etapaId, flujoVenta: { instanciaId: sesion.instanciaId } },
  });
  if (!etapa) return { exito: false, error: "Etapa no encontrada" };

  try {
    const esInicial = validado.data.esInicial ?? etapa.esInicial;
    const esFinal = validado.data.esFinal ?? etapa.esFinal;
    const esCancelacion = validado.data.esCancelacion ?? etapa.esCancelacion;
    const permiteEditarPedido = (esFinal || esCancelacion)
      ? false
      : esInicial
        ? true
        : (validado.data.permiteEditarPedido ?? etapa.permiteEditarPedido);

    const permiteEditarEntrega = (esFinal || esCancelacion)
      ? false
      : (validado.data.permiteEditarEntrega ?? etapa.permiteEditarEntrega);

    await prisma.flujoVentaEtapa.update({
      where: { id: etapaId },
      data: { ...validado.data, permiteEditarPedido, permiteEditarEntrega },
    });
    revalidatePath("/sales/flujo-venta");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al actualizar la etapa" };
  }
}

export async function eliminarEtapa(etapaId: string): Promise<Resultado> {
  const { sesion, acceso } = await requireAdminFlujo();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const etapa = await prisma.flujoVentaEtapa.findFirst({
    where: { id: etapaId, flujoVenta: { instanciaId: sesion.instanciaId } },
    include: { _count: { select: { pedidos: true } } },
  });
  if (!etapa) return { exito: false, error: "Etapa no encontrada" };
  if (etapa._count.pedidos > 0) return { exito: false, error: `No se puede eliminar: ${etapa._count.pedidos} pedido(s) en esta etapa` };

  await prisma.flujoVentaEtapa.delete({ where: { id: etapaId } });
  revalidatePath("/sales/flujo-venta");
  return { exito: true, datos: undefined };
}

export async function reordenarEtapas(
  items: { id: string; parentId: string | null; orden: number }[]
): Promise<Resultado> {
  const { acceso } = await requireAdminFlujo();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  await prisma.$transaction(
    items.map(({ id, parentId, orden }) =>
      prisma.flujoVentaEtapa.update({ where: { id }, data: { parentId, orden } })
    )
  );
  revalidatePath("/sales/flujo-venta");
  return { exito: true, datos: undefined };
}

// ── Reglas de validación ─────────────────────────────────────────

async function registrarAuditoriaRegla(
  tipo: string,
  reglaId: string,
  instanciaId: string | null,
  usuarioId: string | null,
  payload: Record<string, unknown>
) {
  if (!instanciaId) return;
  await prisma.eventoLog.create({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { tipo, payload: payload as any, entidadTipo: "FlujoVentaRegla", entidadId: reglaId, instanciaId, usuarioId },
  });
}

export async function crearRegla(datos: unknown): Promise<Resultado<{ id: string }>> {
  const validado = ReglaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const { sesion, acceso } = await requireAdminFlujo();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const { nombre, descripcion, activo, estado, prioridad, etapaDestinoId, arbolCondiciones, mensajeFallo, mostrarPendientes } = validado.data;

  try {
    const regla = await prisma.flujoVentaRegla.create({
      data: {
        nombre,
        descripcion: descripcion || null,
        activo: activo ?? true,
        estado: estado ?? "PUBLICADA",
        prioridad,
        etapaDestinoId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        arbolCondiciones: arbolCondiciones as any,
        mensajeFallo: mensajeFallo || null,
        mostrarPendientes: mostrarPendientes ?? true,
        creadoPorId: sesion.usuarioId,
        actualizadoPorId: sesion.usuarioId,
      },
    });
    await registrarAuditoriaRegla("REGLA_VALIDACION_CREADA", regla.id, sesion.instanciaId, sesion.usuarioId, { nombre, etapaDestinoId, estado: regla.estado });
    revalidatePath("/sales/flujo-venta");
    return { exito: true, datos: { id: regla.id } };
  } catch {
    return { exito: false, error: "Error al crear la regla" };
  }
}

export async function actualizarRegla(reglaId: string, datos: unknown): Promise<Resultado> {
  const validado = ReglaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: validado.error.issues[0]?.message ?? "Error de validación" };

  const { sesion, acceso } = await requireAdminFlujo();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const { nombre, descripcion, activo, estado, prioridad, etapaDestinoId, arbolCondiciones, mensajeFallo, mostrarPendientes } = validado.data;

  try {
    const anterior = await prisma.flujoVentaRegla.findUnique({ where: { id: reglaId }, select: { estado: true } });
    await prisma.flujoVentaRegla.update({
      where: { id: reglaId },
      data: {
        nombre,
        descripcion: descripcion || null,
        activo: activo ?? true,
        estado: estado ?? "PUBLICADA",
        prioridad,
        etapaDestinoId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        arbolCondiciones: arbolCondiciones as any,
        mensajeFallo: mensajeFallo || null,
        mostrarPendientes: mostrarPendientes ?? true,
        actualizadoPorId: sesion.usuarioId,
        version: { increment: 1 },
      },
    });
    const tipoEvento = anterior?.estado === "BORRADOR" && estado === "PUBLICADA" ? "REGLA_VALIDACION_PUBLICADA" : "REGLA_VALIDACION_ACTUALIZADA";
    await registrarAuditoriaRegla(tipoEvento, reglaId, sesion.instanciaId, sesion.usuarioId, { nombre, etapaDestinoId, estado: estado ?? "PUBLICADA" });
    revalidatePath("/sales/flujo-venta");
    return { exito: true, datos: undefined };
  } catch {
    return { exito: false, error: "Error al actualizar la regla" };
  }
}

export async function duplicarRegla(reglaId: string): Promise<Resultado<{ id: string }>> {
  const { sesion, acceso } = await requireAdminFlujo();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const original = await prisma.flujoVentaRegla.findUnique({ where: { id: reglaId } });
  if (!original) return { exito: false, error: "Regla no encontrada" };

  try {
    const copia = await prisma.flujoVentaRegla.create({
      data: {
        nombre: `${original.nombre} (copia)`,
        descripcion: original.descripcion,
        activo: original.activo,
        // Una copia arranca en Borrador — evita que un duplicado accidental
        // quede exigiendo lo mismo dos veces sin que nadie lo haya revisado.
        estado: "BORRADOR",
        prioridad: original.prioridad,
        etapaDestinoId: original.etapaDestinoId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        arbolCondiciones: original.arbolCondiciones as any,
        mensajeFallo: original.mensajeFallo,
        mostrarPendientes: original.mostrarPendientes,
        creadoPorId: sesion.usuarioId,
        actualizadoPorId: sesion.usuarioId,
      },
    });
    await registrarAuditoriaRegla("REGLA_VALIDACION_DUPLICADA", copia.id, sesion.instanciaId, sesion.usuarioId, { reglaOriginalId: reglaId });
    revalidatePath("/sales/flujo-venta");
    return { exito: true, datos: { id: copia.id } };
  } catch {
    return { exito: false, error: "Error al duplicar la regla" };
  }
}

export async function eliminarRegla(reglaId: string, forzar = false): Promise<Resultado> {
  const { sesion, acceso } = await requireAdminFlujo();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  const regla = await prisma.flujoVentaRegla.findUnique({ where: { id: reglaId } });
  if (!regla) return { exito: false, error: "Regla no encontrada" };

  // Si ya quedó auditada (se usó para evaluar/rechazar algún pedido) y sigue
  // Publicada, se pide confirmación explícita en vez de borrar directo —
  // perder su historial de auditoría sin avisar sería sorprendente. El
  // llamador puede desactivarla en su lugar (toggleRegla) sin pasar por acá.
  if (!forzar && regla.estado === "PUBLICADA") {
    const usada = await prisma.eventoLog.findFirst({
      where: { entidadTipo: "FlujoVentaRegla", entidadId: reglaId },
      select: { id: true },
    });
    if (usada) {
      return { exito: false, error: "USADA" };
    }
  }

  await prisma.flujoVentaRegla.delete({ where: { id: reglaId } });
  await registrarAuditoriaRegla("REGLA_VALIDACION_ELIMINADA", reglaId, sesion.instanciaId, sesion.usuarioId, { nombre: regla.nombre });
  revalidatePath("/sales/flujo-venta");
  return { exito: true, datos: undefined };
}

export async function toggleRegla(reglaId: string, activo: boolean): Promise<Resultado> {
  const { sesion, acceso } = await requireAdminFlujo();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };

  await prisma.flujoVentaRegla.update({ where: { id: reglaId }, data: { activo } });
  await registrarAuditoriaRegla(
    activo ? "REGLA_VALIDACION_ACTIVADA" : "REGLA_VALIDACION_DESACTIVADA",
    reglaId, sesion.instanciaId, sesion.usuarioId, {}
  );
  revalidatePath("/sales/flujo-venta");
  return { exito: true, datos: undefined };
}

// ── Catálogo de campos + "Probar con un pedido" ──────────────────

export async function obtenerCatalogoCamposAction() {
  const { sesion, acceso } = await requireLectorFlujo();
  if (!acceso.permitido) return [];
  const catalogo = await obtenerCatalogoCampos(prisma, sesion.instanciaId);
  // Solo lo serializable hace falta del lado del cliente — el `resolver` es
  // una función de servidor, no viaja.
  return catalogo.map(({ key, label, category, dataType, allowedOperators, allowedValues, isCustomField }) => ({
    key, label, category, dataType, allowedOperators, allowedValues, isCustomField,
  }));
}

export async function buscarPedidosParaPruebaAction(query: string): Promise<OpcionCombobox[]> {
  if (!query.trim()) return [];
  const { sesion, acceso } = await requireLectorFlujo();
  if (!acceso.permitido) return [];
  const pedidos = await obtenerPedidos(sesion.instanciaId, { busqueda: query });
  return pedidos.slice(0, 10).map((p) => ({
    valor: p.id,
    etiqueta: p.numero,
    subtitulo: p.contacto ? `${p.contacto.nombre} ${p.contacto.apellido}`.trim() : (p.nombre ?? undefined),
  }));
}

/**
 * Evalúa un árbol de condiciones (guardado o todavía sin guardar, para
 * "Probar con un pedido" mientras se edita) contra un pedido real, sin
 * persistir nada.
 */
export async function probarReglaConPedidoAction(
  pedidoId: string,
  etapaDestinoId: string,
  arbolCondiciones: unknown
): Promise<Resultado<ResultadoEvaluacion["reglasEvaluadas"][number]>> {
  const parsed = ArbolCondicionesSchema.safeParse(arbolCondiciones);
  if (!parsed.success) return { exito: false, error: "El árbol de condiciones no es válido" };

  const { sesion, acceso } = await requireLectorFlujo();
  if (!acceso.permitido) return { exito: false, error: acceso.error! };
  const [hechos, catalogo, configuracion] = await Promise.all([
    resolverHechosPedido(prisma, pedidoId, sesion.instanciaId),
    obtenerCatalogoCampos(prisma, sesion.instanciaId),
    obtenerConfiguracionEmpresa(sesion.instanciaId),
  ]);
  if (!hechos) return { exito: false, error: "Pedido no encontrado" };

  const { cumple, condiciones } = evaluarArbol(
    parsed.data as ConditionTree,
    hechos,
    catalogo,
    configuracion?.zonaHoraria ?? "America/Lima"
  );

  return {
    exito: true,
    datos: {
      reglaId: "prueba",
      nombre: "Prueba",
      prioridad: 0,
      cumple,
      mensajeFallo: null,
      mostrarPendientes: true,
      condiciones,
    },
  };
}

// ── Movimiento de pedido ──────────────────────────────────────────

export async function moverPedidoAction(pedidoId: string, etapaDestinoId: string): Promise<Resultado<void>> {
  const auth = await requirePermisoAction("pedidos", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };
  const sesion = auth.sesion;

  const validacion = await validarTransicion(pedidoId, etapaDestinoId);
  if (!validacion.permitido) {
    if (validacion.detalle?.reglaFallida) {
      await registrarAuditoriaRegla(
        "REGLA_VALIDACION_RECHAZO", validacion.detalle.reglaFallida.reglaId, sesion.instanciaId, sesion.usuarioId,
        { pedidoId, etapaDestinoId, origen: "MANUAL" }
      );
    }
    return { exito: false, error: validacion.motivo ?? "Requisito no cumplido" };
  }

  const resultado = await moverPedidoAEtapa(pedidoId, etapaDestinoId, sesion.usuarioId);
  if (!resultado.exito) return resultado;
  return { exito: true, datos: undefined };
}
