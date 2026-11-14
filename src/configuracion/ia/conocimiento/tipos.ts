// 032 — Base de conocimiento FAQ del agente.
//
// El negocio sube manuales, políticas de envío, preguntas frecuentes. El
// agente los usa para RESPONDER, nunca para decidir qué hacer: son
// información de referencia, no instrucciones. Esa distinción se sostiene en
// el texto de la capa (ver src/ai/contexto/capas/conocimiento.ts).

export const MAX_DOCUMENTOS_FAQ = 3;

/** 5 MB. Un manual de texto nunca pesa esto; el tope existe para que un PDF
 *  con imágenes no llegue a la extracción y se coma el worker. */
export const MAX_PESO_DOCUMENTO = 5 * 1024 * 1024;

export const MIMES_DOCUMENTO_FAQ = ["application/pdf", "text/plain"] as const;
export type MimeDocumentoFaq = (typeof MIMES_DOCUMENTO_FAQ)[number];

// Presupuesto. El límite de contexto del agente son 4000 tokens por omisión y
// ahí entra TODO: prompt, catálogo, capas y los mensajes de la conversación.
// 2000 caracteres por documento (~500 tokens) y 5000 del bloque completo
// (~1250) es lo máximo que se puede ceder sin quedarse sin conversación.
export const MAX_CARACTERES_DOCUMENTO = 2000;
export const MAX_CARACTERES_BLOQUE = 5000;

/** Por debajo de esto no hay nada que destilar: PDF escaneado, vacío o ilegible. */
export const MIN_CARACTERES_EXTRAIDOS = 50;

export type EstadoDocumentoFaq =
  /** Cargado y legible, pero todavía sin entrenar. NO entra al contexto:
   *  el texto crudo trae basura de maquetación y no cabe en el presupuesto.
   *  Hasta que no se entrene, el agente no sabe que este documento existe. */
  | "SIN_ENTRENAR"
  /** Entrenado: el texto quedó en el formato compacto que consume el agente. */
  | "LISTO"
  /** Se intentó entrenar y falló. Quedó el texto crudo recortado para que una
   *  persona lo corrija a mano; entra al contexto, pero avisado. */
  | "REVISAR";

export const ETIQUETA_ESTADO_DOCUMENTO: Record<EstadoDocumentoFaq, string> = {
  SIN_ENTRENAR: "Sin entrenar",
  LISTO: "Entrenado",
  REVISAR: "Revisar",
};

export interface DocumentoFaq {
  id: string;
  /** Nombre del archivo tal como lo subió el negocio. */
  nombre: string;
  mime: MimeDocumentoFaq;
  pesoBytes: number;
  /** Clave en el storage — permite volver a descargar el original. El modelo
   *  nunca lo lee: solo ve `contenido`. */
  storageKey: string;
  subidoEn: string; // ISO UTC
  /** Desactivado sigue cargado pero no entra al contexto. */
  activo: boolean;
  estado: EstadoDocumentoFaq;
  /** El texto destilado y acotado. Es lo ÚNICO que llega al modelo, y es
   *  editable: si el destilado se equivocó, el negocio lo corrige. */
  contenido: string;
  /** Caracteres del texto extraído antes de destilar — para que la UI pueda
   *  mostrar cuánto se comprimió y el negocio juzgue si se perdió algo. */
  caracteresOriginal: number;
}

/** Por qué un archivo no se pudo aceptar. El negocio tiene que entenderlo sin
 *  saber qué es un OCR, así que cada motivo trae su explicación. */
export type MotivoRechazo =
  | "MIME_NO_SOPORTADO"
  | "DEMASIADO_PESADO"
  | "LIMITE_ALCANZADO"
  | "SIN_TEXTO"
  | "ILEGIBLE";

export const MENSAJE_RECHAZO: Record<MotivoRechazo, string> = {
  MIME_NO_SOPORTADO: "Solo se aceptan archivos PDF o TXT.",
  DEMASIADO_PESADO: `El archivo supera los ${MAX_PESO_DOCUMENTO / 1024 / 1024} MB.`,
  LIMITE_ALCANZADO: `Ya hay ${MAX_DOCUMENTOS_FAQ} documentos cargados. Eliminá uno para subir otro.`,
  SIN_TEXTO:
    "No se pudo leer texto del archivo. Si es un PDF escaneado (una foto de las páginas), el agente no puede leerlo: subí una versión con texto seleccionable.",
  ILEGIBLE: "El archivo está dañado o no se pudo abrir.",
};

/** Qué documentos llegan efectivamente al agente. Un documento sin entrenar
 *  nunca entra: ese es justamente el sentido del botón "Entrenar" — hasta
 *  apretarlo, el archivo está cargado pero el agente no lo usa. */
export function entraAlContexto(doc: Pick<DocumentoFaq, "activo" | "estado" | "contenido">): boolean {
  return doc.activo && doc.estado !== "SIN_ENTRENAR" && doc.contenido.trim().length > 0;
}

/** Documentos que el botón "Entrenar" tiene para procesar. */
export function necesitaEntrenamiento(doc: Pick<DocumentoFaq, "estado">): boolean {
  return doc.estado === "SIN_ENTRENAR";
}
