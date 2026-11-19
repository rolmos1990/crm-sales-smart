import { z } from "zod";

/**
 * 042 — Parámetros de operación del motor que maneja el equipo de Karia (no
 * las cuentas). Viven en el entorno y no en una tabla porque son de la
 * plataforma: concurrencia, cupos por prioridad, presupuesto global.
 *
 * Valida al importar: un cupo mal escrito tiene que tumbar el arranque del
 * worker, no repartir mal la capacidad en silencio.
 */

const booleano = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => v === "true" || v === "1");

const EsquemaEntorno = z.object({
  ANALISIS_CONTACTOS_CONCURRENCIA: z.coerce.number().int().min(1).max(50).default(3),
  ANALISIS_CONTACTOS_CUPOS: z
    .string()
    .default("20,50,30")
    .transform((v) => v.split(",").map((n) => Number(n.trim())))
    .refine((c) => c.length === 3 && c.every((n) => Number.isFinite(n) && n >= 0), {
      message: "ANALISIS_CONTACTOS_CUPOS debe tener tres números: P0,P1,P2",
    })
    .refine((c) => c[0] + c[1] + c[2] === 100, { message: "ANALISIS_CONTACTOS_CUPOS debe sumar 100" }),
  ANALISIS_CONTACTOS_PRESUPUESTO_GLOBAL_USD: z.coerce.number().positive().optional(),
  ANALISIS_CONTACTOS_HISTORICO_PAUSADO: booleano,
  ANALISIS_CONTACTOS_INTERVALO_MS: z.coerce.number().int().min(200).default(2000),
  ANALISIS_CONTACTOS_RECONCILIACION_MIN: z.coerce.number().int().min(1).default(15),
});

export interface ConfigEntornoAnalisis {
  concurrencia: number;
  cupos: { P0: number; P1: number; P2: number };
  presupuestoGlobalUsd: number | null;
  historicoPausado: boolean;
  intervaloMs: number;
  reconciliacionMin: number;
}

export function leerConfigEntorno(env: Record<string, string | undefined> = process.env): ConfigEntornoAnalisis {
  const vacioComoAusente = Object.fromEntries(
    Object.entries(env).map(([k, v]) => [k, v === "" ? undefined : v]),
  );
  const r = EsquemaEntorno.safeParse(vacioComoAusente);
  if (!r.success) {
    throw new Error(`[analisis-contactos] Configuración de entorno inválida: ${r.error.issues.map((i) => i.message).join("; ")}`);
  }
  const e = r.data;
  return Object.freeze({
    concurrencia: e.ANALISIS_CONTACTOS_CONCURRENCIA,
    cupos: Object.freeze({
      P0: e.ANALISIS_CONTACTOS_CUPOS[0],
      P1: e.ANALISIS_CONTACTOS_CUPOS[1],
      P2: e.ANALISIS_CONTACTOS_CUPOS[2],
    }),
    presupuestoGlobalUsd: e.ANALISIS_CONTACTOS_PRESUPUESTO_GLOBAL_USD ?? null,
    historicoPausado: e.ANALISIS_CONTACTOS_HISTORICO_PAUSADO,
    intervaloMs: e.ANALISIS_CONTACTOS_INTERVALO_MS,
    reconciliacionMin: e.ANALISIS_CONTACTOS_RECONCILIACION_MIN,
  });
}

let cache: ConfigEntornoAnalisis | null = null;

/** Perezoso: la app Next.js importa módulos del motor sin necesitar el entorno del worker. */
export function configEntorno(): ConfigEntornoAnalisis {
  cache ??= leerConfigEntorno();
  return cache;
}
