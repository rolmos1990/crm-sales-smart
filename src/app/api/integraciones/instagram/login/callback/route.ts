import { NextRequest, NextResponse } from "next/server";
import { obtenerSesionActual } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { verificarEstado } from "@/integraciones/instagram/estado-oauth";
import {
  conectarCuentaInstagramLogin,
  esTipoDeCuentaValido,
  suscribirWebhookInstagramLogin,
} from "@/integraciones/instagram/conectar";
import { INSTAGRAM_LOGIN_GRAPH_VERSION } from "@/conversaciones/providers/instagram-estrategia-auth";

export const runtime = "nodejs";

/**
 * Callback del flujo Instagram Login (Business Login for Instagram).
 *
 * Flujo:
 * 1. Maneja cancelación/errores que Instagram devuelve en la propia query.
 * 2. Verifica el `state` firmado (integridad + expiración) y el nonce en
 *    cookie (CSRF).
 * 3. Verifica que la sesión actual sea el mismo usuario/organización que
 *    inició el flujo — evita conectar una cuenta a otra organización si el
 *    usuario cambió de sesión/instancia a mitad del proceso.
 * 4. Intercambia `code` por un token corto (api.instagram.com), lo eleva a
 *    de larga duración (graph.instagram.com) y obtiene el perfil.
 * 5. Rechaza cuentas que no sean profesionales (Business/Creator).
 * 6. Guarda/actualiza la CuentaCanal y suscribe el webhook de mensajes.
 *
 * El access token NUNCA se expone al frontend ni se incluye en URLs de
 * redirect — solo vive en el backend y termina en `configuracion` (JSON) de
 * CuentaCanal, igual que el flujo heredado.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const returnBase = `${appUrl}/integraciones/instagram`;

  // ── Cancelación / error devuelto por Instagram ────────────────────────
  const metaError = searchParams.get("error");
  if (metaError) {
    console.warn("[IG Login] Usuario canceló o Instagram devolvió error:", metaError);
    return redirigir(returnBase, "cancelado");
  }

  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  if (!code || !stateRaw) {
    return redirigir(returnBase, "parametros");
  }

  // ── Verificar state firmado (integridad + expiración) ─────────────────
  const estado = verificarEstado(stateRaw);
  if (!estado) {
    console.warn("[IG Login] state inválido, manipulado o expirado");
    return redirigir(returnBase, "state");
  }

  // ── Verificar nonce en cookie (CSRF) ───────────────────────────────────
  const nonceCookie = req.cookies.get("ig_login_nonce")?.value;
  if (!nonceCookie || nonceCookie !== estado.nonce) {
    console.warn("[IG Login] Nonce inválido — posible CSRF");
    return redirigir(returnBase, "state");
  }

  // ── Verificar que la sesión actual coincide con quien inició el flujo ──
  const sesion = await obtenerSesionActual();
  if (!sesion) {
    return redirigir(`${appUrl}/login`, null);
  }
  if (sesion.usuarioId !== estado.usuarioId || sesion.instanciaId !== estado.instanciaId) {
    console.warn("[IG Login] Sesión actual no coincide con la que inició el flujo — se rechaza para evitar conectar la cuenta a otra organización");
    return redirigir(returnBase, "state");
  }
  if (!verificarAcceso(sesion, "integraciones", "modificar").permitido) {
    return redirigir(`${appUrl}/acceso-denegado`, null);
  }

  const appId = process.env.META_INSTAGRAM_APP_ID;
  const appSecret = process.env.META_INSTAGRAM_APP_SECRET;
  if (!appId || !appSecret) {
    return redirigir(returnBase, "no_configurado");
  }

  const redirectUri =
    process.env.META_INSTAGRAM_REDIRECT_URI || `${appUrl}/api/integraciones/instagram/login/callback`;

  try {
    // ── 1. Intercambiar code por short-lived token ───────────────────────
    // https://api.instagram.com/oauth/access_token — POST multipart/form-data
    const form = new FormData();
    form.set("client_id", appId);
    form.set("client_secret", appSecret);
    form.set("grant_type", "authorization_code");
    form.set("redirect_uri", redirectUri);
    form.set("code", code);

    const shortRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    const shortJson = (await shortRes.json().catch(() => ({}))) as {
      data?: Array<{ access_token?: string; user_id?: string; permissions?: string }>;
      access_token?: string;
      user_id?: string;
      error_message?: string;
      error_type?: string;
    };
    const shortLived = shortJson.data?.[0] ?? shortJson;

    if (!shortLived.access_token) {
      console.error("[IG Login] Error en intercambio de code → token:", shortJson.error_type ?? shortJson.error_message ?? "sin detalle");
      return redirigir(returnBase, "token");
    }

    // ── 2. Elevar a long-lived token (válido 60 días) ─────────────────────
    // https://graph.instagram.com/access_token?grant_type=ig_exchange_token
    const llRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token` +
        `&client_secret=${encodeURIComponent(appSecret)}` +
        `&access_token=${encodeURIComponent(shortLived.access_token)}`,
      { cache: "no-store" },
    );
    const llJson = (await llRes.json().catch(() => ({}))) as {
      access_token?: string;
      expires_in?: number;
    };

    const accessToken = llJson.access_token ?? shortLived.access_token;
    const expiresInSeconds = llJson.expires_in ?? 3600; // fallback conservador si no elevó a long-lived

    if (!llJson.access_token) {
      console.warn("[IG Login] No se pudo elevar a long-lived token — se continúa con el short-lived (expira en ~1h)");
    }

    // ── 3. Obtener perfil de la cuenta profesional ─────────────────────────
    const meRes = await fetch(
      `https://graph.instagram.com/${INSTAGRAM_LOGIN_GRAPH_VERSION}/me` +
        `?fields=user_id,username,name,account_type,profile_picture_url` +
        `&access_token=${encodeURIComponent(accessToken)}`,
      { cache: "no-store" },
    );
    const perfil = (await meRes.json().catch(() => ({}))) as {
      user_id?: string;
      username?: string;
      name?: string;
      account_type?: string;
      profile_picture_url?: string;
      error?: unknown;
    };

    const igUserId = perfil.user_id ?? shortLived.user_id;
    if (!igUserId) {
      console.error("[IG Login] No se pudo obtener el perfil de la cuenta:", perfil.error ?? "sin detalle");
      return redirigir(returnBase, "perfil");
    }

    // ── 4. Rechazar cuentas no profesionales ───────────────────────────────
    if (!esTipoDeCuentaValido(perfil.account_type)) {
      console.warn(`[IG Login] Cuenta ${igUserId} no es Business/Creator (account_type: ${perfil.account_type ?? "desconocido"})`);
      return redirigir(returnBase, "cuenta_personal");
    }

    // ── 5. Guardar CuentaCanal ──────────────────────────────────────────────
    const resultado = await conectarCuentaInstagramLogin(sesion.instanciaId, {
      igUserId,
      username: perfil.username,
      name: perfil.name,
      accountType: perfil.account_type,
      profilePicUrl: perfil.profile_picture_url,
      accessToken,
      expiresInSeconds,
    });

    // ── 6. Suscribir webhook explícitamente ─────────────────────────────────
    const suscripcion = await suscribirWebhookInstagramLogin(igUserId, accessToken);
    if (!suscripcion.success) {
      console.warn(`[IG Login] La cuenta ${igUserId} se conectó pero la suscripción al webhook falló:`, suscripcion.error);
    }

    console.log(`[IG Login] Cuenta ${resultado.creada ? "conectada" : "reconectada"}: ${igUserId} (instancia ${sesion.instanciaId})`);
    const respuestaExito = redirigir(returnBase, null, "instagram");
    respuestaExito.cookies.delete("ig_login_nonce");
    return respuestaExito;
  } catch (e) {
    console.error("[IG Login] Error inesperado en el callback:", e);
    return redirigir(returnBase, "oauth");
  }
}

function redirigir(base: string, error: string | null, conectadaVia?: string): NextResponse {
  const url = new URL(base);
  if (error) {
    url.searchParams.set("error", error);
  } else if (conectadaVia) {
    url.searchParams.set("conectadas", "1");
    url.searchParams.set("via", conectadaVia);
  }
  return NextResponse.redirect(url.toString());
}
