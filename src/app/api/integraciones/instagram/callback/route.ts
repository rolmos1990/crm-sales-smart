import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/db/prisma";
import { cifrarToken } from "@/shared/lib/cifrado-tokens";
import { obtenerSesionActual } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { verificarEstado } from "@/integraciones/instagram/estado-oauth";

export const runtime = "nodejs";

const IG_GRAPH = "https://graph.facebook.com/v20.0";

/**
 * Callback OAuth de Meta Instagram (flujo heredado vía Facebook Login).
 * Meta redirige aquí tras la autorización del usuario.
 * El flujo:
 * 1. Verifica el `state` firmado (integridad + expiración) y el nonce en
 *    cookie (CSRF) — antes el state era JSON sin firmar, ver
 *    docs/META-INSTAGRAM-PRODUCTION-AUDIT.md §G.7/§9.
 * 2. Verifica que la sesión actual sea el mismo usuario/organización que
 *    inició el flujo — antes este endpoint no requería sesión en absoluto,
 *    permitiendo conectar una cuenta a cualquier `instanciaId` conocido.
 * 3. Intercambia el code por un user access token
 * 4. Eleva a long-lived token
 * 5. Intenta vía Pages → instagram_business_account (flujo clásico)
 * 6. Fallback: vía /me/instagram_accounts (flujo nuevo Meta con selección directa)
 * 7. Guarda cada cuenta en CuentaCanal y suscribe el webhook
 * 8. Redirige a /integraciones/instagram con resultado
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  // Fallback al origin de la request si APP_URL no está configurada — evita
  // construir una URL relativa (NextResponse.redirect exige URL absoluta).
  const appUrl = process.env.APP_URL || req.nextUrl.origin;
  const returnBase = `${appUrl}/integraciones/instagram`;

  // ── Errores devueltos por Meta (usuario canceló, etc.) ────────────────────
  const metaError = searchParams.get("error");
  if (metaError) {
    console.warn("[IG OAuth] Usuario canceló o error de Meta:", metaError);
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
    console.warn("[IG OAuth] state inválido, manipulado o expirado");
    return redirect(returnBase, "state");
  }

  // ── Verificar nonce en cookie (CSRF) ───────────────────────────────────
  const storedNonce = req.cookies.get("ig_oauth_nonce")?.value;
  if (!storedNonce || storedNonce !== estado.nonce) {
    console.warn("[IG OAuth] Nonce inválido — posible CSRF");
    return redirect(returnBase, "state");
  }

  // ── Verificar que la sesión actual coincide con quien inició el flujo ──
  const sesion = await obtenerSesionActual();
  if (!sesion) {
    return NextResponse.redirect(`${appUrl}/login`);
  }
  if (sesion.usuarioId !== estado.usuarioId || sesion.instanciaId !== estado.instanciaId) {
    console.warn("[IG OAuth] Sesión actual no coincide con la que inició el flujo — se rechaza para evitar conectar la cuenta a otra organización");
    return redirect(returnBase, "state");
  }
  if (!verificarAcceso(sesion, "integraciones", "modificar").permitido) {
    return NextResponse.redirect(`${appUrl}/acceso-denegado`);
  }

  const instanciaId = estado.instanciaId;
  const callbackUrl = `${appUrl}/api/integraciones/instagram/callback`;

  try {
    // ── 1. Intercambiar code por short-lived user token ───────────────────
    const tokenRes = await fetch(
      `${IG_GRAPH}/oauth/access_token?` +
      `client_id=${appId}&client_secret=${appSecret}` +
      `&redirect_uri=${encodeURIComponent(callbackUrl)}&code=${code}`,
      { cache: "no-store" }
    );
    const tokenJson = await tokenRes.json() as { access_token?: string; error?: unknown };
    if (!tokenJson.access_token) {
      console.error("[IG OAuth] Error obteniendo token:", tokenJson.error);
      return redirect(returnBase, "token");
    }

    // ── 2. Elevar a long-lived token (válido ~60 días) ───────────────────
    const llRes = await fetch(
      `${IG_GRAPH}/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${appId}&client_secret=${appSecret}` +
      `&fb_exchange_token=${tokenJson.access_token}`,
      { cache: "no-store" }
    );
    const llJson = await llRes.json() as { access_token?: string };
    const userToken = llJson.access_token ?? tokenJson.access_token;

    // ── 3. Obtener páginas de Facebook con sus page tokens ───────────────
    const pagesRes = await fetch(
      `${IG_GRAPH}/me/accounts?fields=id,name,access_token,instagram_business_account` +
      `&access_token=${userToken}`,
      { cache: "no-store" }
    );
    const pagesJson = await pagesRes.json() as {
      data?: Array<{
        id: string;
        name: string;
        access_token: string;
        instagram_business_account?: { id: string };
      }>;
    };

    const pages = pagesJson.data ?? [];

    console.log("[IG OAuth] Páginas encontradas:", JSON.stringify(
      pages.map(p => ({
        id: p.id,
        name: p.name,
        instagram_business_account: p.instagram_business_account ?? null,
      })),
      null, 2
    ));

    let cuentasConectadas = 0;

    // ── 4. Flujo clásico: Instagram vinculado a Página de Facebook ────────
    for (const page of pages) {
      const igId = page.instagram_business_account?.id;
      if (!igId) {
        console.warn(`[IG OAuth] Página "${page.name}" (${page.id}) sin instagram_business_account`);
        continue;
      }
      cuentasConectadas += await conectarCuentaIG({
        igId,
        pageAccessToken: page.access_token,
        pageId: page.id,
        pageName: page.name,
        instanciaId,
      });
    }

    // ── 5. Fallback: Business Manager API ────────────────────────────────
    // Las páginas gestionadas a través de Business Manager no aparecen en
    // /me/accounts. Se deben buscar via /me/businesses → /{biz-id}/owned_pages.
    if (cuentasConectadas === 0) {
      console.log("[IG OAuth] Intentando vía Business Manager API...");

      const bizRes = await fetch(
        `${IG_GRAPH}/me/businesses?fields=id,name&access_token=${userToken}`,
        { cache: "no-store" }
      );
      const bizJson = await bizRes.json() as {
        data?: Array<{ id: string; name: string }>;
        error?: unknown;
      };

      if (bizJson.error) {
        console.warn("[IG OAuth] /me/businesses error:", bizJson.error);
      }

      const businesses = bizJson.data ?? [];
      console.log("[IG OAuth] Businesses:", businesses.map(b => `${b.name} (${b.id})`));

      for (const biz of businesses) {
        // Obtener páginas del Business Manager (owned + client)
        const [ownedRes, clientRes] = await Promise.all([
          fetch(
            `${IG_GRAPH}/${biz.id}/owned_pages` +
            `?fields=id,name,access_token,instagram_business_account` +
            `&access_token=${userToken}`,
            { cache: "no-store" }
          ),
          fetch(
            `${IG_GRAPH}/${biz.id}/client_pages` +
            `?fields=id,name,access_token,instagram_business_account` +
            `&access_token=${userToken}`,
            { cache: "no-store" }
          ),
        ]);

        const [ownedJson, clientJson] = await Promise.all([
          ownedRes.json() as Promise<{ data?: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }> }>,
          clientRes.json() as Promise<{ data?: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }> }>,
        ]);

        const bizPages = [...(ownedJson.data ?? []), ...(clientJson.data ?? [])];

        console.log(`[IG OAuth] Business "${biz.name}" páginas:`, JSON.stringify(
          bizPages.map(p => ({
            id: p.id,
            name: p.name,
            instagram_business_account: p.instagram_business_account ?? null,
          })),
          null, 2
        ));

        for (const page of bizPages) {
          const igId = page.instagram_business_account?.id;
          if (!igId) {
            console.warn(`[IG OAuth] Página "${page.name}" (${page.id}) sin instagram_business_account`);
            continue;
          }
          cuentasConectadas += await conectarCuentaIG({
            igId,
            pageAccessToken: page.access_token,
            pageId: page.id,
            pageName: page.name,
            instanciaId,
          });
        }
      }
    }

    if (cuentasConectadas === 0) {
      console.warn("[IG OAuth] No se encontraron cuentas de Instagram Business");
      return redirect(returnBase, "sin_instagram");
    }

    const res = redirect(returnBase, null, cuentasConectadas);
    res.cookies.delete("ig_oauth_nonce");
    return res;

  } catch (e) {
    console.error("[IG OAuth] Error inesperado:", e);
    return redirect(returnBase, "oauth");
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface ConectarCuentaIGParams {
  igId: string;
  pageAccessToken: string;
  pageId: string;
  pageName: string;
  instanciaId: string;
  usernameOverride?: string;
  profilePicOverride?: string;
}

async function conectarCuentaIG({
  igId,
  pageAccessToken,
  pageId,
  pageName,
  instanciaId,
  usernameOverride,
  profilePicOverride,
}: ConectarCuentaIGParams): Promise<number> {
  let username = usernameOverride;
  let profilePicUrl = profilePicOverride;

  // Obtener datos del perfil si no los tenemos
  if (!username) {
    const igRes = await fetch(
      `${IG_GRAPH}/${igId}?fields=id,username,profile_picture_url` +
      `&access_token=${pageAccessToken}`,
      { cache: "no-store" }
    );
    const igJson = await igRes.json() as {
      id?: string;
      username?: string;
      profile_picture_url?: string;
    };
    username = igJson.username;
    profilePicUrl = igJson.profile_picture_url;
  }

  const nombre = username ? `@${username}` : pageName || `IG:${igId}`;
  const configuracion = {
    // Cifrado en reposo — ver docs/META-INSTAGRAM-PRODUCTION-AUDIT.md §9 y
    // src/shared/lib/cifrado-tokens.ts. `pageAccessToken` (parámetro, en
    // texto plano) se sigue usando tal cual arriba/abajo para las llamadas a
    // Graph API dentro de esta misma función — solo se cifra al persistir.
    accessToken: cifrarToken(pageAccessToken),
    instagramBusinessAccountId: igId,
    pageId,
    pageName,
    username,
    profilePicUrl,
  };

  const existente = await prisma.cuentaCanal.findFirst({
    where: { canal: "instagram", identificador: igId, instanciaId },
    select: { id: true },
  });

  if (existente) {
    await prisma.cuentaCanal.update({
      where: { id: existente.id },
      data: { activa: true, nombre, configuracion: configuracion as never },
    });
  } else {
    await prisma.cuentaCanal.create({
      data: {
        instanciaId,
        canal: "instagram",
        nombre,
        identificador: igId,
        activa: true,
        configuracion: configuracion as never,
      },
    });
  }

  // Suscribir la página al webhook si tenemos pageId
  if (pageId) {
    const subRes = await fetch(
      `${IG_GRAPH}/${pageId}/subscribed_apps?subscribed_fields=messages&access_token=${pageAccessToken}`,
      { method: "POST", cache: "no-store" }
    );
    const subJson = await subRes.json() as { success?: boolean; error?: unknown };
    if (subJson.success) {
      console.log(`[IG OAuth] Página ${pageId} suscrita al webhook messages ✓`);
    } else {
      console.warn(`[IG OAuth] Suscripción webhook falló para página ${pageId}:`, subJson.error);
    }
  }

  console.log(`[IG OAuth] Cuenta conectada: ${nombre} (${igId})`);
  return 1;
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
