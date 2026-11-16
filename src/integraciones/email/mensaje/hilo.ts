import "server-only";

// Lo que hace que una respuesta de Karia aparezca DENTRO del hilo del cliente
// y no como un correo suelto (FR-028).
//
// No hace falta ninguna columna nueva: los Message-ID de todos los correos de
// la conversación ya están en MensajeConversacion.idExterno, así que la cadena
// del hilo se reconstruye desde ahí.
import { prisma } from "@/shared/db/prisma";

/** Tope de la cadena References. Los clientes de correo no necesitan más y
 *  una cabecera enorme es motivo de rechazo en algunos servidores. */
const MAX_REFERENCIAS = 10;

export interface ContextoHiloCorreo {
  /** Asunto a usar, ya con "Re: " si corresponde. */
  asunto: string;
  /** Message-ID del último correo entrante, para In-Reply-To. */
  inReplyTo: string | null;
  /** Cadena del hilo, del más viejo al más nuevo. */
  references: string[];
}

/**
 * Agrega "Re: " sin duplicarlo.
 *
 * Un "Re: Re: Re:" no rompe nada técnicamente, pero delata que el sistema no
 * entiende el hilo, y el cliente lo ve.
 */
export function asuntoDeRespuesta(asuntoOriginal: string | null, nombreNegocio?: string): string {
  const limpio = (asuntoOriginal ?? "").trim();
  if (!limpio) {
    return nombreNegocio ? `Mensaje de ${nombreNegocio}` : "Mensaje";
  }
  // Cubre "Re:", "RE:", "re :" y el "RE:" repetido que arrastran algunos
  // clientes de correo.
  const sinPrefijo = limpio.replace(/^((re|rv|fwd|fw)\s*:\s*)+/i, "").trim();
  return `Re: ${sinPrefijo || limpio}`;
}

/** Envuelve un Message-ID en ángulos, como exige el formato de las cabeceras. */
export function conAngulos(messageId: string): string {
  const limpio = messageId.trim();
  if (!limpio) return "";
  return limpio.startsWith("<") ? limpio : `<${limpio}>`;
}

/**
 * Arma el contexto del hilo para responder una conversación de correo.
 *
 * Se resuelve acá y no dentro del provider porque el provider no tiene acceso
 * a Prisma — es la misma razón por la que la ventana de mensajería de Meta se
 * resuelve en EnviarMensajeSuscriptor antes de llamar al provider.
 */
export async function resolverContextoHilo(
  conversacionId: string,
  nombreNegocio?: string,
): Promise<ContextoHiloCorreo> {
  const [conversacion, mensajesConId] = await Promise.all([
    prisma.conversacion.findUnique({
      where: { id: conversacionId },
      select: { asunto: true },
    }),
    // Todos los correos de la conversación que tienen Message-ID real, del más
    // viejo al más nuevo. Los que no lo tienen traen un hash derivado de la
    // posición en el buzón (ver normalizar.ts): ese no es un Message-ID válido
    // y no debe entrar en References.
    prisma.mensajeConversacion.findMany({
      where: { conversacionId, idExterno: { not: null } },
      select: { idExterno: true, remitente: true, creadoEn: true },
      orderBy: { creadoEn: "asc" },
    }),
  ]);

  const esMessageIdValido = (id: string | null): id is string => Boolean(id && id.includes("@"));

  const cadena = mensajesConId.map((m) => m.idExterno).filter(esMessageIdValido);

  const ultimoEntrante = [...mensajesConId]
    .reverse()
    .find((m) => m.remitente === "CONTACTO" && esMessageIdValido(m.idExterno));

  // Si la cadena excede el tope, se conservan el primero (la raíz del hilo, que
  // es lo que agrupa) y los últimos: es la recomendación del RFC 5322 para
  // acortar References sin romper el agrupamiento.
  const references =
    cadena.length <= MAX_REFERENCIAS
      ? cadena
      : [cadena[0], ...cadena.slice(-(MAX_REFERENCIAS - 1))];

  return {
    asunto: asuntoDeRespuesta(conversacion?.asunto ?? null, nombreNegocio),
    inReplyTo: ultimoEntrante?.idExterno ?? null,
    references,
  };
}
