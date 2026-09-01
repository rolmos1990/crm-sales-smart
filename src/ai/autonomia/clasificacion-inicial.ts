import type { CategoriaIntencionAutonomia, NivelAutonomia } from "@/generated/prisma/enums";

// research.md Decisión 1 — clasificación inicial sugerida por el pedido
// (seguras/supervisadas/solo humano). Única fuente de verdad, reutilizada
// tanto por la siembra al crear un agente nuevo (siembra.ts) como por el
// valor por defecto que muestra la UI cuando un agente aún no tiene
// ninguna fila guardada (seccion-automatizacion.tsx).
export const CLASIFICACION_INICIAL: Record<CategoriaIntencionAutonomia, NivelAutonomia> = {
  SALUDO: "AUTO_REPLY_SAFE_INTENTS",
  CONSULTA_HORARIO: "AUTO_REPLY_SAFE_INTENTS",
  PREGUNTA_FRECUENTE: "AUTO_REPLY_SAFE_INTENTS",
  INFORMACION_GENERAL: "AUTO_REPLY_SAFE_INTENTS",

  RECOMENDACION: "SUGGESTION_ONLY",
  CONSULTA_PRECIO: "SUGGESTION_ONLY",
  CONSULTA_DISPONIBILIDAD: "SUGGESTION_ONLY",
  COSTO_ENVIO: "SUGGESTION_ONLY",
  SOLICITUD_COTIZACION: "SUGGESTION_ONLY",

  RECLAMO: "HUMAN_ONLY",
  SOLICITUD_REEMBOLSO: "HUMAN_ONLY",
  DESCUENTO_ESPECIAL: "HUMAN_ONLY",
  PROBLEMA_PAGO: "HUMAN_ONLY",
  EXCEPCION_ENTREGA: "HUMAN_ONLY",
  CLIENTE_MOLESTO: "HUMAN_ONLY",
  COMPROMISO_NO_DEFINIDO: "HUMAN_ONLY",
};
