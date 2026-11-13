// Qué zonas del catálogo no cubre este transportista.
//
// Las zonas son de la empresa, no del transportista: la misma "Coclé" la
// pueden cubrir varios, cada uno con su tarifa. Así que "sin tarifa" acá
// siempre significa "sin tarifa DE ESTE transportista", nunca "sin tarifa de
// nadie".
//
// Se extrajo del componente al aparecer un aviso que listaba zonas que la
// tabla de abajo ya mostraba con su tarifa. La causa estaba en el componente
// (una lista de zonas vieja comparada contra tarifas nuevas), pero el
// criterio en sí merecía quedar fijado con tests: es fácil invertirlo o
// compararlo contra el conjunto equivocado sin que nada falle.

export function zonasSinTarifaDelTransportista<Z extends { id: string }>(
  zonas: readonly Z[],
  tarifasDelTransportista: readonly { zonaEntrega: { id: string } }[],
): Z[] {
  const idsConTarifa = new Set(tarifasDelTransportista.map((t) => t.zonaEntrega.id));
  return zonas.filter((z) => !idsConTarifa.has(z.id));
}
