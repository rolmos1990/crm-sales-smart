import { prisma } from "@/shared/db/prisma";
import { getStorageProvider } from "../providers/factory";
import { calcularHash, sanitizarNombre } from "../processor/validators";
import { getProveedorActivo } from "../config";
import type { CanalOrigen, MediaModulo } from "../types";

const MAX_BYTES = 50 * 1024 * 1024; // 50 MB — video/documentos pesan más que el audio original (10 MB)

const MIMES_AUDIO = new Set([
  "audio/ogg",
  "audio/ogg; codecs=opus",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/webm",
  "audio/aac",
  "audio/wav",
  "audio/x-wav",
]);

const MIMES_VIDEO = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/3gpp",
  "video/x-msvideo",
  "video/mpeg",
]);

// Documentos recibidos por canales de conversación (WhatsApp/Instagram) — no se
// reprocesan, se guardan tal cual llegan. Whitelist explícita en vez de aceptar
// cualquier mime, igual que el resto de validadores de este módulo.
const MIMES_DOCUMENTO = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/zip",
  "text/plain",
  "text/csv",
  "application/octet-stream", // fallback genérico que usan algunos proveedores cuando no detectan el mime real
]);

const MIMES_PERMITIDOS = new Set([...MIMES_AUDIO, ...MIMES_VIDEO, ...MIMES_DOCUMENTO]);

function extDesde(mimeType: string): string {
  const mapa: Record<string, string> = {
    // audio
    "audio/ogg": "ogg",
    "audio/ogg; codecs=opus": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/webm": "webm",
    "audio/aac": "aac",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    // video
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "video/3gpp": "3gp",
    "video/x-msvideo": "avi",
    "video/mpeg": "mpeg",
    // documentos
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/zip": "zip",
    "text/plain": "txt",
    "text/csv": "csv",
  };
  return mapa[mimeType] ?? "bin";
}

export interface GuardarArchivoRawInput {
  buffer: Buffer;
  mimeType: string;
  nombreArchivo: string;
  instanciaId: string;
  modulo: MediaModulo;
  canalOrigen?: CanalOrigen;
  entidadTipo?: string;
  entidadId?: string;
}

export interface GuardarArchivoRawResult {
  id: string;
  urlOptimizada: string;
  urlPublica: string;
  pesoOriginal: number;
  hash: string;
  deduplicado: boolean;
}

export async function guardarArchivoRaw(
  input: GuardarArchivoRawInput
): Promise<GuardarArchivoRawResult> {
  const { buffer, mimeType, nombreArchivo, instanciaId, modulo, canalOrigen, entidadTipo, entidadId } = input;

  const mimeBase = mimeType.split(";")[0].trim();
  if (!MIMES_PERMITIDOS.has(mimeType) && !MIMES_PERMITIDOS.has(mimeBase)) {
    throw new Error(`Tipo de archivo no soportado para almacenamiento raw: ${mimeType}`);
  }
  if (buffer.length === 0) throw new Error("El buffer está vacío.");
  if (buffer.length > MAX_BYTES) throw new Error(`Archivo demasiado grande. Máximo ${MAX_BYTES / (1024 * 1024)} MB.`);

  const hash = calcularHash(buffer);

  const existente = await prisma.mediaArchivo.findUnique({
    where: { instanciaId_hash: { instanciaId, hash } },
  });

  if (existente) {
    return {
      id: existente.id,
      urlOptimizada: existente.urlOptimizada,
      urlPublica: `/m/${existente.id}`,
      pesoOriginal: existente.pesoOriginal,
      hash: existente.hash,
      deduplicado: true,
    };
  }

  const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const ext = extDesde(mimeType);
  const key = `${instanciaId}/${modulo}/originals/${fileId}.${ext}`;
  const provider = getStorageProvider();

  await provider.upload({ key, buffer, contentType: mimeType });

  const url = provider.getPublicUrl(key);

  const registro = await prisma.mediaArchivo.create({
    data: {
      instanciaId,
      modulo,
      entidadTipo: entidadTipo ?? null,
      entidadId: entidadId ?? null,
      nombreOriginal: sanitizarNombre(nombreArchivo),
      mimeOriginal: mimeType,
      pesoOriginal: buffer.length,
      anchoOriginal: null,
      altoOriginal: null,
      mimeOptimizado: mimeType,
      pesoOptimizado: buffer.length,
      ancho: null,
      alto: null,
      keyOptimizado: key,
      keyThumbnail: null,
      keyOriginal: key,
      urlOptimizada: url,
      urlThumbnail: null,
      urlOriginal: url,
      hash,
      proveedor: getProveedorActivo(),
      canalOrigen: canalOrigen ?? null,
      estadoProcesado: "LISTO",
      creadoPorId: null,
    },
  });

  return {
    id: registro.id,
    urlOptimizada: url,
    urlPublica: `/m/${registro.id}`,
    pesoOriginal: buffer.length,
    hash,
    deduplicado: false,
  };
}
