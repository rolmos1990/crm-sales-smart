import type {
  AccionComercial,
  EstadoColaAnalisis,
  EstadoSugerencia,
  IntencionCompra,
  NivelInteres,
  NivelRecuperacion,
  NivelUrgencia,
  OrigenEvaluacion,
  RelacionComercial,
} from "@/generated/prisma/enums";
import { prisma } from "@/shared/db/prisma";
import type { Recomendacion } from "@/crm/contactos/segmentacion/recomendacion";

/** 042 — Lo que el panel lateral muestra en "Análisis de IA" (FR-050). Fechas en ISO UTC. */
export interface AnalisisContacto {
  evaluacion: {
    origen: OrigenEvaluacion;
    relacionComercial: RelacionComercial;
    puntaje: number;
    intencion: IntencionCompra | null;
    urgencia: NivelUrgencia | null;
    recuperacion: NivelRecuperacion | null;
    senales: string[];
    objeciones: string[];
    motivos: string[];
    evaluadoEn: string;
    evaluadoIAEn: string | null;
    criterioNumero: number | null;
    plantillaAplicada: string | null;
    interesSugerido: NivelInteres | null;
    interesSugeridoPendiente: boolean;
    noContactarSugerido: boolean;
    noContactarMotivo: string | null;
    noContactarSugeridoPendiente: boolean;
  } | null;
  estadoCola: EstadoColaAnalisis | null;
  /** Hay un análisis urgente (P0) esperando o en curso: el panel consulta hasta que termine. */
  analizandoAhora: boolean;
  /** IA habilitada en la cuenta, análisis activo y al menos un proveedor activo. */
  iaDisponible: boolean;
  interesFijado: boolean;
  accionVisible: AccionComercial | null;
}

const ACCIONES_DE_HECHOS: Partial<Record<Recomendacion, AccionComercial>> = {
  RESPONDER: "RESPONDER",
  NO_CONTACTAR: "NO_CONTACTAR",
};

function textos(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string") : [];
}

const pendiente = (e: EstadoSugerencia | null) => e === "PENDIENTE";

/**
 * Análisis vigente de un contacto. La acción visible respeta la recomendación
 * de la 041 cuando es un hecho (Responder, No contactar) aunque la evaluación
 * sea anterior a ese hecho (FR-021).
 */
export async function obtenerAnalisisContacto(
  instanciaId: string,
  contactoId: string,
  recomendacion041: Recomendacion,
  interesFijado: boolean,
): Promise<AnalisisContacto> {
  const [ev, cola, configIA, config, proveedores] = await Promise.all([
    prisma.contactoEvaluacion.findFirst({
      where: { contactoId, instanciaId },
      select: {
        origen: true,
        relacionComercial: true,
        puntaje: true,
        intencion: true,
        urgencia: true,
        recuperacion: true,
        senalesReglas: true,
        senales: true,
        objeciones: true,
        motivos: true,
        motivosReglas: true,
        accionSugerida: true,
        evaluadoEn: true,
        evaluadoIAEn: true,
        plantillaAplicada: true,
        interesSugerido: true,
        interesSugeridoEstado: true,
        noContactarSugerido: true,
        noContactarMotivo: true,
        noContactarSugeridoEstado: true,
        criterioVersion: { select: { numero: true } },
      },
    }),
    prisma.contactoAnalisisCola.findFirst({ where: { contactoId, instanciaId }, select: { estado: true, prioridad: true } }),
    prisma.configuracionIA.findUnique({ where: { instanciaId }, select: { habilitado: true } }),
    prisma.configuracionAnalisisContactos.findUnique({ where: { instanciaId }, select: { habilitado: true } }),
    prisma.proveedorIA.count({ where: { instanciaId, activo: true } }),
  ]);

  const iaDisponible = Boolean(configIA?.habilitado) && config?.habilitado !== false && proveedores > 0;
  const deHechos = ACCIONES_DE_HECHOS[recomendacion041];

  return {
    evaluacion: ev
      ? {
          origen: ev.origen,
          relacionComercial: ev.relacionComercial,
          puntaje: ev.puntaje,
          intencion: ev.intencion,
          urgencia: ev.urgencia,
          recuperacion: ev.recuperacion,
          senales: [...textos(ev.senalesReglas), ...textos(ev.senales)],
          objeciones: textos(ev.objeciones),
          motivos: [...textos(ev.motivosReglas), ...textos(ev.motivos)],
          evaluadoEn: ev.evaluadoEn.toISOString(),
          evaluadoIAEn: ev.evaluadoIAEn?.toISOString() ?? null,
          criterioNumero: ev.criterioVersion?.numero ?? null,
          plantillaAplicada: ev.plantillaAplicada,
          interesSugerido: ev.interesSugerido,
          interesSugeridoPendiente: pendiente(ev.interesSugeridoEstado) && !interesFijado,
          noContactarSugerido: ev.noContactarSugerido,
          noContactarMotivo: ev.noContactarMotivo,
          noContactarSugeridoPendiente: ev.noContactarSugerido && pendiente(ev.noContactarSugeridoEstado),
        }
      : null,
    estadoCola: cola?.estado ?? null,
    analizandoAhora: cola?.prioridad === "P0" && (cola.estado === "PENDIENTE" || cola.estado === "EN_PROCESO"),
    iaDisponible,
    interesFijado,
    accionVisible: deHechos ?? ev?.accionSugerida ?? null,
  };
}

/** 042 (Historia 6, FR-052) — Avance del análisis de una cuenta. */
export interface AvanceAnalisis {
  clasificacionInicial: {
    /** Contactos con conversación e interacción dentro del plazo de antigüedad: los únicos que necesitan IA. */
    elegiblesIA: number;
    analizadosIA: number;
    porcentaje: number | null;
    resueltosPorReglas: number;
    pausado: boolean;
  };
  actualizacion: {
    pendientes: { P0: number; P1: number; P2: number };
    esperaMediaSeg: number | null;
    ultimaAtencionEn: string | null;
  };
  fallidos: number;
  hoy: {
    atenciones: number;
    lotesFallidos: number;
    duracionMediaMs: number | null;
    tokens: number;
    costoEstimado: number | null;
  };
  limites: {
    presupuestoPropio: number | null;
    consumoLimiteCuentaPct: number | null;
    iaDisponible: boolean;
    motivoNoDisponible: string | null;
  };
}

export async function obtenerAvanceAnalisis(instanciaId: string, ahora: Date = new Date()): Promise<AvanceAnalisis> {
  const { obtenerZonaNegocio } = await import("@/shared/fechas/negocio");
  const { aFiltroPrisma, rangoHoy } = await import("@/shared/fechas/rangos");
  const { evaluarDisponibilidadIA } = await import("./motor/presupuesto");
  const zona = await obtenerZonaNegocio(instanciaId);
  const hoy = aFiltroPrisma(rangoHoy(zona, ahora))!;

  const config = await prisma.configuracionAnalisisContactos.findUnique({ where: { instanciaId } });
  const meses = config?.mesesAntiguedadInicial ?? 12;
  const desde = new Date(ahora);
  desde.setUTCMonth(desde.getUTCMonth() - meses);

  const [elegibles, analizadosIA, totalContactos, porPrioridad, fallidos, ejecucionesHoy, usoCuenta, configIA, disponibilidad] = await Promise.all([
    prisma.contacto.count({ where: { instanciaId, ultimaInteraccionEn: { gte: desde }, conversaciones: { some: {} } } }),
    prisma.contactoEvaluacion.count({
      where: { instanciaId, evaluadoIAEn: { not: null }, contacto: { ultimaInteraccionEn: { gte: desde }, conversaciones: { some: {} } } },
    }),
    prisma.contacto.count({ where: { instanciaId } }),
    prisma.contactoAnalisisCola.groupBy({ by: ["prioridad"], where: { instanciaId, estado: { in: ["PENDIENTE", "EN_PROCESO"] } }, _count: { _all: true } }),
    prisma.contactoAnalisisCola.count({ where: { instanciaId, estado: "FALLIDO" } }),
    prisma.ejecucionAnalisisContactos.findMany({
      where: { instanciaId, creadoEn: hoy },
      select: { estado: true, duracionMs: true, esperaColaMs: true, tokensEntrada: true, tokensSalida: true, costoEstimado: true },
    }),
    prisma.usoIA.aggregate({ where: { instanciaId, creadoEn: hoy }, _sum: { tokensInput: true, tokensOutput: true } }),
    prisma.configuracionIA.findUnique({ where: { instanciaId }, select: { limiteTokensDiarios: true } }),
    evaluarDisponibilidadIA(instanciaId, "P1", ahora).catch(() => ({ disponible: false, motivo: "IA_DESHABILITADA" as const })),
  ]);

  const pendientes = { P0: 0, P1: 0, P2: 0 };
  for (const g of porPrioridad) pendientes[g.prioridad] = g._count._all;
  const conDuracion = ejecucionesHoy.filter((e) => e.duracionMs !== null);
  const conEspera = ejecucionesHoy.filter((e) => e.esperaColaMs !== null);
  const costos = ejecucionesHoy.map((e) => e.costoEstimado).filter((c): c is NonNullable<typeof c> => c !== null);
  const tokensCuenta = (usoCuenta._sum.tokensInput ?? 0) + (usoCuenta._sum.tokensOutput ?? 0);

  return {
    clasificacionInicial: {
      elegiblesIA: elegibles,
      analizadosIA,
      porcentaje: elegibles > 0 ? Math.min(100, Math.round((analizadosIA / elegibles) * 100)) : null,
      resueltosPorReglas: Math.max(0, totalContactos - elegibles),
      pausado: config?.historicoPausado ?? false,
    },
    actualizacion: {
      pendientes,
      esperaMediaSeg: conEspera.length ? Math.round(conEspera.reduce((s, e) => s + e.esperaColaMs!, 0) / conEspera.length / 1000) : null,
      ultimaAtencionEn: config?.ultimaAtencionEn?.toISOString() ?? null,
    },
    fallidos,
    hoy: {
      atenciones: ejecucionesHoy.length,
      lotesFallidos: ejecucionesHoy.filter((e) => e.estado === "FALLIDA" || e.estado === "ABANDONADA").length,
      duracionMediaMs: conDuracion.length ? Math.round(conDuracion.reduce((s, e) => s + e.duracionMs!, 0) / conDuracion.length) : null,
      tokens: ejecucionesHoy.reduce((s, e) => s + e.tokensEntrada + e.tokensSalida, 0),
      costoEstimado: costos.length ? costos.reduce((s, c) => s + Number(c), 0) : null,
    },
    limites: {
      presupuestoPropio: config?.presupuestoDiarioCosto === null || config?.presupuestoDiarioCosto === undefined ? null : Number(config.presupuestoDiarioCosto),
      consumoLimiteCuentaPct: configIA?.limiteTokensDiarios ? Math.round((tokensCuenta / configIA.limiteTokensDiarios) * 100) : null,
      iaDisponible: disponibilidad.disponible,
      motivoNoDisponible: disponibilidad.disponible ? null : (disponibilidad.motivo ?? null),
    },
  };
}
