// 035 — Token firmado de vida corta para la vista aislada de correos.
//
// Por qué un token y no la cookie de sesión: el iframe aislado (sandbox sin
// allow-same-origin) tiene origen opaco, y las peticiones que salen de él son
// cross-site para la cookie SameSite=Lax de la sesión. La vista, las imágenes
// cid y las del proxy llegarían sin sesión. El token lo emite una ruta que SÍ
// tiene sesión y ya verificó el comercio (research.md R8). El mismo diseño
// sirve el día que la vista se mueva a un dominio aparte.
//
// Sin CORREO_VISTA_SECRETO (o si es corto) no se firma ni se verifica nada:
// falla cerrado y la UI cae al texto plano.
import { createHmac, timingSafeEqual } from "node:crypto";

export const VIDA_TOKEN_SEGUNDOS = 15 * 60;
const VERSION_TOKEN = 1;
const MIN_BYTES_SECRETO = 32;

export type TipoTokenCorreo = "vista" | "cid" | "imagen";

export interface PayloadTokenCorreo {
  tipo: TipoTokenCorreo;
  mensajeId: string;
  instanciaId: string;
  /** cid (tipo "cid") o índice de imagen externa (tipo "imagen"). */
  recurso?: string;
  /** Solo tipo "vista": si el documento debe pedir las imágenes externas. */
  imagenes?: boolean;
  /** Segundos epoch. */
  exp: number;
}

interface PayloadSerializado {
  v: number;
  t: TipoTokenCorreo;
  m: string;
  i: string;
  r?: string;
  img?: boolean;
  exp: number;
}

function secreto(): Buffer | null {
  const valor = process.env.CORREO_VISTA_SECRETO;
  if (!valor || Buffer.byteLength(valor, "utf8") < MIN_BYTES_SECRETO) return null;
  return Buffer.from(valor, "utf8");
}

export function vistaHabilitada(): boolean {
  return secreto() !== null;
}

function firmar(datos: string, clave: Buffer): string {
  return createHmac("sha256", clave).update(datos).digest("base64url");
}

function ahoraSegundos(ahora?: number): number {
  return Math.floor((ahora ?? Date.now()) / 1000);
}

/** Expiración estándar contada desde ahora. */
export function expiracionNueva(ahora?: number): number {
  return ahoraSegundos(ahora) + VIDA_TOKEN_SEGUNDOS;
}

export function firmarToken(payload: PayloadTokenCorreo): string | null {
  const clave = secreto();
  if (!clave) return null;
  const serializado: PayloadSerializado = {
    v: VERSION_TOKEN,
    t: payload.tipo,
    m: payload.mensajeId,
    i: payload.instanciaId,
    ...(payload.recurso !== undefined ? { r: payload.recurso } : {}),
    ...(payload.imagenes !== undefined ? { img: payload.imagenes } : {}),
    exp: payload.exp,
  };
  const cuerpo = Buffer.from(JSON.stringify(serializado), "utf8").toString("base64url");
  return `${cuerpo}.${firmar(cuerpo, clave)}`;
}

function esPayloadSerializado(valor: unknown): valor is PayloadSerializado {
  if (!valor || typeof valor !== "object") return false;
  const p = valor as Record<string, unknown>;
  return (
    typeof p.v === "number" &&
    (p.t === "vista" || p.t === "cid" || p.t === "imagen") &&
    typeof p.m === "string" && p.m.length > 0 &&
    typeof p.i === "string" && p.i.length > 0 &&
    (p.r === undefined || typeof p.r === "string") &&
    (p.img === undefined || typeof p.img === "boolean") &&
    typeof p.exp === "number" && Number.isFinite(p.exp)
  );
}

/**
 * Devuelve el payload si el token es auténtico, vigente y del tipo esperado.
 * Cualquier otra cosa devuelve null, sin distinguir el motivo: quien llama
 * responde 404 igual en todos los casos.
 */
export function verificarToken(
  token: string | null | undefined,
  tipoEsperado: TipoTokenCorreo,
  ahora?: number,
): PayloadTokenCorreo | null {
  const clave = secreto();
  if (!clave || !token || token.length > 4096) return null;

  const partes = token.split(".");
  if (partes.length !== 2) return null;
  const [cuerpo, firma] = partes;

  const esperada = Buffer.from(firmar(cuerpo, clave), "utf8");
  const recibida = Buffer.from(firma, "utf8");
  if (esperada.length !== recibida.length || !timingSafeEqual(esperada, recibida)) return null;

  let datos: unknown;
  try {
    datos = JSON.parse(Buffer.from(cuerpo, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!esPayloadSerializado(datos)) return null;
  if (datos.v !== VERSION_TOKEN || datos.t !== tipoEsperado) return null;

  const ahoraS = ahoraSegundos(ahora);
  if (datos.exp <= ahoraS) return null;
  // Un token con vida más larga que la permitida no lo emitió este código
  // (o lo emitió con el reloj corrido): no se acepta.
  if (datos.exp - ahoraS > VIDA_TOKEN_SEGUNDOS) return null;

  return {
    tipo: datos.t,
    mensajeId: datos.m,
    instanciaId: datos.i,
    ...(datos.r !== undefined ? { recurso: datos.r } : {}),
    ...(datos.img !== undefined ? { imagenes: datos.img } : {}),
    exp: datos.exp,
  };
}
