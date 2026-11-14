// 032 — Archivo → texto plano. Sin IA y sin red: es la primera puerta, y la
// que decide si el archivo sirve. Un PDF escaneado (fotos de las páginas) no
// tiene texto que extraer y se rechaza acá, antes de gastar una llamada al
// modelo y antes de que el negocio crea que el agente lo va a usar.

import { MIN_CARACTERES_EXTRAIDOS, type MimeDocumentoFaq, type MotivoRechazo } from "./tipos";

export type ResultadoExtraccion =
  | { ok: true; texto: string }
  | { ok: false; motivo: Extract<MotivoRechazo, "SIN_TEXTO" | "ILEGIBLE"> };

/**
 * Normaliza el texto crudo: los PDFs vienen con saltos de línea por cada
 * línea visual, espacios dobles y páginas separadas por saltos triples. Sin
 * esto el destilado gasta tokens en basura de maquetación.
 */
export function normalizarTexto(crudo: string): string {
  return crudo
    .replace(/\r\n?/g, "\n")
    // Ligaduras y comillas tipográficas que los PDFs meten y los modelos
    // tokenizan peor que sus equivalentes simples.
    .replace(/­/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[ \t ]+/g, " ")
    // Tres o más saltos = separación de secciones; se deja en dos.
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

async function extraerDePdf(datos: Uint8Array): Promise<string> {
  // Import diferido: unpdf arrastra pdfjs y no tiene sentido cargarlo en cada
  // request que no suba un PDF.
  const { extractText, getDocumentProxy } = await import("unpdf");
  const documento = await getDocumentProxy(datos);
  const { text } = await extractText(documento, { mergePages: true });
  return Array.isArray(text) ? text.join("\n\n") : text;
}

export async function extraerTexto(datos: Uint8Array, mime: MimeDocumentoFaq): Promise<ResultadoExtraccion> {
  let crudo: string;

  try {
    crudo = mime === "application/pdf" ? await extraerDePdf(datos) : new TextDecoder("utf-8").decode(datos);
  } catch (err) {
    console.error("[ConocimientoFAQ] No se pudo abrir el archivo:", err);
    return { ok: false, motivo: "ILEGIBLE" };
  }

  const texto = normalizarTexto(crudo);

  // El caso típico: un PDF escaneado devuelve cadena vacía o cuatro caracteres
  // de metadatos. Rechazarlo acá con un motivo claro es mucho mejor que dejar
  // al negocio creyendo que el agente ya sabe lo que dice ese manual.
  if (texto.length < MIN_CARACTERES_EXTRAIDOS) return { ok: false, motivo: "SIN_TEXTO" };

  return { ok: true, texto };
}
