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

/** Presupuesto de almacenamiento indexado por CUENTA, compartido por todos
 *  los agentes de la instancia. Es el límite operativo: la cantidad de
 *  archivos dejó de mandar, solo importa cuánto pesan entre todos. */
export const MAX_PESO_TOTAL_INSTANCIA = 20 * 1024 * 1024;

/** Un solo archivo puede consumir todo el presupuesto de la cuenta, no más.
 *  OpenAI admitiría hasta 512 MB, pero por encima del total no tendría dónde
 *  entrar. */
export const MAX_PESO_DOCUMENTO = MAX_PESO_TOTAL_INSTANCIA;

/** Tope de cordura, NO el límite real: lo que manda es
 *  MAX_PESO_TOTAL_INSTANCIA. Existe solo para que una cuenta con miles de
 *  archivos diminutos no se acerque al techo de 10.000 archivos que OpenAI
 *  impone por vector store. */
export const MAX_DOCUMENTOS_AGENTE = 200;

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
  | "SIN_ESPACIO"
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
  // Genérico: el mensaje que ve el negocio lo arma `validarArchivo`, que sabe
  // cuánto espacio queda. Éste es el fallback de la tabla.
  SIN_ESPACIO: `La documentación de la cuenta no puede superar los ${MAX_PESO_TOTAL_INSTANCIA / 1024 / 1024} MB en total.`,
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

/** Peso legible para mensajes y para la UI. Vive acá porque el texto del
 *  rechazo por falta de espacio lo arma este módulo. */
export function formatearPeso(bytes: number): string {
  if (bytes <= 0) return "0 KB";
  const mb = bytes / 1024 / 1024;
  // Math.max(1, …) para que un archivo de 200 bytes no se muestre como "0 KB".
  if (mb < 0.1) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  // Sin decimal cuando es redondo: "20 MB" y no "20,0 MB".
  return `${mb.toLocaleString("es", { maximumFractionDigits: 1 })} MB`;
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
  pesoAcumuladoInstancia: number,
):
  | { ok: true; extension: ExtensionSoportada; mime: string }
  | { ok: false; motivo: MotivoRechazo; mensaje: string } {
  const rechazo = (motivo: MotivoRechazo) =>
    ({ ok: false, motivo, mensaje: MENSAJE_RECHAZO[motivo] }) as const;

  if (cantidadActual >= MAX_DOCUMENTOS_AGENTE) return rechazo("LIMITE_ALCANZADO");

  const ext = extensionDe(nombre);
  // Las imágenes se chequean antes que el soporte general para poder dar el
  // mensaje específico en vez del genérico de "formato no soportado".
  if (esImagen(ext)) return rechazo("ES_IMAGEN");
  if (!esExtensionSoportada(ext)) return rechazo("EXTENSION_NO_SOPORTADA");
  if (pesoBytes > MAX_PESO_DOCUMENTO) return rechazo("DEMASIADO_PESADO");

  // El espacio se mira al final: un .png que además no entra debe recibir el
  // mensaje de que es una imagen, que es el problema que de verdad tiene.
  const disponible = MAX_PESO_TOTAL_INSTANCIA - pesoAcumuladoInstancia;
  if (pesoBytes > disponible) {
    return {
      ok: false,
      motivo: "SIN_ESPACIO",
      mensaje:
        disponible <= 0
          ? `La cuenta ya usa los ${formatearPeso(MAX_PESO_TOTAL_INSTANCIA)} de documentación disponibles. Eliminá un documento para subir otro.`
          : `No hay espacio: el archivo pesa ${formatearPeso(pesoBytes)} y quedan ${formatearPeso(disponible)} de los ${formatearPeso(MAX_PESO_TOTAL_INSTANCIA)} de la cuenta.`,
    };
  }

  return { ok: true, extension: ext, mime: MIME_POR_EXTENSION[ext] };
}
