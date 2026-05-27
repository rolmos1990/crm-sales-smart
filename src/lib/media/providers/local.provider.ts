import path from "path";
import fs from "fs/promises";
import type { IStorageProvider, UploadParams, UploadResult, StorageProveedor } from "../types";

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
}
