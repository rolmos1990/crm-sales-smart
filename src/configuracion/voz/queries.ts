import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import { repartirRedondeo } from "./reparto";
import { obtenerZonaNegocio } from "@/shared/fechas/negocio";
import { rangoHoy, rangoEsteMes, aFiltroPrisma } from "@/shared/fechas/rangos";

/**
 * 049 — Lecturas de la pestaña de Voz.
 *
 * Ninguna devuelve `apiKeyEncriptada`. El `select` es explícito justamente por
 * eso: con un `findMany` sin select, agregar un campo sensible al modelo lo
 * publicaría al cliente sin que nadie lo note (FR-002).
 */

export interface ProveedorVozListado {
  id: string;
  alias: string;
  proveedor: string;
  baseUrl: string | null;
  modelo: string;
  activo: boolean;
  prioridad: number;
  costoPorHora: string | null;
  limiteMinutosDia: number | null;
  timeoutMs: number;
  reintentosMax: number;
  tieneCredencial: boolean;
}

export async function obtenerProveedoresVoz(instanciaId: string): Promise<ProveedorVozListado[]> {
  const filas = await prisma.proveedorVoz.findMany({
    where: { instanciaId },
    orderBy: [{ activo: "desc" }, { prioridad: "desc" }, { alias: "asc" }],
    select: {
      id: true,
      alias: true,
      proveedor: true,
      baseUrl: true,
      modelo: true,
      activo: true,
      prioridad: true,
      costoPorHora: true,
      limiteMinutosDia: true,
      timeoutMs: true,
      reintentosMax: true,
      // Solo si HAY credencial, nunca cuál.
      apiKeyEncriptada: true,
    },
  });

  return filas.map(({ apiKeyEncriptada, costoPorHora, ...resto }) => ({
    ...resto,
    costoPorHora: costoPorHora ? costoPorHora.toString() : null,
    tieneCredencial: Boolean(apiKeyEncriptada),
  }));
}

export type CoberturaCosto = "COMPLETO" | "PARCIAL" | "NO_ESTIMABLE";

/**
 * Una cifra de consumo, ya lista para mostrar.
 *
 * `costo` en `null` significa **no estimable**, nunca cero: un proveedor sin
 * tarifa cargada mostrando `0.00` se lee como "este servicio sale gratis", que
 * es justo el malentendido que 050 corrige.
 */
export interface ConsumoVoz {
  minutos: number;
  costo: number | null;
  costoCobertura: CoberturaCosto;
  transcripciones: number;
}

export interface ConsumoProveedor {
  /** `null` = la agrupación de proveedores ya eliminados (`onDelete: SetNull`). */
  proveedorVozId: string | null;
  consumo: ConsumoVoz;
}

export interface ResumenUsoVoz {
  hoy: ConsumoVoz;
  mes: ConsumoVoz;
  mesPorProveedor: ConsumoProveedor[];
}

/**
 * Minutos y costo consumidos, con el desglose del mes por proveedor.
 *
 * Los cortes de día y mes salen de `obtenerZonaNegocio`, NO de la zona del
 * navegador: "hoy" tiene que significar lo mismo para el comercio que para
 * cualquier otro total de Karia (regla 7 de CLAUDE.md).
 */
export async function obtenerResumenUsoVoz(instanciaId: string): Promise<ResumenUsoVoz> {
  const zona = await obtenerZonaNegocio(instanciaId);
  const ahora = new Date();

  const [hoy, grupos] = await Promise.all([
    agregar(instanciaId, aFiltroPrisma(rangoHoy(zona, ahora))!),
    agruparPorProveedor(instanciaId, aFiltroPrisma(rangoEsteMes(zona, ahora))!),
  ]);

  return { hoy, ...desglosarMes(grupos) };
}

async function agregar(instanciaId: string, rango: { gte: Date; lt: Date }): Promise<ConsumoVoz> {
  const r = await prisma.usoVoz.aggregate({
    where: { instanciaId, exito: true, creadoEn: rango },
    _sum: { segundos: true, costoEstimado: true },
    // `costoEstimado` cuenta los NO nulos. Sin ese segundo contador, un tramo
    // sin tarifa es indistinguible de uno con tarifa cero, porque `_sum`
    // ignora los NULL y devuelve un monto que parece completo.
    _count: { _all: true, costoEstimado: true },
  });

  return {
    minutos: Math.round(((r._sum.segundos ?? 0) / 60) * 10) / 10,
    costo: r._sum.costoEstimado ? Number(r._sum.costoEstimado) : null,
    costoCobertura: cobertura(r._count.costoEstimado, r._count._all),
    transcripciones: r._count._all,
  };
}

function agruparPorProveedor(instanciaId: string, rango: { gte: Date; lt: Date }) {
  return prisma.usoVoz.groupBy({
    by: ["proveedorVozId"],
    where: { instanciaId, exito: true, creadoEn: rango },
    _sum: { segundos: true, costoEstimado: true },
    _count: { _all: true, costoEstimado: true },
  });
}

type GrupoUsoVoz = Awaited<ReturnType<typeof agruparPorProveedor>>[number];

/**
 * El total del mes se **deriva** de los grupos; no sale de una consulta aparte.
 *
 * `SUM(x)` sobre todas las filas ES la suma de los `SUM(x)` por grupo, porque
 * `GROUP BY` particiona el conjunto filtrado sin solaparlo ni perder filas
 * —incluidas las de `proveedorVozId IS NULL`, que forman su propio grupo—. Así
 * "las filas suman el total" (FR-004) es aritmética y no convención: correr dos
 * consultas independientes lo dejaría a merced de que nadie toque un `where`.
 */
function desglosarMes(grupos: GrupoUsoVoz[]): Omit<ResumenUsoVoz, "hoy"> {
  const segundos = grupos.reduce((a, g) => a + (g._sum.segundos ?? 0), 0);
  const transcripciones = grupos.reduce((a, g) => a + g._count._all, 0);
  const conCosto = grupos.reduce((a, g) => a + g._count.costoEstimado, 0);

  // Los Decimal se suman como Decimal y se convierten a número UNA vez, al
  // borde de la presentación. Acumular con `+` introduce desvío justo donde no
  // se ve y rompe la igualdad de arriba.
  const costoDecimal = grupos.reduce(
    (a, g) => (g._sum.costoEstimado ? a.add(g._sum.costoEstimado) : a),
    new Prisma.Decimal(0),
  );

  const mes: ConsumoVoz = {
    // Misma expresión exacta que antes de 050: la tarjeta no puede cambiar de
    // valor por agregar el desglose (FR-003).
    minutos: Math.round((segundos / 60) * 10) / 10,
    costo: conCosto > 0 ? Number(costoDecimal) : null,
    costoCobertura: cobertura(conCosto, transcripciones),
    transcripciones,
  };

  // El redondeo se reparte una sola vez, al final y sobre los valores exactos,
  // contra el total que ya calculó la tarjeta. Redondear antes de sumar, o
  // dejar que cada fila redondee por su cuenta, descuadra la pantalla.
  const minutosPorGrupo = repartirRedondeo(
    grupos.map((g) => (g._sum.segundos ?? 0) / 60),
    1,
    mes.minutos,
  );

  // Un grupo sin ningún costo estimable no participa del reparto: sumaría cero
  // y podría recibir un centavo de ajuste que no le corresponde.
  const indicesConCosto = grupos.flatMap((g, i) => (g._count.costoEstimado > 0 ? [i] : []));
  const costosRepartidos = repartirRedondeo(
    indicesConCosto.map((i) => Number(grupos[i]._sum.costoEstimado)),
    2,
    mes.costo === null ? 0 : Number(mes.costo.toFixed(2)),
  );
  const costoPorGrupo = new Map(indicesConCosto.map((i, n) => [i, costosRepartidos[n]]));

  const mesPorProveedor: ConsumoProveedor[] = grupos.map((g, i) => ({
    proveedorVozId: g.proveedorVozId,
    consumo: {
      minutos: minutosPorGrupo[i],
      costo: costoPorGrupo.get(i) ?? null,
      costoCobertura: cobertura(g._count.costoEstimado, g._count._all),
      transcripciones: g._count._all,
    },
  }));

  return { mes, mesPorProveedor };
}

function cobertura(conCosto: number, total: number): CoberturaCosto {
  if (total === 0 || conCosto === 0) return "NO_ESTIMABLE";
  return conCosto === total ? "COMPLETO" : "PARCIAL";
}
