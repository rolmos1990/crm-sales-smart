// Referencias `@tipo:clave` dentro de los textos de configuración del agente
// (instrucciones y formato de respuestas guía). El token se guarda crudo en la
// base y se resuelve en cada armado de prompt: así editar la plantilla
// referenciada cambia lo que dice el agente, sin tocar la instrucción.

export const TIPOS_REFERENCIA = ["plantilla", "usuario", "producto"] as const;

export type TipoReferencia = (typeof TIPOS_REFERENCIA)[number];

export const ETIQUETA_TIPO_REFERENCIA: Record<TipoReferencia, string> = {
  plantilla: "Plantilla",
  usuario: "Usuario",
  producto: "Producto",
};

export const ICONO_TIPO_REFERENCIA: Record<TipoReferencia, string> = {
  plantilla: "📄",
  usuario: "🧑‍💼",
  producto: "📦",
};

/** Una referencia tal como aparece escrita en el texto, antes de resolverse. */
export interface Referencia {
  tipo: TipoReferencia;
  /** Slug/alias que identifica al registro dentro de la instancia. */
  clave: string;
  /** El token literal, p.ej. "@plantilla:metodos_envios". */
  token: string;
}

/** Una referencia que encontró exactamente un registro vivo en la instancia. */
export interface ReferenciaResuelta extends Referencia {
  /** Nombre legible — es lo que reemplaza al token dentro de la frase. */
  etiqueta: string;
  /** Texto que se inyecta en el bloque de contenido referenciado del prompt. */
  contenido: string;
}

/** Candidato del menú de autocompletado. */
export interface OpcionReferencia {
  tipo: TipoReferencia;
  clave: string;
  token: string;
  etiqueta: string;
  detalle: string;
}
