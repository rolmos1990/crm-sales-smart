// Ventana de mensajería de Instagram (Meta) — centraliza la regla en un
// solo lugar en vez de repartirla entre el subscriber y el provider:
//
//   0–24h desde el ÚLTIMO MENSAJE DEL CONTACTO → envío normal, sin tag.
//   24h–7 días                                  → requiere tag HUMAN_AGENT
//                                                  (y que la integración lo
//                                                  tenga habilitado — ver
//                                                  CuentaCanal.configuracion
//                                                  .humanAgentEnabled).
//   Más de 7 días                                → Meta ya no deja
//                                                  responder de ninguna
//                                                  forma.
//
// Importante: la ventana se calcula desde el último mensaje QUE EL
// CONTACTO envió, no desde el último mensaje de la conversación en
// general — que un agente responda no la reinicia (así lo define Meta).
// Función pura (sin Prisma) para poder testearla sin mockear nada — quien
// la llama (EnviarMensajeSuscriptor) es responsable de buscar esa fecha.

export type EstadoVentanaMensajeria = "VENTANA_NORMAL" | "HUMAN_AGENT" | "FUERA_DE_VENTANA";

const VENTANA_NORMAL_MS = 24 * 60 * 60 * 1000;
const VENTANA_HUMAN_AGENT_MS = 7 * 24 * 60 * 60 * 1000;

export function obtenerEstadoVentanaMensajeria(
  ultimoMensajeContactoEn: Date | null,
  ahora: Date = new Date()
): EstadoVentanaMensajeria {
  // El contacto nunca escribió — no hay conversación "abierta" que
  // responder, Meta lo trata igual que fuera de ventana.
  if (!ultimoMensajeContactoEn) return "FUERA_DE_VENTANA";

  const transcurridoMs = ahora.getTime() - ultimoMensajeContactoEn.getTime();
  if (transcurridoMs <= VENTANA_NORMAL_MS) return "VENTANA_NORMAL";
  if (transcurridoMs <= VENTANA_HUMAN_AGENT_MS) return "HUMAN_AGENT";
  return "FUERA_DE_VENTANA";
}
