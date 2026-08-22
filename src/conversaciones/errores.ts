// Excepción tipada para fallos de envío por un canal de mensajería —
// reemplaza los `throw new Error(...)` sueltos que antes usaban los
// providers (no había ninguna abstracción de errores de dominio en el
// proyecto, ver `grep -rln "extends Error" src/` — vacío). Genérica a
// propósito (no "InstagramError"): cualquier provider (WhatsApp, email,
// futuros) puede lanzarla igual, y ConsumidorBase la respeta por su forma
// estructural (ver ErrorConReintentabilidad en shared/rabbitmq/tipos.ts),
// no por un import directo de esta clase — así la capa de colas no
// depende de este módulo de dominio.
export interface DetalleErrorEnvio {
  /** Slug estable para que el frontend distinga el motivo sin parsear
   *  texto de Meta (que además viene en el idioma de la cuenta — ver
   *  ejemplo real en producción: el mismo error "fuera de ventana" llegó
   *  en finés). Ej: "HUMAN_AGENT_NO_APROBADO", "FUERA_VENTANA_MENSAJERIA". */
  codigo: string;
  /** Mensaje funcional para mostrarle al usuario — no el texto crudo del
   *  proveedor. */
  mensaje: string;
  /** false = ningún reintento lo va a arreglar (permiso denegado, fuera de
   *  ventana, token inválido) — ConsumidorBase corta ahí mismo sin agotar
   *  los 3 intentos. true = puede ser transitorio (rate limit, 5xx, red). */
  reintentable: boolean;
  /** `error.code` de la respuesta de Meta, si vino de ahí. */
  metaCode?: number;
  /** `error.error_subcode` de la respuesta de Meta, si vino de ahí. */
  metaSubcode?: number;
  httpStatus?: number;
}

// No "implements DetalleErrorEnvio": Error ya expone el mensaje como
// `.message` (estándar), duplicarlo como `.mensaje` sería redundante —
// DetalleErrorEnvio.mensaje solo describe el shape del constructor.
export class EnvioMensajeError extends Error {
  readonly codigo: string;
  readonly reintentable: boolean;
  readonly metaCode?: number;
  readonly metaSubcode?: number;
  readonly httpStatus?: number;

  constructor(detalle: DetalleErrorEnvio) {
    super(detalle.mensaje);
    this.name = "EnvioMensajeError";
    this.codigo = detalle.codigo;
    this.reintentable = detalle.reintentable;
    this.metaCode = detalle.metaCode;
    this.metaSubcode = detalle.metaSubcode;
    this.httpStatus = detalle.httpStatus;
  }
}
