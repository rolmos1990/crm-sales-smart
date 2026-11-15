// 033 — Aislamiento. El archivo más delicado de esta feature.
//
// Hay un vector store POR INSTANCIA (ver vector-store.ts), así que entre
// comercios el aislamiento es físico: el índice de uno no contiene bytes de
// otro. Pero dentro de una misma cuenta conviven los documentos de todos sus
// agentes, y ahí la separación es puramente lógica — la sostiene este archivo.
//
// Y la garantía del Principio V de la constitución ("toda query scoped al
// tenant autenticado"), que en el resto del repo la da una cláusula `where` de
// Prisma trivial de auditar, acá hay que reconstruirla con medios propios
// igual: parte de la consulta se ejecuta del lado de OpenAI, fuera de nuestro
// control. Entre comercios esto es defensa en profundidad; entre agentes es la
// única línea.
//
// Cuatro capas, todas derivadas de este archivo y de ningún otro:
//
//   1. nombreArchivoOpenAI()  → la identidad viaja en el nombre del archivo
//   2. atributosArchivo()     → y en sus atributos consultables
//   3. filtroTenant()         → toda búsqueda filtra por ellos, obligatoriamente
//   4. verificarResultados()  → y lo devuelto se verifica igual, por las dudas
//
// Ninguna función de acá acepta un parámetro que permita omitir la identidad.
// Eso es deliberado: la garantía tiene que ser estructural, no depender de que
// cada llamador se acuerde. Si alguna vez hace falta "buscar en todo", no se
// agrega un flag acá — se discute de nuevo el modelo de aislamiento.
//
// Los tests de aislamiento.test.ts son la red: si alguien afloja cualquiera de
// las cuatro capas y ninguno se pone en rojo, el test está mal escrito.

export interface IdentidadDocumento {
  instanciaId: string;
  agenteId: string;
  documentoId: string;
}

/** La forma mínima que necesita la verificación. Es un tipo propio y no el del
 *  SDK de OpenAI a propósito: así `verificarResultados` se testea sin mockear
 *  nada, y la constitución (Principio IV) se cumple sin esfuerzo. */
export interface FragmentoDocumental {
  attributes?: Record<string, string | number | boolean> | null;
  filename?: string;
}

export type FiltroDocumentacion = {
  type: "and";
  filters: Array<{ type: "eq"; key: string; value: string }>;
};

/** Claves de los atributos. Constantes y no literales sueltos: el filtro y el
 *  verificador tienen que mirar exactamente lo mismo que escribió el indexador. */
export const CLAVE_INSTANCIA = "instanciaId";
export const CLAVE_AGENTE = "agenteId";
export const CLAVE_DOCUMENTO = "documentoId";

/** Separador entre los tres ids y el nombre original. Los cuid de Prisma no lo
 *  contienen, así que el prefijo nunca se vuelve ambiguo. */
const SEPARADOR = "_";

/**
 * Deja el nombre original apto para viajar como `filename` en OpenAI: sin
 * separadores que rompan el prefijo de identidad, sin acentos ni espacios.
 * No busca ser reversible — el nombre que ve el negocio vive en la base de
 * datos; esto es solo la etiqueta del archivo remoto.
 */
function sanearNombre(nombre: string): string {
  return (
    nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // El guion bajo es el separador del prefijo: no puede sobrevivir en la
      // parte libre del nombre o se volvería imposible leer la identidad.
      .replace(/[^a-zA-Z0-9.-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 120) || "documento"
  );
}

/**
 * `instanciaId_agenteId_documentoId_nombreSaneado` — FR-011.
 *
 * Que la identidad esté en el nombre y no solo en los atributos tiene un
 * propósito operativo concreto: mirando el dashboard de OpenAI se puede saber
 * de quién es cada archivo y borrar los de una cuenta sin consultar la base.
 */
export function nombreArchivoOpenAI(id: IdentidadDocumento, nombreOriginal: string): string {
  return [id.instanciaId, id.agenteId, id.documentoId, sanearNombre(nombreOriginal)].join(SEPARADOR);
}

/** Atributos consultables del vector store file. Son los que filtra la
 *  búsqueda y los que verifica `verificarResultados` — FR-011. */
export function atributosArchivo(id: IdentidadDocumento): Record<string, string> {
  return {
    [CLAVE_INSTANCIA]: id.instanciaId,
    [CLAVE_AGENTE]: id.agenteId,
    [CLAVE_DOCUMENTO]: id.documentoId,
  };
}

/**
 * Filtro obligatorio de toda búsqueda — FR-012.
 *
 * Sin parámetros opcionales y sin variante "sin filtro": no existe la forma de
 * llamar a una búsqueda sin acotarla al tenant. `buscarEnDocumentacion` tampoco
 * acepta un filtro del llamador, así que este es el único que se usa jamás.
 */
export function filtroTenant(instanciaId: string, agenteId: string): FiltroDocumentacion {
  if (!instanciaId || !agenteId) {
    // No es validación defensiva de rutina: un id vacío produciría un filtro
    // que no filtra nada, y el store de la cuenta tiene los documentos de
    // todos sus agentes. Preferimos romper.
    throw new Error("[Documentacion] filtroTenant requiere instanciaId y agenteId no vacíos");
  }

  return {
    type: "and",
    filters: [
      { type: "eq", key: CLAVE_INSTANCIA, value: instanciaId },
      { type: "eq", key: CLAVE_AGENTE, value: agenteId },
    ],
  };
}

export type ResultadoVerificacion = { ok: true } | { ok: false; motivo: string };

/**
 * Verifica que TODO fragmento devuelto pertenece al tenant que consultó —
 * FR-013, FR-014.
 *
 * Es la cuarta capa y la que vale incluso si las otras tres fallan: aunque el
 * filtro de OpenAI devolviera algo ajeno, esto lo detecta antes de que el
 * texto llegue al modelo y, por lo tanto, al cliente.
 *
 * **Fail-closed**: un fragmento sin atributos se considera ajeno. Un archivo
 * mal indexado (sin identidad) no puede colarse por omisión.
 *
 * Devuelve un objeto y no un boolean para que el llamador no pueda ignorar el
 * resultado por descuido — un `if (verificar(...))` olvidado es justo el tipo
 * de error que acá no puede pasar.
 */
export function verificarResultados(
  fragmentos: FragmentoDocumental[],
  instanciaId: string,
  agenteId: string,
): ResultadoVerificacion {
  for (const [indice, fragmento] of fragmentos.entries()) {
    const attrs = fragmento.attributes;

    if (!attrs) {
      return { ok: false, motivo: `El fragmento ${indice} no trae atributos de identidad` };
    }

    if (attrs[CLAVE_INSTANCIA] !== instanciaId) {
      // El motivo NO incluye el texto del fragmento ajeno: este string termina
      // en los logs, y filtrar datos de otro comercio al log sería el mismo
      // problema que estamos evitando, solo que en otro lado.
      return {
        ok: false,
        motivo: `El fragmento ${indice} pertenece a otra instancia (esperada ${instanciaId})`,
      };
    }

    if (attrs[CLAVE_AGENTE] !== agenteId) {
      return {
        ok: false,
        motivo: `El fragmento ${indice} pertenece a otro agente (esperado ${agenteId})`,
      };
    }
  }

  return { ok: true };
}
