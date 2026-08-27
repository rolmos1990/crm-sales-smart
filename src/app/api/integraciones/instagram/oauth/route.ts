import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { firmarEstado } from "@/integraciones/instagram/estado-oauth";

export const runtime = "nodejs";

const SCOPES = [
  "instagram_basic",
  "instagram_manage_messages",
  "pages_show_list",
  "pages_manage_metadata",
  "pages_messaging",
  "business_management",
].join(",");

/**
 * Inicia el flujo OAuth heredado de Meta (Facebook Login + Página vinculada)
 * para conectar Instagram.
 *
 * Antes tomaba `instanciaId` de un query param sin verificar sesión — endpoint
 * abierto que permitía a cualquiera conectar una cuenta de Instagram a
 * cualquier `instanciaId` que conociera/adivinara (ver
 * docs/META-INSTAGRAM-PRODUCTION-AUDIT.md §G.7/§9). Ahora sigue el mismo
 * patrón que el flujo activo (login/route.ts): `instanciaId` sale de la
 * sesión autenticada, nunca de la query, y el `state` va firmado (HMAC) con
 * el App Secret de esta app de Facebook — no con el de Instagram Login, son
 * apps de Meta distintas.
 *
 * Variables de entorno requeridas (solo en el servidor):
 *   META_APP_ID      — App ID de Meta for Developers
 *   META_APP_SECRET  — App Secret (también firma el `state`)
 *   APP_URL          — URL pública del servidor (ej: https://micrm.com)
 */
export async function GET(req: NextRequest) {
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const returnBase = `${appUrl}/integraciones/instagram`;

  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "integraciones", "modificar").permitido) {
    return NextResponse.redirect(`${appUrl}/acceso-denegado`);
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return NextResponse.redirect(`${returnBase}?error=no_configurado`);
  }

  const nonce = randomUUID();
  const state = firmarEstado(
    { instanciaId: sesion.instanciaId, usuarioId: sesion.usuarioId, nonce, ts: Date.now() },
    appSecret,
  );
  if (!state) {
    return NextResponse.redirect(`${returnBase}?error=no_configurado`);
  }

  const callbackUrl = `${appUrl}/api/integraciones/instagram/callback`;

  const dialogUrl = new URL("https://www.facebook.com/v20.0/dialog/oauth");
  dialogUrl.searchParams.set("client_id", appId);
  dialogUrl.searchParams.set("redirect_uri", callbackUrl);
  dialogUrl.searchParams.set("scope", SCOPES);
  dialogUrl.searchParams.set("state", state);
  dialogUrl.searchParams.set("response_type", "code");

  const response = NextResponse.redirect(dialogUrl.toString());

  // Guardar nonce en cookie httpOnly para verificar en el callback (CSRF)
  response.cookies.set("ig_oauth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutos
    path: "/",
  });

  return response;
}
