// Envoltorio de ImapFlow. Es el único archivo del proyecto que importa esa
// librería: ningún tipo ni código de error suyo cruza este límite (principio
// IV de la constitución — integraciones reemplazables).
//
// Todo lo que sale de acá son tipos propios y CodigoErrorCorreo.
import { ImapFlow } from "imapflow";
import type { ConexionCorreoDescifrada } from "../configuracion";
import { traducirErrorCorreo, type CodigoErrorCorreo } from "../errores";

/** Ninguna operación contra un servidor de correo puede colgar el ciclo. */
export const TIMEOUT_MS = 15_000;

/** Carpeta que se lee. Carpetas adicionales quedan fuera de alcance (ver spec, Assumptions). */
export const CARPETA = "INBOX";

export class ErrorCorreo extends Error {
  readonly codigo: CodigoErrorCorreo;

  constructor(codigo: CodigoErrorCorreo, causa?: unknown) {
    super(`[correo] ${codigo}`);
    this.name = "ErrorCorreo";
    this.codigo = codigo;
    this.cause = causa;
  }
}

/** Un correo tal como se lee del buzón, antes de normalizarlo. */
export interface CorreoCrudo {
  uid: number;
  /** Mensaje completo en bruto (cabeceras + cuerpo), para que mailparser lo procese. */
  fuente: Buffer;
}

function construirCliente(conexion: ConexionCorreoDescifrada): ImapFlow {
  return new ImapFlow({
    host: conexion.servidor,
    port: conexion.puerto,
    secure: conexion.seguridad === "SSL_TLS",
    // STARTTLS: se conecta en claro y se promueve. `NINGUNA` lo desactiva del
    // todo — lo permitimos porque algunos servidores internos lo exigen, pero
    // el formulario lo muestra como "Sin cifrado" a propósito.
    ...(conexion.seguridad === "STARTTLS" ? { requireTLS: true } : {}),
    ...(conexion.seguridad === "NINGUNA" ? { ignoreTLS: true } : {}),
    auth: { user: conexion.usuario, pass: conexion.password },
    // El logger de ImapFlow imprime el diálogo IMAP completo, que incluye
    // cabeceras y fragmentos de los correos. Apagado a propósito.
    logger: false,
    socketTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    connectionTimeout: TIMEOUT_MS,
  });
}

/**
 * Abre la conexión, ejecuta `trabajo` con el buzón abierto y cierra siempre,
 * incluso si `trabajo` lanza. Cualquier fallo sale como `ErrorCorreo`.
 */
async function conBuzonAbierto<T>(
  conexion: ConexionCorreoDescifrada,
  trabajo: (cliente: ImapFlow) => Promise<T>,
): Promise<T> {
  const cliente = construirCliente(conexion);

  try {
    await cliente.connect();
  } catch (err) {
    throw new ErrorCorreo(traducirErrorCorreo(err), err);
  }

  try {
    const bloqueo = await cliente.getMailboxLock(CARPETA).catch((err) => {
      throw new ErrorCorreo("BUZON_INACCESIBLE", err);
    });
    try {
      return await trabajo(cliente);
    } finally {
      bloqueo.release();
    }
  } catch (err) {
    if (err instanceof ErrorCorreo) throw err;
    throw new ErrorCorreo(traducirErrorCorreo(err), err);
  } finally {
    // `logout` puede fallar si el socket ya se cayó; cerrar igual.
    await cliente.logout().catch(() => cliente.close());
  }
}

/** Prueba de conexión: autenticar y abrir la bandeja. No lee ningún correo. */
export async function verificarAcceso(conexion: ConexionCorreoDescifrada): Promise<void> {
  await conBuzonAbierto(conexion, async () => undefined);
}

/**
 * UID más alto de la bandeja en este momento. Se usa para anclar la marca de
 * lectura al activar un buzón, de modo que el historial previo de la casilla
 * no entre al CRM (FR-023).
 */
export async function obtenerPosicionActual(
  conexion: ConexionCorreoDescifrada,
): Promise<{ uidValidity: bigint; ultimoUid: bigint }> {
  return conBuzonAbierto(conexion, async (cliente) => {
    const buzon = cliente.mailbox;
    if (typeof buzon === "boolean") throw new ErrorCorreo("BUZON_INACCESIBLE");

    // `uidNext` es el UID que recibirá el PRÓXIMO correo: el último ya
    // existente es uidNext - 1. Usarlo evita una búsqueda sobre toda la
    // bandeja solo para saber dónde empezar.
    const ultimoUid = BigInt(buzon.uidNext ?? 1) - BigInt(1);
    return {
      uidValidity: BigInt(buzon.uidValidity ?? 0),
      ultimoUid: ultimoUid < BigInt(0) ? BigInt(0) : ultimoUid,
    };
  });
}

export interface LecturaBuzon {
  uidValidity: bigint;
  correos: CorreoCrudo[];
  /** true si quedaron correos sin leer por el tope de este ciclo. */
  hayMas: boolean;
}

/**
 * Lee los correos con UID mayor a `desdeUid`, en orden ascendente y hasta
 * `tope` por ciclo.
 *
 * El tope existe para que una casilla con mil correos sin leer no monopolice
 * el ciclo del worker: el resto entra en los ciclos siguientes, en orden.
 */
export async function leerCorreosNuevos(
  conexion: ConexionCorreoDescifrada,
  desdeUid: bigint | null,
  tope: number,
): Promise<LecturaBuzon> {
  return conBuzonAbierto(conexion, async (cliente) => {
    const buzon = cliente.mailbox;
    if (typeof buzon === "boolean") throw new ErrorCorreo("BUZON_INACCESIBLE");

    const uidValidity = BigInt(buzon.uidValidity ?? 0);
    const desde = desdeUid === null ? BigInt(1) : desdeUid + BigInt(1);
    const correos: CorreoCrudo[] = [];

    // `uid: true` hace que el rango se interprete como UIDs y no como números
    // de secuencia, que cambian cuando alguien borra un correo desde su
    // cliente de escritorio.
    for await (const mensaje of cliente.fetch(
      `${desde}:*`,
      { uid: true, source: true },
      { uid: true },
    )) {
      // El rango `n:*` de IMAP siempre devuelve al menos un mensaje, incluso
      // cuando no hay ninguno con UID >= n: devuelve el último de la bandeja.
      // Sin este filtro, el último correo se reprocesaría en cada ciclo.
      if (BigInt(mensaje.uid) < desde) continue;
      if (!mensaje.source) continue;

      correos.push({ uid: mensaje.uid, fuente: mensaje.source });
      if (correos.length >= tope) break;
    }

    correos.sort((a, b) => a.uid - b.uid);
    return { uidValidity, correos, hayMas: correos.length >= tope };
  });
}
