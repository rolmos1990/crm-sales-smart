import "server-only";

import { prisma } from "@/shared/db/prisma";
import { CANAL_EMAIL, aBuzonParaCliente, type BuzonParaCliente } from "./configuracion";

// Única puerta de salida de los buzones hacia la UI. Todo pasa por
// `aBuzonParaCliente`, que descarta las credenciales: así no hay forma de
// filtrar una contraseña por olvido en un `select` (FR-011, FR-042).

export async function obtenerBuzones(instanciaId: string): Promise<BuzonParaCliente[]> {
  const cuentas = await prisma.cuentaCanal.findMany({
    where: { instanciaId, canal: CANAL_EMAIL },
    select: {
      id: true,
      nombre: true,
      identificador: true,
      activa: true,
      configuracion: true,
      pipelineId: true,
      stageId: true,
      stageIdRespuestaAutomatica: true,
      buzonCorreoEstado: {
        select: { ultimaLecturaOkEn: true, errorCodigo: true, errorMensaje: true },
      },
    },
    orderBy: { creadoEn: "asc" },
  });

  return cuentas.flatMap((c) => {
    const buzon = aBuzonParaCliente(c);
    return buzon ? [buzon] : [];
  });
}

/** Pipelines y etapas para el selector de entrada del buzón. */
export async function obtenerPipelinesParaBuzon(instanciaId: string) {
  return prisma.pipeline.findMany({
    where: { instanciaId, activo: true },
    select: {
      id: true,
      nombre: true,
      esDefault: true,
      stages: {
        where: { activo: true },
        select: { id: true, nombre: true, orden: true },
        orderBy: { orden: "asc" },
      },
    },
    orderBy: [{ esDefault: "desc" }, { creadoEn: "asc" }],
  });
}
