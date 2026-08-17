import { prisma } from "@/shared/db/prisma";
import { INSTAGRAM_LOGIN_GRAPH_VERSION } from "@/conversaciones/providers/instagram-estrategia-auth";

/**
 * Persistencia de una cuenta de Instagram conectada vía Instagram Login.
 * Separado de la ruta de callback (login/callback/route.ts) a propósito:
 * esta función no toca `cookies()`/`redirect()` de Next.js, así que se puede
 * importar y probar directamente (ver tests/e2e/integraciones/instagram-login.spec.ts)
 * sin pasar por el boundary HTTP de la app.
 */

export interface PerfilInstagramLogin {
  igUserId: string; // Instagram professional account ID (campo user_id del token exchange / account_type de /me)
  username?: string;
  name?: string;
  accountType?: string; // "BUSINESS" | "MEDIA_CREATOR" (Meta no expone cuentas personales acá)
  profilePicUrl?: string;
  accessToken: string;
  expiresInSeconds: number; // expires_in del long-lived token
}

export interface ResultadoConexionIG {
  cuentaCanalId: string;
  creada: boolean;
}

/**
 * Cuentas profesionales válidas para Instagram API with Instagram Login.
 * Cuentas personales no pueden completar el login de negocio — esto es una
 * validación defensiva adicional, no el único gate (Meta también rechaza
 * cuentas personales dentro del propio flujo de autorización).
 */
export function esTipoDeCuentaValido(accountType: string | undefined): boolean {
  return accountType === "BUSINESS" || accountType === "MEDIA_CREATOR";
}

export async function conectarCuentaInstagramLogin(
  instanciaId: string,
  perfil: PerfilInstagramLogin,
): Promise<ResultadoConexionIG> {
  const nombre = perfil.username ? `@${perfil.username}` : perfil.name || `IG:${perfil.igUserId}`;

  const configuracion = {
    accessToken: perfil.accessToken,
    instagramBusinessAccountId: perfil.igUserId,
    username: perfil.username,
    name: perfil.name,
    accountType: perfil.accountType,
    profilePicUrl: perfil.profilePicUrl,
    proveedorAuth: "Instagram" as const,
  };

  const tokenExpiraEn = new Date(Date.now() + perfil.expiresInSeconds * 1000);
  const tokenRenovadoEn = new Date();

  // Mismo patrón de dedup que el flujo heredado (findFirst antes de crear).
  // Se complementa con el índice único parcial de la migración
  // 20260817120000_add_instagram_auth_provider como defensa en profundidad
  // ante condiciones de carrera (dos callbacks concurrentes para la misma
  // cuenta) — en ese caso el create() de abajo fallaría con P2002 y el
  // caller (login/callback/route.ts) lo trata como error genérico.
  const existente = await prisma.cuentaCanal.findFirst({
    where: { canal: "instagram", identificador: perfil.igUserId, instanciaId },
    select: { id: true },
  });

  if (existente) {
    await prisma.cuentaCanal.update({
      where: { id: existente.id },
      data: {
        activa: true,
        nombre,
        configuracion,
        proveedorAuth: "Instagram",
        tokenExpiraEn,
        tokenRenovadoEn,
      },
    });
    return { cuentaCanalId: existente.id, creada: false };
  }

  const creada = await prisma.cuentaCanal.create({
    data: {
      instanciaId,
      canal: "instagram",
      nombre,
      identificador: perfil.igUserId,
      activa: true,
      configuracion,
      proveedorAuth: "Instagram",
      tokenExpiraEn,
      tokenRenovadoEn,
    },
  });
  return { cuentaCanalId: creada.id, creada: true };
}

/**
 * Suscribe explícitamente la cuenta profesional a los eventos de webhook que
 * el CRM sabe procesar hoy. Completar el OAuth NO suscribe nada por sí solo
 * — hay que llamar esto siempre tras conectar.
 *
 * Nota: solo se suscribe "messages" (mensajes directos), que es lo único que
 * el pipeline de webhooks procesa actualmente (ver
 * src/app/api/webhooks/instagram/route.ts). No se suscribe "comments" — el
 * permiso instagram_business_manage_comments se solicita en el OAuth para no
 * forzar un re-consentimiento cuando se implemente esa función, pero
 * suscribir el evento sin tener quién lo procese solo generaría webhooks
 * ignorados.
 */
export async function suscribirWebhookInstagramLogin(
  igUserId: string,
  accessToken: string,
): Promise<{ success: boolean; error?: unknown }> {
  const url =
    `https://graph.instagram.com/${INSTAGRAM_LOGIN_GRAPH_VERSION}/${igUserId}/subscribed_apps` +
    `?subscribed_fields=messages&access_token=${encodeURIComponent(accessToken)}`;

  const res = await fetch(url, { method: "POST", cache: "no-store" });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: unknown };
  return { success: !!json.success, error: json.error };
}
