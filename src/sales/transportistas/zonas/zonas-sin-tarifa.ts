// Qué zonas del transportista todavía no tienen tarifa.
//
// Desde que las zonas son de un transportista (ver ZonaEntrega.transportistaId),
// `zonas` y `tarifas` son del mismo dueño y esto es simplemente "las que
// quedan por configurar" — una lista corta y accionable. Antes las zonas eran
// de la empresa y acá aparecían también las de otros transportistas.
//
// Se extrajo del componente al aparecer un aviso que listaba zonas que la
// tabla de abajo ya mostraba con su tarifa (una lista de zonas vieja
// comparada contra tarifas nuevas). El criterio merecía quedar fijado con
// tests: es fácil invertirlo o compararlo contra el conjunto equivocado sin
// que nada falle.

export function zonasSinTarifaDelTransportista<Z extends { id: string }>(
  zonas: readonly Z[],
  tarifasDelTransportista: readonly { zonaEntrega: { id: string } }[],
): Z[] {
  const idsConTarifa = new Set(tarifasDelTransportista.map((t) => t.zonaEntrega.id));
  return zonas.filter((z) => !idsConTarifa.has(z.id));
}
