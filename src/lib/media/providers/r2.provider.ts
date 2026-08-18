import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { R2_CONFIG } from "../config";
import type {
  IStorageProvider,
  UploadParams,
  UploadResult,
  StorageProveedor,
  DownloadResult,
} from "../types";

export class R2Provider implements IStorageProvider {
  readonly nombre: StorageProveedor = "r2";

  private client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: "auto",
      endpoint: R2_CONFIG.endpoint,
      credentials: {
        accessKeyId: R2_CONFIG.accessKeyId,
        secretAccessKey: R2_CONFIG.secretAccessKey,
      },
    });
  }

  async upload({ key, buffer, contentType, metadata }: UploadParams): Promise<UploadResult> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: R2_CONFIG.bucketName,
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
      new DeleteObjectCommand({ Bucket: R2_CONFIG.bucketName, Key: key })
    );
  }

  getPublicUrl(key: string): string {
    return `${R2_CONFIG.publicUrl}/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: R2_CONFIG.bucketName, Key: key })
      );
      return true;
    } catch {
      return false;
    }
  }

  async download(key: string): Promise<DownloadResult | null> {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: R2_CONFIG.bucketName, Key: key })
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
