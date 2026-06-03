import { createHash } from "crypto";
import { prisma } from "@/shared/db/prisma";
import { getStorageProvider } from "../providers/factory";
import { procesarImagen } from "../processor/image.processor";
import { getProveedorActivo } from "../config";

// ── Tipos permitidos para imágenes en conversaciones ──────────────────────────

const MIMES_IMAGEN_PERMITIDOS = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// ── Detección de tipo real por magic bytes ────────────────────────────────────

function detectarMimePorMagicBytes(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";

  // GIF: 47 49 46 38
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return "image/gif";

  // WebP: RIFF????WEBP
  if (
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer.length >= 12 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) return "image/webp";

  // HEIC/HEIF: ftyp box at offset 4
  if (buffer.length >= 12) {
    const ftyp = buffer.slice(4, 8).toString("ascii");
    if (ftyp === "ftyp") {
      const brand = buffer.slice(8, 12).toString("ascii").toLowerCase();
      if (["heic", "heis", "hevc", "hevx", "mif1", "msf1", "hevm"].some((b) => brand.startsWith(b))) {
        return "image/heic";
      }
    }
  }

  // PDF: %PDF
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return "application/pdf";

  // ZIP/APK/DOCX/JAR: PK\x03\x04
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) return "application/zip";

  // EXE/DLL: MZ
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) return "application/x-msdownload";

  // ELF (Linux executables)
  if (buffer[0] === 0x7f && buffer[1] === 0x45 && buffer[2] === 0x4c && buffer[3] === 0x46) return "application/x-elf";

  // SVG / HTML — buscar en primeros 128 bytes
  const inicio = buffer.slice(0, 128).toString("utf8").replace(/\s+/g, " ").trimStart().toLowerCase();
  if (inicio.startsWith("<svg") || inicio.includes("<svg ") || inicio.startsWith("<?xml")) return "image/svg+xml";
  if (inicio.startsWith("<!doctype html") || inicio.startsWith("<html")) return "text/html";

  return null;
}

// ── Interface pública del servicio ────────────────────────────────────────────

export interface SubirImagenConversacionInput {
  buffer: Buffer;
  mimeTypeProveedor: string;
  instanciaId: string;
  canal: string;
  contactoId: string | null;
}

export interface ResultadoSubirImagen {
  mediaArchivoId: string;
  urlOptimizada: string | null;
  urlThumbnail: string | null;
  rechazada: boolean;
  razon?: string;
}

// ── Servicio principal ────────────────────────────────────────────────────────

export async function subirImagenConversacion(
  input: SubirImagenConversacionInput
): Promise<ResultadoSubirImagen> {
  const { buffer, instanciaId, canal, contactoId } = input;

  // 1. Validar tamaño antes de cualquier cosa
  if (buffer.length > MAX_BYTES) {
    return await crearRegistroRechazado(instanciaId, canal, contactoId, buffer,
      `Imagen demasiado grande: ${(buffer.length / 1024 / 1024).toFixed(1)} MB (máx 10 MB)`);
  }

  if (buffer.length === 0) {
    return await crearRegistroRechazado(instanciaId, canal, contactoId, buffer, "Archivo vacío");
  }

  // 2. Detectar MIME real por magic bytes (no confiar en lo que dice el proveedor)
  const mimeReal = detectarMimePorMagicBytes(buffer);

  if (!mimeReal || !MIMES_IMAGEN_PERMITIDOS.has(mimeReal)) {
    const razon = mimeReal
      ? `Formato no permitido: ${mimeReal}`
      : "Formato desconocido o no reconocido";
    return await crearRegistroRechazado(instanciaId, canal, contactoId, buffer, `RECHAZADA_SEGURIDAD: ${razon}`);
  }

  // 3. Deduplicar por hash
  const hash = createHash("sha256").update(buffer).digest("hex");
  const existente = await prisma.mediaArchivo.findUnique({
    where: { instanciaId_hash: { instanciaId, hash } },
    select: { id: true, urlOptimizada: true, urlThumbnail: true, estadoProcesado: true },
  });

  if (existente && existente.estadoProcesado === "LISTO") {
    // Si el registro existente no tiene contactoId, actualizarlo
    if (contactoId) {
      await prisma.mediaArchivo.update({
        where: { id: existente.id },
        data: { contactoId },
      });
    }
    return {
      mediaArchivoId: existente.id,
      urlOptimizada: existente.urlOptimizada,
      urlThumbnail: existente.urlThumbnail ?? null,
      rechazada: false,
    };
  }

  // 4. Procesar imagen con sharp (optimizado + thumbnail)
  let optimizado: Awaited<ReturnType<typeof procesarImagen>>["optimized"];
  let thumbnail: Awaited<ReturnType<typeof procesarImagen>>["thumbnail"];
  try {
    const resultado = await procesarImagen({ buffer, mimeType: mimeReal });
    optimizado = resultado.optimized;
    thumbnail = resultado.thumbnail;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error procesando imagen";
    return await crearRegistroError(instanciaId, canal, contactoId, buffer, hash, msg);
  }

  // 5. Construir storage keys con estructura por canal + contacto
  const fileId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const base = `${instanciaId}/conversaciones/${canal}/${contactoId ?? "_sin_contacto"}`;
  const keyOpt  = `${base}/opt/${fileId}.webp`;
  const keyThumb = `${base}/thumb/${fileId}.webp`;

  // 6. Subir archivos al storage
  const provider = getStorageProvider();
  try {
    await Promise.all([
      provider.upload({ key: keyOpt,   buffer: optimizado.buffer, contentType: "image/webp" }),
      provider.upload({ key: keyThumb, buffer: thumbnail.buffer,  contentType: "image/webp" }),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error subiendo imagen al storage";
    return await crearRegistroError(instanciaId, canal, contactoId, buffer, hash, msg);
  }

  const urlOptimizada = provider.getPublicUrl(keyOpt);
  const urlThumbnail  = provider.getPublicUrl(keyThumb);

  // 7. Crear registro en MediaArchivo
  const registro = await prisma.mediaArchivo.create({
    data: {
      instanciaId,
      modulo: "conversaciones",
      entidadTipo: "conversacion",
      contactoId,
      canalOrigen: canal,
      nombreOriginal: `imagen-${fileId}`,
      mimeOriginal: mimeReal,
      pesoOriginal: buffer.length,
      mimeOptimizado: "image/webp",
      pesoOptimizado: optimizado.peso,
      ancho: optimizado.ancho,
      alto: optimizado.alto,
      keyOptimizado: keyOpt,
      keyThumbnail: keyThumb,
      keyOriginal: null,
      urlOptimizada,
      urlThumbnail,
      urlOriginal: null,
      hash,
      proveedor: getProveedorActivo(),
      estadoProcesado: "LISTO",
    },
  });

  return {
    mediaArchivoId: registro.id,
    urlOptimizada,
    urlThumbnail,
    rechazada: false,
  };
}

// ── Helpers privados ──────────────────────────────────────────────────────────

async function crearRegistroRechazado(
  instanciaId: string,
  canal: string,
  contactoId: string | null,
  buffer: Buffer,
  razon: string
): Promise<ResultadoSubirImagen> {
  const hash = buffer.length > 0 ? createHash("sha256").update(buffer).digest("hex") : `rejected-${Date.now()}`;

  const existing = await prisma.mediaArchivo.findFirst({
    where: { instanciaId, hash },
    select: { id: true },
  });

  let id: string;
  if (existing) {
    id = existing.id;
  } else {
    const reg = await prisma.mediaArchivo.create({
      data: {
        instanciaId,
        modulo: "conversaciones",
        canalOrigen: canal,
        contactoId,
        nombreOriginal: "imagen-rechazada",
        mimeOriginal: "application/octet-stream",
        pesoOriginal: buffer.length,
        keyOptimizado: `_rechazado/${instanciaId}/${hash}`,
        urlOptimizada: "",
        hash,
        proveedor: getProveedorActivo(),
        estadoProcesado: "ERROR",
        errorMensaje: razon,
      },
    });
    id = reg.id;
  }

  return { mediaArchivoId: id, urlOptimizada: null, urlThumbnail: null, rechazada: true, razon };
}

async function crearRegistroError(
  instanciaId: string,
  canal: string,
  contactoId: string | null,
  buffer: Buffer,
  hash: string,
  error: string
): Promise<ResultadoSubirImagen> {
  const reg = await prisma.mediaArchivo.create({
    data: {
      instanciaId,
      modulo: "conversaciones",
      canalOrigen: canal,
      contactoId,
      nombreOriginal: "imagen-error",
      mimeOriginal: "application/octet-stream",
      pesoOriginal: buffer.length,
      keyOptimizado: `_error/${instanciaId}/${hash}`,
      urlOptimizada: "",
      hash,
      proveedor: getProveedorActivo(),
      estadoProcesado: "ERROR",
      errorMensaje: error,
    },
  });
  return { mediaArchivoId: reg.id, urlOptimizada: null, urlThumbnail: null, rechazada: false };
}
