import { generarSlug } from "@/shared/lib/slug";

// Filtro del selector de provincia para cmdk.
//
// cmdk puntúa por subsecuencia difusa sobre todas las palabras clave juntas.
// Mientras cada provincia tenía solo su nombre y su código eso alcanzaba, pero
// al sumarle los lugares que cubre (distritos, corregimientos, sectores,
// alias) la lista de claves pasó a ser larga y el difuso empezó a devolver
// provincias que solo comparten letras sueltas: escribir "Coclé" traía también
// Bocas del Toro, Chiriquí, Panamá Oeste y Panamá.
//
// Acá se exige una coincidencia real —que alguna clave CONTENGA lo buscado—
// y se prioriza el nombre de la provincia por sobre los lugares, para que
// "Coclé" muestre Coclé primero aunque otra provincia tenga un distrito con
// ese nombre.

/** cmdk: 0 oculta la opción; a mayor número, más arriba aparece. */
export const PUNTAJE = { OCULTA: 0, POR_LUGAR: 1, POR_NOMBRE: 2 } as const;

/**
 * @param keywords Tal como las arma Combobox: [etiqueta, subtitulo?, ...busqueda].
 *                 La etiqueta (nombre de la provincia) siempre va primera.
 */
export function filtrarProvincia(_valor: string, busqueda: string, keywords?: string[]): number {
  const consulta = generarSlug(busqueda);
  // Sin búsqueda, cmdk pide puntaje para ordenar: todas valen igual.
  if (!consulta) return PUNTAJE.POR_LUGAR;

  const claves = (keywords ?? []).map(generarSlug);
  if (claves.length === 0) return PUNTAJE.OCULTA;

  if (claves[0].includes(consulta)) return PUNTAJE.POR_NOMBRE;
  return claves.some((clave) => clave.includes(consulta)) ? PUNTAJE.POR_LUGAR : PUNTAJE.OCULTA;
}
