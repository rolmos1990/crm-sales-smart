import { normalizarTexto } from "@/shared/lib/normalizar-texto";

// 024-alias-ubicaciones-transportistas — entrypoint de dominio sobre
// normalizarTexto() (FR-001): minúsculas, sin tildes, espacios/puntuación
// colapsados. Se guarda como función propia (no un simple re-export) para
// dejar un único punto de cambio si en el futuro se agrega un diccionario de
// abreviaturas geográficas — explícitamente fuera de alcance de este spec.
export function normalizarUbicacion(texto: string): string {
  return normalizarTexto(texto);
}
