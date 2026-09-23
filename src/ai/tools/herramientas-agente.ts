import { HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES } from "./constantes";

/**
 * Herramientas que el agente puede ejecutar en una respuesta. Única fuente
 * para la respuesta automática real y para el simulador: si divergen, el
 * simulador deja de predecir lo que hace el agente en una conversación.
 *
 * 028-respuestas-guia-catalogo-ia — con el catálogo en el contexto se habilita
 * también `buscar_productos`: las herramientas de precio y stock "siempre
 * disponibles" piden un `productoId`, y sin búsqueda no había cómo obtenerlo
 * para un producto que no entró en la lista del catálogo.
 */
export function resolverHerramientasAgente({
  herramientas,
  catalogoEnContexto,
}: {
  herramientas: unknown;
  catalogoEnContexto: boolean | null | undefined;
}): string[] {
  return [
    ...new Set([
      ...parsearListaHerramientas(herramientas),
      ...HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES,
      ...((catalogoEnContexto ?? true) ? ["buscar_productos"] : []),
    ]),
  ];
}

export function parsearListaHerramientas(valor: unknown): string[] {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.filter((h): h is string => typeof h === "string");
  if (typeof valor === "object" && valor !== null) {
    const obj = valor as Record<string, unknown>;
    const lista = obj["habilitadas"] ?? obj["lista"];
    if (Array.isArray(lista)) return lista.filter((h): h is string => typeof h === "string");
  }
  return [];
}
