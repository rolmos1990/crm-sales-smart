// 033 — Documentación del comercio indexada en el vector store de OpenAI.
//
// Reemplaza a la base de conocimiento FAQ de la 032: los archivos ya no se
// resumen con IA ni se inyectan en el prompt. Se indexan íntegros y el agente
// los consulta bajo demanda con `buscar_en_documentacion`.
//
// Este archivo es la única fuente de qué se acepta y cuáles son los límites.
// La UI deriva su `accept` de acá para que cliente y servidor no se separen.

/** Formatos que OpenAI indexa en un vector store. La lista es cerrada y la
 *  define el proveedor, no Karia: agregar uno que no esté acá hace que la
 *  indexación falle del lado de OpenAI, no acá.
 *  https://developers.openai.com/api/docs/guides/tools-file-search */
export const EXTENSIONES_SOPORTADAS = [
  ".pdf", ".doc", ".docx", ".pptx",
  ".txt", ".md", ".json", ".html", ".css", ".tex",
  ".c", ".cpp", ".cs", ".go", ".java", ".js", ".php", ".py", ".rb", ".sh", ".ts",
] as const;

export type ExtensionSoportada = (typeof EXTENSIONES_SOPORTADAS)[number];

/** Las imágenes NO son un olvido: los vector stores solo indexan texto, así
 *  que un PNG subido acá nunca sería consultable. Se rechazan con un mensaje
 *  propio en vez de dejar al negocio con un archivo que no sirve para nada. */
export const EXTENSIONES_IMAGEN_RECHAZADAS = [
  ".png", ".svg", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".heic",
] as const;

/** MIME con el que se sube cada formato a OpenAI. El `type` que manda el
 *  navegador no es confiable (manda octet-stream para .md, vacío para .txt),
 *  así que el tipo se decide por extensión y esto es la tabla de verdad. */
export const MIME_POR_EXTENSION: Record<ExtensionSoportada, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".json": "application/json",
  ".html": "text/html",
  ".css": "text/css",
  ".tex": "text/x-tex",
  ".c": "text/x-c",
  ".cpp": "text/x-c++",
  ".cs": "text/x-csharp",
  ".go": "text/x-golang",
  ".java": "text/x-java",
  ".js": "text/javascript",
  ".php": "text/x-php",
  ".py": "text/x-python",
  ".rb": "text/x-ruby",
  ".sh": "application/x-sh",
  ".ts": "application/typescript",
};

/** Lo que va en el `accept` del input de archivo. Derivado, nunca escrito a
 *  mano en el componente: si se agrega un formato acá, la UI lo acepta sola. */
export const ACCEPT_INPUT_ARCHIVO = EXTENSIONES_SOPORTADAS.join(",");

// ─── Límites ────────────────────────────────────────────────────────────────

/** El tope anterior era 3, y existía porque los documentos ocupaban
 *  presupuesto de contexto en CADA respuesta. Esa razón desapareció: ahora el
 *  límite es de cordura y de costo. 20 × ~500 agentes ≈ el techo de 10.000
 *  archivos que OpenAI impone por vector store. */
export const MAX_DOCUMENTOS_AGENTE = 20;

/** OpenAI admite hasta 512 MB por archivo. 25 MB es lo razonable para
 *  documentación comercial y evita que una subida bloquee el request. */
export const MAX_PESO_DOCUMENTO = 25 * 1024 * 1024;

/** Cuántos fragmentos pide la búsqueda. Menos fragmentos = menos tokens por
 *  consulta, y 5 alcanza de sobra para una política o un FAQ. */
export const MAX_RESULTADOS_BUSQUEDA = 5;

/** El tool loop del agente permite 10 iteraciones (MAX_ITERACIONES_TOOL): una
 *  búsqueda colgada no puede comerse el turno. Al vencer se degrada a "no
 *  encontré nada" en vez de romper la respuesta al cliente. */
export const TIMEOUT_BUSQUEDA_MS = 15_000;

/** Tarifa de OpenAI por llamada al hosted tool `file_search`: USD 2,50 por
 *  cada 1.000 llamadas, por encima de los tokens del modelo. Se suma al
 *  `costoEstimado` de UsoIA porque si no, el costo registrado sería menor que
 *  el real. */
export const COSTO_POR_LLAMADA_FILE_SEARCH = 0.0025;

/** Por debajo de esto un PDF no tiene texto que indexar: es un escaneado. */
export const MIN_CARACTERES_EXTRAIDOS = 50;

// ─── Estados ────────────────────────────────────────────────────────────────

export type EstadoDocumento = "INDEXANDO" | "LISTO" | "ERROR";

export const ETIQUETA_ESTADO_DOCUMENTO: Record<EstadoDocumento, string> = {
  INDEXANDO: "Indexando",
  LISTO: "Listo",
  ERROR: "Error",
};

// ─── Rechazos ───────────────────────────────────────────────────────────────

export type MotivoRechazo =
  | "EXTENSION_NO_SOPORTADA"
  | "ES_IMAGEN"
  | "DEMASIADO_PESADO"
  | "LIMITE_ALCANZADO"
  | "PDF_SIN_TEXTO"
  | "ILEGIBLE"
  | "NO_CONFIGURADO";

export const MENSAJE_RECHAZO: Record<MotivoRechazo, string> = {
  EXTENSION_NO_SOPORTADA:
    "Ese formato no se puede indexar. Se aceptan PDF, Word, PowerPoint, TXT, Markdown, JSON, HTML y archivos de código.",
  // El pedido original incluía PNG y SVG; no es una limitación de Karia sino
  // del servicio de indexación, y el mensaje lo dice sin rodeos.
  ES_IMAGEN:
    "Las imágenes no se pueden indexar como documentación. Subí el contenido como PDF, Word o TXT.",
  DEMASIADO_PESADO: `El archivo supera los ${MAX_PESO_DOCUMENTO / 1024 / 1024} MB.`,
  LIMITE_ALCANZADO: `Ya hay ${MAX_DOCUMENTOS_AGENTE} documentos cargados. Eliminá uno para subir otro.`,
  PDF_SIN_TEXTO:
    "No se pudo leer texto del PDF. Si es un escaneado (una foto de las páginas), no se puede indexar: subí una versión con texto seleccionable.",
  ILEGIBLE: "El archivo está dañado o no se pudo abrir.",
  NO_CONFIGURADO: "La documentación del agente no está habilitada en este entorno.",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extensión en minúsculas, con el punto. Cadena vacía si el nombre no tiene. */
export function extensionDe(nombreArchivo: string): string {
  const punto = nombreArchivo.lastIndexOf(".");
  if (punto <= 0) return "";
  return nombreArchivo.slice(punto).toLowerCase();
}

export function esExtensionSoportada(ext: string): ext is ExtensionSoportada {
  return (EXTENSIONES_SOPORTADAS as readonly string[]).includes(ext);
}

export function esImagen(ext: string): boolean {
  return (EXTENSIONES_IMAGEN_RECHAZADAS as readonly string[]).includes(ext);
}

/**
 * Decide si un archivo se acepta, antes de tocar el storage o a OpenAI.
 * Se usa en el cliente para dar feedback inmediato Y en el server action, que
 * es el boundary de verdad: el cliente puede saltearse (FR-003).
 */
export function validarArchivo(
  nombre: string,
  pesoBytes: number,
  cantidadActual: number,
): { ok: true; extension: ExtensionSoportada; mime: string } | { ok: false; motivo: MotivoRechazo } {
  if (cantidadActual >= MAX_DOCUMENTOS_AGENTE) return { ok: false, motivo: "LIMITE_ALCANZADO" };

  const ext = extensionDe(nombre);
  // Las imágenes se chequean antes que el soporte general para poder dar el
  // mensaje específico en vez del genérico de "formato no soportado".
  if (esImagen(ext)) return { ok: false, motivo: "ES_IMAGEN" };
  if (!esExtensionSoportada(ext)) return { ok: false, motivo: "EXTENSION_NO_SOPORTADA" };
  if (pesoBytes > MAX_PESO_DOCUMENTO) return { ok: false, motivo: "DEMASIADO_PESADO" };

  return { ok: true, extension: ext, mime: MIME_POR_EXTENSION[ext] };
}
