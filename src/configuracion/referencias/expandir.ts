import {
  construirBloqueReferencias,
  claveDeReferencia,
  extraerReferencias,
  reemplazarTokens,
  sinReferencias,
} from "./parser";
import type { Referencia, ReferenciaResuelta } from "./tipos";

// Expande las referencias `@tipo:clave` de la configuración de un agente
// ANTES de que llegue a construirSystemPrompt, que queda intacto: no recibe
// parámetros nuevos ni cambia el orden de sus partes. El bloque de contenido
// referenciado se anexa al final de `instruccionesAgente`, que el builder ya
// empuja como primera parte del prompt — así queda justo debajo de la
// instrucción que lo menciona y por encima de las reglas fijas del sistema.

/** Lo mínimo que esta expansión necesita de ConfigAgenteParaPrompt. */
export interface ConfigConReferencias {
  instruccionesAgente?: string | null;
  respuestasGuia?: unknown;
  sistemaPrompt?: string | null;
}

type ResolverReferencias = (
  instanciaId: string,
  referencias: Referencia[],
) => Promise<Map<string, ReferenciaResuelta>>;

function textosDeRespuestasGuia(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((item) =>
      typeof item === "object" && item !== null
        ? (item as Record<string, unknown>).formato
        : undefined,
    )
    .filter((f): f is string => typeof f === "string");
}

/**
 * Devuelve una copia de la config con los tokens reemplazados por el nombre
 * legible de lo referenciado y el contenido vivo anexado.
 *
 * Si ningún texto contiene `@`, devuelve el MISMO objeto sin una sola query:
 * el prompt de un agente sin referencias es byte-idéntico al de antes de esta
 * feature.
 */
export async function expandirReferenciasAgente<T extends ConfigConReferencias>(
  config: T,
  instanciaId: string,
  resolver?: ResolverReferencias,
): Promise<T> {
  const formatos = textosDeRespuestasGuia(config.respuestasGuia);
  const textos = [config.instruccionesAgente ?? "", ...formatos];
  if (textos.every(sinReferencias)) return config;

  const referencias: Referencia[] = [];
  const vistas = new Set<string>();
  for (const texto of textos) {
    for (const ref of extraerReferencias(texto)) {
      const clave = claveDeReferencia(ref);
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      referencias.push(ref);
    }
  }
  if (referencias.length === 0) return config;

  const resolverFn = resolver ?? (await import("./queries")).resolverReferencias;
  const resueltas = await resolverFn(instanciaId, referencias);
  if (resueltas.size === 0) return config;

  const instrucciones = reemplazarTokens(config.instruccionesAgente ?? "", resueltas).trim();
  // El orden de `referencias` (orden de aparición) manda sobre el del Map,
  // para que el bloque se lea igual que la instrucción.
  const bloque = construirBloqueReferencias(
    referencias
      .map((r) => resueltas.get(claveDeReferencia(r)))
      .filter((r): r is ReferenciaResuelta => r !== undefined),
  );

  const expandida: T = { ...config };

  if (instrucciones) {
    expandida.instruccionesAgente = [instrucciones, bloque].filter(Boolean).join("\n\n");
  } else if (bloque) {
    // Agente anterior al backfill de `instruccionesAgente` (ver
    // scripts/backfill-instrucciones-agente.ts) que referencia algo desde sus
    // respuestas guía: el bloque NO puede ir a `instruccionesAgente`, porque
    // que ese campo pase a tener contenido hace que construirSystemPrompt
    // descarte la composición por campos (rol, tono, especialidad) y el
    // agente perdería su identidad. Va a `sistemaPrompt`, que el builder
    // agrega al final sin desactivar nada.
    expandida.sistemaPrompt = [bloque, config.sistemaPrompt?.trim()].filter(Boolean).join("\n\n");
  }

  if (Array.isArray(config.respuestasGuia)) {
    expandida.respuestasGuia = config.respuestasGuia.map((item) => {
      if (typeof item !== "object" || item === null) return item;
      const r = item as Record<string, unknown>;
      if (typeof r.formato !== "string") return item;
      return { ...r, formato: reemplazarTokens(r.formato, resueltas) };
    });
  }

  return expandida;
}
