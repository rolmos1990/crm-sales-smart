import { normalizarUbicacion } from "@/shared/entregas/normalizar-ubicacion";

// 024-alias-ubicaciones-transportistas — construye la etiqueta legible de una
// ZonaEntregaUbicacion a partir de sus niveles no vacíos, y su versión
// normalizada para búsqueda (FR-001). Usadas al crear una ubicación
// (zonas/actions.ts) y por el backfill (scripts/backfill-normalizar-ubicaciones.ts).
interface NivelesUbicacion {
  provinciaEstado?: string | null;
  distritoCiudad?: string | null;
  corregimiento?: string | null;
  sectorOCodigoPostal?: string | null;
}

export function construirNombreVisible(ubicacion: NivelesUbicacion): string {
  return [ubicacion.provinciaEstado, ubicacion.distritoCiudad, ubicacion.corregimiento, ubicacion.sectorOCodigoPostal]
    .filter((valor): valor is string => !!valor?.trim())
    .join(" > ");
}

export function calcularNombreNormalizado(nombreVisible: string): string {
  return normalizarUbicacion(nombreVisible);
}
