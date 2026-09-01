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
export async function crearRespuestaPendiente(datos: {
  instanciaId: string;
  agenteIAConfigId: string;
  conversacionId: string;
  categoriaDetectada?: CategoriaIntencionAutonomia;
  mensajeCliente: string;
  respuestaPropuesta: string;
  motivoPendiente: string;
}): Promise<Resultado<{ id: string }>> {
  const creada = await prisma.respuestaPendienteRevision.create({
    data: {
      instanciaId: datos.instanciaId,
      agenteIAConfigId: datos.agenteIAConfigId,
      conversacionId: datos.conversacionId,
      categoriaDetectada: datos.categoriaDetectada,
      mensajeCliente: datos.mensajeCliente,
      respuestaPropuesta: datos.respuestaPropuesta,
      motivoPendiente: datos.motivoPendiente,
    },
    select: { id: true },
  });
  revalidatePath("/inbox");
  return { exito: true, id: creada.id };
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
