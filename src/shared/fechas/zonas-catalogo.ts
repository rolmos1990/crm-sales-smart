/**
 * Catálogo de zonas horarias ofrecidas en configuración.
 *
 * Identificadores IANA siempre — nunca offsets fijos tipo "UTC-5": no
 * contemplan el horario de verano, así que en Santiago o Madrid darían el día
 * equivocado la mitad del año. La etiqueta sí menciona el offset porque es lo
 * que la gente reconoce al elegir.
 */

export const ZONAS_HORARIAS = [
  { valor: "America/Panama",                 etiqueta: "Panamá (UTC-5)" },
  { valor: "America/Lima",                   etiqueta: "Lima (UTC-5)" },
  { valor: "America/Bogota",                 etiqueta: "Bogotá (UTC-5)" },
  { valor: "America/Mexico_City",            etiqueta: "Ciudad de México (UTC-6)" },
  { valor: "America/Argentina/Buenos_Aires", etiqueta: "Buenos Aires (UTC-3)" },
  { valor: "America/Santiago",               etiqueta: "Santiago (UTC-4/-3)" },
  { valor: "America/Guayaquil",              etiqueta: "Guayaquil (UTC-5)" },
  { valor: "America/La_Paz",                 etiqueta: "La Paz (UTC-4)" },
  { valor: "America/Caracas",                etiqueta: "Caracas (UTC-4)" },
  { valor: "America/New_York",               etiqueta: "Nueva York (UTC-5/-4)" },
  { valor: "Europe/Madrid",                  etiqueta: "Madrid (UTC+1/+2)" },
  { valor: "UTC",                            etiqueta: "UTC (UTC+0)" },
] as const;

export type CodigoZonaHoraria = (typeof ZONAS_HORARIAS)[number]["valor"];

/**
 * Mapa valor → etiqueta para la prop `items` del `<Select>`.
 *
 * Obligatorio: sin `items`, el trigger muestra el valor crudo
 * ("America/Panama") en vez de la etiqueta hasta que el usuario abre el popup
 * una vez. Ver docs/selects.md.
 */
export const ZONAS_HORARIAS_ITEMS: Record<string, string> = Object.fromEntries(
  ZONAS_HORARIAS.map((z) => [z.valor, z.etiqueta]),
);
