import { producirCapaCatalogo, type InsumosCapaCatalogo } from "./catalogo";
import { producirCapaLecturaConversacion, type InsumosCapaFicha } from "./estado-conversacion";

// 013-context-builder-capas-precedencia (FR-008) — puntos de extensión
// reservados para capas que todavía no tienen fuente de datos real.
// Siempre devuelven `null` — ninguna produce contenido en esta spec. Cuando
// la spec correspondiente se implemente, solo debe reemplazar el cuerpo de
// la función respectiva; el orden de precedencia ya está fijado.

/** Capa 7 — datos conocidos y faltantes. Desde 031-memoria-y-ficha-conversacion
 *  lleva la lectura interpretada de la conversación (ver ./estado-conversacion.ts).
 *  Con la ficha apagada devuelve null, igual que cuando era un placeholder. */
export async function producirCapaDatosConocidosFaltantes(insumos: InsumosCapaFicha): Promise<string | null> {
  return producirCapaLecturaConversacion(insumos);
}

/** Capa 8 — información operativa verificada. Desde 028-respuestas-guia-catalogo-ia
 *  lleva el catálogo vigente con precios (ver ./catalogo.ts). */
export async function producirCapaInfoOperativa(insumos: InsumosCapaCatalogo): Promise<string | null> {
  return producirCapaCatalogo(insumos);
}

// Capa 9 (ejemplos piloto relevantes) ya no es un placeholder — ver
// ./ejemplos-piloto.ts (014-conversaciones-piloto-ejemplos-relevantes).
