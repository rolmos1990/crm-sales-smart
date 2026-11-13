import { generarSlug } from "@/shared/lib/slug";
import { nucleoAdministrativo } from "@/shared/entregas/resolver-costo-envio";

// Agrupa los lugares cubiertos por provincia, para que el selector encuentre
// "Chiriquí" escribiendo "Boquete". Función pura: la consulta vive en
// queries-geografia.ts y le pasa las filas ya cargadas.

export interface UbicacionConLugares {
  provinciaEstado: string | null;
  distritoCiudad: string | null;
  corregimiento: string | null;
  sectorOCodigoPostal: string | null;
  aliases: { valor: string }[];
}

export interface CoberturaProvincia {
  estadoProvinciaId: string;
  /** Distritos, corregimientos, sectores y alias cargados en las zonas. */
  lugares: string[];
}

export function agruparCoberturaPorProvincia(
  ubicaciones: readonly UbicacionConLugares[],
  estados: readonly { id: string; nombre: string }[],
): CoberturaProvincia[] {
  // `provinciaEstado` es texto libre y el catálogo guarda el nombre
  // administrativo completo ("Chiriquí Province"), así que se comparan por
  // núcleo — mismo criterio que el motor de resolución de envíos.
  const porNucleo = new Map<string, string>();
  for (const e of estados) {
    porNucleo.set(nucleoAdministrativo(generarSlug(e.nombre)), e.id);
  }

  const lugaresPorProvincia = new Map<string, Set<string>>();
  for (const u of ubicaciones) {
    if (!u.provinciaEstado) continue;
    const estadoProvinciaId = porNucleo.get(nucleoAdministrativo(generarSlug(u.provinciaEstado)));
    if (!estadoProvinciaId) continue;

    const lugares = lugaresPorProvincia.get(estadoProvinciaId) ?? new Set<string>();
    for (const valor of [u.distritoCiudad, u.corregimiento, u.sectorOCodigoPostal]) {
      if (valor?.trim()) lugares.add(valor.trim());
    }
    for (const a of u.aliases) {
      if (a.valor.trim()) lugares.add(a.valor.trim());
    }
    lugaresPorProvincia.set(estadoProvinciaId, lugares);
  }

  return [...lugaresPorProvincia.entries()].map(([estadoProvinciaId, lugares]) => ({
    estadoProvinciaId,
    lugares: [...lugares].sort((a, b) => a.localeCompare(b, "es")),
  }));
}
