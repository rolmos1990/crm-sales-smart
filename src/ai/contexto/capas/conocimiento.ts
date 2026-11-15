// 033 — Documentación del comercio. Segundo bloque de la capa 8 ("Información
// operativa verificada"), junto al catálogo: no hay capa nueva ni cambia el
// orden de precedencia que fijó la spec 013.
//
// Lo que cambió respecto de la 032: esta capa YA NO lleva el contenido de los
// documentos. Los archivos ahora están indexados y el agente los consulta con
// `buscar_en_documentacion` cuando le hace falta. Entonces lo que se emite acá
// es la POLÍTICA de cuándo consultar — que es lo que separa a un agente que
// busca con criterio de uno que busca en cada mensaje (caro y lento) o que no
// busca nunca (inútil).
//
// La política es el contrato con el modelo y por eso está escrita entera acá,
// en vez de repartida entre la descripción de la herramienta y el prompt: si
// se parte en dos, se contradicen.

export interface InsumosCapaDocumentacion {
  /** Si el agente tiene al menos un documento LISTO y activo. */
  tieneDocumentacion: boolean;
  /** Nombres de esos documentos, para que el agente sepa sobre qué puede
   *  buscar antes de gastar una llamada averiguándolo. */
  nombres: string[];
}

/** Cuántos nombres se listan antes de resumir. Con 20 documentos, listarlos
 *  todos gastaría más contexto del que esta capa vino a ahorrar. */
const MAX_NOMBRES_LISTADOS = 8;

export function producirCapaConocimiento(insumos: InsumosCapaDocumentacion): string | null {
  // Sin documentación el agente se comporta exactamente como antes de esta
  // feature: no se menciona una capacidad que no tiene.
  if (!insumos.tieneDocumentacion || insumos.nombres.length === 0) return null;

  const listados = insumos.nombres.slice(0, MAX_NOMBRES_LISTADOS);
  const restantes = insumos.nombres.length - listados.length;
  const listado = listados.join(", ") + (restantes > 0 ? ` y ${restantes} más` : "");

  return [
    "Documentación del comercio",
    `Tenés la herramienta \`buscar_en_documentacion\` sobre los archivos que cargó el negocio: ${listado}.`,
    "",
    "Antes de responder, decidí si necesitás consultar una fuente:",
    "- Usá la conversación y el contexto de Karia para responder saludos, confirmaciones y preguntas ya contestadas.",
    "- Consultá la documentación cuando el cliente pregunte por información estable que podría estar allí —políticas, métodos generales de envío, retiro, materiales o cuidados— y esa respuesta no aparezca ya en la conversación.",
    "- Para precios, inventario, pedidos y tarifas actuales, usá las herramientas o datos actualizados de Karia. No uses documentos como sustituto de esos datos.",
    "- No consultes documentos para cada mensaje. Hacelo solo cuando la respuesta dependa de información específica del comercio que aún no tenés.",
    "- Si buscás y no encontrás una respuesta clara, decilo y no la inventes.",
  ].join("\n");
}
