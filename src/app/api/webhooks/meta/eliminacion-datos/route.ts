import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { prisma } from "@/shared/db/prisma";

export const runtime = "nodejs";

/**
 * Data Deletion Request Callback de Meta.
 *
 * Meta llama a esta URL (configurada en el dashboard de la app, sección
 * "Eliminación de datos de usuario") cuando alguien revoca el acceso de
 * Karia App desde su configuración de Facebook/Instagram y solicita el
 * borrado de los datos obtenidos a través de la integración.
 *
 * Formato exigido por Meta: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 * - Recibe POST x-www-form-urlencoded con el campo `signed_request`.
 * - Debe responder con { url, confirmation_code } si la firma es válida.
 *
 * Borrado automático acotado: para el flujo activo de Instagram Login
 * (`proveedorAuth: "Instagram"`), el `user_id` que entrega Meta en el
 * `signed_request` SÍ tiene un mapeo 1:1 seguro — es el mismo Instagram
 * professional account ID que guardamos como `CuentaCanal.identificador`
 * (ver conectarCuentaInstagramLogin en integraciones/instagram/conectar.ts).
 * Para ese caso desactivamos la cuenta y borramos el access token + los
 * datos de perfil cacheados (username, nombre, foto) obtenidos vía la API —
 * eso es lo que esta integración "obtuvo" de Meta y lo que la política de
 * borrado de datos cubre. NO tocamos `Conversacion`/`MensajeConversacion`:
 * son registros propios del negocio sobre sus contactos, no datos que Karia
 * obtuvo a través del permiso, y borrarlos es una decisión de negocio que no
 * debe automatizarse a partir de este webhook.
 *
 * El flujo legacy de Facebook Login (`proveedorAuth: "MetaFacebook"`) no
 * tiene ese mapeo confiable — el `identificador` ahí es el Instagram
 * Business Account ID vía Página, no el Facebook user ID que autorizó — así
 * que para esos casos (y cualquier `user_id` sin match) se mantiene el
 * comportamiento anterior: se deja constancia auditable de la solicitud
 * (EventoLog) para revisión manual y se expone el estado en
 * /data-deletion-status, tal como permite Meta.
 */

interface SignedRequestPayload {
  algorithm: string;
  issued_at: number;
  user_id: string;
}

function base64UrlDecode(input: string): Buffer {
  const normalizado = input.replace(/-/g, "+").replace(/_/g, "/");
  const relleno = normalizado.length % 4 === 0 ? "" : "=".repeat(4 - (normalizado.length % 4));
  return Buffer.from(normalizado + relleno, "base64");
}

function verificarSignedRequest(signedRequest: string, appSecret: string): SignedRequestPayload | null {
  const partes = signedRequest.split(".");
  if (partes.length !== 2) return null;
  const [encodedSig, encodedPayload] = partes;

  let firmaRecibida: Buffer;
  let payload: SignedRequestPayload;
  try {
    firmaRecibida = base64UrlDecode(encodedSig);
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString("utf8"));
  } catch {
    return null;
  }

  if (payload.algorithm?.toUpperCase() !== "HMAC-SHA256") return null;

  const firmaEsperada = createHmac("sha256", appSecret).update(encodedPayload).digest();
  if (firmaRecibida.length !== firmaEsperada.length || !timingSafeEqual(firmaRecibida, firmaEsperada)) {
    return null;
  }

  return payload;
}

export async function POST(req: NextRequest) {
  // Puede llegar firmado con el secret de la app "clásica" (Facebook
  // Login/WhatsApp) o con el de la app de Instagram Login — son apps de Meta
  // distintas, cada una con su propio App Secret.
  const appSecrets = [process.env.META_APP_SECRET, process.env.META_INSTAGRAM_APP_SECRET].filter(
    (s): s is string => !!s,
  );
  const appUrl = process.env.APP_URL ?? "";

  if (appSecrets.length === 0) {
    console.error("[Meta Eliminación Datos] Ningún APP_SECRET configurado (META_APP_SECRET / META_INSTAGRAM_APP_SECRET)");
    return NextResponse.json({ error: "No configurado" }, { status: 500 });
  }

  let signedRequest: string | null = null;
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await req.json();
      signedRequest = body?.signed_request ?? null;
    } else {
      const form = await req.formData();
      signedRequest = form.get("signed_request")?.toString() ?? null;
    }
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (!signedRequest) {
    return NextResponse.json({ error: "Falta signed_request" }, { status: 400 });
  }

  const payload = appSecrets
    .map((secret) => verificarSignedRequest(signedRequest, secret))
    .find((resultado): resultado is SignedRequestPayload => resultado !== null);
  if (!payload) {
    console.warn("[Meta Eliminación Datos] signed_request inválido o firma incorrecta");
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  const confirmationCode = randomUUID();

  // Mapeo 1:1 seguro solo para el flujo activo (Instagram Login) — ver
  // comentario del archivo. Puede haber más de una coincidencia si la misma
  // cuenta de Instagram fue conectada en varias instancias/tenants.
  const cuentasCoincidentes = await prisma.cuentaCanal.findMany({
    where: { canal: "instagram", proveedorAuth: "Instagram", identificador: payload.user_id },
    select: { id: true, instanciaId: true },
  });

  const estado = cuentasCoincidentes.length > 0 ? "PROCESADO_AUTOMATICO" : "PENDIENTE_REVISION_MANUAL";

  if (cuentasCoincidentes.length > 0) {
    await prisma.cuentaCanal.updateMany({
      where: { id: { in: cuentasCoincidentes.map((c) => c.id) } },
      data: {
        activa: false,
        // Reemplaza el token y los datos de perfil cacheados — no se
        // conserva nada obtenido a través del permiso de Meta.
        configuracion: {
          eliminadoPorSolicitudMeta: true,
          eliminadoEn: new Date().toISOString(),
        },
      },
    });
    console.log(
      `[Meta Eliminación Datos] ${cuentasCoincidentes.length} cuenta(s) de Instagram desactivada(s) y token borrado automáticamente — user_id: ${payload.user_id}`,
    );
  }

  await prisma.eventoLog.create({
    data: {
      tipo: "META_SOLICITUD_ELIMINACION_DATOS",
      payload: {
        metaUserId: payload.user_id,
        issuedAt: payload.issued_at,
        confirmationCode,
        estado,
        cuentasAfectadas: cuentasCoincidentes.map((c) => c.id),
      },
      entidadTipo: "meta_user",
      entidadId: payload.user_id,
    },
  });

  console.log(`[Meta Eliminación Datos] Solicitud recibida — user_id: ${payload.user_id} · code: ${confirmationCode} · estado: ${estado}`);

  return NextResponse.json({
    url: `${appUrl}/data-deletion-status?id=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}
