// 009-perfil-agente-estructurado-versionado (FR-007) — detecta contradicciones
// evidentes entre el campo de instrucciones libres (sistemaPrompt) y las
// reglas obligatorias/estructuradas del agente, para advertir antes de
// publicar. Heurística léxica y determinística a propósito (ver research.md
// Decisión 4 de la spec): no usa IA, no pretende comprensión semántica
// perfecta — solo los casos más evidentes, sin costo ni latencia adicional.

export interface ReglasEstructuradasParaContradiccion {
  comportamientosProhibidos?: string[] | null;
}

const PATRONES_PERMITIR_SIN_CONSULTAR = [
  /confirma(r)?\s+(el\s+)?(precio|disponibilidad|entrega)[^.]{0,40}sin\s+(verificar|consultar|confirmar)/,
  /puedes\s+(prometer|confirmar|dar)\s+(el\s+)?(precio|disponibilidad|fecha de entrega)[^.]{0,40}sin/,
  /no\s+(hace falta|necesitas|es necesario)\s+(verificar|consultar)\s+(precio|disponibilidad|inventario|stock)/,
];

const STOPWORDS = new Set([
  "no", "a", "el", "la", "los", "las", "de", "del", "en", "un", "una",
  "y", "o", "sin", "para", "con", "que", "al", "su", "sus",
]);

function extraerPalabrasClave(texto: string): string[] {
  return texto
    .toLowerCase()
    .split(/\s+/)
    .map((palabra) => palabra.replace(/[^a-záéíóúñ]/g, ""))
    .filter((palabra) => palabra.length > 3 && !STOPWORDS.has(palabra));
}

const PATRON_PERMISO = /puedes|puede|puedo|está bien|no hay problema|no pasa nada/;

/**
 * Devuelve una lista de advertencias (vacía si no se detecta ninguna
 * contradicción evidente). Nunca bloquea — el llamador decide si permite
 * publicar de todas formas (FR-007: advertencia, no bloqueo silencioso).
 */
export function detectarContradicciones(
  sistemaPromptLibre: string | null | undefined,
  reglas: ReglasEstructuradasParaContradiccion,
): string[] {
  if (!sistemaPromptLibre || sistemaPromptLibre.trim().length === 0) return [];

  const textoLower = sistemaPromptLibre.toLowerCase();
  const advertencias: string[] = [];

  if (PATRONES_PERMITIR_SIN_CONSULTAR.some((patron) => patron.test(textoLower))) {
    advertencias.push(
      "El texto de instrucciones libres parece permitir confirmar precio, disponibilidad o entrega sin consultar la información real, lo cual contradice una regla obligatoria del sistema (no prometer datos operativos sin verificarlos).",
    );
  }

  for (const comportamiento of reglas.comportamientosProhibidos ?? []) {
    const palabrasClave = extraerPalabrasClave(comportamiento);
    if (palabrasClave.length === 0) continue;

    const mencionaElComportamiento = palabrasClave.every((palabra) => textoLower.includes(palabra));
    if (mencionaElComportamiento && PATRON_PERMISO.test(textoLower)) {
      advertencias.push(
        `El texto de instrucciones libres podría estar permitiendo algo relacionado con el comportamiento prohibido: "${comportamiento}".`,
      );
    }
  }

  return advertencias;
}
