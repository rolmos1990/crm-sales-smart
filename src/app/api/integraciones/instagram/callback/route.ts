import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/shared/db/prisma";

export const runtime = "nodejs";

const IG_GRAPH = "https://graph.facebook.com/v20.0";

/**
 * Callback OAuth de Meta Instagram.
 * Meta redirige aquí tras la autorización del usuario.
 * El flujo:
 * 1. Verifica el nonce (CSRF)
 * 2. Intercambia el code por un user access token
 * 3. Eleva a long-lived token
 * 4. Obtiene todas las Páginas de Facebook del usuario
 * 5. Para cada Página, busca la cuenta de Instagram Business vinculada
 * 6. Guarda cada cuenta en CuentaCanal
 * 7. Redirige a /integraciones/instagram con resultado
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const appUrl = process.env.APP_URL ?? "";
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

  // ── Verificar CSRF: nonce ────────────────────────────────────────────────
  let stateData: { instanciaId: string; nonce: string };
  try {
    stateData = JSON.parse(Buffer.from(stateRaw, "base64url").toString("utf8"));
  } catch {
    return redirect(returnBase, "state");
  }

  const storedNonce = req.cookies.get("ig_oauth_nonce")?.value;
  if (!storedNonce || storedNonce !== stateData.nonce) {
    console.warn("[IG OAuth] Nonce inválido — posible CSRF");
    return redirect(returnBase, "state");
  }

  const { instanciaId } = stateData;
  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;
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
    let cuentasConectadas = 0;

    // ── 4. Conectar cada cuenta de Instagram Business encontrada ─────────
    for (const page of pages) {
      const igId = page.instagram_business_account?.id;
      if (!igId) continue;

      // Obtener username y foto de perfil
      const igRes = await fetch(
        `${IG_GRAPH}/${igId}?fields=id,username,profile_picture_url` +
        `&access_token=${page.access_token}`,
        { cache: "no-store" }
      );
      const igJson = await igRes.json() as {
        id?: string;
        username?: string;
        profile_picture_url?: string;
      };

      const nombre = igJson.username ? `@${igJson.username}` : page.name;
      const configuracion = {
        accessToken: page.access_token,
        instagramBusinessAccountId: igId,
        pageId: page.id,
        pageName: page.name,
        username: igJson.username,
        profilePicUrl: igJson.profile_picture_url,
      };

      // Upsert: si ya existe la cuenta, actualizar el token; si no, crear
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

      // Suscribir la página al webhook para recibir DMs de Instagram
      const subRes = await fetch(
        `${IG_GRAPH}/${page.id}/subscribed_apps?subscribed_fields=messages&access_token=${page.access_token}`,
        { method: "POST", cache: "no-store" }
      );
      const subJson = await subRes.json() as { success?: boolean; error?: unknown };
      if (subJson.success) {
        console.log(`[IG OAuth] Página ${page.id} suscrita al webhook messages ✓`);
      } else {
        console.warn(`[IG OAuth] Suscripción falló para página ${page.id}:`, subJson.error);
      }

      cuentasConectadas++;
      console.log(`[IG OAuth] Cuenta conectada: ${nombre} (${igId})`);
    }

    if (cuentasConectadas === 0) {
      console.warn("[IG OAuth] No se encontraron cuentas de Instagram Business en las páginas del usuario");
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

function redirect(base: string, error: string | null, conectadas?: number): NextResponse {
  const url = new URL(base);
  if (error) {
    url.searchParams.set("error", error);
  } else if (conectadas) {
    url.searchParams.set("conectadas", String(conectadas));
  }
  return NextResponse.redirect(url.toString());
}
