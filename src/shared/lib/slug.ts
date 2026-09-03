import { normalizarTexto } from "./normalizar-texto";

// 024-alias-ubicaciones-transportistas — wrapper sobre normalizarTexto() (la
// lógica original vivía acá; se extrajo para reutilizarla fuera del caso de
// uso de slugs). Comportamiento sin cambios para los ~10 call sites actuales.
export function generarSlug(nombre: string): string {
  return normalizarTexto(nombre);
}
