// Códigos funcionales del canal de correo.
//
// Ningún texto crudo del servidor IMAP/SMTP llega al navegador: lo que el
// negocio ve es uno de estos códigos y su mensaje en español. El detalle
// técnico queda en el log del servidor. Es lo mismo que ya se hace con los
// errores de Meta (ver src/conversaciones/errores.ts), por dos razones: el
// texto del proveedor viene en el idioma que se le antoja, y filtrarlo al
// cliente expone detalles internos.

export const CODIGOS_ERROR_CORREO = [
  "CREDENCIALES_RECHAZADAS",
  "SERVIDOR_INALCANZABLE",
  "SEGURIDAD_INCOMPATIBLE",
  "TIEMPO_AGOTADO",
  "BUZON_INACCESIBLE",
  "ERROR_DESCONOCIDO",
] as const;

export type CodigoErrorCorreo = (typeof CODIGOS_ERROR_CORREO)[number];

const MENSAJES: Record<CodigoErrorCorreo, string> = {
  CREDENCIALES_RECHAZADAS:
    "El servidor rechazó el usuario o la contraseña. Si tu proveedor exige una contraseña de aplicación, generá una y usala acá.",
  SERVIDOR_INALCANZABLE:
    "No se pudo conectar con el servidor. Revisá el nombre del servidor y el puerto.",
  SEGURIDAD_INCOMPATIBLE:
    "El servidor no aceptó el tipo de seguridad elegido. Probá con otra combinación de puerto y seguridad.",
  TIEMPO_AGOTADO: "El servidor no respondió a tiempo. Puede estar caído o bloqueando la conexión.",
  BUZON_INACCESIBLE:
    "La conexión funcionó pero no se pudo abrir la bandeja de entrada de esa cuenta.",
  ERROR_DESCONOCIDO: "No se pudo completar la operación con el servidor de correo.",
};

export function mensajeErrorCorreo(codigo: CodigoErrorCorreo): string {
  return MENSAJES[codigo];
}

/** Lo que devuelve cada mitad de la prueba de conexión (entrada y salida). */
export interface ResultadoConexion {
  ok: boolean;
  codigo?: CodigoErrorCorreo;
  mensaje?: string;
}

export function conexionOk(): ResultadoConexion {
  return { ok: true };
}

export function conexionFallida(codigo: CodigoErrorCorreo): ResultadoConexion {
  return { ok: false, codigo, mensaje: mensajeErrorCorreo(codigo) };
}

// Fragmentos que aparecen en los errores de ImapFlow y Nodemailer. Se buscan
// en minúsculas sobre `code` + `message` + `responseCode`, en este orden: la
// primera coincidencia gana, así que lo más específico va primero.
const REGLAS: { codigo: CodigoErrorCorreo; señales: string[] }[] = [
  {
    codigo: "CREDENCIALES_RECHAZADAS",
    señales: [
      "eauth",
      "authenticationfailed",
      "authentication failed",
      "invalid credentials",
      "invalid login",
      "login failed",
      "535",
      "534",
      "authenticate",
    ],
  },
  { codigo: "TIEMPO_AGOTADO", señales: ["etimedout", "timeout", "timed out", "econnaborted"] },
  {
    codigo: "SERVIDOR_INALCANZABLE",
    señales: ["enotfound", "econnrefused", "ehostunreach", "enetunreach", "econnreset", "edns"],
  },
  {
    // Señales específicas a propósito: un "tls" suelto aparece en errores que
    // no tienen nada que ver con la seguridad elegida, y mandaría al negocio a
    // cambiar el puerto cuando el problema era otro.
    codigo: "SEGURIDAD_INCOMPATIBLE",
    señales: [
      "wrong version number",
      "ssl routines",
      "self signed",
      "self-signed",
      "unable to verify the first certificate",
      "starttls",
      "eprotocol",
      "err_tls",
    ],
  },
];

/**
 * Traduce cualquier error de ImapFlow o Nodemailer a un código funcional.
 *
 * Deliberadamente tolerante: ante un error que no reconoce devuelve
 * ERROR_DESCONOCIDO en vez de dejar escapar el texto del servidor, que es
 * justo lo que no queremos mostrar.
 */
export function traducirErrorCorreo(error: unknown): CodigoErrorCorreo {
  const e = error as { code?: unknown; message?: unknown; responseCode?: unknown } | null;
  if (!e) return "ERROR_DESCONOCIDO";

  const texto = [e.code, e.message, e.responseCode]
    .filter((v) => v !== undefined && v !== null)
    .join(" ")
    .toLowerCase();

  for (const regla of REGLAS) {
    if (regla.señales.some((s) => texto.includes(s))) return regla.codigo;
  }
  return "ERROR_DESCONOCIDO";
}
