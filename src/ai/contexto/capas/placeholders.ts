// 013-context-builder-capas-precedencia (FR-008) — puntos de extensión
// reservados para capas que todavía no tienen fuente de datos real.
// Siempre devuelven `null` — ninguna produce contenido en esta spec. Cuando
// la spec correspondiente se implemente, solo debe reemplazar el cuerpo de
// la función respectiva; el orden de precedencia ya está fijado.

/** Capa 7 — datos conocidos y faltantes. Sin fuente real todavía (ver docs/AGENTE-IA-EVOLUCION-ANALISIS.md §7, research.md Decisión 1). */
export async function producirCapaDatosConocidosFaltantes(): Promise<string | null> {
  return null;
}

/** Capa 8 — información operativa verificada. Fuente real: 015-herramientas-operativas-inventario-envios-acciones. */
export async function producirCapaInfoOperativa(): Promise<string | null> {
  return null;
}

/** Capa 9 — ejemplos piloto relevantes. Fuente real: 014-conversaciones-piloto-ejemplos-relevantes. */
export async function producirCapaEjemplosPiloto(): Promise<string | null> {
  return null;
}
