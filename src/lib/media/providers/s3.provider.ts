import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { S3_CONFIG } from "../config";
import type { IStorageProvider, UploadParams, UploadResult, StorageProveedor } from "../types";

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

  getPublicUrl(key: string): string {
    return `${S3_CONFIG.publicUrl}/${key}`;
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
}
