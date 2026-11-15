// 033 — Verificación previa de PDF. Lo único que sobrevive de la extracción de
// texto de la 032, y por una razón muy concreta.
//
// Ya no hace falta extraer texto para el agente: OpenAI parsea el archivo al
// indexarlo. Pero un PDF escaneado (fotos de las páginas) no tiene texto que
// indexar, y OpenAI lo aceptaría igual: lo indexaría vacío, lo cobraría, y el
// negocio descubriría recién semanas después que el agente nunca encontró nada
// ahí. Detectarlo acá cuesta una llamada a `unpdf` (ya es dependencia) y
// produce un mensaje que explica exactamente qué pasó y qué hacer.
//
// Solo aplica a PDF. Para los demás formatos no se intenta nada: un .docx o un
// .md no tienen la falla equivalente.

import { MIN_CARACTERES_EXTRAIDOS } from "./tipos";

export type ResultadoVerificacionPdf =
  | { ok: true }
  | { ok: false; motivo: "PDF_SIN_TEXTO" | "ILEGIBLE" };

/**
 * ¿Este PDF tiene texto extraíble? — FR-004.
 *
 * No devuelve el texto: no lo necesita nadie. Solo responde si el archivo
 * sirve para indexar.
 */
export async function verificarPdfTieneTexto(datos: Uint8Array): Promise<ResultadoVerificacionPdf> {
  let crudo: string;

  try {
    // Import diferido: unpdf arrastra pdfjs y no tiene sentido cargarlo en
    // cada request que no suba un PDF.
    const { extractText, getDocumentProxy } = await import("unpdf");
    const documento = await getDocumentProxy(datos);
    const { text } = await extractText(documento, { mergePages: true });
    crudo = Array.isArray(text) ? text.join("\n") : text;
  } catch (err) {
    console.error("[Documentacion] No se pudo abrir el PDF:", err);
    return { ok: false, motivo: "ILEGIBLE" };
  }

  // Un PDF escaneado devuelve cadena vacía o un puñado de caracteres de
  // metadatos. El umbral distingue eso de un documento real corto.
  if (crudo.replace(/\s+/g, "").length < MIN_CARACTERES_EXTRAIDOS) {
    return { ok: false, motivo: "PDF_SIN_TEXTO" };
  }

  return { ok: true };
}
