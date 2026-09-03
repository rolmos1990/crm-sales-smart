// 024-alias-ubicaciones-transportistas — primitiva genérica de normalización,
// extraída de generarSlug() (slug.ts) para reutilizarla en dominios que no
// necesitan un slug (ej. comparación de ubicaciones). Mismo comportamiento
// exacto que generarSlug(): minúsculas, sin diacríticos, cualquier corrida de
// caracteres no alfanuméricos colapsada a un único separador, sin separador
// en los bordes.
export function normalizarTexto(texto: string, separador = "-"): string {
  const separadorEscapado = separador.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, separador)
    .replace(new RegExp(`(^${separadorEscapado}|${separadorEscapado}$)`, "g"), "");
}
