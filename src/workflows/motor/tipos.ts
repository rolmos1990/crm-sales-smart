import type { EstadoEjecucionWorkflow, TipoEsperaWorkflow } from "@/generated/prisma/enums";
import type { ResultadoRespuestaIA, ParamsRespuestaIA } from "@/ai/respuesta/responder-con-agente";
import type { ResultadoMovimiento } from "@/crm/pipeline/mover-stage";
import type { ContextoDatos } from "./contexto";

// Contratos del motor de Workflows (docs/WORKFLOWS-PROPUESTA-ARQUITECTURA.md, E.2).

export type ResultadoNodo =
  | { tipo: "continuar"; salida: string; variables?: Record<string, string>; resultado?: Record<string, unknown> }
  | {
      tipo: "esperar";
      estado: Extract<EstadoEjecucionWorkflow, "ESPERANDO_RESPUESTA" | "ESPERANDO_TIMER" | "IA_ACTIVA" | "ESPERANDO_ACCION_EXTERNA">;
      espera: TipoEsperaWorkflow;
      /** null = sin vencimiento (solo la reanuda un evento). */
      hasta: Date | null;
      variables?: Record<string, string>;
      resultado?: Record<string, unknown>;
    }
  | { tipo: "finalizar"; resultado: string; detalle?: Record<string, unknown> }
  | { tipo: "error"; mensaje: string; reintentable: boolean };

export type EntradaReanudacion =
  | { tipo: "MENSAJE"; mensajeId: string; texto: string }
  | { tipo: "TIMER_VENCIDO" }
  /** Timer interrumpido con política "Terminar la espera" (CANCELAR_TIMER) o "Ruta alternativa". */
  | { tipo: "INTERRUPCION"; accion: "CANCELAR_TIMER" | "RUTA_ALTERNATIVA" };

/** Estado de control que los nodos guardan entre pasos (en WorkflowEjecucion.contexto). */
export interface MetaEjecucion {
  /** Veces que se entró a cada nodo: define la `iteracion` del paso (idempotencia). */
  visitas: Record<string, number>;
  /** Intentos de respuesta inválida por nodo (Menú, Esperar respuesta). */
  intentos: Record<string, number>;
  /** Mensajes enviados por la IA en un nodo Atención IA continua. */
  interaccionesIA: Record<string, number>;
  /** Inicio de la última espera (ISO): base de "el cliente respondió". */
  ultimaEsperaDesde?: string;
}

export interface ContextoEjecucionGuardado {
  variables: Record<string, string>;
  meta: MetaEjecucion;
}

export interface EjecucionEnCurso {
  id: string;
  instanciaId: string;
  workflowId: string;
  oportunidadId: string | null;
  conversacionId: string | null;
  contactoId: string | null;
  profundidad: number;
  iniciadaEn: Date;
}

export interface CtxNodo {
  ejecucion: EjecucionEnCurso;
  nodoId: string;
  iteracion: number;
  variables: Record<string, string>;
  meta: MetaEjecucion;
  ahora: Date;
  zonaNegocio: string;
  datos: () => Promise<ContextoDatos>;
  deps: AdaptadoresEjecucion;
}

export interface EjecutorNodo<C> {
  ejecutar(config: C, ctx: CtxNodo): Promise<ResultadoNodo>;
  reanudar?(config: C, ctx: CtxNodo, entrada: EntradaReanudacion): Promise<ResultadoNodo>;
}

/**
 * Única frontera del motor con el resto de Karia. El simulador (fase
 * posterior) inyecta implementaciones en memoria que no tocan producción.
 */
export interface AdaptadoresEjecucion {
  enviarMensaje(p: { instanciaId: string; conversacionId: string; texto: string; mediaUrl?: string }): Promise<{ mensajeId: string }>;
  moverEtapa(p: {
    instanciaId: string;
    oportunidadId: string;
    pipelineId: string;
    stageId: string;
    motivo?: string;
    ejecucionId: string;
  }): Promise<ResultadoMovimiento>;
  responderConAgente(p: ParamsRespuestaIA): Promise<ResultadoRespuestaIA>;
  /** El último mensaje (no interno) de la conversación es del cliente. */
  hayMensajeClientePendiente(conversacionId: string): Promise<boolean>;
  crearTarea(p: {
    instanciaId: string;
    oportunidadId: string | null;
    contactoId: string | null;
    titulo: string;
    descripcion?: string;
    usuarioInstanciaId: string | null;
    vence: Date;
    prioridad: "ALTA" | "MEDIA" | "BAJA";
    ejecucionId: string;
  }): Promise<{ actividadId: string }>;
  notificar(p: {
    instanciaId: string;
    oportunidadId: string | null;
    usuarioInstanciaId: string | null;
    mensaje: string;
    email: boolean;
    ejecucionId: string;
  }): Promise<void>;
  actualizarOportunidad(p: { instanciaId: string; oportunidadId: string; cambios: { campo: string; valor: string }[] }): Promise<void>;
  asignarHumano(p: {
    instanciaId: string;
    conversacionId: string | null;
    oportunidadId: string | null;
    usuarioInstanciaId: string | null;
    motivo?: string;
    ejecucionId: string;
  }): Promise<void>;
  iniciarWorkflow(p: {
    instanciaId: string;
    workflowId: string;
    origen: EjecucionEnCurso;
    variables: Record<string, string>;
  }): Promise<{ ejecucionId: string }>;
}

/** Errores de negocio: reintentar no los arregla. */
export class ErrorDefinitivoWorkflow extends Error {}
