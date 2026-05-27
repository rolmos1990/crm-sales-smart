import { MEDIA_CONFIG } from "../config";
import type { FileValidationResult } from "../types";

const MIMES_SET = new Set<string>(MEDIA_CONFIG.mimesAceptados);

// Evita path traversal sanitizando el nombre del archivo
export function sanitizarNombre(nombre: string): string {
  return nombre
    .replace(/[^a-zA-Z0-9.\-_]/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/^\./, "_")
    .slice(0, 120);
}

export function validarArchivo(file: File): FileValidationResult {
  if (!MIMES_SET.has(file.type)) {
    return {
      valido: false,
      error: `Formato no soportado: ${file.type}. Usa JPG, PNG, WebP, AVIF o HEIC.`,
    };
  }

  if (file.size > MEDIA_CONFIG.maxFileSizeBytes) {
    const maxMB = MEDIA_CONFIG.maxFileSizeBytes / (1024 * 1024);
    return { valido: false, error: `Imagen demasiado grande. Máximo ${maxMB} MB.` };
  }

  if (file.size === 0) {
    return { valido: false, error: "El archivo está vacío." };
  }

  return { valido: true };
}

export function calcularHash(buffer: Buffer): string {
  // Importación dinámica inline — crypto es built-in en Node.js
  const { createHash } = require("crypto") as typeof import("crypto");
  return createHash("sha256").update(buffer).digest("hex");
}
