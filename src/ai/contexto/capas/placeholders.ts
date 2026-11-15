import { producirCapaCatalogo, type InsumosCapaCatalogo } from "./catalogo";
import { producirCapaConocimiento, type InsumosCapaDocumentacion } from "./conocimiento";
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

/** Capa 8 — información operativa verificada. Lleva dos bloques: el catálogo
 *  vigente con precios (028) y la documentación del comercio (033). El catálogo
 *  va primero porque es dato estructurado y verificado al momento; la
 *  documentación es la política de cuándo ir a buscar material de referencia.
 *
 *  Desde la 033 el segundo bloque ya no trae el contenido de los documentos:
 *  trae las reglas que deciden cuándo el agente consulta el índice. */
export async function producirCapaInfoOperativa(
  insumos: InsumosCapaCatalogo & { documentacion?: InsumosCapaDocumentacion },
): Promise<string | null> {
  const [catalogo, conocimiento] = [
    await producirCapaCatalogo(insumos),
    insumos.documentacion ? producirCapaConocimiento(insumos.documentacion) : null,
  ];
  const bloques = [catalogo, conocimiento].filter((b): b is string => Boolean(b));
  return bloques.length > 0 ? bloques.join("\n\n") : null;
}

// Capa 9 (ejemplos piloto relevantes) ya no es un placeholder — ver
// ./ejemplos-piloto.ts (014-conversaciones-piloto-ejemplos-relevantes).
