// ─── Módulos del sistema ────────────────────────────────────────────────────
export type MediaModulo =
  | "productos"
  | "plantillas"
  | "logos"
  | "conversaciones"
  | "contactos"
  | "empresas"
  | "general";

// ─── Canal de origen ────────────────────────────────────────────────────────
export type CanalOrigen =
  | "web"
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "api";

// ─── Proveedores de storage ─────────────────────────────────────────────────
export type StorageProveedor = "r2" | "local" | "s3" | "azure" | "supabase";

// ─── Provider interface ──────────────────────────────────────────────────────
export interface UploadParams {
  key: string;
  buffer: Buffer;
  contentType: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  key: string;
  url: string;
  etag?: string;
}

export interface IStorageProvider {
  upload(params: UploadParams): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
  exists(key: string): Promise<boolean>;
  readonly nombre: StorageProveedor;
}

// ─── Procesamiento de imagen ─────────────────────────────────────────────────
export interface ImageProcessorInput {
  buffer: Buffer;
  mimeType: string;
}

export interface ProcessedImage {
  buffer: Buffer;
  mime: string;
  ancho: number;
  alto: number;
  peso: number;
}

export interface ImageProcessorResult {
  optimized: ProcessedImage;
  thumbnail: ProcessedImage;
}

// ─── Servicio de upload ──────────────────────────────────────────────────────
export interface MediaUploadInput {
  file: File;
  instanciaId: string;
  modulo: MediaModulo;
  entidadTipo?: string;
  entidadId?: string;
  canalOrigen?: CanalOrigen;
  creadoPorId?: string;
  guardarOriginal?: boolean;
}

export interface MediaUploadResult {
  id: string;
  urlOptimizada: string;
  urlThumbnail: string | null;
  urlOriginal: string | null;
  urlPublica: string;
  pesoOriginal: number;
  pesoOptimizado: number | null;
  ancho: number | null;
  alto: number | null;
  hash: string;
  deduplicado: boolean;
}

// ─── Respuesta de la API ─────────────────────────────────────────────────────
export interface MediaUploadApiResponse {
  ok: true;
  data: MediaUploadResult;
}

export interface MediaUploadApiError {
  ok: false;
  error: string;
}

// ─── Validación de archivos ──────────────────────────────────────────────────
export interface FileValidationResult {
  valido: boolean;
  error?: string;
}
