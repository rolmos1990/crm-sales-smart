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
 * No borramos datos automáticamente en este endpoint: el `user_id` que
 * entrega Meta es el ID del usuario de Facebook que hizo login OAuth (el
 * negocio que conectó su cuenta), no el de los contactos que le escriben —
 * no hay un mapeo 1:1 seguro en nuestro modelo de datos para automatizar el
 * borrado sin riesgo de borrar la cuenta equivocada. En su lugar, dejamos
 * constancia auditable de la solicitud (EventoLog) para revisión manual y
 * exponemos el estado en /data-deletion-status, tal como permite Meta.
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
  const appSecret = process.env.META_APP_SECRET;
  const appUrl = process.env.APP_URL ?? "";

  if (!appSecret) {
    console.error("[Meta Eliminación Datos] META_APP_SECRET no configurado");
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

  const payload = verificarSignedRequest(signedRequest, appSecret);
  if (!payload) {
    console.warn("[Meta Eliminación Datos] signed_request inválido o firma incorrecta");
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  const confirmationCode = randomUUID();

  await prisma.eventoLog.create({
    data: {
      tipo: "META_SOLICITUD_ELIMINACION_DATOS",
      payload: {
        metaUserId: payload.user_id,
        issuedAt: payload.issued_at,
        confirmationCode,
        estado: "PENDIENTE_REVISION_MANUAL",
      },
      entidadTipo: "meta_user",
      entidadId: payload.user_id,
    },
  });

  console.log(`[Meta Eliminación Datos] Solicitud recibida — user_id: ${payload.user_id} · code: ${confirmationCode}`);

  return NextResponse.json({
    url: `${appUrl}/data-deletion-status?id=${confirmationCode}`,
    confirmation_code: confirmationCode,
  });
}
