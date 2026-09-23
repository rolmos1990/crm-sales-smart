// 030-variantes-producto — reglas puras de variantes (sin I/O).

export interface AtributoVariante {
  nombre: string;
  valores: string[];
}

export type ValoresVariante = Record<string, string>;

export const MAX_ATRIBUTOS = 3;
export const MAX_VARIANTES = 100;

const normalizar = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** Todas las combinaciones, en orden estable (el primer atributo varía más lento). */
export function generarCombinaciones(atributos: AtributoVariante[]): ValoresVariante[] {
  const conValores = atributos.filter((a) => a.nombre.trim() && a.valores.some((v) => v.trim()));
  if (conValores.length === 0) return [];
  return conValores.reduce<ValoresVariante[]>(
    (acumulado, atributo) =>
      acumulado.flatMap((parcial) =>
        atributo.valores
          .filter((v) => v.trim())
          .map((valor) => ({ ...parcial, [atributo.nombre.trim()]: valor.trim() })),
      ),
    [{}],
  );
}

/**
 * Combinación normalizada: identifica la variante aunque cambien mayúsculas
 * o espacios. Es lo que garantiza que no haya combinaciones duplicadas y lo
 * que permite conservar SKU/stock de una variante al editar los atributos.
 */
export function claveVariante(valores: ValoresVariante, atributos: AtributoVariante[]): string {
  return atributos.map((a) => `${normalizar(a.nombre)}=${normalizar(valores[a.nombre.trim()] ?? "")}`).join("|");
}

export function nombreVariante(valores: ValoresVariante, atributos: AtributoVariante[]): string {
  return atributos.map((a) => valores[a.nombre.trim()]?.trim()).filter(Boolean).join(" / ");
}

export interface VarianteParaValidar {
  valores: ValoresVariante;
  sku?: string | null;
}

export function validarConfiguracionVariantes(
  atributos: AtributoVariante[],
  variantes: VarianteParaValidar[],
): string | null {
  if (atributos.length === 0 || atributos.every((a) => a.valores.every((v) => !v.trim()))) {
    return "Agrega al menos un atributo con valores";
  }
  if (atributos.length > MAX_ATRIBUTOS) return `Máximo ${MAX_ATRIBUTOS} atributos por producto`;

  const nombresAtributo = new Set<string>();
  for (const atributo of atributos) {
    const nombre = normalizar(atributo.nombre);
    if (!nombre) return "Cada atributo necesita un nombre";
    if (nombresAtributo.has(nombre)) return `El atributo «${atributo.nombre.trim()}» está repetido`;
    nombresAtributo.add(nombre);

    const valores = atributo.valores.map(normalizar).filter(Boolean);
    if (valores.length === 0) return `El atributo «${atributo.nombre.trim()}» necesita al menos un valor`;
    const repetido = valores.find((v, i) => valores.indexOf(v) !== i);
    if (repetido) {
      const original = atributo.valores.find((v) => normalizar(v) === repetido)!.trim();
      return `El valor «${original}» está repetido en «${atributo.nombre.trim()}»`;
    }
  }

  if (variantes.length === 0) return "Agrega al menos un atributo con valores";
  if (variantes.length > MAX_VARIANTES) return `Máximo ${MAX_VARIANTES} variantes por producto`;

  const claves = new Set<string>();
  const skus = new Set<string>();
  for (const variante of variantes) {
    const nombre = nombreVariante(variante.valores, atributos) || "sin valores";
    const coincide =
      Object.keys(variante.valores).length === atributos.length &&
      atributos.every((a) => {
        const valor = variante.valores[a.nombre.trim()];
        return valor !== undefined && a.valores.some((v) => normalizar(v) === normalizar(valor));
      });
    if (!coincide) return `La variante «${nombre}» no coincide con los atributos del producto`;

    const clave = claveVariante(variante.valores, atributos);
    if (claves.has(clave)) return `La combinación «${nombre}» está duplicada`;
    claves.add(clave);

    const sku = variante.sku?.trim().toLowerCase();
    if (sku) {
      if (skus.has(sku)) return `El SKU «${variante.sku!.trim()}» se repite en más de una variante`;
      skus.add(sku);
    }
  }
  return null;
}

/**
 * Convertir un producto con stock a variantes es una TRANSFERENCIA: la suma
 * del stock inicial de las variantes tiene que ser exactamente el stock que
 * tenía el producto, para que nunca se duplique ni se pierda inventario.
 */
export function planConversionStock(params: {
  stockActual: number;
  manejaStock: boolean;
  stockVariantes: number[];
}): { ok: true } | { ok: false; error: string } {
  if (!params.manejaStock || params.stockActual <= 0) return { ok: true };
  if (params.stockVariantes.some((s) => s < 0)) return { ok: false, error: "El stock de una variante no puede ser negativo" };
  const asignado = params.stockVariantes.reduce((a, b) => a + b, 0);
  if (asignado === params.stockActual) return { ok: true };
  return {
    ok: false,
    error: `Distribuye el stock actual (${params.stockActual}) entre las variantes: asignado ${asignado}`,
  };
}
