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
    salida: { servidor: "smtp.gmail.com", puerto: 465, seguridad: "SSL_TLS" },
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
