import sharp from "sharp";
import { MEDIA_CONFIG } from "../config";
import type { ImageProcessorInput, ImageProcessorResult, ProcessedImage } from "../types";

async function procesarVariante(
  pipeline: sharp.Sharp,
  opts: { maxWidth: number; maxHeight: number; quality: number }
): Promise<ProcessedImage> {
  // JPEG y no WebP: esta variante se usa como adjunto al enviar mensajes por
  // WhatsApp/Instagram, y Meta rechaza WebP como adjunto de imagen normal
  // (solo lo acepta para stickers). Ver comentario en MEDIA_CONFIG.optimized.
  const buffer = await pipeline
    .clone()
    .rotate()                               // corrige orientación EXIF
    .resize(opts.maxWidth, opts.maxHeight, { fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#ffffff" })     // jpeg no soporta transparencia
    .jpeg({ quality: opts.quality, mozjpeg: true })
    .toBuffer();

  const meta = await sharp(buffer).metadata();

  return {
    buffer,
    mime: "image/jpeg",
    ancho: meta.width ?? 0,
    alto: meta.height ?? 0,
    peso: buffer.length,
  };
}

async function procesarThumbnail(
  pipeline: sharp.Sharp,
  opts: { width: number; height: number; quality: number }
): Promise<ProcessedImage> {
  const buffer = await pipeline
    .clone()
    .rotate()
    .resize(opts.width, opts.height, { fit: "cover" })
    .webp({ quality: opts.quality, effort: 3 })
    .toBuffer();

  return {
    buffer,
    mime: "image/webp",
    ancho: opts.width,
    alto: opts.height,
    peso: buffer.length,
  };
}

export async function procesarImagen(input: ImageProcessorInput): Promise<ImageProcessorResult> {
  const cfg = MEDIA_CONFIG;

  // Validar que sharp puede leer la imagen (rechaza corruptas)
  const pipeline = sharp(input.buffer, { failOn: "error" });
  const meta = await pipeline.metadata();

  if (!meta.width || !meta.height) {
    throw new Error("No se pudo leer las dimensiones de la imagen.");
  }

  if (meta.width > cfg.maxDimensionPx || meta.height > cfg.maxDimensionPx) {
    throw new Error(
      `Imagen demasiado grande: ${meta.width}×${meta.height}px. Máximo ${cfg.maxDimensionPx}px por lado.`
    );
  }

  const [optimized, thumbnail] = await Promise.all([
    procesarVariante(pipeline, cfg.optimized),
    procesarThumbnail(pipeline, cfg.thumbnail),
  ]);

  return { optimized, thumbnail };
}
