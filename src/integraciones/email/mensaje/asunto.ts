// Módulo puro (sin Prisma): lo usan el envío SMTP en el servidor y el
// compositor de correo en el cliente, para que el asunto que ve el agente sea
// exactamente el que sale.

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
