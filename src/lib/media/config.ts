import type { StorageProveedor } from "./types";

export const MEDIA_CONFIG = {
  // Validación
  maxFileSizeBytes: 10 * 1024 * 1024, // 10 MB
  maxDimensionPx: 8000,

  // Tipos MIME aceptados
  mimesAceptados: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/avif",
    "image/heic",
    "image/heif",
    "image/gif",
  ] as const,

  // Procesamiento — imagen optimizada. JPEG y no WebP a propósito: esta es
  // la variante que se usa como `mediaUrl` al enviar mensajes por WhatsApp/
  // Instagram, y la Messaging API de Meta rechaza adjuntos WebP (solo lo
  // acepta para stickers) — con WebP el envío de plantillas con imagen falla
  // silenciosamente del lado de Meta. El thumbnail sí se queda en WebP porque
  // es de uso interno (preview en el CRM), nunca se manda a un canal externo.
  optimized: {
    quality: 80,
    maxWidth: 1200,
    maxHeight: 1200,
    mime: "image/jpeg" as const,
    ext: "jpg",
  },

  // Procesamiento — thumbnail
  thumbnail: {
    quality: 70,
    width: 320,
    height: 320,
    mime: "image/webp" as const,
    ext: "webp",
  },
} as const;

// ─── Configuración de R2 ────────────────────────────────────────────────────
export const R2_CONFIG = {
  accountId: process.env.R2_ACCOUNT_ID ?? "",
  accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
  bucketName: process.env.R2_BUCKET_NAME ?? "",
  publicUrl: (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, ""),
  endpoint: `https://${process.env.R2_ACCOUNT_ID ?? ""}.r2.cloudflarestorage.com`,
};

// ─── Configuración de S3 genérico (Hetzner Object Storage, MinIO, DO Spaces,
// Backblaze B2, etc.) — cualquier storage compatible con la API de S3 que no
// sea específicamente R2. Todo por variables de entorno porque el endpoint,
// la región y el estilo de URL cambian de proveedor a proveedor.
export const S3_CONFIG = {
  endpoint: process.env.S3_ENDPOINT ?? "",
  region: process.env.S3_REGION ?? "auto",
  accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  bucketName: process.env.S3_BUCKET_NAME ?? "",
  publicUrl: (process.env.S3_PUBLIC_URL ?? "").replace(/\/$/, ""),
  // La mayoría de storages S3-compatibles fuera de AWS (Hetzner, MinIO, DO
  // Spaces...) necesitan path-style ("https://endpoint/bucket/key") en vez
  // de virtual-hosted-style ("https://bucket.endpoint/key"), salvo que el
  // proveedor tenga DNS wildcard por bucket configurado. Por defecto activo;
  // se puede desactivar con S3_FORCE_PATH_STYLE=false si tu proveedor sí
  // soporta virtual-hosted-style.
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
};

// ─── Selección de proveedor activo ─────────────────────────────────────────
export function getProveedorActivo(): StorageProveedor {
  const env = process.env.STORAGE_PROVIDER as StorageProveedor | undefined;
  if (env && ["r2", "s3", "azure", "supabase", "local"].includes(env)) return env;
  // Si R2 está configurado, usarlo automáticamente
  if (R2_CONFIG.accountId && R2_CONFIG.accessKeyId && R2_CONFIG.bucketName) return "r2";
  // Si hay un S3 genérico configurado (ej. Hetzner), usarlo automáticamente
  if (S3_CONFIG.endpoint && S3_CONFIG.accessKeyId && S3_CONFIG.bucketName) return "s3";
  return "local";
}
