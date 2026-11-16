// Presets de proveedores de correo.
//
// IMPORTANTE: esto NO es inicio de sesión con Google o Microsoft. Son atajos
// que completan servidor, puerto y seguridad por el negocio, para que no tenga
// que buscar esos datos en la ayuda de su proveedor. La autenticación sigue
// siendo usuario + contraseña contra IMAP/SMTP, como define el spec 034.
import type { SeguridadCorreo } from "./tipos";

export type ClaveProveedor = "gmail" | "outlook" | "otro";

export interface AjustesConexion {
  servidor: string;
  puerto: number;
  seguridad: SeguridadCorreo;
}

export interface ProveedorCorreo {
  clave: ClaveProveedor;
  nombre: string;
  descripcion: string;
  /** Dominios por los que se autodetecta el proveedor desde la dirección. */
  dominios: string[];
  entrada?: AjustesConexion;
  salida?: AjustesConexion;
  /** Lo que el negocio necesita saber ANTES de intentar conectar. */
  aviso?: string;
}

export const PROVEEDORES: ProveedorCorreo[] = [
  {
    clave: "gmail",
    nombre: "Gmail",
    descripcion: "Google Workspace o una cuenta @gmail.com.",
    dominios: ["gmail.com", "googlemail.com"],
    entrada: { servidor: "imap.gmail.com", puerto: 993, seguridad: "SSL_TLS" },
    // 587 + STARTTLS y no 465 + SSL/TLS: los dos son válidos para Gmail, pero
    // 587 es el puerto de envío estándar (RFC 6409) y el que menos bloquean
    // los proveedores de hosting. Visto en producción: 465 dio "Connection
    // timeout" y 587 contestó desde el mismo contenedor.
    salida: { servidor: "smtp.gmail.com", puerto: 587, seguridad: "STARTTLS" },
    aviso:
      "Google no acepta tu contraseña normal: necesitás una contraseña de aplicación, y para generarla tenés que tener la verificación en dos pasos activada.",
  },
  {
    clave: "outlook",
    nombre: "Outlook",
    descripcion: "Microsoft 365 o una cuenta @outlook.com.",
    dominios: ["outlook.com", "hotmail.com", "live.com", "msn.com"],
    entrada: { servidor: "outlook.office365.com", puerto: 993, seguridad: "SSL_TLS" },
    salida: { servidor: "smtp.office365.com", puerto: 587, seguridad: "STARTTLS" },
    aviso:
      "Microsoft desactivó el acceso con contraseña en buena parte de las cuentas. Si la prueba falla con las credenciales correctas, tu administrador tiene que habilitar IMAP y SMTP AUTH para este buzón.",
  },
  {
    clave: "otro",
    nombre: "Otro proveedor",
    descripcion: "Cargá los datos IMAP y SMTP a mano.",
    dominios: [],
  },
];

export function obtenerProveedor(clave: ClaveProveedor): ProveedorCorreo {
  return PROVEEDORES.find((p) => p.clave === clave) ?? PROVEEDORES[PROVEEDORES.length - 1];
}

/**
 * Deduce el proveedor desde la dirección.
 *
 * Sirve para preseleccionar la tarjeta mientras el negocio escribe su correo:
 * un dominio propio (ventas@minegocio.com) cae en "otro", que es lo correcto.
 */
export function detectarProveedor(direccion: string): ClaveProveedor {
  const dominio = direccion.trim().toLowerCase().split("@")[1];
  if (!dominio) return "otro";
  const encontrado = PROVEEDORES.find((p) => p.dominios.includes(dominio));
  return encontrado?.clave ?? "otro";
}

// ── Combinaciones de puerto y seguridad ─────────────────────────────────────

/**
 * Avisa cuando el puerto y el tipo de seguridad no se hablan.
 *
 * Es el error más caro de este formulario porque no se parece a un error de
 * configuración: el servidor ni contesta, o responde algo que el cliente no
 * entiende, y el mensaje que llega es un timeout o un "wrong version number"
 * que parecen un problema de red. Visto en producción con Gmail:
 * 587 + SSL/TLS devolvió `ssl3_get_record:wrong version number`, porque el
 * cliente arrancó un handshake TLS contra un puerto que habla texto plano.
 *
 * Devuelve null cuando la combinación es válida o cuando el puerto no es uno
 * de los conocidos (un servidor propio puede usar cualquiera).
 */
export function avisoPuertoSeguridad(
  puerto: number,
  seguridad: SeguridadCorreo,
): string | null {
  // Puertos de TLS implícito: el servidor espera el handshake de entrada.
  if ((puerto === 465 || puerto === 993) && seguridad !== "SSL_TLS") {
    return `El puerto ${puerto} espera SSL/TLS desde el primer byte. Con "${seguridad === "STARTTLS" ? "STARTTLS" : "Sin cifrado"}" la conexión se queda esperando hasta agotar el tiempo.`;
  }

  // Puertos que arrancan en texto plano y recién después promueven a TLS.
  if ((puerto === 587 || puerto === 143 || puerto === 25) && seguridad === "SSL_TLS") {
    return `El puerto ${puerto} arranca sin cifrar y recién después pasa a TLS. Con SSL/TLS vas a ver un error de "wrong version number"; usá STARTTLS.`;
  }

  return null;
}
