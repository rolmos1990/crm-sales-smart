import { prisma } from "@/shared/db/prisma";
import { asegurarPlantillasSembradas } from "./plantillas-default";

// FR-001 — siembra perezosa: cubre tanto instancias nuevas (vía
// InicializarInstanciaSuscriptor en el futuro, si se decide agregarlo ahí)
// como instancias ya existentes antes de esta spec, sin necesitar backfill.
export async function listarEstrategias(instanciaId: string) {
  await asegurarPlantillasSembradas(instanciaId);
  return prisma.playbookEstrategia.findMany({
    where: { instanciaId },
    orderBy: [{ activo: "desc" }, { prioridad: "desc" }, { nombre: "asc" }],
  });
}

export async function obtenerEstrategia(id: string, instanciaId: string) {
  return prisma.playbookEstrategia.findFirst({ where: { id, instanciaId } });
}

/** Estrategias asignadas a un agente, con el contenido/condiciones de su playbook ya unido. */
export async function listarAsignacionesDeAgente(agenteIAConfigId: string) {
  return prisma.agentePlaybookAsignacion.findMany({
    where: { agenteIAConfigId },
    include: { playbookEstrategia: true },
    orderBy: { creadoEn: "desc" },
  });
}

export async function contarAsignacionesDeEstrategia(playbookEstrategiaId: string): Promise<number> {
  return prisma.agentePlaybookAsignacion.count({ where: { playbookEstrategiaId } });
}

/** Últimas selecciones registradas para un agente — auditoría (FR-009, SC-003). */
export async function listarSeleccionesRecientes(agenteIAConfigId: string, limite = 20) {
  return prisma.seleccionEstrategiaLog.findMany({
    where: { agenteIAConfigId },
    orderBy: { creadoEn: "desc" },
    take: limite,
  });
}
