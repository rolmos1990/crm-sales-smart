import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { NivelInteres, PrioridadAnalisis, TipoEjecucionAnalisis } from "@/generated/prisma/enums";
import { prisma } from "@/shared/db/prisma";
import { publicadorEventos } from "@/shared/rabbitmq";
import { EventosSistema } from "@/eventos/catalogo";
import { calcularCortes } from "@/crm/contactos/segmentacion/cortes";
import { actualizarInteres } from "@/crm/contactos/clasificacion";
import { completarContacto, devolverConBackoff } from "../cola";
import { cargarDatosLote } from "../datos-lote";
import { combinarPuntaje } from "../puntaje";
import { evaluarPorReglas } from "../reglas";
import type {
  ContactoParaIA,
  ContactoReclamado,
  DatosContactoLote,
  EjecutorIA,
  ResultadoIAContacto,
  ResultadoReglas,
  RespuestaLoteIA,
} from "../types";
import {
  abrirEjecucion,
  cerrarEjecucion,
  codigoDeError,
  estadoPorConteos,
  registrarItems,
  type ItemEjecucion,
} from "./auditoria";
import { cargarContextoCuenta, type ContextoCuenta } from "./contexto-cuenta";
import { accionVisible, calcularSugerencias, decidirIA } from "./decisiones";
import { PROMPT_SISTEMA_VERSION } from "@/ai/analisis-contactos/prompt";

/**
 * 042 — Procesa UN lote de UNA cuenta (FR-015): reglas para todos, IA solo
 * para los que la necesitan (research D5), escritura con guarda de versión
 * (research D4) y una atención auditada por cada intento (FR-037).
 *
 * Cada contacto se escribe en su propia transacción corta: un contacto
 * borrado a mitad del lote (o cualquier error puntual) no arrastra al resto.
 */

export interface DisponibilidadIA {
  disponible: boolean;
  motivo?: string;
}

export interface DependenciasMotor {
  ejecutorIA?: EjecutorIA;
  disponibilidadIA?: (instanciaId: string, prioridad: PrioridadAnalisis) => Promise<DisponibilidadIA>;
  /** Compatibilidad con el perfil 012 (FR-022): recibe la interpretación de la IA tras el commit. */
  alEvaluarConIA?: (instanciaId: string, contactoId: string, ia: ResultadoIAContacto) => Promise<void>;
  /** Avisa el consumo real para la caché de presupuestos (motor/presupuesto.ts). */
  registrarConsumo?: (instanciaId: string, tokens: number, costo: number | null) => void;
}

export interface ResumenLote {
  loteId: string;
  pedidos: number;
  exitosos: number;
  fallidos: number;
  conIA: number;
  porReglas: number;
}

interface Entrada {
  reclamado: ContactoReclamado;
  datos: DatosContactoLote;
  reglas: ResultadoReglas;
  /** Último mensaje que entra en esta evaluación (pasa a `iaHasta` si hubo IA). */
  datosHasta: Date | null;
}

interface ResultadoEscritura {
  estado: "EXITOSO" | "DESCARTADO_VERSION";
  item: ItemEjecucion;
  evento: Parameters<typeof publicarAnalizado>[0] | null;
  aplicarInteres: NivelInteres | null;
}

function resumenEvaluacion(e: { relacion: string; puntaje: number; intencion: string | null; accion: string }): Prisma.InputJsonValue {
  return { relacion: e.relacion, puntaje: e.puntaje, intencion: e.intencion, accion: e.accion };
}

// ── Escritura de un contacto ─────────────────────────────────────────────────

async function escribirContacto(
  ctx: ContextoCuenta,
  ejecucionId: string,
  entrada: Entrada,
  ia: ResultadoIAContacto | null,
  ahora: Date,
): Promise<ResultadoEscritura> {
  const { reclamado, datos, reglas } = entrada;
  const previa = datos.evaluacionPrevia;
  const ajusteIA = ia ? ia.ajustePuntaje : (previa?.ajusteIA ?? null);
  const puntaje = combinarPuntaje(reglas.puntajeBase, ajusteIA);
  const accionIA = ia ? ia.accionSugerida : (previa?.accionIA ?? null);
  const accion = accionVisible(reglas.accion, accionIA);
  const tuvoIA = ia !== null || Boolean(previa?.evaluadoIAEn);
  const sugerencias = ia ? calcularSugerencias({ ia, datos, modo: ctx.modoInteres, datosHasta: entrada.datosHasta }) : null;

  const comunes = {
    origen: tuvoIA ? ("IA" as const) : ("REGLA" as const),
    relacionComercial: reglas.relacionComercial,
    puntaje,
    puntajeBase: reglas.puntajeBase,
    senalesReglas: reglas.senales,
    motivosReglas: reglas.motivos,
    accionSugerida: accion,
    versionEvaluada: reclamado.versionReclamada,
    evaluadoEn: ahora,
    proximaEvaluacionEn: reglas.proximaEvaluacionEn,
    criterioVersionId: ctx.criterio.versionId,
    plantillaAplicada: ctx.criterio.plantillaAplicada,
    ejecucionId,
  };
  const deIA = ia
    ? {
        ajusteIA: ia.ajustePuntaje,
        intencion: ia.intencion,
        urgencia: ia.urgencia,
        recuperacion: ia.recuperacion,
        senales: ia.senales,
        objeciones: ia.objeciones,
        motivos: ia.motivos,
        accionIA: ia.accionSugerida,
        iaHasta: entrada.datosHasta,
        evaluadoIAEn: ahora,
        ...(sugerencias?.interesSugerido !== undefined ? { interesSugerido: sugerencias.interesSugerido } : {}),
        ...(sugerencias?.interesSugeridoEstado !== undefined ? { interesSugeridoEstado: sugerencias.interesSugeridoEstado } : {}),
        ...(sugerencias?.noContactarSugerido !== undefined
          ? {
              noContactarSugerido: sugerencias.noContactarSugerido,
              noContactarMotivo: sugerencias.noContactarMotivo ?? null,
              noContactarSugeridoEstado: sugerencias.noContactarSugeridoEstado ?? null,
            }
          : {}),
      }
    : {};

  const escrito = await prisma.$transaction(async (tx) => {
    let filas: number;
    if (previa) {
      // Guarda de versión (FR-011): una evaluación vieja no pisa una más nueva.
      const r = await tx.contactoEvaluacion.updateMany({
        where: { contactoId: reclamado.contactoId, instanciaId: ctx.instanciaId, versionEvaluada: { lt: reclamado.versionReclamada } },
        data: { ...comunes, ...deIA },
      });
      filas = r.count;
    } else {
      const r = await tx.contactoEvaluacion.createMany({
        data: [{ ...comunes, ...deIA, contactoId: reclamado.contactoId, instanciaId: ctx.instanciaId }],
        skipDuplicates: true,
      });
      filas = r.count;
    }
    if (filas > 0) {
      await tx.contacto.updateMany({
        where: { id: reclamado.contactoId, instanciaId: ctx.instanciaId },
        data: { puntajeComercial: puntaje },
      });
    }
    await completarContacto(tx, {
      contactoId: reclamado.contactoId,
      versionReclamada: reclamado.versionReclamada,
      ejecucionId,
      datosHasta: entrada.datosHasta ?? datos.ultimaInteraccionEn,
    });
    return filas > 0;
  });

  const antes = previa
    ? resumenEvaluacion({ relacion: "", puntaje: previa.puntaje, intencion: previa.intencion, accion: previa.accionIA ?? "" })
    : null;
  const despues = resumenEvaluacion({
    relacion: reglas.relacionComercial,
    puntaje,
    intencion: ia?.intencion ?? previa?.intencion ?? null,
    accion,
  });

  if (!escrito) {
    return {
      estado: "DESCARTADO_VERSION",
      item: { contactoId: reclamado.contactoId, estado: "DESCARTADO_VERSION", antes, motivo: "EVALUACION_MAS_RECIENTE" },
      evento: null,
      aplicarInteres: null,
    };
  }
  return {
    estado: "EXITOSO",
    item: { contactoId: reclamado.contactoId, estado: "EXITOSO", antes, despues },
    evento: {
      instanciaId: ctx.instanciaId,
      contactoId: reclamado.contactoId,
      ejecucionId,
      origen: ia ? "IA" : "REGLA",
      puntaje,
      puntajeAnterior: previa?.puntaje ?? null,
      intencion: ia?.intencion ?? previa?.intencion ?? null,
      relacionComercial: reglas.relacionComercial,
      accionSugerida: accion,
      interesAplicado: false,
    },
    aplicarInteres: sugerencias?.aplicarInteres ?? null,
  };
}

function publicarAnalizado(payload: {
  instanciaId: string;
  contactoId: string;
  ejecucionId: string;
  origen: "REGLA" | "IA";
  puntaje: number;
  puntajeAnterior: number | null;
  intencion: "ALTA" | "MEDIA" | "BAJA" | "DESCONOCIDA" | null;
  relacionComercial: "PROSPECTO" | "CLIENTE" | "CLIENTE_RECURRENTE" | "CLIENTE_INACTIVO";
  accionSugerida: string;
  interesAplicado: boolean;
}): void {
  void publicadorEventos.publicar(EventosSistema.ContactoAnalizado, payload.instanciaId, payload).catch((err) =>
    console.error("[worker:analisis] No se pudo publicar ContactoAnalizado", { contactoId: payload.contactoId, err }),
  );
}

/**
 * Escribe un grupo y devuelve los ítems. Un error en un contacto (p. ej. lo
 * borraron entre el reclamo y la escritura) se registra como descartado y no
 * frena a los demás (C3).
 */
async function escribirGrupo(
  ctx: ContextoCuenta,
  ejecucionId: string,
  entradas: Array<{ entrada: Entrada; ia: ResultadoIAContacto | null }>,
  dep: DependenciasMotor,
  ahora: Date,
): Promise<{ items: ItemEjecucion[]; exitosos: number; fallidosIds: string[] }> {
  const items: ItemEjecucion[] = [];
  const fallidosIds: string[] = [];
  let exitosos = 0;

  for (const { entrada, ia } of entradas) {
    try {
      const r = await escribirContacto(ctx, ejecucionId, entrada, ia, ahora);
      items.push(r.item);
      exitosos++; // descartado por versión también cierra el trabajo: no es una falla
      if (r.evento) {
        if (r.aplicarInteres) {
          const aplicado = await actualizarInteres({
            instanciaId: ctx.instanciaId,
            contactoId: entrada.reclamado.contactoId,
            accion: { tipo: "FIJAR", nivel: r.aplicarInteres },
            origen: "IA",
            usuarioInstanciaId: null,
          }).catch((err) => {
            console.error("[worker:analisis] No se pudo aplicar el interés", { contactoId: entrada.reclamado.contactoId, err });
            return null;
          });
          r.evento.interesAplicado = Boolean(aplicado?.ok && aplicado.cambiado);
        }
        if (ia && dep.alEvaluarConIA) {
          await dep.alEvaluarConIA(ctx.instanciaId, entrada.reclamado.contactoId, ia).catch((err) =>
            console.error("[worker:analisis] No se pudo actualizar el perfil 012", { contactoId: entrada.reclamado.contactoId, err }),
          );
        }
        publicarAnalizado(r.evento);
      }
    } catch (err) {
      const eliminado = (err as { code?: string })?.code === "P2003" || (err as { code?: string })?.code === "P2025";
      items.push({
        contactoId: entrada.reclamado.contactoId,
        estado: eliminado ? "DESCARTADO_VERSION" : "FALLIDO",
        motivo: eliminado ? "CONTACTO_ELIMINADO" : null,
        errorCodigo: eliminado ? null : codigoDeError(err),
      });
      if (eliminado) exitosos++;
      else {
        fallidosIds.push(entrada.reclamado.contactoId);
        console.error("[worker:analisis] Error al escribir la evaluación", { contactoId: entrada.reclamado.contactoId, err });
      }
    }
  }
  return { items, exitosos, fallidosIds };
}

// ── Grupo de IA con división de lotes ────────────────────────────────────────

async function procesarGrupoIA(p: {
  ctx: ContextoCuenta;
  entradas: Entrada[];
  loteId: string;
  loteRaizId: string | null;
  tipo: TipoEjecucionAnalisis;
  prioridad: PrioridadAnalisis;
  leaseMs: number;
  esperaColaMs: number | null;
  dep: DependenciasMotor & { ejecutorIA: EjecutorIA };
  ahora: Date;
}): Promise<{ exitosos: number; fallidos: number }> {
  const { ctx, entradas, dep } = p;
  const inicio = Date.now();
  const ejecucionId = await abrirEjecucion({
    instanciaId: ctx.instanciaId,
    loteId: p.loteId,
    loteRaizId: p.loteRaizId,
    intento: 1,
    tipo: p.tipo,
    prioridad: p.prioridad,
    modo: "IA",
    contactosPedidos: entradas.length,
    leaseMs: p.leaseMs,
    esperaColaMs: p.esperaColaMs,
    configAplicada: {
      tamanoLote: ctx.tamanoLote,
      criterioVersionId: ctx.criterio.versionId,
      criterioNumero: ctx.criterio.numero,
      plantillaAplicada: ctx.criterio.plantillaAplicada,
      modoInteres: ctx.modoInteres,
      promptVersion: PROMPT_SISTEMA_VERSION,
      division: p.loteRaizId !== null,
    },
  });

  const contactos: ContactoParaIA[] = entradas.map((e) => ({
    contactoId: e.reclamado.contactoId,
    datos: e.datos,
    reglas: e.reglas,
    datosHasta: e.datosHasta,
  }));

  let respuesta: RespuestaLoteIA;
  try {
    respuesta = await dep.ejecutorIA({ instanciaId: ctx.instanciaId, idioma: ctx.idioma, criterio: ctx.criterio.contenido, contactos });
  } catch (err) {
    const consumo = (err as { consumo?: Partial<RespuestaLoteIA> }).consumo;
    if (consumo?.tokensEntrada || consumo?.tokensSalida) {
      dep.registrarConsumo?.(ctx.instanciaId, (consumo.tokensEntrada ?? 0) + (consumo.tokensSalida ?? 0), consumo.costoEstimado ?? null);
    }
    await cerrarEjecucion(ejecucionId, {
      estado: "FALLIDA",
      contactosProcesados: 0,
      contactosExitosos: 0,
      contactosFallidos: entradas.length,
      tokensEntrada: consumo?.tokensEntrada,
      tokensSalida: consumo?.tokensSalida,
      tokensCacheados: consumo?.tokensCacheados,
      costoEstimado: consumo?.costoEstimado ?? null,
      usoIAId: consumo?.usoIAId ?? null,
      proveedorIAId: consumo?.proveedorIAId ?? null,
      proveedor: consumo?.proveedor ?? null,
      modelo: consumo?.modelo ?? null,
      inicio,
      error: err,
    });
    await devolverConBackoff({ instanciaId: ctx.instanciaId, contactoIds: entradas.map((e) => e.reclamado.contactoId), ejecucionId });
    return { exitosos: 0, fallidos: entradas.length };
  }

  dep.registrarConsumo?.(ctx.instanciaId, respuesta.tokensEntrada + respuesta.tokensSalida, respuesta.costoEstimado);
  const consumoCierre = {
    tokensEntrada: respuesta.tokensEntrada,
    tokensSalida: respuesta.tokensSalida,
    tokensCacheados: respuesta.tokensCacheados,
    costoEstimado: respuesta.costoEstimado,
    usoIAId: respuesta.usoIAId,
    proveedorIAId: respuesta.proveedorIAId,
    proveedor: respuesta.proveedor,
    modelo: respuesta.modelo,
  };

  // Lote entero ininteligible: se divide en mitades hasta llegar a uno (FR-018).
  if (respuesta.loteInvalido) {
    await cerrarEjecucion(ejecucionId, {
      estado: "FALLIDA",
      contactosProcesados: 0,
      contactosExitosos: 0,
      contactosFallidos: entradas.length,
      ...consumoCierre,
      inicio,
      errorCodigo: "RESPUESTA_INVALIDA",
      error: new Error("La respuesta de la IA no se pudo interpretar"),
    });
    if (entradas.length === 1) {
      await devolverConBackoff({ instanciaId: ctx.instanciaId, contactoIds: [entradas[0].reclamado.contactoId], ejecucionId });
      return { exitosos: 0, fallidos: 1 };
    }
    const mitad = Math.ceil(entradas.length / 2);
    const raiz = p.loteRaizId ?? p.loteId;
    const [a, b] = await Promise.all([
      procesarGrupoIA({ ...p, entradas: entradas.slice(0, mitad), loteRaizId: raiz }),
      procesarGrupoIA({ ...p, entradas: entradas.slice(mitad), loteRaizId: raiz }),
    ]);
    return { exitosos: a.exitosos + b.exitosos, fallidos: a.fallidos + b.fallidos };
  }

  const validas = entradas
    .filter((e) => respuesta.resultados.has(e.reclamado.contactoId))
    .map((e) => ({ entrada: e, ia: respuesta.resultados.get(e.reclamado.contactoId)! }));
  const sinResultado = entradas.filter((e) => !respuesta.resultados.has(e.reclamado.contactoId));

  const escritura = await escribirGrupo(ctx, ejecucionId, validas, dep, p.ahora);
  const invalidosSet = new Set(respuesta.invalidos);
  const itemsSinResultado: ItemEjecucion[] = sinResultado.map((e) => ({
    contactoId: e.reclamado.contactoId,
    estado: invalidosSet.has(e.reclamado.contactoId) ? "INVALIDO" : "OMITIDO",
    errorCodigo: "RESPUESTA_INVALIDA",
  }));
  const aDevolver = [...sinResultado.map((e) => e.reclamado.contactoId), ...escritura.fallidosIds];
  await devolverConBackoff({ instanciaId: ctx.instanciaId, contactoIds: aDevolver, ejecucionId });
  await registrarItems(prisma, ctx.instanciaId, ejecucionId, [...escritura.items, ...itemsSinResultado]).catch((err) =>
    console.error("[worker:analisis] No se pudo registrar el detalle de la atención", { ejecucionId, err }),
  );

  const fallidos = aDevolver.length;
  await cerrarEjecucion(ejecucionId, {
    estado: estadoPorConteos(escritura.exitosos, entradas.length),
    contactosProcesados: entradas.length,
    contactosExitosos: escritura.exitosos,
    contactosFallidos: fallidos,
    ...consumoCierre,
    inicio,
  });
  return { exitosos: escritura.exitosos, fallidos };
}

// ── Entrada principal ────────────────────────────────────────────────────────

export async function procesarLote(p: {
  instanciaId: string;
  prioridad: PrioridadAnalisis;
  reclamados: ContactoReclamado[];
  leaseMs: number;
  dependencias?: DependenciasMotor;
  loteId?: string;
  ahora?: Date;
}): Promise<ResumenLote> {
  const loteId = p.loteId ?? randomUUID();
  const dep = p.dependencias ?? {};
  const ahora = p.ahora ?? new Date();
  const resumen: ResumenLote = { loteId, pedidos: p.reclamados.length, exitosos: 0, fallidos: 0, conIA: 0, porReglas: 0 };
  if (p.reclamados.length === 0) return resumen;

  const ctx = await cargarContextoCuenta(p.instanciaId);
  const cortes = calcularCortes(ctx.zonaNegocio, ctx.umbralesSeguimiento, ahora);
  const datos = await cargarDatosLote(p.instanciaId, p.reclamados.map((r) => r.contactoId), ctx.etapas, cortes);
  const esperaColaMs = Math.max(0, ahora.getTime() - Math.min(...p.reclamados.map((r) => r.elegibleDesde.getTime())));
  const tipo = p.reclamados[0].tipo;

  const iaPosible = ctx.analisisHabilitado && ctx.iaCuentaHabilitada && Boolean(dep.ejecutorIA);
  const disponibilidad = iaPosible && dep.disponibilidadIA
    ? await dep.disponibilidadIA(p.instanciaId, p.prioridad)
    : { disponible: iaPosible };

  const porReglas: Entrada[] = [];
  const porIA: Entrada[] = [];
  const desaparecidos: ContactoReclamado[] = [];

  for (const reclamado of p.reclamados) {
    const d = datos.get(reclamado.contactoId);
    if (!d) {
      desaparecidos.push(reclamado);
      continue;
    }
    const reglas = evaluarPorReglas(d, ctx.criterio.contenido, ctx.umbralesSeguimiento, ahora);
    const decision = decidirIA({
      datos: d,
      reclamado,
      iaDisponible: disponibilidad.disponible,
      mesesAntiguedadInicial: ctx.mesesAntiguedadInicial,
      ahora,
    });
    if (decision.va) porIA.push({ reclamado, datos: d, reglas, datosHasta: d.ultimoMensajeEn });
    else porReglas.push({ reclamado, datos: d, reglas, datosHasta: null });
  }

  // Atención de reglas: todo lo que no va a la IA, más los contactos que ya no existen.
  if (porReglas.length > 0 || desaparecidos.length > 0) {
    const inicio = Date.now();
    const pedidos = porReglas.length + desaparecidos.length;
    const ejecucionId = await abrirEjecucion({
      instanciaId: p.instanciaId,
      loteId,
      intento: 1,
      tipo,
      prioridad: p.prioridad,
      modo: "REGLAS",
      contactosPedidos: pedidos,
      leaseMs: p.leaseMs,
      esperaColaMs,
      configAplicada: {
        tamanoLote: ctx.tamanoLote,
        criterioVersionId: ctx.criterio.versionId,
        criterioNumero: ctx.criterio.numero,
        plantillaAplicada: ctx.criterio.plantillaAplicada,
      },
    });
    const escritura = await escribirGrupo(ctx, ejecucionId, porReglas.map((entrada) => ({ entrada, ia: null })), dep, ahora);
    const itemsDesaparecidos: ItemEjecucion[] = desaparecidos.map((r) => ({
      contactoId: r.contactoId,
      estado: "DESCARTADO_VERSION",
      motivo: "CONTACTO_ELIMINADO",
    }));
    await devolverConBackoff({ instanciaId: p.instanciaId, contactoIds: escritura.fallidosIds, ejecucionId });
    await registrarItems(prisma, p.instanciaId, ejecucionId, [...escritura.items, ...itemsDesaparecidos]).catch((err) =>
      console.error("[worker:analisis] No se pudo registrar el detalle de la atención", { ejecucionId, err }),
    );
    const exitosos = escritura.exitosos + desaparecidos.length;
    await cerrarEjecucion(ejecucionId, {
      estado: estadoPorConteos(exitosos, pedidos),
      contactosProcesados: pedidos,
      contactosExitosos: exitosos,
      contactosFallidos: escritura.fallidosIds.length,
      inicio,
    });
    resumen.exitosos += exitosos;
    resumen.fallidos += escritura.fallidosIds.length;
    resumen.porReglas += porReglas.length;
  }

  if (porIA.length > 0 && dep.ejecutorIA) {
    const r = await procesarGrupoIA({
      ctx,
      entradas: porIA,
      loteId,
      loteRaizId: null,
      tipo,
      prioridad: p.prioridad,
      leaseMs: p.leaseMs,
      esperaColaMs,
      dep: { ...dep, ejecutorIA: dep.ejecutorIA },
      ahora,
    });
    resumen.exitosos += r.exitosos;
    resumen.fallidos += r.fallidos;
    resumen.conIA += porIA.length;
  }
  return resumen;
}
