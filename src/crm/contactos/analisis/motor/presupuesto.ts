import type { PrioridadAnalisis } from "@/generated/prisma/enums";
import { prisma } from "@/shared/db/prisma";
import { obtenerZonaNegocio } from "@/shared/fechas/negocio";
import { aFiltroPrisma, rangoHoy } from "@/shared/fechas/rangos";
import { resolverProveedorPorObjetivo } from "@/ai/orquestador/orquestador";
import { configEntorno } from "../config-entorno";

/**
 * 042 — ¿Puede esta cuenta usar IA para analizar contactos AHORA? (research
 * D9, FR-043, FR-044, FR-044a). Se revisa ANTES de llamar al proveedor:
 *
 * 1. Presupuesto propio de la cuenta (opcional; por defecto no hay).
 * 2. `ConfiguracionIA.limiteTokensDiarios` de la cuenta, que comparte con el
 *    agente conversacional: desde el 80 % se pausa el histórico (P2); al 100 %
 *    no se analiza nada con IA. Así siempre queda margen para atender clientes.
 * 3. Límites por minuto y por día del proveedor que atendería la tarea.
 * 4. Presupuesto global diario de Karia.
 *
 * Para no sumar `UsoIA` en cada turno, el consumo se cachea 60 s por cuenta y
 * se incrementa localmente con lo que reporta cada atención. Con varios
 * workers el exceso posible queda acotado a un lote por worker (SC-014).
 */

export interface Disponibilidad {
  disponible: boolean;
  motivo?:
    | "IA_DESHABILITADA"
    | "SIN_PROVEEDOR"
    | "PRESUPUESTO_CUENTA"
    | "LIMITE_CUENTA"
    | "LIMITE_CUENTA_HISTORICO"
    | "LIMITE_PROVEEDOR"
    | "PRESUPUESTO_GLOBAL";
}

export const UMBRAL_HISTORICO_LIMITE_CUENTA = 0.8;
const TTL_MS = 60_000;

interface ConsumoCuenta {
  tokensAnalisis: number;
  costoAnalisis: number;
  tokensTodasLasTareas: number;
  vence: number;
}

const cacheCuenta = new Map<string, ConsumoCuenta>();
let cacheGlobal: { costo: number; vence: number } | null = null;

/** Lo que reporta cada atención; evita volver a sumar `UsoIA` hasta que vence la caché. */
export function registrarConsumoLocal(instanciaId: string, tokens: number, costo: number | null): void {
  const c = cacheCuenta.get(instanciaId);
  if (c) {
    c.tokensAnalisis += tokens;
    c.tokensTodasLasTareas += tokens;
    c.costoAnalisis += costo ?? 0;
  }
  if (cacheGlobal) cacheGlobal.costo += costo ?? 0;
}

async function consumoCuenta(instanciaId: string, ahora: Date): Promise<ConsumoCuenta> {
  const c = cacheCuenta.get(instanciaId);
  if (c && c.vence > ahora.getTime()) return c;
  const zona = await obtenerZonaNegocio(instanciaId);
  const hoy = aFiltroPrisma(rangoHoy(zona, ahora))!;
  const [analisis, todas] = await Promise.all([
    prisma.usoIA.aggregate({
      where: { instanciaId, tarea: "ANALISIS_CONTACTOS", creadoEn: hoy },
      _sum: { tokensInput: true, tokensOutput: true, costoEstimado: true },
    }),
    prisma.usoIA.aggregate({
      where: { instanciaId, creadoEn: hoy },
      _sum: { tokensInput: true, tokensOutput: true },
    }),
  ]);
  const nuevo: ConsumoCuenta = {
    tokensAnalisis: (analisis._sum.tokensInput ?? 0) + (analisis._sum.tokensOutput ?? 0),
    costoAnalisis: Number(analisis._sum.costoEstimado ?? 0),
    tokensTodasLasTareas: (todas._sum.tokensInput ?? 0) + (todas._sum.tokensOutput ?? 0),
    vence: ahora.getTime() + TTL_MS,
  };
  cacheCuenta.set(instanciaId, nuevo);
  return nuevo;
}

async function costoGlobalHoy(ahora: Date): Promise<number> {
  if (cacheGlobal && cacheGlobal.vence > ahora.getTime()) return cacheGlobal.costo;
  const inicioDiaUtc = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
  const finDiaUtc = new Date(inicioDiaUtc.getTime() + 24 * 60 * 60_000);
  const r = await prisma.usoIA.aggregate({
    where: { tarea: "ANALISIS_CONTACTOS", creadoEn: { gte: inicioDiaUtc, lt: finDiaUtc } },
    _sum: { costoEstimado: true },
  });
  cacheGlobal = { costo: Number(r._sum.costoEstimado ?? 0), vence: ahora.getTime() + TTL_MS };
  return cacheGlobal.costo;
}

/** Puro: aplica los umbrales sobre el consumo ya medido. */
export function decidirDisponibilidad(p: {
  prioridad: PrioridadAnalisis;
  presupuestoCosto: number | null;
  presupuestoTokens: number | null;
  limiteTokensDiariosCuenta: number | null;
  consumo: { tokensAnalisis: number; costoAnalisis: number; tokensTodasLasTareas: number };
  proveedorTieneCostos: boolean;
  limiteProveedorAlcanzado: boolean;
  presupuestoGlobalUsd: number | null;
  costoGlobalHoy: number;
}): Disponibilidad {
  if (p.presupuestoGlobalUsd !== null && p.costoGlobalHoy >= p.presupuestoGlobalUsd) {
    return { disponible: false, motivo: "PRESUPUESTO_GLOBAL" };
  }
  // Presupuesto propio: en costo si el proveedor tiene tarifas; si no, en tokens.
  if (p.proveedorTieneCostos && p.presupuestoCosto !== null && p.consumo.costoAnalisis >= p.presupuestoCosto) {
    return { disponible: false, motivo: "PRESUPUESTO_CUENTA" };
  }
  if ((!p.proveedorTieneCostos || p.presupuestoCosto === null) && p.presupuestoTokens !== null && p.consumo.tokensAnalisis >= p.presupuestoTokens) {
    return { disponible: false, motivo: "PRESUPUESTO_CUENTA" };
  }
  if (p.limiteTokensDiariosCuenta !== null && p.limiteTokensDiariosCuenta > 0) {
    const uso = p.consumo.tokensTodasLasTareas / p.limiteTokensDiariosCuenta;
    if (uso >= 1) return { disponible: false, motivo: "LIMITE_CUENTA" };
    if (p.prioridad === "P2" && uso >= UMBRAL_HISTORICO_LIMITE_CUENTA) {
      return { disponible: false, motivo: "LIMITE_CUENTA_HISTORICO" };
    }
  }
  if (p.limiteProveedorAlcanzado) return { disponible: false, motivo: "LIMITE_PROVEEDOR" };
  return { disponible: true };
}

async function limiteProveedorAlcanzado(
  proveedor: { id: string; limitePorMinuto: number | null; limitePorDia: number | null },
  zona: string,
  ahora: Date,
): Promise<boolean> {
  const [minuto, dia] = await Promise.all([
    proveedor.limitePorMinuto
      ? prisma.usoIA.count({ where: { proveedorIAId: proveedor.id, creadoEn: { gte: new Date(ahora.getTime() - 60_000), lt: ahora } } })
      : Promise.resolve(0),
    proveedor.limitePorDia
      ? prisma.usoIA.count({ where: { proveedorIAId: proveedor.id, creadoEn: aFiltroPrisma(rangoHoy(zona, ahora))! } })
      : Promise.resolve(0),
  ]);
  return (
    (proveedor.limitePorMinuto !== null && minuto >= proveedor.limitePorMinuto) ||
    (proveedor.limitePorDia !== null && dia >= proveedor.limitePorDia)
  );
}

export async function evaluarDisponibilidadIA(
  instanciaId: string,
  prioridad: PrioridadAnalisis,
  ahora: Date = new Date(),
): Promise<Disponibilidad> {
  const [configIA, config, proveedores] = await Promise.all([
    prisma.configuracionIA.findUnique({ where: { instanciaId }, select: { habilitado: true, limiteTokensDiarios: true } }),
    prisma.configuracionAnalisisContactos.findUnique({
      where: { instanciaId },
      select: { habilitado: true, presupuestoDiarioCosto: true, presupuestoDiarioTokens: true },
    }),
    prisma.proveedorIA.findMany({ where: { instanciaId, activo: true }, orderBy: { prioridad: "desc" } }),
  ]);
  if (!configIA?.habilitado || config?.habilitado === false) return { disponible: false, motivo: "IA_DESHABILITADA" };
  const proveedor = resolverProveedorPorObjetivo(proveedores, "ANALISIS_CONTACTOS") ?? proveedores[0];
  if (!proveedor) return { disponible: false, motivo: "SIN_PROVEEDOR" };

  const zona = await obtenerZonaNegocio(instanciaId);
  const [consumo, global, limiteProv] = await Promise.all([
    consumoCuenta(instanciaId, ahora),
    configEntorno().presupuestoGlobalUsd !== null ? costoGlobalHoy(ahora) : Promise.resolve(0),
    limiteProveedorAlcanzado(proveedor, zona, ahora),
  ]);
  return decidirDisponibilidad({
    prioridad,
    presupuestoCosto: config?.presupuestoDiarioCosto === null || config?.presupuestoDiarioCosto === undefined ? null : Number(config.presupuestoDiarioCosto),
    presupuestoTokens: config?.presupuestoDiarioTokens ?? null,
    limiteTokensDiariosCuenta: configIA.limiteTokensDiarios ?? null,
    consumo,
    proveedorTieneCostos: proveedor.costoInputPorMilToken !== null && proveedor.costoOutputPorMilToken !== null,
    limiteProveedorAlcanzado: limiteProv,
    presupuestoGlobalUsd: configEntorno().presupuestoGlobalUsd,
    costoGlobalHoy: global,
  });
}
