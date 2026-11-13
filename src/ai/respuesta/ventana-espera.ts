// Ventana de espera antes de responder ("no contestar a cada línea").
//
// El cliente que escribe "Hola", "¿Tienen disponible?" y "la esfera azul" en
// diez segundos recibía tres respuestas. Con la ventana activa el agente
// espera a que deje de escribir y contesta una sola vez, tomando los tres
// mensajes.
//
// Implementación: *trailing debounce* por comandos redundantes. Cada mensaje
// entrante publica su propio GENERAR_RESPUESTA_IA; cada comando espera su
// ventana y después comprueba si sigue siendo el último mensaje de la
// conversación. Si no lo es, se descarta — el comando del mensaje más nuevo
// es el que va a responder, y lo hará con el historial completo (el prompt se
// arma leyendo la conversación en el momento de generar, no al encolar).
//
// Por eso el temporizador "se reinicia" sin reiniciar nada: con mensajes en
// t=0 y t=3, el primero despierta en t=5 y se descarta, y el segundo responde
// en t=8 — cinco segundos después del último mensaje.
//
// No hace falta cancelar nada si un humano toma la conversación:
// responderConAgente ya corta con OMITIDO cuando modoAtencion es HUMANO.
//
// Este módulo es puro a propósito: lo importan componentes cliente (el modal
// del agente y el editor de Workflows) para sus límites de formulario. La
// consulta que sí toca Prisma vive en ventana-espera.queries.ts — si volviera
// acá, el bundle del cliente arrastraría el driver de Postgres.

export const SEGUNDOS_ESPERA_DEFECTO = 5;
export const MAX_SEGUNDOS_ESPERA = 60;

export interface ConfigEspera {
  /** null/undefined = heredar del respaldo global de la instancia. */
  esperarAntesDeResponder?: boolean | null;
  segundosEsperaRespuesta?: number | null;
}

/**
 * Milisegundos a esperar. El agente manda; si no define nada, decide la
 * configuración de la instancia. Cero = responder de inmediato (comportamiento
 * previo a esta feature).
 */
export function resolverMsEspera(
  agente: ConfigEspera | null | undefined,
  instancia: ConfigEspera | null | undefined,
): number {
  const activa = agente?.esperarAntesDeResponder ?? instancia?.esperarAntesDeResponder ?? false;
  if (!activa) return 0;

  const segundos =
    agente?.segundosEsperaRespuesta ?? instancia?.segundosEsperaRespuesta ?? SEGUNDOS_ESPERA_DEFECTO;

  // Acotado por las dos puntas: un 0 mal configurado desactivaría la espera
  // sin que el toggle lo refleje, y un valor enorme dejaría al consumidor
  // reteniendo su turno sin sentido.
  return Math.min(Math.max(segundos, 1), MAX_SEGUNDOS_ESPERA) * 1000;
}

export const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));
