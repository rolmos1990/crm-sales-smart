import { producirCapaCatalogo, type InsumosCapaCatalogo } from "./catalogo";

// 013-context-builder-capas-precedencia (FR-008) — puntos de extensión
// reservados para capas que todavía no tienen fuente de datos real.
// Siempre devuelven `null` — ninguna produce contenido en esta spec. Cuando
// la spec correspondiente se implemente, solo debe reemplazar el cuerpo de
// la función respectiva; el orden de precedencia ya está fijado.

/** Capa 7 — datos conocidos y faltantes. Sin fuente real todavía (ver docs/AGENTE-IA-EVOLUCION-ANALISIS.md §7, research.md Decisión 1). */
export async function producirCapaDatosConocidosFaltantes(): Promise<string | null> {
  return null;
}

/** Capa 8 — información operativa verificada. Desde 028-respuestas-guia-catalogo-ia
 *  lleva el catálogo vigente con precios (ver ./catalogo.ts). */
export async function producirCapaInfoOperativa(insumos: InsumosCapaCatalogo): Promise<string | null> {
  return producirCapaCatalogo(insumos);
}

// Capa 9 (ejemplos piloto relevantes) ya no es un placeholder — ver
// ./ejemplos-piloto.ts (014-conversaciones-piloto-ejemplos-relevantes).
