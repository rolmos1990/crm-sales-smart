import { prisma } from "@/shared/db/prisma";

export interface CuentaFacebookMessenger {
  id: string;
  nombre: string;
  identificador: string;
  activa: boolean;
  estadoConexion: "ACTIVA" | "CON_PROBLEMA";
}

/**
 * Lista las Páginas de Facebook conectadas a Messenger para una instancia,
 * junto a su estado de conexión (FR-008) — mismo patrón que
 * integraciones/instagram/page.tsx (obtenerCuentasIG), pero en queries.ts
 * en vez de directo en el Server Component, para poder reutilizarlo desde
 * otros puntos si hace falta.
 */
export async function obtenerCuentasFacebookMessenger(instanciaId: string): Promise<CuentaFacebookMessenger[]> {
  const cuentas = await prisma.cuentaCanal.findMany({
    where: { instanciaId, canal: "facebook_messenger" },
    orderBy: { creadoEn: "asc" },
    select: {
      id: true,
      nombre: true,
      identificador: true,
      activa: true,
      tokenExpiraEn: true,
      configuracion: true,
    },
  });

  return cuentas.map((c) => {
    const cfg = c.configuracion as Record<string, unknown> | null;
    const tieneToken = !!cfg?.accessToken;
    // Un Page Access Token de larga duración normalmente no vence mientras
    // el token de usuario que lo generó siga vigente (research.md R2 /
    // conectar.ts) — por eso `tokenExpiraEn` suele quedar sin valor acá. Solo
    // se marca "con problema" si falta el token o si, cuando sí hay una
    // fecha de vencimiento registrada, ya pasó (ver data-model.md).
    const tokenVencido = c.tokenExpiraEn ? c.tokenExpiraEn.getTime() < Date.now() : false;
    const estadoConexion: CuentaFacebookMessenger["estadoConexion"] =
      c.activa && tieneToken && !tokenVencido ? "ACTIVA" : "CON_PROBLEMA";

    return {
      id: c.id,
      nombre: c.nombre,
      identificador: c.identificador,
      activa: c.activa,
      estadoConexion,
    };
  });
}
