import { prisma } from "@/shared/db/prisma";
import { cifrarToken } from "@/shared/lib/cifrado-tokens";

/**
 * Persistencia de una Página de Facebook conectada para Messenger.
 * Mismo patrón que integraciones/instagram/conectar.ts, adaptado a que acá
 * no hay dos flujos de autenticación posibles — Messenger siempre usa
 * Facebook Login + Page Access Token, obtenido igual que en el flujo
 * heredado de Instagram vía Página (ver research.md de
 * 005-facebook-messenger-integracion, R2).
 */

export interface PaginaFacebookMessenger {
  pageId: string;
  pageName: string;
  // Page Access Token de larga duración: a diferencia del token de usuario
  // de Instagram Login (que vence a los ~60 días), un Page Access Token
  // obtenido de /me/accounts con un token de usuario de larga duración no
  // trae `expires_in` — Meta no lo vence mientras el token de usuario que lo
  // generó siga vigente. Por eso no se completa `tokenExpiraEn` acá.
  accessToken: string;
}

export interface ResultadoConexionFacebookMessenger {
  cuentaCanalId: string;
  creada: boolean;
}

export async function conectarCuentaFacebookMessenger(
  instanciaId: string,
  pagina: PaginaFacebookMessenger,
): Promise<ResultadoConexionFacebookMessenger> {
  const nombre = pagina.pageName || `Página ${pagina.pageId}`;

  const configuracion = {
    // Cifrado en reposo — ver docs/META-INSTAGRAM-PRODUCTION-AUDIT.md §9 y
    // src/shared/lib/cifrado-tokens.ts. Mismo mecanismo ya usado para
    // Instagram, sin uno nuevo (research.md R3).
    accessToken: cifrarToken(pagina.accessToken),
    pageId: pagina.pageId,
    pageName: pagina.pageName,
  };

  // Mismo patrón de dedup que Instagram (findFirst antes de create),
  // complementado por el índice único parcial de la migración
  // 20260827000000_add_facebook_messenger_canal como defensa en profundidad.
  const existente = await prisma.cuentaCanal.findFirst({
    where: { canal: "facebook_messenger", identificador: pagina.pageId, instanciaId },
    select: { id: true },
  });

  if (existente) {
    await prisma.cuentaCanal.update({
      where: { id: existente.id },
      data: {
        activa: true,
        nombre,
        configuracion,
        tokenRenovadoEn: new Date(),
      },
    });
    return { cuentaCanalId: existente.id, creada: false };
  }

  const creada = await prisma.cuentaCanal.create({
    data: {
      instanciaId,
      canal: "facebook_messenger",
      nombre,
      identificador: pagina.pageId,
      activa: true,
      configuracion,
      tokenRenovadoEn: new Date(),
    },
  });
  return { cuentaCanalId: creada.id, creada: true };
}

/**
 * Suscribe explícitamente la Página al evento de webhook que Karia sabe
 * procesar (`messages`) — completar el OAuth no suscribe nada por sí solo.
 * Mismo endpoint que ya usa el flujo heredado de Instagram vía Página
 * (graph.facebook.com/<PAGE_ID>/subscribed_apps), porque es la misma Página
 * y el mismo mecanismo de suscripción de Meta.
 */
export async function suscribirWebhookFacebookMessenger(
  pageId: string,
  accessToken: string,
): Promise<{ success: boolean; error?: unknown }> {
  const url =
    `https://graph.facebook.com/v20.0/${pageId}/subscribed_apps` +
    `?subscribed_fields=messages&access_token=${encodeURIComponent(accessToken)}`;

  const res = await fetch(url, { method: "POST", cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: unknown };
  return { success: !!json.success, error: json.error };
}
