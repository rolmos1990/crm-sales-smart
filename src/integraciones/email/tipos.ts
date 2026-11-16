// Tipos y constantes del canal de correo que TAMBIÉN usa el navegador.
//
// Vive separado de configuracion.ts a propósito: ese módulo cifra y descifra
// credenciales con `node:crypto`, y si un componente cliente lo importa —aunque
// sea solo por una etiqueta— webpack arrastra el cifrado al bundle del
// navegador y el build falla. El límite es el del principio I de la
// constitución: los componentes React no tocan módulos de servidor.
//
// Regla: acá NO va nada que importe de "@/shared/db/prisma", de
// "@/shared/lib/cifrado-tokens" ni de ningún módulo de Node.

// errores.ts tampoco importa nada de Node: es seguro para el cliente.
import type { CodigoErrorCorreo } from "./errores";

export const CANAL_EMAIL = "email";

export type SeguridadCorreo = "SSL_TLS" | "STARTTLS" | "NINGUNA";
export type AgrupacionCorreo = "POR_REMITENTE" | "POR_HILO";

export interface ConexionCorreoAlmacenada {
  servidor: string;
  puerto: number;
  seguridad: SeguridadCorreo;
  usuario: string;
  /** Resultado de cifrarToken(). Nunca el valor plano. */
  passwordCifrada: string;
}

export interface ConfiguracionBuzonAlmacenada {
  entrada: ConexionCorreoAlmacenada;
  salida: ConexionCorreoAlmacenada & { nombreRemitente?: string };
  recepcion: {
    agrupacion: AgrupacionCorreo;
    crearContactosAutomaticamente: boolean;
  };
}

/** Credenciales ya descifradas. Solo existe en memoria del servidor. */
export interface ConexionCorreoDescifrada {
  servidor: string;
  puerto: number;
  seguridad: SeguridadCorreo;
  usuario: string;
  password: string;
  nombreRemitente?: string;
}

/** Lo único que puede viajar al navegador. */
export interface BuzonParaCliente {
  id: string;
  nombre: string;
  direccion: string;
  activa: boolean;
  entrada: Omit<ConexionCorreoAlmacenada, "passwordCifrada">;
  salida: Omit<ConexionCorreoAlmacenada, "passwordCifrada"> & { nombreRemitente?: string };
  tieneCredenciales: boolean;
  recepcion: ConfiguracionBuzonAlmacenada["recepcion"];
  pipelineId: string | null;
  stageId: string | null;
  stageIdRespuestaAutomatica: string | null;
  estado: {
    ultimaLecturaOkEn: Date | null;
    errorCodigo: CodigoErrorCorreo | null;
    errorMensaje: string | null;
  };
}

/** Datos de conexión tal como llegan del formulario, sin cifrar. */
export interface ConexionCorreoEntrada {
  servidor: string;
  puerto: number;
  seguridad: SeguridadCorreo;
  usuario: string;
  password?: string;
  nombreRemitente?: string;
}

// ── Puertos sugeridos ───────────────────────────────────────────────────────
// Solo ayuda del formulario; el usuario puede cambiarlos.

export const PUERTOS_SUGERIDOS: Record<SeguridadCorreo, { entrada: number; salida: number }> = {
  SSL_TLS: { entrada: 993, salida: 465 },
  STARTTLS: { entrada: 143, salida: 587 },
  NINGUNA: { entrada: 143, salida: 25 },
};

export const ETIQUETAS_SEGURIDAD: Record<SeguridadCorreo, string> = {
  SSL_TLS: "SSL/TLS",
  STARTTLS: "STARTTLS",
  NINGUNA: "Sin cifrado",
};

export const ETIQUETAS_AGRUPACION: Record<AgrupacionCorreo, string> = {
  POR_REMITENTE: "Agrupar por remitente",
  POR_HILO: "Una conversación por hilo",
};
