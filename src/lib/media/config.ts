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

  // Procesamiento — imagen optimizada
  optimized: {
    quality: 80,
    maxWidth: 1200,
    maxHeight: 1200,
    mime: "image/webp" as const,
    ext: "webp",
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

// ─── Selección de proveedor activo ─────────────────────────────────────────
export function getProveedorActivo(): StorageProveedor {
  const env = process.env.STORAGE_PROVIDER as StorageProveedor | undefined;
  if (env && ["r2", "s3", "azure", "supabase", "local"].includes(env)) return env;
  // Si R2 está configurado, usarlo automáticamente
  if (R2_CONFIG.accountId && R2_CONFIG.accessKeyId && R2_CONFIG.bucketName) return "r2";
  return "local";
}
