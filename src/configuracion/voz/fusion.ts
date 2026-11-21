import type {
  CoberturaCosto,
  ConsumoProveedor,
  ConsumoVoz,
  ProveedorVozListado,
} from "./queries";

/**
 * 050 — Cruce entre los proveedores configurados y el consumo del mes.
 *
 * Vive aparte de `queries.ts` para poder testearse sin base de datos: acá están
 * los cuatro casos que de verdad pueden fallar —proveedor sin consumo, consumo
 * huérfano, varios eliminados colapsando en uno, y el orden de la lista—.
 */

/** `ProveedorVozListado` ya excluye `apiKeyEncriptada` por construcción. */
export type ProveedorVozConConsumo = ProveedorVozListado & { consumoMes: ConsumoVoz };

const SIN_CONSUMO: ConsumoVoz = {
  minutos: 0,
  costo: null,
  costoCobertura: "NO_ESTIMABLE",
  transcripciones: 0,
};

export function fusionarConsumoProveedores(
  proveedores: ProveedorVozListado[],
  mesPorProveedor: ConsumoProveedor[],
): { conConsumo: ProveedorVozConConsumo[]; eliminados: ConsumoVoz | null } {
  const porId = new Map(
    mesPorProveedor
      .filter((g): g is ConsumoProveedor & { proveedorVozId: string } => g.proveedorVozId !== null)
      .map((g) => [g.proveedorVozId, g.consumo]),
  );

  const conConsumo = proveedores.map((p) => ({ ...p, consumoMes: porId.get(p.id) ?? SIN_CONSUMO }));

  // Un grupo con id que no está configurado no debería existir —el borrado pone
  // el id en NULL, no lo deja colgado—, pero si apareciera se acumula acá en vez
  // de descartarse: que las filas sumen el total importa más que la prolijidad
  // de la atribución, y descartarlo descuadraría la pantalla sin ningún síntoma.
  const configurados = new Set(proveedores.map((p) => p.id));
  const huerfanos = mesPorProveedor
    .filter((g) => g.proveedorVozId === null || !configurados.has(g.proveedorVozId))
    .map((g) => g.consumo);

  return { conConsumo, eliminados: huerfanos.length > 0 ? sumarConsumos(huerfanos) : null };
}

/**
 * Los minutos y costos que entran acá ya vienen repartidos a 1 y 2 decimales,
 * así que sumarlos es exacto; el redondeo solo limpia el ruido de punto
 * flotante y no vuelve a mover ninguna cifra.
 */
function sumarConsumos(consumos: ConsumoVoz[]): ConsumoVoz {
  const minutos = consumos.reduce((a, c) => a + c.minutos, 0);
  const conCosto = consumos.filter((c) => c.costo !== null);
  const costo = conCosto.reduce((a, c) => a + c.costo!, 0);

  return {
    minutos: Math.round(minutos * 10) / 10,
    costo: conCosto.length > 0 ? Math.round(costo * 100) / 100 : null,
    costoCobertura: combinarCobertura(consumos.map((c) => c.costoCobertura)),
    transcripciones: consumos.reduce((a, c) => a + c.transcripciones, 0),
  };
}

function combinarCobertura(coberturas: CoberturaCosto[]): CoberturaCosto {
  if (coberturas.every((c) => c === "NO_ESTIMABLE")) return "NO_ESTIMABLE";
  if (coberturas.every((c) => c === "COMPLETO")) return "COMPLETO";
  return "PARCIAL";
}
