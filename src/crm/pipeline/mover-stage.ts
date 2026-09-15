// Sin "use server": este módulo NO debe llevar esa directiva porque
// `ejecutarMovimientoAStage` deliberadamente saltea el chequeo de permisos de
// sesión (ver comentario en la función) — un archivo "use server" convierte
// automáticamente TODA función exportada en un Server Action invocable
// directamente desde el cliente, sin importar si algo más "interno" la
// importa como helper. Vivir fuera de actions.ts (que sí tiene "use server")
// es lo que mantiene esta función como un detalle de implementación interno,
// nunca como un endpoint público.
import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { procesarCambioStage } from "./disparadores/motor";

async function cerrarConversacionesDeOportunidad(oportunidadId: string) {
  const links = await prisma.oportunidadConversacion.findMany({
    where: { oportunidadId },
    select: { conversacionId: true },
  });
  const ids = links.map((l) => l.conversacionId);
  if (ids.length === 0) return;
  await prisma.conversacion.updateMany({
    where: { id: { in: ids }, estado: { not: "CERRADA" } },
    data: { estado: "CERRADA" },
  });
}

/**
 * Cuerpo real del movimiento de etapa, sin el gate de permisos de sesión de
 * `moverAStage` (src/crm/pipeline/actions.ts) — se extrajo a este módulo para
 * que lo puedan usar automatizaciones del sistema sin sesión de usuario
 * propia (ver procesarPrimeraRespuestaProspecto en conversaciones/actions.ts,
 * disparada por un worker de IA o un webhook de mensaje nativo). Cualquier
 * llamador nuevo desde el cliente debe pasar por `moverAStage` para no
 * saltarse el permiso "oportunidades.modificar".
 */
export async function ejecutarMovimientoAStage(oportunidadId: string, stageId: string, pipelineId: string) {
  try {
    const [stage, todosCampos, oportunidad] = await Promise.all([
      prisma.pipelineStage.findUnique({
        where: { id: stageId },
        select: { nombre: true, probabilidad: true, esGanado: true, esPerdido: true },
      }),
      prisma.campoPersonalizado.findMany({
        where: { pipelineId, activo: true },
        select: { nombre: true, clave: true, requeridoEn: true },
      }),
      prisma.oportunidad.findUnique({
        where: { id: oportunidadId },
        select: { metadata: true },
      }),
    ]);

    // Validar campos requeridos para el stage destino
    const camposRequeridos = todosCampos.filter(
      (c) => Array.isArray(c.requeridoEn) && (c.requeridoEn as string[]).includes(stageId)
    );
    if (camposRequeridos.length > 0) {
      const metadata = (oportunidad?.metadata as Record<string, unknown>) ?? {};
      const faltantes = camposRequeridos
        .filter((c) => {
          const v = metadata[c.clave];
          return v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
        })
        .map((c) => c.nombre);
      if (faltantes.length > 0) {
        return {
          exito: false as const,
          error: `Para avanzar a "${stage?.nombre ?? stageId}" debes completar: ${faltantes.join(", ")}`,
        };
      }
    }

    const ahora = new Date();
    await prisma.oportunidad.update({
      where: { id: oportunidadId },
      data: {
        stageId,
        pipelineId,
        ...(stage != null && { probabilidad: stage.probabilidad }),
        ...(stage?.esGanado && { etapa: "GANADO", fechaGanada: ahora }),
        ...(stage?.esPerdido && { etapa: "PERDIDO", fechaPerdida: ahora }),
      },
    });

    // Cerrar conversaciones asociadas si la etapa es terminal
    if (stage?.esGanado || stage?.esPerdido) {
      await cerrarConversacionesDeOportunidad(oportunidadId);
    }

    await procesarCambioStage(oportunidadId, stageId, pipelineId);

    // revalidatePath solo funciona dentro de un request de Next.js — esta
    // función también se llama desde automatizaciones sin ese contexto (ej.
    // procesarPrimeraRespuestaProspecto disparada por un worker de IA o un
    // webhook de mensaje nativo), donde revalidatePath lanza. Mismo patrón ya
    // usado en conversaciones/actions.ts (registrarMensajeAppNativa) para el
    // mismo problema — la revalidación es "best effort", nunca debe tirar
    // abajo un movimiento de etapa que ya se guardó en la base.
    try {
      revalidatePath("/crm/pipeline");
      revalidatePath("/crm/oportunidades");
      revalidatePath("/crm/inbox");
    } catch { /* fuera de request context */ }

    return { exito: true as const };
  } catch {
    return { exito: false as const, error: "Error al mover la oportunidad" };
  }
}
