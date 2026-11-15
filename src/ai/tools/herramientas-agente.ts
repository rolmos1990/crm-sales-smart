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
 *
 * 033-documentacion-vector-store-openai — `buscar_en_documentacion` sigue el
 * mismo patrón condicional y NO entra en las "siempre disponibles": un agente
 * sin documentos indexados leería una herramienta que siempre devuelve vacío,
 * la llamaría igual y gastaría una iteración del tool loop por nada. Sin
 * documentación, la lista es idéntica a la de antes de esta feature.
 */
export function resolverHerramientasAgente({
  herramientas,
  catalogoEnContexto,
  tieneDocumentacion,
}: {
  herramientas: unknown;
  catalogoEnContexto: boolean | null | undefined;
  tieneDocumentacion?: boolean;
}): string[] {
  return [
    ...new Set([
      ...parsearListaHerramientas(herramientas),
      ...HERRAMIENTAS_OPERATIVAS_SIEMPRE_DISPONIBLES,
      ...((catalogoEnContexto ?? true) ? ["buscar_productos"] : []),
      ...(tieneDocumentacion ? ["buscar_en_documentacion"] : []),
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
