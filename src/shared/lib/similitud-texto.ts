// 024-alias-ubicaciones-transportistas — similitud aproximada para tolerar
// errores ortográficos leves en el matching de ubicaciones (nivel de
// confianza PROBABLE). Sin dependencias externas: el volumen esperado (las
// ZonaEntregaUbicacion/AliasUbicacion de una sola instancia) no justifica
// pg_trgm ni una librería de fuzzy-matching — ver research.md §4.

/** Distancia de edición clásica (programación dinámica O(n*m)). */
export function distanciaLevenshtein(a: string, b: string): number {
  const filas = a.length + 1;
  const columnas = b.length + 1;
  const dp: number[][] = Array.from({ length: filas }, () => new Array<number>(columnas).fill(0));

  for (let i = 0; i < filas; i++) dp[i][0] = i;
  for (let j = 0; j < columnas; j++) dp[0][j] = j;

  for (let i = 1; i < filas; i++) {
    for (let j = 1; j < columnas; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + costo);
    }
  }

  return dp[filas - 1][columnas - 1];
}

/** 1 = idénticos, 0 = completamente distintos. Normalizado por la longitud del texto más largo. */
export function similitud(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - distanciaLevenshtein(a, b) / maxLen;
}

/**
 * Umbral inicial para considerar una coincidencia "PROBABLE" (research.md §4
 * Assumptions — valor inicial ajustable, no una decisión de producto cerrada).
 */
export const UMBRAL_SIMILITUD_APROXIMADA = 0.75;
