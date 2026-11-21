/**
 * 050 — Reparto de redondeo por resto mayor.
 *
 * Existe por una sola razón: sin esto las filas del desglose de voz no suman la
 * tarjeta de total. Tres proveedores con 12.34 minutos se muestran 12.3 + 12.3 +
 * 12.3 = 36.9 mientras la tarjeta dice 37.0, y una pantalla de costos que no
 * cuadra se lee como rota aunque el total sea correcto. Con 2–4 proveedores el
 * desvío aparece buena parte de las veces, no ocasionalmente.
 *
 * Invariante: `suma(repartirRedondeo(v, d)) === objetivo`.
 */

/**
 * @param objetivo Suma exacta que deben dar las salidas, ya redondeada a
 *   `decimales`. **El llamador lo pasa calculado con la MISMA expresión que usa
 *   la tarjeta de total**, y esa es la razón de que el parámetro exista: derivar
 *   el objetivo acá de `suma(valores)` deja a merced del punto flotante los
 *   casos que caen justo sobre un límite de redondeo —y con minutos salidos de
 *   segundos enteros esos límites se tocan seguido, uno cada 3 segundos—. Un
 *   desvío de un ULP ahí vuelve a romper lo mismo que esta función arregla.
 *   Omitirlo usa `suma(valores)`, que es correcto cuando no hay un total externo
 *   que respetar.
 */
export function repartirRedondeo(
  valores: number[],
  decimales: number,
  objetivo?: number,
): number[] {
  if (valores.length === 0) return [];

  const factor = 10 ** decimales;

  // Todo el reparto ocurre en unidades enteras de 10^-decimales. Comparar
  // restos como fracciones es justo lo que esta función existe para evitar.
  const escalados = valores.map((v) => v * factor);
  const piso = escalados.map((e) => Math.floor(e));

  const meta = Math.round(
    (objetivo ?? valores.reduce((acumulado, v) => acumulado + v, 0)) * factor,
  );

  let resto = meta - piso.reduce((acumulado, p) => acumulado + p, 0);

  // Resto mayor primero; empate por índice menor para que dos renders del mismo
  // dato den exactamente lo mismo.
  const porResto = escalados
    .map((e, indice) => ({ indice, fraccion: e - Math.floor(e) }))
    .sort((a, b) => b.fraccion - a.fraccion || a.indice - b.indice);

  const salida = [...piso];

  // Una entrada en cero tiene fracción cero y queda al final del orden, así que
  // nunca recibe ajuste: mostrar "0.1 min" en un proveedor que no consumió nada
  // sería peor que el descuadre original.
  for (const { indice } of porResto) {
    if (resto <= 0) break;
    salida[indice] += 1;
    resto -= 1;
  }

  return salida.map((s) => s / factor);
}
