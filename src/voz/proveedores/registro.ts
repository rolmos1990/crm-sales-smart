import type { ProveedorVozEnum } from "@/generated/prisma/enums";
import type { IProveedorVoz } from "./types";

/**
 * 049 — Registro de adaptadores de voz.
 *
 * Mismo patrón que src/ai/proveedores/registro.ts, con una diferencia
 * deliberada: la fábrica recibe `baseUrl`.
 *
 * En el registro de IA la fábrica es `(apiKey, modelo?)` y cada proveedor
 * hardcodea su baseURL, así que `ProveedorIA.baseUrl` se persiste, se edita en
 * la UI y no se usa en ningún lado. Quien configure un endpoint alternativo
 * ahí cree haberlo cambiado y sigue pegándole al de siempre. Acá no.
 */
type FabricaProveedorVoz = (apiKey: string, modelo?: string, baseUrl?: string) => IProveedorVoz;

const registro = new Map<ProveedorVozEnum, FabricaProveedorVoz>();

export function registrarProveedorVoz(nombre: ProveedorVozEnum, fabrica: FabricaProveedorVoz): void {
  registro.set(nombre, fabrica);
}

export function crearProveedorVoz(
  nombre: ProveedorVozEnum,
  apiKey: string,
  modelo?: string,
  baseUrl?: string,
): IProveedorVoz {
  const fabrica = registro.get(nombre);
  if (!fabrica) throw new Error(`Proveedor de voz no registrado: ${nombre}`);
  return fabrica(apiKey, modelo, baseUrl);
}

export function proveedoresVozRegistrados(): ProveedorVozEnum[] {
  return [...registro.keys()];
}
