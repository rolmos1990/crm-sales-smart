import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";

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
 * Inicia el flujo OAuth de Meta para conectar Instagram.
 * El usuario es redirigido a Facebook Login, concede permisos,
 * y Meta lo devuelve al callback con un código de autorización.
 *
 * Variables de entorno requeridas (solo en el servidor):
 *   META_APP_ID      — App ID de Meta for Developers
 *   META_APP_SECRET  — App Secret
 *   APP_URL          — URL pública del servidor (ej: https://micrm.com)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const instanciaId = searchParams.get("instanciaId");

  const appId = process.env.META_APP_ID;
  const appUrl = process.env.APP_URL ?? "";

  if (!appId || !appUrl) {
    return NextResponse.redirect(
      `${appUrl}/integraciones/instagram?error=no_configurado`
    );
  }

  if (!instanciaId) {
    return NextResponse.redirect(`${appUrl}/integraciones/instagram?error=sesion`);
  }

  // Nonce para protección CSRF
  const nonce = randomUUID();

  // Codificar instanciaId + nonce en el state parameter de OAuth
  const statePayload = Buffer.from(JSON.stringify({ instanciaId, nonce })).toString("base64url");

  const callbackUrl = `${appUrl}/api/integraciones/instagram/callback`;

  const dialogUrl = new URL("https://www.facebook.com/v20.0/dialog/oauth");
  dialogUrl.searchParams.set("client_id", appId);
  dialogUrl.searchParams.set("redirect_uri", callbackUrl);
  dialogUrl.searchParams.set("scope", SCOPES);
  dialogUrl.searchParams.set("state", statePayload);
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
