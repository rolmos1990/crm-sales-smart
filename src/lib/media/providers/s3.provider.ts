import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { S3_CONFIG } from "../config";
import type {
  IStorageProvider,
  UploadParams,
  UploadResult,
  StorageProveedor,
  DownloadResult,
} from "../types";

/**
 * Storage S3-compatible genérico — Hetzner Object Storage, MinIO, DigitalOcean
 * Spaces, Backblaze B2, etc. Mismo contrato que R2Provider (que en el fondo
 * también es un cliente S3 apuntando al endpoint de Cloudflare); acá el
 * endpoint/región/estilo de URL son configurables porque cada proveedor
 * S3-compatible fuera de AWS/R2 los define distinto — ver S3_CONFIG.
 */
export class S3Provider implements IStorageProvider {
  readonly nombre: StorageProveedor = "s3";

  private client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: S3_CONFIG.region,
      endpoint: S3_CONFIG.endpoint,
      forcePathStyle: S3_CONFIG.forcePathStyle,
      credentials: {
        accessKeyId: S3_CONFIG.accessKeyId,
        secretAccessKey: S3_CONFIG.secretAccessKey,
      },
    });
  }

  async upload({ key, buffer, contentType, metadata }: UploadParams): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: S3_CONFIG.bucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        Metadata: metadata,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );

    return { key, url: this.getPublicUrl(key) };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: S3_CONFIG.bucketName, Key: key })
    );
  }

  // Si S3_PUBLIC_URL apunta a un dominio propio (ej. un reverse proxy Caddy
  // delante del bucket — Hetzner no soporta dominio personalizado nativo, ver
  // docs.hetzner.com/storage/object-storage/howto-configurations/domain-cname/),
  // se devuelve la URL absoluta directa: el navegador descarga el archivo sin
  // pasar por esta app. Si no hay dominio propio configurado, se cae al proxy
  // interno /cdn/[...key] (ver S3Provider.download) como fallback funcional.
  getPublicUrl(key: string): string {
    if (S3_CONFIG.publicUrl) return `${S3_CONFIG.publicUrl}/${key}`;
    return `/cdn/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: S3_CONFIG.bucketName, Key: key })
      );
      return true;
    } catch {
      return false;
    }
  }

  async download(key: string): Promise<DownloadResult | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: S3_CONFIG.bucketName, Key: key })
      );
      if (!res.Body) return null;
      const bytes = await res.Body.transformToByteArray();
      return {
        buffer: Buffer.from(bytes),
        contentType: res.ContentType ?? "application/octet-stream",
      };
    } catch {
      return null;
    }
  }
}
