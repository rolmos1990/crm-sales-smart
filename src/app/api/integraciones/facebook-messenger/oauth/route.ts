import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { firmarEstado } from "@/integraciones/instagram/estado-oauth";

export const runtime = "nodejs";

// Mismos permisos ya usados por el flujo heredado de Instagram vía Página —
// pages_messaging es el que habilita mensajería de Messenger en sí; el
// resto son sus prerequisitos para encontrar/suscribir la Página (ver
// research.md de 005-facebook-messenger-integracion, R2).
const SCOPES = ["pages_show_list", "pages_manage_metadata", "pages_messaging", "business_management"].join(",");

/**
 * Inicia el flujo OAuth de Meta (Facebook Login) para conectar una Página a
 * Facebook Messenger. Mismo patrón que
 * /api/integraciones/instagram/oauth/route.ts (ya asegurado): `instanciaId`
 * sale de la sesión autenticada, nunca de un query param, y el `state` va
 * firmado (HMAC) reutilizando estado-oauth.ts con el App Secret de esta
 * misma app de Facebook — es la misma app de Meta que ya usa el flujo
 * heredado de Instagram, solo cambia el scope solicitado.
 *
 * Variables de entorno requeridas (solo en el servidor):
 *   META_APP_ID      — App ID de Meta for Developers
 *   META_APP_SECRET  — App Secret (también firma el `state`)
 *   APP_URL          — URL pública del servidor
 */
export async function GET(req: NextRequest) {
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const returnBase = `${appUrl}/integraciones/facebook-messenger`;

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

  const callbackUrl = `${appUrl}/api/integraciones/facebook-messenger/callback`;

  const dialogUrl = new URL("https://www.facebook.com/v20.0/dialog/oauth");
  dialogUrl.searchParams.set("client_id", appId);
  dialogUrl.searchParams.set("redirect_uri", callbackUrl);
  dialogUrl.searchParams.set("scope", SCOPES);
  dialogUrl.searchParams.set("state", state);
  dialogUrl.searchParams.set("response_type", "code");

  const response = NextResponse.redirect(dialogUrl.toString());

  response.cookies.set("fb_messenger_oauth_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutos
    path: "/",
  });

  return response;
}
