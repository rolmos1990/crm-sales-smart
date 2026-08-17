import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { firmarEstado } from "@/integraciones/instagram/estado-oauth";

export const runtime = "nodejs";

// Instagram API with Instagram Login (Business Login for Instagram) — NO es
// Instagram Basic Display (ese no permite gestionar mensajes ni comentarios).
// Permisos vigentes: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
const SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
  // Agregar "instagram_business_content_publish" acá si el proyecto llega a
  // publicar contenido a Instagram — hoy no lo hace.
].join(",");

/**
 * Inicia el flujo de Instagram Login (Business Login for Instagram). A
 * diferencia de /api/integraciones/instagram/oauth (flujo heredado vía
 * Facebook Login), este NO requiere que la cuenta de Instagram tenga una
 * Página de Facebook vinculada.
 *
 * Variables de entorno requeridas (solo servidor):
 *   META_INSTAGRAM_APP_ID      — App ID de la app de Instagram en Meta for Developers
 *   META_INSTAGRAM_APP_SECRET  — App Secret (también se usa para firmar el `state`)
 *   APP_URL                    — URL pública del servidor
 *   META_INSTAGRAM_REDIRECT_URI (opcional) — override del redirect_uri; si no
 *     se define se usa `${APP_URL}/api/integraciones/instagram/login/callback`
 */
export async function GET(req: NextRequest) {
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const returnBase = `${appUrl}/integraciones/instagram`;

  const sesion = await requireSesion();
  if (!verificarAcceso(sesion, "integraciones", "modificar").permitido) {
    return NextResponse.redirect(`${appUrl}/acceso-denegado`);
  }

  const appId = process.env.META_INSTAGRAM_APP_ID;
  if (!appId || !process.env.META_INSTAGRAM_APP_SECRET) {
    return NextResponse.redirect(`${returnBase}?error=no_configurado`);
  }

  const redirectUri =
    process.env.META_INSTAGRAM_REDIRECT_URI || `${appUrl}/api/integraciones/instagram/login/callback`;

  const nonce = randomUUID();

  // El state queda ligado al usuario y organización de la sesión actual
  // (no a un instanciaId que llegue por query param) — así el callback
  // puede verificar que quien completa el flujo es la misma persona/org que
  // lo inició, sin depender solo del nonce en cookie.
  const state = firmarEstado({
    instanciaId: sesion.instanciaId,
    usuarioId: sesion.usuarioId,
    nonce,
    ts: Date.now(),
  });

  if (!state) {
    // No debería pasar (ya validamos META_INSTAGRAM_APP_SECRET arriba), pero
    // por si acaso no dejamos avanzar el flujo sin poder firmar el state.
    return NextResponse.redirect(`${returnBase}?error=no_configurado`);
  }

  const dialogUrl = new URL("https://www.instagram.com/oauth/authorize");
  dialogUrl.searchParams.set("client_id", appId);
  dialogUrl.searchParams.set("redirect_uri", redirectUri);
  dialogUrl.searchParams.set("response_type", "code");
  dialogUrl.searchParams.set("scope", SCOPES);
  dialogUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(dialogUrl.toString());

  response.cookies.set("ig_login_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutos
    path: "/",
  });

  return response;
}
