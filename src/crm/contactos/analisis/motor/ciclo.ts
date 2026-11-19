import type { PrioridadAnalisis } from "@/generated/prisma/enums";
import { prisma } from "@/shared/db/prisma";
import { configEntorno } from "../config-entorno";
import { liberarTurno, reclamarLote, tomarTurnoCuenta } from "../cola";
import { procesarLote, type DependenciasMotor } from "./ejecutor";
import { INTERVALO_BASE_MS, PRIORIDADES, repartirEspacios, type PorClase } from "./planificador";
import { recuperarTrabajoAbandonado } from "./recuperacion";

/**
 * 042 — Ciclo del motor dentro del worker (research D10). Corre en su propio
 * `setTimeout` recursivo, como el polling de correo, para que un proveedor de
 * IA lento no atrase los disparadores de pipeline ni los Workflows (FR-033).
 *
 * Cada vuelta: recuperar leases vencidos, repartir los espacios libres entre
 * P0/P1/P2 según los cupos (con préstamo), y llenar cada espacio con el turno
 * de la cuenta que más tiempo lleva esperando (stride scheduling, research
 * D2). Escalar = levantar otro worker: SKIP LOCKED reparte el trabajo (FR-031).
 */

export const LEASE_MS = 3 * 60_000;

export interface Turno {
  instanciaId: string;
  prioridad: PrioridadAnalisis;
  tamanoLote: number;
}

/**
 * Elige la cuenta que atiende un espacio de una prioridad. En producción es
 * `tomarTurnoCuenta` (que ya ocupa el lugar de la cuenta); el simulador puede
 * inyectar otra. Siempre excluye P2 con el histórico pausado (I1).
 */
export type ElegirTurno = (prioridad: PrioridadAnalisis, historicoPausadoGlobal: boolean) => Promise<Turno | null>;

export const elegirTurnoJusto: ElegirTurno = async (prioridad, historicoPausadoGlobal) => {
  const t = await tomarTurnoCuenta({ prioridad, historicoPausadoGlobal, intervaloBaseMs: INTERVALO_BASE_MS });
  return t ? { instanciaId: t.instanciaId, prioridad, tamanoLote: t.tamanoLote } : null;
};

export interface OpcionesCiclo {
  dependencias?: DependenciasMotor;
  /** Solo para el simulador: sin reconciliación ni retención (recorren TODAS las cuentas). */
  sinTareasPeriodicas?: boolean;
  elegirTurno?: ElegirTurno;
  /** Al terminar un turno, para liberar el lugar de la cuenta. */
  alTerminarTurno?: (turno: Turno) => Promise<void>;
}

const enCurso: PorClase<number> = { P0: 0, P1: 0, P2: 0 };
let detenido = false;
let ultimaReconciliacion = 0;
let ultimaRetencion = 0;

async function ejecutarTurno(turno: Turno, opciones: OpcionesCiclo): Promise<void> {
  const inicio = Date.now();
  try {
    const reclamados = await reclamarLote({
      instanciaId: turno.instanciaId,
      prioridad: turno.prioridad,
      limite: turno.tamanoLote,
      leaseMs: LEASE_MS,
    });
    // Vacío = otra réplica tomó esos contactos entre el turno y el reclamo.
    if (reclamados.length === 0) return;
    const r = await procesarLote({
      instanciaId: turno.instanciaId,
      prioridad: turno.prioridad,
      reclamados,
      leaseMs: LEASE_MS,
      dependencias: opciones.dependencias,
    });
    await prisma.configuracionAnalisisContactos
      .updateMany({ where: { instanciaId: turno.instanciaId }, data: { ultimaAtencionEn: new Date() } })
      .catch(() => {});
    console.log(
      `[worker:analisis] ${turno.prioridad} cuenta=${turno.instanciaId} lote=${r.loteId.slice(0, 8)} ` +
        `${r.exitosos}/${r.pedidos} ok (reglas ${r.porReglas}, IA ${r.conIA})` +
        (r.fallidos > 0 ? `, ${r.fallidos} devueltos` : "") +
        ` en ${Date.now() - inicio} ms`,
    );
  } catch (err) {
    console.error("[worker:analisis] Error procesando el turno", { ...turno, err });
  } finally {
    await (opciones.alTerminarTurno ?? ((t: Turno) => liberarTurno(t.instanciaId)))(turno).catch(() => {});
  }
}

async function tareasPeriodicas(ahora: number, reconciliacionMin: number): Promise<void> {
  if (ahora - ultimaReconciliacion > reconciliacionMin * 60_000) {
    ultimaReconciliacion = ahora;
    const { reconciliar } = await import("./reconciliacion");
    await reconciliar(new Date()).catch((err) => console.error("[worker:analisis] Error en reconciliación", err));
  }
  if (ahora - ultimaRetencion > 6 * 60 * 60_000) {
    ultimaRetencion = ahora;
    const { consolidarYPurgar } = await import("./retencion");
    await consolidarYPurgar(new Date()).catch((err) => console.error("[worker:analisis] Error en retención", err));
  }
}

/** Una vuelta del ciclo. Exportada para el simulador de carga y las pruebas. */
export async function vueltaCiclo(opciones: OpcionesCiclo = {}): Promise<Turno[]> {
  const entorno = configEntorno();
  const elegir = opciones.elegirTurno ?? elegirTurnoJusto;
  await recuperarTrabajoAbandonado();
  if (!opciones.sinTareasPeriodicas) await tareasPeriodicas(Date.now(), entorno.reconciliacionMin);

  // Se asume demanda en todas; una clase que no entrega turno deja de tenerla
  // y su espacio se reparte entre las demás en la misma vuelta (préstamo).
  const demanda: PorClase<boolean> = { P0: true, P1: true, P2: !entorno.historicoPausado };
  const lanzados: Turno[] = [];
  for (;;) {
    const espacios = repartirEspacios(entorno.concurrencia, enCurso, entorno.cupos, demanda);
    const prioridad = espacios[0];
    if (!prioridad) break;
    const turno = await elegir(prioridad, entorno.historicoPausado);
    if (!turno) {
      demanda[prioridad] = false;
      if (!PRIORIDADES.some((p) => demanda[p])) break;
      continue;
    }
    enCurso[prioridad]++;
    lanzados.push(turno);
    void ejecutarTurno(turno, opciones).finally(() => {
      enCurso[prioridad]--;
    });
  }
  return lanzados;
}

export function iniciarCicloAnalisisContactos(opciones: OpcionesCiclo = {}): { detener: () => void } {
  const entorno = configEntorno();
  detenido = false;
  console.log(
    `[worker:analisis] iniciando — concurrencia ${entorno.concurrencia}, cupos P0/P1/P2 ${entorno.cupos.P0}/${entorno.cupos.P1}/${entorno.cupos.P2}` +
      (entorno.historicoPausado ? ", histórico PAUSADO" : ""),
  );
  const vuelta = async () => {
    if (detenido) return;
    try {
      await vueltaCiclo(opciones);
    } catch (err) {
      console.error("[worker:analisis] Error en el ciclo", err);
    }
    if (!detenido) setTimeout(vuelta, entorno.intervaloMs);
  };
  void vuelta();
  return {
    detener: () => {
      detenido = true;
    },
  };
}

export function lotesEnCursoLocal(): number {
  return enCurso.P0 + enCurso.P1 + enCurso.P2;
}
