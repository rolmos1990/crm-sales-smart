import path from "path";
import fs from "fs/promises";
import type {
  IStorageProvider,
  UploadParams,
  UploadResult,
  StorageProveedor,
  DownloadResult,
} from "../types";

const MIME_POR_EXT: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
  gif: "image/gif",
};

const BASE_DIR = path.join(process.cwd(), "public", "uploads");
const BASE_URL = "/uploads";

export class LocalProvider implements IStorageProvider {
  readonly nombre: StorageProveedor = "local";

  async upload({ key, buffer }: UploadParams): Promise<UploadResult> {
    const absPath = path.join(BASE_DIR, key);
    const absDir = path.dirname(absPath);

    await fs.mkdir(absDir, { recursive: true });
    await fs.writeFile(absPath, buffer);

    return { key, url: this.getPublicUrl(key) };
  }

  async delete(key: string): Promise<void> {
    const absPath = path.join(BASE_DIR, key);
    try {
      await fs.unlink(absPath);
    } catch {
      // Si no existe, no hay error
    }
  }

  getPublicUrl(key: string): string {
    return `${BASE_URL}/${key.replace(/\\/g, "/")}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(path.join(BASE_DIR, key));
      return true;
    } catch {
      return false;
    }
  }

  async download(key: string): Promise<DownloadResult | null> {
    try {
      const buffer = await fs.readFile(path.join(BASE_DIR, key));
      const ext = key.split(".").pop()?.toLowerCase() ?? "";
      return { buffer, contentType: MIME_POR_EXT[ext] ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }
}
