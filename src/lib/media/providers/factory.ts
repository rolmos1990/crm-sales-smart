import { getProveedorActivo } from "../config";
import type { IStorageProvider } from "../types";
import { R2Provider } from "./r2.provider";
import { S3Provider } from "./s3.provider";
import { LocalProvider } from "./local.provider";

let _instance: IStorageProvider | null = null;

export function getStorageProvider(): IStorageProvider {
  if (_instance) return _instance;

  const proveedor = getProveedorActivo();

  switch (proveedor) {
    case "r2":
      _instance = new R2Provider();
      break;
    case "s3":
      _instance = new S3Provider();
      break;
    default:
      _instance = new LocalProvider();
  }

  return _instance;
}

// Para testing: permite resetear el singleton
export function resetStorageProvider(): void {
  _instance = null;
}
