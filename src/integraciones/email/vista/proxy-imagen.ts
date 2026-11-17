// 035 — Descarga segura de una imagen externa de un correo (proxy con
// protección SSRF). Solo la usa la ruta /api/correo-aislado/imagen, y solo
// con URLs que el propio correo traía (MensajeCorreo.imagenesExternas).
//
// Por qué cada paso (contracts/proxy-imagenes.md, research.md R10):
// - El DNS se resuelve UNA vez, se validan TODAS las IPs y la conexión va a la
//   IP validada. Sin eso, un DNS que cambia entre la validación y la conexión
//   (rebinding) llevaría a Karia a su propia red interna.
// - Las redirecciones se siguen a mano y cada una se revalida completa.
// - La imagen se re-codifica con sharp: lo que llega al navegador lo generó
//   Karia, sin metadatos ni contenido políglota.
// - No se reenvía nada del agente: ni cookies, ni Authorization, ni Referer.
import http from "node:http";
import https from "node:https";
import { lookup as dnsLookup } from "node:dns/promises";
import { isIP, type LookupFunction } from "node:net";
import type { IncomingMessage } from "node:http";
import { esDireccionBloqueada } from "./direcciones-bloqueadas";

export type RechazoProxy =
  | "ESQUEMA"
  | "PUERTO"
  | "CREDENCIALES_EN_URL"
  | "DIRECCION_BLOQUEADA"
  | "DNS"
  | "DEMASIADAS_REDIRECCIONES"
  | "ESTADO_HTTP"
  | "TIPO_NO_ADMITIDO"
  | "DEMASIADO_GRANDE"
  | "TIEMPO_EXCEDIDO"
  | "IMAGEN_INVALIDA";

export type ResultadoProxy = { ok: true; webp: Buffer } | { ok: false; motivo: RechazoProxy };

export interface DireccionResuelta {
  address: string;
  family: number;
}

export interface DependenciasProxy {
  /** Resolución DNS (inyectable en pruebas). Debe devolver TODAS las direcciones. */
  resolver?: (host: string) => Promise<DireccionResuelta[]>;
  /**
   * SOLO PRUEBAS: permite conectarse a loopback y a cualquier puerto para
   * hablar con un servidor de prueba local. El código de producción nunca lo pasa.
   */
  permitirDestinoDePrueba?: boolean;
  tiempoMaximoMs?: number;
  bytesMaximos?: number;
}

export const MAX_REDIRECCIONES = 3;
const TIEMPO_MAXIMO_MS = 5_000;
const BYTES_MAXIMOS = 5 * 1024 * 1024;
const MAX_PIXELES = 40_000_000;
const TIPOS_ADMITIDOS = new Set(["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]);

class Rechazo extends Error {
  constructor(readonly motivo: RechazoProxy) {
    super(motivo);
  }
}

function esImagenPorBytes(b: Buffer): boolean {
  if (b.length < 12) return false;
  const png = b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
  const jpeg = b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  const gif = b.subarray(0, 4).toString("latin1") === "GIF8";
  const webp = b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP";
  return png || jpeg || gif || webp;
}

async function resolverPorDefecto(host: string): Promise<DireccionResuelta[]> {
  return dnsLookup(host, { all: true, verbatim: true });
}

/** Valida la URL y devuelve la IP (ya validada) a la que hay que conectarse. */
async function validarDestino(url: URL, deps: DependenciasProxy): Promise<DireccionResuelta> {
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Rechazo("ESQUEMA");
  if (url.username || url.password) throw new Rechazo("CREDENCIALES_EN_URL");
  if (!deps.permitirDestinoDePrueba && url.port && url.port !== "80" && url.port !== "443") {
    throw new Rechazo("PUERTO");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  const literal = isIP(host);
  let direcciones: DireccionResuelta[];
  if (literal) {
    direcciones = [{ address: host, family: literal }];
  } else {
    try {
      direcciones = await (deps.resolver ?? resolverPorDefecto)(host);
    } catch {
      throw new Rechazo("DNS");
    }
    if (direcciones.length === 0) throw new Rechazo("DNS");
  }

  // Basta UNA dirección interna para rechazar: no se elige "la buena".
  const bloqueada = direcciones.some((d) => {
    if (deps.permitirDestinoDePrueba && (d.address === "127.0.0.1" || d.address === "::1")) return false;
    return esDireccionBloqueada(d.address);
  });
  if (bloqueada) throw new Rechazo("DIRECCION_BLOQUEADA");
  return direcciones[0];
}

/** `lookup` que siempre devuelve la IP ya validada: la conexión no vuelve a resolver. */
function lookupFijo(destino: DireccionResuelta): LookupFunction {
  return ((_host: string, opciones: { all?: boolean }, callback: (...args: unknown[]) => void) => {
    if (opciones?.all) callback(null, [{ address: destino.address, family: destino.family }]);
    else callback(null, destino.address, destino.family);
  }) as unknown as LookupFunction;
}

function pedir(url: URL, destino: DireccionResuelta, senal: AbortSignal): Promise<IncomingMessage> {
  const cliente = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = cliente.request(
      url,
      {
        method: "GET",
        lookup: lookupFijo(destino),
        agent: false,
        signal: senal,
        // Nada del agente sale: ni cookies, ni Authorization, ni Referer.
        headers: { "User-Agent": "KariaImageProxy/1.0", Accept: "image/*" },
      },
      resolve,
    );
    req.on("error", reject);
    req.end();
  });
}

async function leerCuerpo(res: IncomingMessage, maximo: number): Promise<Buffer> {
  const partes: Buffer[] = [];
  let total = 0;
  for await (const parte of res) {
    const buf = parte as Buffer;
    total += buf.length;
    if (total > maximo) {
      res.destroy();
      throw new Rechazo("DEMASIADO_GRANDE");
    }
    partes.push(buf);
  }
  return Buffer.concat(partes);
}

async function descargar(urlInicial: string, deps: DependenciasProxy, senal: AbortSignal): Promise<Buffer> {
  const maximo = deps.bytesMaximos ?? BYTES_MAXIMOS;
  let url: URL;
  try {
    url = new URL(urlInicial);
  } catch {
    throw new Rechazo("ESQUEMA");
  }

  for (let salto = 0; ; salto += 1) {
    const destino = await validarDestino(url, deps);
    const res = await pedir(url, destino, senal);
    const estado = res.statusCode ?? 0;

    if (estado >= 300 && estado < 400 && res.headers.location) {
      res.resume();
      if (salto >= MAX_REDIRECCIONES) throw new Rechazo("DEMASIADAS_REDIRECCIONES");
      try {
        url = new URL(res.headers.location, url);
      } catch {
        throw new Rechazo("ESQUEMA");
      }
      continue;
    }
    if (estado !== 200) {
      res.resume();
      throw new Rechazo("ESTADO_HTTP");
    }

    const tipo = (res.headers["content-type"] ?? "").split(";")[0].trim().toLowerCase();
    if (!TIPOS_ADMITIDOS.has(tipo)) {
      res.resume();
      throw new Rechazo("TIPO_NO_ADMITIDO");
    }
    const declarado = Number(res.headers["content-length"]);
    if (Number.isFinite(declarado) && declarado > maximo) {
      res.destroy();
      throw new Rechazo("DEMASIADO_GRANDE");
    }
    return leerCuerpo(res, maximo);
  }
}

/** Nunca lanza: cualquier problema es un rechazo con motivo (que va al log, no al navegador). */
export async function descargarImagenSegura(url: string, deps: DependenciasProxy = {}): Promise<ResultadoProxy> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), deps.tiempoMaximoMs ?? TIEMPO_MAXIMO_MS);
  try {
    const cuerpo = await descargar(url, deps, control.signal);
    if (!esImagenPorBytes(cuerpo)) return { ok: false, motivo: "TIPO_NO_ADMITIDO" };
    try {
      const { default: sharp } = await import("sharp");
      const webp = await sharp(cuerpo, { limitInputPixels: MAX_PIXELES, animated: false })
        .rotate()
        .webp({ quality: 80 })
        .toBuffer();
      return { ok: true, webp };
    } catch {
      return { ok: false, motivo: "IMAGEN_INVALIDA" };
    }
  } catch (err) {
    if (err instanceof Rechazo) return { ok: false, motivo: err.motivo };
    if (control.signal.aborted) return { ok: false, motivo: "TIEMPO_EXCEDIDO" };
    return { ok: false, motivo: "ESTADO_HTTP" };
  } finally {
    clearTimeout(reloj);
  }
}
