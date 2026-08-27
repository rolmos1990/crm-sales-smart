import { NextRequest, NextResponse } from "next/server";
import { obtenerSesionActual } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { verificarEstado } from "@/integraciones/instagram/estado-oauth";
import {
  conectarCuentaFacebookMessenger,
  suscribirWebhookFacebookMessenger,
} from "@/integraciones/facebook-messenger/conectar";

export const runtime = "nodejs";

const FB_GRAPH = "https://graph.facebook.com/v20.0";

/**
 * Callback OAuth de Facebook Login para Facebook Messenger. Mismo patrón que
 * /api/integraciones/instagram/callback/route.ts (ya asegurado):
 * 1. Verifica el `state` firmado (integridad + expiración) y el nonce en
 *    cookie (CSRF).
 * 2. Verifica que la sesión actual sea el mismo usuario/organización que
 *    inició el flujo.
 * 3. Intercambia `code` por un token de usuario, lo eleva a larga duración.
 * 4. Lista las Páginas del usuario (con fallback a Business Manager si no
 *    aparecen en /me/accounts) y conecta cada una para Messenger.
 * 5. Suscribe cada Página al webhook de mensajes.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const returnBase = `${appUrl}/integraciones/facebook-messenger`;

  const metaError = searchParams.get("error");
  if (metaError) {
    console.warn("[FB Messenger OAuth] Usuario canceló o error de Meta:", metaError);
    return redirect(returnBase, "cancelado");
  }

  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  if (!code || !stateRaw) {
    return redirect(returnBase, "parametros");
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    return redirect(returnBase, "no_configurado");
  }

  // ── Verificar state firmado (integridad + expiración) ─────────────────
  const estado = verificarEstado(stateRaw, appSecret);
  if (!estado) {
    console.warn("[FB Messenger OAuth] state inválido, manipulado o expirado");
    return redirect(returnBase, "state");
  }

  // ── Verificar nonce en cookie (CSRF) ───────────────────────────────────
  const storedNonce = req.cookies.get("fb_messenger_oauth_nonce")?.value;
  if (!storedNonce || storedNonce !== estado.nonce) {
    console.warn("[FB Messenger OAuth] Nonce inválido — posible CSRF");
    return redirect(returnBase, "state");
  }

  // ── Verificar que la sesión actual coincide con quien inició el flujo ──
  const sesion = await obtenerSesionActual();
  if (!sesion) {
    return NextResponse.redirect(`${appUrl}/login`);
  }
  if (sesion.usuarioId !== estado.usuarioId || sesion.instanciaId !== estado.instanciaId) {
    console.warn("[FB Messenger OAuth] Sesión actual no coincide con la que inició el flujo — se rechaza");
    return redirect(returnBase, "state");
  }
  if (!verificarAcceso(sesion, "integraciones", "modificar").permitido) {
    return NextResponse.redirect(`${appUrl}/acceso-denegado`);
  }

  const instanciaId = estado.instanciaId;
  const callbackUrl = `${appUrl}/api/integraciones/facebook-messenger/callback`;

  try {
    // ── 1. Intercambiar code por short-lived user token ───────────────────
    const tokenRes = await fetch(
      `${FB_GRAPH}/oauth/access_token?` +
        `client_id=${appId}&client_secret=${appSecret}` +
        `&redirect_uri=${encodeURIComponent(callbackUrl)}&code=${code}`,
      { cache: "no-store" },
    );
    const tokenJson = (await tokenRes.json()) as { access_token?: string; error?: unknown };
    if (!tokenJson.access_token) {
      console.error("[FB Messenger OAuth] Error obteniendo token:", tokenJson.error);
      return redirect(returnBase, "token");
    }

    // ── 2. Elevar a long-lived token (válido ~60 días) ───────────────────
    const llRes = await fetch(
      `${FB_GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
        `&client_id=${appId}&client_secret=${appSecret}` +
        `&fb_exchange_token=${tokenJson.access_token}`,
      { cache: "no-store" },
    );
    const llJson = (await llRes.json()) as { access_token?: string };
    const userToken = llJson.access_token ?? tokenJson.access_token;

    // ── 3. Obtener páginas de Facebook con sus page tokens ───────────────
    const pagesRes = await fetch(
      `${FB_GRAPH}/me/accounts?fields=id,name,access_token&access_token=${userToken}`,
      { cache: "no-store" },
    );
    const pagesJson = (await pagesRes.json()) as {
      data?: Array<{ id: string; name: string; access_token: string }>;
    };

    let paginas = pagesJson.data ?? [];

    // ── 4. Fallback: Business Manager API (páginas no listadas en /me/accounts) ──
    if (paginas.length === 0) {
      const bizRes = await fetch(`${FB_GRAPH}/me/businesses?fields=id,name&access_token=${userToken}`, {
        cache: "no-store",
      });
      const bizJson = (await bizRes.json()) as { data?: Array<{ id: string; name: string }> };
      const businesses = bizJson.data ?? [];

      for (const biz of businesses) {
        const [ownedRes, clientRes] = await Promise.all([
          fetch(`${FB_GRAPH}/${biz.id}/owned_pages?fields=id,name,access_token&access_token=${userToken}`, {
            cache: "no-store",
          }),
          fetch(`${FB_GRAPH}/${biz.id}/client_pages?fields=id,name,access_token&access_token=${userToken}`, {
            cache: "no-store",
          }),
        ]);
        const [ownedJson, clientJson] = await Promise.all([
          ownedRes.json() as Promise<{ data?: Array<{ id: string; name: string; access_token: string }> }>,
          clientRes.json() as Promise<{ data?: Array<{ id: string; name: string; access_token: string }> }>,
        ]);
        paginas = [...paginas, ...(ownedJson.data ?? []), ...(clientJson.data ?? [])];
      }
    }

    if (paginas.length === 0) {
      console.warn("[FB Messenger OAuth] No se encontraron Páginas de Facebook");
      return redirect(returnBase, "sin_paginas");
    }

    // ── 5. Conectar cada Página y suscribir el webhook de mensajes ────────
    let conectadas = 0;
    for (const pagina of paginas) {
      await conectarCuentaFacebookMessenger(instanciaId, {
        pageId: pagina.id,
        pageName: pagina.name,
        accessToken: pagina.access_token,
      });
      conectadas++;

      const suscripcion = await suscribirWebhookFacebookMessenger(pagina.id, pagina.access_token);
      if (!suscripcion.success) {
        console.warn(`[FB Messenger OAuth] Página ${pagina.id} conectada pero la suscripción al webhook falló:`, suscripcion.error);
      }
    }

    console.log(`[FB Messenger OAuth] ${conectadas} Página(s) conectada(s) (instancia ${instanciaId})`);
    const respuestaExito = redirect(returnBase, null, conectadas);
    respuestaExito.cookies.delete("fb_messenger_oauth_nonce");
    return respuestaExito;
  } catch (e) {
    console.error("[FB Messenger OAuth] Error inesperado:", e);
    return redirect(returnBase, "oauth");
  }
}

function redirect(base: string, error: string | null, conectadas?: number): NextResponse {
  const url = new URL(base);
  if (error) {
    url.searchParams.set("error", error);
  } else if (conectadas) {
    url.searchParams.set("conectadas", String(conectadas));
  }
  return NextResponse.redirect(url.toString());
}
