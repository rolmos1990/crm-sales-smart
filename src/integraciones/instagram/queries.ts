import { prisma } from "@/shared/db/prisma";

const DIAS_VENTANA_HUMAN_AGENT = 30;
const CODIGO_HUMAN_AGENT_NO_APROBADO = "HUMAN_AGENT_NO_APROBADO";

/**
 * Cuenta cuántos mensajes salientes de Instagram fallaron en los últimos 30
 * días porque Meta rechazó la extensión Human Agent (código
 * "HUMAN_AGENT_NO_APROBADO" — ver instagram.ts:clasificarErrorInstagram).
 * Es la única señal disponible sin salir del sistema: Meta no expone un
 * endpoint estable para consultar el estado de aprobación de esta
 * capability por app (ver research.md de 004-fix-instagram-human-agent, D3).
 *
 * `instanciaId` se filtra explícitamente sobre `Conversacion` (no solo
 * `cuentaCanalId`) para no introducir una brecha multi-tenant en este
 * módulo — mismo criterio que ya usan `obtenerCuentasCanalAction` y
 * `desconectarCuentaInstagram` (ver docs/META-INSTAGRAM-PRODUCTION-AUDIT.md §9).
 */
export async function obtenerRechazosHumanAgent(
  cuentaCanalId: string,
  instanciaId: string
): Promise<number> {
  const desde = new Date(Date.now() - DIAS_VENTANA_HUMAN_AGENT * 24 * 60 * 60 * 1000);

  return prisma.mensajeConversacion.count({
    where: {
      codigoError: CODIGO_HUMAN_AGENT_NO_APROBADO,
      fechaError: { gte: desde },
      conversacion: { cuentaCanalId, instanciaId },
    },
  });
}
