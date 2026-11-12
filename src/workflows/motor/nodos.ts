import { evaluarArbol } from "@/sales/flujo-venta/reglas/evaluador";
import type { CampoRegla, ConditionTree } from "@/sales/flujo-venta/reglas/tipos";
import { aInstante } from "@/shared/fechas/zona";
import { camposCondicion } from "../definicion/campos-condicion";
import { duracionEnMinutos, type ConfigNodo, type Destinatario, type Duracion, type TipoNodo } from "../definicion/schema";
import { interpolar, resolverHechos } from "./contexto";
import { ErrorDefinitivoWorkflow, type CtxNodo, type EjecutorNodo, type ResultadoNodo } from "./tipos";

// Un ejecutor por tipo de nodo. Reciben la config ya validada por Zod
// (la versión publicada pasó el validador) y devuelven qué hacer después;
// el motor (motor.ts) persiste, espera, reintenta o termina.

const sumar = (ahora: Date, d: Duracion) => new Date(ahora.getTime() + duracionEnMinutos(d) * 60_000);
const continuar = (salida: string, extra?: Omit<Extract<ResultadoNodo, { tipo: "continuar" }>, "tipo" | "salida">): ResultadoNodo => ({
  tipo: "continuar",
  salida,
  ...extra,
});

function requiereConversacion(ctx: CtxNodo): string {
  if (!ctx.ejecucion.conversacionId) {
    throw new ErrorDefinitivoWorkflow("Este paso necesita una conversación y la ejecución no tiene ninguna");
  }
  return ctx.ejecucion.conversacionId;
}

function requiereOportunidad(ctx: CtxNodo): string {
  if (!ctx.ejecucion.oportunidadId) {
    throw new ErrorDefinitivoWorkflow("Este paso necesita una oportunidad y la ejecución no tiene ninguna");
  }
  return ctx.ejecucion.oportunidadId;
}

async function resolverDestinatario(d: Destinatario, ctx: CtxNodo): Promise<string | null> {
  if (d.tipo === "USUARIO") return d.usuarioInstanciaId;
  return (await ctx.datos()).oportunidad?.usuarioInstanciaId ?? null;
}

async function texto(plantilla: string, ctx: CtxNodo): Promise<string> {
  return interpolar(plantilla, await ctx.datos(), ctx.variables);
}

// ── Control ─────────────────────────────────────────────────────────────────

const inicio: EjecutorNodo<ConfigNodo<"INICIO">> = {
  async ejecutar() {
    return continuar("siguiente");
  },
};

const fin: EjecutorNodo<ConfigNodo<"FIN">> = {
  async ejecutar(c) {
    return { tipo: "finalizar", resultado: c.resultado, detalle: c.etiqueta ? { etiqueta: c.etiqueta } : undefined };
  },
};

const condicion: EjecutorNodo<ConfigNodo<"CONDICION">> = {
  async ejecutar(c, ctx) {
    const datos = await ctx.datos();
    const hechos = await resolverHechos(ctx.ejecucion, datos, ctx.variables, ctx.meta);
    const catalogo: CampoRegla[] = camposCondicion({ version: 1, nodos: [], conexiones: [] }, []).map((campo) => ({
      ...campo,
      resolver: (h) => h[campo.key],
    }));
    // Variables del Workflow: se agregan al catálogo según lo que la ejecución tenga.
    for (const nombre of Object.keys(ctx.variables)) {
      catalogo.push({
        key: `workflow.variables.${nombre}`,
        label: nombre,
        category: "Variables del Workflow",
        dataType: "TEXTO",
        allowedOperators: catalogo.find((x) => x.dataType === "TEXTO")!.allowedOperators,
        resolver: (h) => h[`workflow.variables.${nombre}`],
      });
    }
    const evaluadas: { rama: string; cumple: boolean }[] = [];
    for (const rama of c.ramas) {
      const r = evaluarArbol(rama.arbol as ConditionTree, hechos, catalogo, ctx.zonaNegocio, ctx.ahora);
      evaluadas.push({ rama: rama.etiqueta, cumple: r.cumple });
      if (r.cumple) return continuar(`rama:${rama.id}`, { resultado: { evaluadas } });
    }
    return continuar("otro", { resultado: { evaluadas } });
  },
};

const timer: EjecutorNodo<ConfigNodo<"TIMER">> = {
  async ejecutar(c, ctx) {
    const hasta = c.modo === "DURACION" ? sumar(ctx.ahora, c.duracion) : aInstante(c.fechaHoraLocal, ctx.zonaNegocio);
    // Una fecha ya pasada no espera: sigue de inmediato.
    if (hasta <= ctx.ahora) return continuar("siguiente", { resultado: { esperaOmitida: true } });
    return { tipo: "esperar", estado: "ESPERANDO_TIMER", espera: "TIMER", hasta, resultado: { hasta: hasta.toISOString() } };
  },
  async reanudar(_c, _ctx, entrada) {
    if (entrada.tipo === "INTERRUPCION") return continuar(entrada.accion === "RUTA_ALTERNATIVA" ? "interrumpido" : "siguiente");
    return continuar("siguiente");
  },
};

const ejecutarWorkflow: EjecutorNodo<ConfigNodo<"EJECUTAR_WORKFLOW">> = {
  async ejecutar(c, ctx) {
    const variables = Object.fromEntries(
      c.transferirVariables.filter((n) => n in ctx.variables).map((n) => [n, ctx.variables[n]]),
    );
    const { ejecucionId } = await ctx.deps.iniciarWorkflow({
      instanciaId: ctx.ejecucion.instanciaId,
      workflowId: c.workflowId,
      origen: ctx.ejecucion,
      variables,
    });
    return { tipo: "finalizar", resultado: "TRANSFERIDO_A_WORKFLOW", detalle: { ejecucionId } };
  },
};

// ── Conversación ────────────────────────────────────────────────────────────

const enviarMensaje: EjecutorNodo<ConfigNodo<"ENVIAR_MENSAJE">> = {
  async ejecutar(c, ctx) {
    const conversacionId = requiereConversacion(ctx);
    const instanciaId = ctx.ejecucion.instanciaId;
    let contenido = c.texto;
    let mediaUrl = c.mediaUrl;
    if (c.origen === "PLANTILLA") {
      const plantilla = c.plantillaId ? await ctx.deps.obtenerPlantilla({ instanciaId, plantillaId: c.plantillaId }) : null;
      if (!plantilla) throw new ErrorDefinitivoWorkflow("La plantilla del mensaje no existe o fue desactivada");
      contenido = plantilla.texto;
      mediaUrl = plantilla.imagenUrl ?? undefined;
    }
    const { mensajeId } = await ctx.deps.enviarMensaje({
      instanciaId,
      conversacionId,
      texto: await texto(contenido, ctx),
      mediaUrl,
    });
    return continuar("siguiente", { resultado: { mensajeId } });
  },
};

function textoMenu(pregunta: string, opciones: { etiqueta: string }[]): string {
  return `${pregunta}\n\n${opciones.map((o, i) => `${i + 1}. ${o.etiqueta}`).join("\n")}`;
}

const normalizar = (t: string) =>
  t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .trim();

/** Número de opción, texto exacto o sinónimo (sin tildes ni mayúsculas). */
export function elegirOpcion(respuesta: string, opciones: ConfigNodo<"MENU">["opciones"]) {
  const r = normalizar(respuesta);
  const numero = Number.parseInt(r, 10);
  if (String(numero) === r && numero >= 1 && numero <= opciones.length) return opciones[numero - 1];
  return opciones.find((o) => normalizar(o.etiqueta) === r || o.sinonimos.some((s) => normalizar(s) === r)) ?? null;
}

const menu: EjecutorNodo<ConfigNodo<"MENU">> = {
  async ejecutar(c, ctx) {
    const conversacionId = requiereConversacion(ctx);
    const { mensajeId } = await ctx.deps.enviarMensaje({
      instanciaId: ctx.ejecucion.instanciaId,
      conversacionId,
      texto: textoMenu(await texto(c.pregunta, ctx), c.opciones),
    });
    return {
      tipo: "esperar",
      estado: "ESPERANDO_RESPUESTA",
      espera: "RESPUESTA",
      hasta: c.timeout ? sumar(ctx.ahora, c.timeout) : null,
      resultado: { mensajeId },
    };
  },
  async reanudar(c, ctx, entrada) {
    if (entrada.tipo !== "MENSAJE") return continuar("timeout");
    const opcion = elegirOpcion(entrada.texto, c.opciones);
    if (opcion) {
      return continuar(`opcion:${opcion.id}`, {
        variables: c.guardarEn ? { [c.guardarEn]: opcion.etiqueta } : undefined,
        resultado: { respuesta: entrada.texto, opcion: opcion.etiqueta },
      });
    }
    const intentos = (ctx.meta.intentos[ctx.nodoId] ?? 0) + 1;
    ctx.meta.intentos[ctx.nodoId] = intentos;
    if (intentos >= c.intentos) return continuar("invalida", { resultado: { respuesta: entrada.texto } });
    await ctx.deps.enviarMensaje({
      instanciaId: ctx.ejecucion.instanciaId,
      conversacionId: requiereConversacion(ctx),
      texto: textoMenu("No entendí tu respuesta. Responde con el número de una opción:", c.opciones),
    });
    return { tipo: "esperar", estado: "ESPERANDO_RESPUESTA", espera: "RESPUESTA", hasta: null };
  },
};

const VALIDADORES: Record<ConfigNodo<"ESPERAR_RESPUESTA">["tipoEsperado"], (t: string) => boolean> = {
  CUALQUIERA: (t) => t.trim().length > 0,
  NUMERO: (t) => /^-?\d+([.,]\d+)?$/.test(t.trim().replace(/[\s$]/g, "")),
  EMAIL: (t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t.trim()),
  TELEFONO: (t) => t.replace(/\D/g, "").length >= 7,
};

const esperarRespuesta: EjecutorNodo<ConfigNodo<"ESPERAR_RESPUESTA">> = {
  async ejecutar(c, ctx) {
    requiereConversacion(ctx);
    return { tipo: "esperar", estado: "ESPERANDO_RESPUESTA", espera: "RESPUESTA", hasta: sumar(ctx.ahora, c.timeout) };
  },
  async reanudar(c, ctx, entrada) {
    if (entrada.tipo !== "MENSAJE") return continuar("timeout");
    if (VALIDADORES[c.tipoEsperado](entrada.texto)) {
      return continuar("valida", { variables: { [c.guardarEn]: entrada.texto.trim() }, resultado: { respuesta: entrada.texto } });
    }
    const intentos = (ctx.meta.intentos[ctx.nodoId] ?? 0) + 1;
    ctx.meta.intentos[ctx.nodoId] = intentos;
    if (intentos >= c.intentos) return continuar("invalida", { resultado: { respuesta: entrada.texto } });
    // Sigue esperando con el mismo vencimiento (el motor conserva esperaHasta).
    return { tipo: "esperar", estado: "ESPERANDO_RESPUESTA", espera: "RESPUESTA", hasta: null };
  },
};

const asignarHumano: EjecutorNodo<ConfigNodo<"ASIGNAR_HUMANO">> = {
  async ejecutar(c, ctx) {
    await ctx.deps.asignarHumano({
      instanciaId: ctx.ejecucion.instanciaId,
      conversacionId: ctx.ejecucion.conversacionId,
      oportunidadId: ctx.ejecucion.oportunidadId,
      usuarioInstanciaId: await resolverDestinatario(c.destinatario, ctx),
      motivo: c.motivo,
      ejecucionId: ctx.ejecucion.id,
    });
    return continuar("siguiente");
  },
};

// ── IA ──────────────────────────────────────────────────────────────────────

async function responderIA(c: ConfigNodo<"ATENCION_IA">, ctx: CtxNodo) {
  const instrucciones = [c.objetivo && `Objetivo de esta atención: ${c.objetivo}`, c.instrucciones && (await texto(c.instrucciones, ctx))]
    .filter(Boolean)
    .join("\n\n");
  return ctx.deps.responderConAgente({
    instanciaId: ctx.ejecucion.instanciaId,
    conversacionId: requiereConversacion(ctx),
    agenteIAConfigId: c.agenteIAConfigId,
    instruccionesAdicionales:
      c.modo === "CONTINUA"
        ? `${instrucciones}\n\nCuando cumplas el objetivo, o si no es posible cumplirlo, usa la herramienta finalizar_atencion_workflow.`.trim()
        : instrucciones || undefined,
    herramientasPermitidas: c.herramientas,
    origen: { tipo: "WORKFLOW", ejecucionId: ctx.ejecucion.id },
  });
}

/** Salida de un turno de la IA, o null si debe seguir atendiendo. */
function salidaTurnoIA(c: ConfigNodo<"ATENCION_IA">, r: Awaited<ReturnType<typeof responderIA>>, interacciones: number): string | null {
  if (r.motivoTransferencia) return "transferencia";
  if (r.accion === "ERROR") return "error";
  if (c.modo === "RESPUESTA_UNICA") return "respondido";
  if (r.finalizacion) return r.finalizacion.resultado === "COMPLETADO" ? "completado" : "no_resuelto";
  if (interacciones >= c.maxInteracciones) return "limite";
  return null;
}

const atencionIA: EjecutorNodo<ConfigNodo<"ATENCION_IA">> = {
  async ejecutar(c, ctx) {
    const conversacionId = requiereConversacion(ctx);
    // Al entrar suele haber un mensaje del cliente sin responder (el lead
    // escribió y eso disparó el Workflow): se responde de inmediato. Si el
    // último mensaje ya es nuestro, la atención continua espera al cliente.
    if (c.modo === "CONTINUA" && !(await ctx.deps.hayMensajeClientePendiente(conversacionId))) {
      return { tipo: "esperar", estado: "IA_ACTIVA", espera: "IA", hasta: c.inactividad ? sumar(ctx.ahora, c.inactividad) : null };
    }
    return turnoIA(c, ctx);
  },
  async reanudar(c, ctx, entrada) {
    if (entrada.tipo !== "MENSAJE") return continuar("no_resuelto", { resultado: { motivo: "inactividad" } });
    return turnoIA(c, ctx);
  },
};

async function turnoIA(c: ConfigNodo<"ATENCION_IA">, ctx: CtxNodo): Promise<ResultadoNodo> {
  const r = await responderIA(c, ctx);
  const interacciones = (ctx.meta.interaccionesIA[ctx.nodoId] ?? 0) + (r.accion === "ENVIADO" ? 1 : 0);
  ctx.meta.interaccionesIA[ctx.nodoId] = interacciones;
  const resultado = { accion: r.accion, mensajeId: r.mensajeId, herramientas: r.herramientasEjecutadas, usoIAId: r.usoIAId };
  const salida = salidaTurnoIA(c, r, interacciones);
  if (salida) return continuar(salida, { resultado: { ...resultado, finalizacion: r.finalizacion, motivoTransferencia: r.motivoTransferencia } });
  return {
    tipo: "esperar",
    estado: "IA_ACTIVA",
    espera: "IA",
    hasta: c.inactividad ? sumar(ctx.ahora, c.inactividad) : null,
    resultado,
  };
}

// ── CRM ─────────────────────────────────────────────────────────────────────

const moverEtapa: EjecutorNodo<ConfigNodo<"MOVER_ETAPA">> = {
  async ejecutar(c, ctx) {
    const oportunidadId = requiereOportunidad(ctx);
    const r = await ctx.deps.moverEtapa({
      instanciaId: ctx.ejecucion.instanciaId,
      oportunidadId,
      pipelineId: c.pipelineId,
      stageId: c.stageId,
      motivo: c.motivo,
      ejecucionId: ctx.ejecucion.id,
    });
    if (!r.exito) return continuar("error", { resultado: { error: r.error } });
    if (c.workflowActual === "FINALIZAR") return { tipo: "finalizar", resultado: "MOVIDA_DE_ETAPA", detalle: { stageId: c.stageId } };
    return continuar("siguiente", { resultado: { stageId: c.stageId } });
  },
};

const actualizarOportunidad: EjecutorNodo<ConfigNodo<"ACTUALIZAR_OPORTUNIDAD">> = {
  async ejecutar(c, ctx) {
    const oportunidadId = requiereOportunidad(ctx);
    const datos = await ctx.datos();
    const cambios = c.cambios.map((x) => ({
      campo: x.campo,
      valor: x.campo === "titulo" || x.campo === "notas" ? interpolar(x.valor, datos, ctx.variables) : x.valor,
    }));
    await ctx.deps.actualizarOportunidad({ instanciaId: ctx.ejecucion.instanciaId, oportunidadId, cambios });
    return continuar("siguiente", { resultado: { cambios: cambios.length } });
  },
};

const crearTarea: EjecutorNodo<ConfigNodo<"CREAR_TAREA">> = {
  async ejecutar(c, ctx) {
    const { actividadId } = await ctx.deps.crearTarea({
      instanciaId: ctx.ejecucion.instanciaId,
      oportunidadId: ctx.ejecucion.oportunidadId,
      contactoId: ctx.ejecucion.contactoId,
      titulo: await texto(c.titulo, ctx),
      descripcion: c.descripcion ? await texto(c.descripcion, ctx) : undefined,
      usuarioInstanciaId: await resolverDestinatario(c.responsable, ctx),
      vence: sumar(ctx.ahora, c.vencimiento),
      prioridad: c.prioridad,
      ejecucionId: ctx.ejecucion.id,
    });
    return continuar("siguiente", { resultado: { actividadId } });
  },
};

const notificarAgente: EjecutorNodo<ConfigNodo<"NOTIFICAR_AGENTE">> = {
  async ejecutar(c, ctx) {
    await ctx.deps.notificar({
      instanciaId: ctx.ejecucion.instanciaId,
      oportunidadId: ctx.ejecucion.oportunidadId,
      usuarioInstanciaId: await resolverDestinatario(c.destinatario, ctx),
      mensaje: await texto(c.mensaje, ctx),
      email: c.tambienEmail,
      ejecucionId: ctx.ejecucion.id,
    });
    return continuar("siguiente");
  },
};

export const EJECUTORES: { [T in TipoNodo]: EjecutorNodo<ConfigNodo<T>> } = {
  INICIO: inicio,
  FIN: fin,
  CONDICION: condicion,
  TIMER: timer,
  EJECUTAR_WORKFLOW: ejecutarWorkflow,
  ENVIAR_MENSAJE: enviarMensaje,
  MENU: menu,
  ESPERAR_RESPUESTA: esperarRespuesta,
  ASIGNAR_HUMANO: asignarHumano,
  ATENCION_IA: atencionIA,
  MOVER_ETAPA: moverEtapa,
  ACTUALIZAR_OPORTUNIDAD: actualizarOportunidad,
  CREAR_TAREA: crearTarea,
  NOTIFICAR_AGENTE: notificarAgente,
};
