"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { enviarMensaje } from "@/conversaciones/actions";
import { GuardarAutonomiaIntencionConfigSchema, EditarYEnviarRespuestaPendienteSchema } from "./schema";
import { listarAutonomiaPorAgente, listarRespuestasPendientes } from "./queries";
import type { CategoriaIntencionAutonomia } from "@/generated/prisma/enums";

type Resultado<T extends object = object> = ({ exito: true } & T) | { exito: false; error: string };

// Historia 1 — gestión de AutonomiaIntencionConfig por agente.
export async function obtenerAutonomiaDeAgente(agenteIAConfigId: string) {
  const auth = await requirePermisoAction("ia", "ver");
  if (!auth.ok) return [];
  return listarAutonomiaPorAgente(agenteIAConfigId);
}

export async function obtenerRespuestasPendientes(conversacionId?: string) {
  const auth = await requirePermisoAction("inbox", "ver");
  if (!auth.ok) return [];
  return listarRespuestasPendientes(auth.sesion.instanciaId, conversacionId);
}

export async function guardarAutonomiaIntencionConfig(datos: unknown): Promise<Resultado> {
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const validado = GuardarAutonomiaIntencionConfigSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  const agente = await prisma.agenteIAConfig.findFirst({
    where: { id: validado.data.agenteIAConfigId, instanciaId: auth.sesion.instanciaId },
    select: { id: true },
  });
  if (!agente) return { exito: false, error: "Agente no encontrado en esta instancia" };

  // Cambiar el nivel de una categoría NO toca ninguna RespuestaPendienteRevision
  // ya existente (FR-013) — este upsert solo escribe AutonomiaIntencionConfig.
  await prisma.$transaction(
    validado.data.filas.map((fila) =>
      prisma.autonomiaIntencionConfig.upsert({
        where: { agenteIAConfigId_categoria: { agenteIAConfigId: validado.data.agenteIAConfigId, categoria: fila.categoria } },
        create: {
          instanciaId: auth.sesion.instanciaId,
          agenteIAConfigId: validado.data.agenteIAConfigId,
          categoria: fila.categoria,
          nivel: fila.nivel,
          condicionesConfianza: fila.condicionesConfianza ?? undefined,
        },
        update: {
          nivel: fila.nivel,
          condicionesConfianza: fila.condicionesConfianza ?? undefined,
        },
      }),
    ),
  );

  revalidatePath("/configuracion");
  return { exito: true };
}

// Historia 2 — persistencia de una respuesta que el gate dejó pendiente.
// 017-aprendizaje-supervisado-auditoria — delega en ensamblarYPersistirRegistro
// (mismo ensamblador que usa el camino ENVIADA_AUTOMATICAMENTE, unificación
// de T010) en vez de escribir directo — sin cambio de comportamiento visible.
export async function crearRespuestaPendiente(datos: {
  instanciaId: string;
  agenteIAConfigId: string;
  conversacionId: string;
  categoriaDetectada?: CategoriaIntencionAutonomia;
  mensajeCliente: string;
  respuestaPropuesta: string;
  motivoPendiente: string;
  usoIAId?: string;
  estrategiaUtilizadaId?: string;
  ejemplosUtilizadosIds?: string[];
  herramientasEjecutadas?: string[];
  confianza?: number;
  motivoTransferencia?: string;
  productoIdentificadoId?: string;
}): Promise<Resultado<{ id: string }>> {
  const { ensamblarYPersistirRegistro } = await import("./registro");
  const id = await ensamblarYPersistirRegistro({
    instanciaId: datos.instanciaId,
    agenteIAConfigId: datos.agenteIAConfigId,
    conversacionId: datos.conversacionId,
    mensajeCliente: datos.mensajeCliente,
    respuestaPropuesta: datos.respuestaPropuesta,
    estadoInicial: "PENDIENTE",
    motivo: datos.motivoPendiente,
    categoriaDetectada: datos.categoriaDetectada,
    usoIAId: datos.usoIAId,
    estrategiaUtilizadaId: datos.estrategiaUtilizadaId,
    ejemplosUtilizadosIds: datos.ejemplosUtilizadosIds,
    herramientasEjecutadas: datos.herramientasEjecutadas,
    confianza: datos.confianza,
    motivoTransferencia: datos.motivoTransferencia,
    productoIdentificadoId: datos.productoIdentificadoId,
  });
  if (!id) return { exito: false, error: "No se pudo registrar la respuesta pendiente" };
  revalidatePath("/inbox");
  return { exito: true, id };
}

// Historia 3 — bandeja de revisión.

async function resolverPendiente(id: string, instanciaId: string) {
  return prisma.respuestaPendienteRevision.findFirst({
    where: { id, instanciaId, estado: "PENDIENTE" },
  });
}

export async function enviarRespuestaPendiente(id: string): Promise<Resultado> {
  const auth = await requirePermisoAction("inbox", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const pendiente = await resolverPendiente(id, auth.sesion.instanciaId);
  if (!pendiente) return { exito: false, error: "Respuesta pendiente no encontrada" };

  const resultado = await enviarMensaje({
    conversacionId: pendiente.conversacionId,
    contenido: pendiente.respuestaPropuesta,
    tipo: "TEXTO",
    esNotaInterna: false,
  });
  if (!resultado.ok) return { exito: false, error: resultado.error };

  await prisma.respuestaPendienteRevision.update({
    where: { id },
    data: { estado: "ENVIADA_TAL_CUAL", resueltaPorUsuarioId: auth.sesion.usuarioId, resueltaEn: new Date() },
  });

  revalidatePath("/inbox");
  return { exito: true };
}

export async function editarYEnviarRespuestaPendiente(datos: unknown): Promise<Resultado> {
  const auth = await requirePermisoAction("inbox", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const validado = EditarYEnviarRespuestaPendienteSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  const pendiente = await resolverPendiente(validado.data.id, auth.sesion.instanciaId);
  if (!pendiente) return { exito: false, error: "Respuesta pendiente no encontrada" };

  const resultado = await enviarMensaje({
    conversacionId: pendiente.conversacionId,
    contenido: validado.data.textoEditado,
    tipo: "TEXTO",
    esNotaInterna: false,
  });
  if (!resultado.ok) return { exito: false, error: resultado.error };

  await prisma.respuestaPendienteRevision.update({
    where: { id: validado.data.id },
    data: {
      estado: "EDITADA_Y_ENVIADA",
      respuestaEditada: validado.data.textoEditado,
      resueltaPorUsuarioId: auth.sesion.usuarioId,
      resueltaEn: new Date(),
    },
  });

  revalidatePath("/inbox");
  return { exito: true };
}

export async function descartarRespuestaPendiente(id: string): Promise<Resultado> {
  const auth = await requirePermisoAction("inbox", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const pendiente = await resolverPendiente(id, auth.sesion.instanciaId);
  if (!pendiente) return { exito: false, error: "Respuesta pendiente no encontrada" };

  await prisma.respuestaPendienteRevision.update({
    where: { id },
    data: { estado: "DESCARTADA", resueltaPorUsuarioId: auth.sesion.usuarioId, resueltaEn: new Date() },
  });

  revalidatePath("/inbox");
  return { exito: true };
}

// 017-aprendizaje-supervisado-auditoria — Historia 1 (auditoría) e Historia 2 (evaluación).

export async function obtenerRegistrosRespuestaAction(filtros?: { agenteIAConfigId?: string; conversacionId?: string }) {
  const auth = await requirePermisoAction("ia", "ver");
  if (!auth.ok) return [];
  const { listarRegistrosRespuesta } = await import("./queries");
  return listarRegistrosRespuesta(auth.sesion.instanciaId, filtros);
}

export async function agregarEvaluacion(datos: unknown): Promise<Resultado<{ id: string }>> {
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const { AgregarEvaluacionSchema } = await import("./schema");
  const validado = AgregarEvaluacionSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  const registro = await prisma.respuestaPendienteRevision.findFirst({
    where: { id: validado.data.respuestaId, instanciaId: auth.sesion.instanciaId },
    select: { id: true },
  });
  if (!registro) return { exito: false, error: "Registro de respuesta no encontrado" };

  // research.md Decisión 4 — nunca sobrescribe una evaluación anterior, se
  // permite más de una para el mismo registro.
  const creada = await prisma.evaluacionRespuestaIA.create({
    data: {
      instanciaId: auth.sesion.instanciaId,
      respuestaId: validado.data.respuestaId,
      calificacion: validado.data.calificacion,
      comentario: validado.data.comentario,
      evaluadoPorUsuarioId: auth.sesion.usuarioId,
    },
    select: { id: true },
  });

  revalidatePath("/configuracion");
  return { exito: true, id: creada.id };
}
