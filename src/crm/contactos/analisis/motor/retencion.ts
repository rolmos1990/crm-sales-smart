import { prisma } from "@/shared/db/prisma";
import { obtenerZonaNegocio } from "@/shared/fechas/negocio";
import { aFiltroPrisma, rangoAyer, rangoHoy } from "@/shared/fechas/rangos";
import { fechaYMDEnZona } from "@/shared/fechas/zona";

/**
 * 042 — Agregado diario y purga del detalle (FR-039, research D13).
 *
 * El resumen se RECALCULA (no se incrementa) para el día de ayer y el de hoy
 * de cada cuenta, en su zona de negocio: correrlo dos veces deja lo mismo.
 * Recién después se borra el detalle por contacto de más de 90 días, en
 * tandas, para no bloquear la tabla.
 */

const RETENCION_DETALLE_DIAS = 90;
const TANDA_PURGA = 5000;

export interface FilaAtencion {
  modo: "REGLAS" | "IA";
  estado: string;
  contactosExitosos: number;
  contactosFallidos: number;
  tokensEntrada: number;
  tokensSalida: number;
  tokensCacheados: number;
  costoEstimado: number | null;
  duracionMs: number | null;
  esperaColaMs: number | null;
}

/** Puro: suma las atenciones de un día. Los reintentos son atenciones aparte, pero un contacto exitoso cuenta una sola vez por atención exitosa. */
export function agregarAtenciones(filas: FilaAtencion[]) {
  const r = {
    atenciones: filas.length,
    atencionesFallidas: 0,
    contactosEvaluados: 0,
    contactosPorReglas: 0,
    contactosConIA: 0,
    contactosFallidos: 0,
    tokensEntrada: 0,
    tokensSalida: 0,
    tokensCacheados: 0,
    costoEstimado: 0,
    duracionTotalMs: 0,
    esperaTotalMs: 0,
  };
  for (const f of filas) {
    if (f.estado === "FALLIDA" || f.estado === "ABANDONADA") r.atencionesFallidas++;
    r.contactosEvaluados += f.contactosExitosos;
    if (f.modo === "REGLAS") r.contactosPorReglas += f.contactosExitosos;
    else r.contactosConIA += f.contactosExitosos;
    r.contactosFallidos += f.contactosFallidos;
    r.tokensEntrada += f.tokensEntrada;
    r.tokensSalida += f.tokensSalida;
    r.tokensCacheados += f.tokensCacheados;
    r.costoEstimado += f.costoEstimado ?? 0;
    r.duracionTotalMs += f.duracionMs ?? 0;
    r.esperaTotalMs += f.esperaColaMs ?? 0;
  }
  return r;
}

async function consolidarDia(instanciaId: string, zona: string, rango: { gte: Date; lt: Date }): Promise<void> {
  const filas = await prisma.ejecucionAnalisisContactos.findMany({
    where: { instanciaId, creadoEn: { gte: rango.gte, lt: rango.lt } },
    select: {
      modo: true,
      estado: true,
      contactosExitosos: true,
      contactosFallidos: true,
      tokensEntrada: true,
      tokensSalida: true,
      tokensCacheados: true,
      costoEstimado: true,
      duracionMs: true,
      esperaColaMs: true,
    },
  });
  if (filas.length === 0) return;
  const a = agregarAtenciones(filas.map((f) => ({ ...f, costoEstimado: f.costoEstimado === null ? null : Number(f.costoEstimado) })));
  const dia = fechaYMDEnZona(rango.gte, zona);
  const datos = { ...a, duracionTotalMs: BigInt(a.duracionTotalMs), esperaTotalMs: BigInt(a.esperaTotalMs) };
  await prisma.resumenDiarioAnalisisContactos.upsert({
    where: { instanciaId_dia: { instanciaId, dia } },
    create: { instanciaId, dia, ...datos },
    update: datos,
  });
}

export async function consolidarYPurgar(ahora: Date = new Date()): Promise<{ cuentas: number; purgados: number }> {
  const desde = new Date(ahora.getTime() - 3 * 24 * 60 * 60_000);
  const cuentas = await prisma.ejecucionAnalisisContactos.findMany({
    where: { creadoEn: { gte: desde } },
    select: { instanciaId: true },
    distinct: ["instanciaId"],
  });

  for (const { instanciaId } of cuentas) {
    try {
      const zona = await obtenerZonaNegocio(instanciaId);
      await consolidarDia(instanciaId, zona, aFiltroPrisma(rangoAyer(zona, ahora))!);
      await consolidarDia(instanciaId, zona, aFiltroPrisma(rangoHoy(zona, ahora))!);
    } catch (err) {
      console.error("[worker:analisis] Error consolidando el resumen diario", { instanciaId, err });
    }
  }

  const limite = new Date(ahora.getTime() - RETENCION_DETALLE_DIAS * 24 * 60 * 60_000);
  let purgados = 0;
  for (;;) {
    const n = await prisma.$executeRaw`
      DELETE FROM "EjecucionAnalisisContactosItem"
      WHERE "id" IN (SELECT "id" FROM "EjecucionAnalisisContactosItem" WHERE "procesadoEn" < ${limite} LIMIT ${TANDA_PURGA})`;
    purgados += n;
    if (n < TANDA_PURGA) break;
  }
  return { cuentas: cuentas.length, purgados };
}
