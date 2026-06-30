import type { IProveedorIA } from "./types";
import type { ProveedorIAEnum } from "@/generated/prisma/enums";

const registro = new Map<ProveedorIAEnum, (apiKey: string, modelo?: string) => IProveedorIA>();

export function registrarProveedor(
  nombre: ProveedorIAEnum,
  fabrica: (apiKey: string, modelo?: string) => IProveedorIA,
): void {
  registro.set(nombre, fabrica);
}

export function crearProveedor(
  nombre: ProveedorIAEnum,
  apiKey: string,
  modelo?: string,
): IProveedorIA {
  const fabrica = registro.get(nombre);
  if (!fabrica) {
    throw new Error(`Proveedor IA no registrado: ${nombre}`);
  }
  return fabrica(apiKey, modelo);
}

export function proveedoresRegistrados(): ProveedorIAEnum[] {
  return Array.from(registro.keys());
}
