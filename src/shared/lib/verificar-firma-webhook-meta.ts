import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifica el header `X-Hub-Signature-256` que Meta manda en cada POST de
 * webhook (mensajes, reacciones, etc.) — HMAC-SHA256 del cuerpo crudo de la
 * request, firmado con el App Secret de la app de Meta correspondiente.
 *
 * Sin esto, cualquiera que descubra la URL del webhook y un
 * identificador/pageId de una cuenta conectada puede inyectar eventos
 * falsos (ver docs/META-INSTAGRAM-PRODUCTION-AUDIT.md, hallazgo #1).
 *
 * Distinto del `signed_request` que usa el callback de "Eliminación de
 * datos" (`src/app/api/webhooks/meta/eliminacion-datos/route.ts`) — ese es
 * un formato propio de Meta para ese caso puntual (payload + firma
 * concatenados en base64url); esto es el formato real de Webhooks
 * (header HTTP + HMAC sobre el body crudo), documentado en
 * https://developers.facebook.com/docs/graph-api/webhooks/getting-started#validate-payloads
 *
 * Prueba contra cada secret recibido (una cuenta puede estar conectada por
 * el flujo legacy de Facebook Login, firmado con META_APP_SECRET, o por el
 * flujo activo de Instagram Login, firmado con META_INSTAGRAM_APP_SECRET) y
 * acepta si cualquiera calza — mismo criterio ya usado en
 * eliminacion-datos/route.ts para el mismo dilema de "dos apps posibles".
 */
export function verificarFirmaWebhookMeta(
  rawBody: string,
  signatureHeader: string | null,
  appSecrets: (string | undefined)[],
): boolean {
  if (!signatureHeader?.startsWith("sha256=")) return false;

  let firmaRecibida: Buffer;
  try {
    firmaRecibida = Buffer.from(signatureHeader.slice("sha256=".length), "hex");
  } catch {
    return false;
  }

  return appSecrets
    .filter((s): s is string => !!s)
    .some((secret) => {
      const firmaEsperada = createHmac("sha256", secret).update(rawBody, "utf8").digest();
      return firmaRecibida.length === firmaEsperada.length && timingSafeEqual(firmaRecibida, firmaEsperada);
    });
}
