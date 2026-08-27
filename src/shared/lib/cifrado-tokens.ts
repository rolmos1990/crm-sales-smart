import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifrado en reposo de tokens de acceso guardados en `CuentaCanal.configuracion`
 * (columna Json, ej. `accessToken` de Instagram/Meta) — hoy se guardaban en
 * texto plano (ver docs/META-INSTAGRAM-PRODUCTION-AUDIT.md §9 "Almacenamiento
 * de tokens" y §G.4), lo cual además bloquea la pregunta de cifrado en reposo
 * del cuestionario de tratamiento de datos de Meta App Review.
 *
 * AES-256-GCM con IV aleatorio de 96 bits por valor cifrado (recomendado para
 * GCM) y auth tag de 128 bits — autentica el ciphertext además de cifrarlo,
 * así una manipulación del valor en la base de datos se detecta al descifrar
 * en vez de producir un token corrupto silencioso.
 *
 * Formato de salida: "enc:v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>".
 * El prefijo "enc:v1:" permite a `descifrarToken` distinguir valores ya
 * cifrados de tokens legacy en texto plano (ver ahí el detalle de
 * compatibilidad hacia atrás).
 */

const ALGORITMO = "aes-256-gcm";
const PREFIJO = "enc:v1:";
const LONGITUD_IV_BYTES = 12;

function obtenerClave(): Buffer {
  const clave = process.env.TOKENS_CIFRADO_KEY;
  if (!clave) {
    throw new Error(
      "TOKENS_CIFRADO_KEY no está configurada. Generar una con `openssl rand -base64 32` " +
        "y definirla como variable de entorno antes de conectar o renovar cuentas de Instagram."
    );
  }
  const bufferClave = Buffer.from(clave, "base64");
  if (bufferClave.length !== 32) {
    throw new Error(
      "TOKENS_CIFRADO_KEY debe decodificar a exactamente 32 bytes en base64 (AES-256). " +
        "Generar una nueva con `openssl rand -base64 32`."
    );
  }
  return bufferClave;
}

/** Cifra un token en texto plano antes de persistirlo en `CuentaCanal.configuracion`. */
export function cifrarToken(textoPlano: string): string {
  const iv = randomBytes(LONGITUD_IV_BYTES);
  const cipher = createCipheriv(ALGORITMO, obtenerClave(), iv);
  const cifrado = Buffer.concat([cipher.update(textoPlano, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PREFIJO + [iv, authTag, cifrado].map((b) => b.toString("base64")).join(":");
}

/**
 * Descifra un token previamente cifrado con `cifrarToken`.
 *
 * Compatibilidad hacia atrás: las cuentas conectadas antes de este cambio
 * tienen `accessToken` en texto plano (sin el prefijo "enc:v1:") — se
 * devuelven tal cual en vez de fallar, y quedan re-cifradas solas la
 * próxima vez que el cron de renovación (`renovarTokenInstagram`) o una
 * reconexión manual reescriban la fila.
 */
export function descifrarToken(valor: string): string {
  if (!valor.startsWith(PREFIJO)) {
    return valor;
  }

  const partes = valor.slice(PREFIJO.length).split(":");
  if (partes.length !== 3) {
    throw new Error("Formato de token cifrado inválido — se esperaban 3 segmentos (iv:authTag:ciphertext).");
  }
  const [ivB64, authTagB64, cifradoB64] = partes;

  const decipher = createDecipheriv(ALGORITMO, obtenerClave(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  const textoPlano = Buffer.concat([
    decipher.update(Buffer.from(cifradoB64, "base64")),
    decipher.final(),
  ]);
  return textoPlano.toString("utf8");
}
