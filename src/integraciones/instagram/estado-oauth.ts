import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Firma y verificación del `state` de OAuth para los flujos de conexión de
 * Instagram (Instagram Login y el heredado vía Facebook Login — ver
 * docs/META-INSTAGRAM-PRODUCTION-AUDIT.md §G.7/§9, antes sin firmar en el
 * flujo heredado). El state va firmado (HMAC-SHA256) para poder validar en
 * el callback, sin estado en servidor, que:
 *   - no fue manipulado (integridad),
 *   - pertenece al usuario y organización que inició el flujo (evita que un
 *     usuario conecte una cuenta a otra organización),
 *   - no es una respuesta vieja reproducida (ventana de expiración).
 *
 * El nonce además se guarda en una cookie httpOnly de corta duración para
 * exigir que el navegador que completa el flujo sea el mismo que lo inició
 * (defensa adicional contra CSRF).
 *
 * `secretoPersonalizado` permite que el flujo heredado (app de Facebook
 * Login, `META_APP_SECRET`) reutilice esta misma implementación firmando con
 * su propio secreto en vez del de Instagram Login (`META_INSTAGRAM_APP_SECRET`,
 * usado por defecto) — son apps de Meta distintas, cada una con su propio
 * App Secret.
 */

export interface EstadoOAuthInstagram {
  instanciaId: string;
  usuarioId: string;
  nonce: string;
  ts: number;
}

const TTL_MS = 10 * 60 * 1000; // 10 minutos — igual al maxAge de la cookie de nonce

function obtenerClaveFirma(): string | null {
  // Reutiliza el App Secret de Instagram como clave HMAC: es un secreto
  // server-only que ya existe para esta integración, evita inventar una
  // variable de entorno nueva solo para esto.
  return process.env.META_INSTAGRAM_APP_SECRET ?? null;
}

export function firmarEstado(payload: EstadoOAuthInstagram, secretoPersonalizado?: string): string | null {
  const clave = secretoPersonalizado ?? obtenerClaveFirma();
  if (!clave) return null;

  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const firma = createHmac("sha256", clave).update(b64).digest("base64url");
  return `${b64}.${firma}`;
}

export function verificarEstado(state: string, secretoPersonalizado?: string): EstadoOAuthInstagram | null {
  const clave = secretoPersonalizado ?? obtenerClaveFirma();
  if (!clave) return null;

  const partes = state.split(".");
  if (partes.length !== 2) return null;
  const [b64, firmaRecibidaStr] = partes;

  const firmaEsperada = createHmac("sha256", clave).update(b64).digest();
  let firmaRecibida: Buffer;
  try {
    firmaRecibida = Buffer.from(firmaRecibidaStr, "base64url");
  } catch {
    return null;
  }

  if (firmaEsperada.length !== firmaRecibida.length || !timingSafeEqual(firmaEsperada, firmaRecibida)) {
    return null;
  }

  let payload: Partial<EstadoOAuthInstagram>;
  try {
    payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    typeof payload.instanciaId !== "string" ||
    typeof payload.usuarioId !== "string" ||
    typeof payload.nonce !== "string" ||
    typeof payload.ts !== "number"
  ) {
    return null;
  }

  if (Date.now() - payload.ts > TTL_MS) return null; // expirado

  return payload as EstadoOAuthInstagram;
}
