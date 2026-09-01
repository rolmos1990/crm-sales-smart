"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";
import { requirePermisoAction } from "@/shared/auth/permisos-server";
import { anonimizarContenido } from "./anonimizacion";
import { CrearConversacionPilotoSchema, AsociarRecomendacionAEstrategiaSchema } from "./schema";
import { listarConversacionesRecientes, listarConversacionesPiloto, listarRecomendaciones, listarEjemplosPrompt } from "./queries";

type Resultado<T extends object = object> = ({ exito: true } & T) | { exito: false; error: string };

// Historia 1 — gestión de ConversacionPiloto.

export async function obtenerConversacionesRecientesAction() {
  const auth = await requirePermisoAction("ia", "ver");
  if (!auth.ok) return [];
  return listarConversacionesRecientes(auth.sesion.instanciaId);
}

export async function obtenerConversacionesPilotoAction() {
  const auth = await requirePermisoAction("ia", "ver");
  if (!auth.ok) return [];
  return listarConversacionesPiloto(auth.sesion.instanciaId);
}

export async function obtenerRecomendacionesAction(agenteIAConfigId?: string) {
  const auth = await requirePermisoAction("ia", "ver");
  if (!auth.ok) return [];
  return listarRecomendaciones(auth.sesion.instanciaId, agenteIAConfigId);
}

export async function obtenerEjemplosPromptAction() {
  const auth = await requirePermisoAction("ia", "ver");
  if (!auth.ok) return [];
  return listarEjemplosPrompt(auth.sesion.instanciaId);
}

export async function crearConversacionPiloto(datos: unknown): Promise<Resultado<{ id: string }>> {
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const validado = CrearConversacionPilotoSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  const conversacion = await prisma.conversacion.findFirst({
    where: { id: validado.data.conversacionOrigenId, instanciaId: auth.sesion.instanciaId },
    select: { id: true },
  });
  if (!conversacion) return { exito: false, error: "Conversación no encontrada en esta instancia" };

  const creada = await prisma.conversacionPiloto.create({
    data: {
      instanciaId: auth.sesion.instanciaId,
      conversacionOrigenId: validado.data.conversacionOrigenId,
      clasificacion: validado.data.clasificacion,
      explicacion: validado.data.explicacion,
      intencion: validado.data.intencion,
      tipoCliente: validado.data.tipoCliente,
      productoId: validado.data.productoId,
      playbookEstrategiaId: validado.data.playbookEstrategiaId,
      creadaPorUsuarioId: auth.sesion.usuarioId,
      incluidaEnPerfil: false,
      anonimizadaEn: null,
    },
    select: { id: true },
  });

  revalidatePath("/configuracion");
  return { exito: true, id: creada.id };
}

export async function anonimizarConversacionPiloto(id: string): Promise<Resultado> {
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const piloto = await prisma.conversacionPiloto.findFirst({
    where: { id, instanciaId: auth.sesion.instanciaId },
    select: { id: true, conversacionOrigenId: true },
  });
  if (!piloto) return { exito: false, error: "Conversación piloto no encontrada" };

  const conversacion = await prisma.conversacion.findUnique({
    where: { id: piloto.conversacionOrigenId },
    select: {
      contacto: { select: { nombre: true, apellido: true, email: true, telefonoPrincipal: true, telefonoSecundario: true } },
      mensajes: {
        orderBy: { creadoEn: "asc" },
        select: { contenido: true, remitente: true },
      },
    },
  });
  if (!conversacion) return { exito: false, error: "Conversación de origen no encontrada" };

  const mensajesOrigen = conversacion.mensajes
    .filter((m) => m.contenido && m.contenido.trim().length > 0)
    .map((m) => ({ rol: (m.remitente === "CONTACTO" ? "user" : "assistant") as "user" | "assistant", texto: m.contenido! }));

  const contenidoAnonimizado = conversacion.contacto
    ? anonimizarContenido(mensajesOrigen, conversacion.contacto)
    : { mensajes: mensajesOrigen };

  await prisma.conversacionPiloto.update({
    where: { id },
    data: { contenidoAnonimizado: contenidoAnonimizado as unknown as Prisma.InputJsonValue, anonimizadaEn: new Date() },
  });

  revalidatePath("/configuracion");
  return { exito: true };
}

export async function incluirEnPerfil(id: string): Promise<Resultado> {
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const piloto = await prisma.conversacionPiloto.findFirst({
    where: { id, instanciaId: auth.sesion.instanciaId },
    select: { anonimizadaEn: true },
  });
  if (!piloto) return { exito: false, error: "Conversación piloto no encontrada" };
  if (!piloto.anonimizadaEn) return { exito: false, error: "Anonimizá la conversación antes de incluirla" };

  await prisma.conversacionPiloto.update({ where: { id }, data: { incluidaEnPerfil: true } });
  revalidatePath("/configuracion");
  return { exito: true };
}

export async function excluirDePerfil(id: string): Promise<Resultado> {
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const piloto = await prisma.conversacionPiloto.findFirst({ where: { id, instanciaId: auth.sesion.instanciaId }, select: { id: true } });
  if (!piloto) return { exito: false, error: "Conversación piloto no encontrada" };

  await prisma.conversacionPiloto.update({ where: { id }, data: { incluidaEnPerfil: false } });
  revalidatePath("/configuracion");
  return { exito: true };
}

// Historia 2 — recomendaciones.

export async function ejecutarAnalisisPilotoAction(
  agenteIAConfigId?: string,
  opciones?: { incluirCorreccionesRecientes?: boolean },
): Promise<Resultado<{ recomendacionesGeneradas: number }>> {
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const { ejecutarAnalisisPiloto } = await import("./analizador");
  const resultado = await ejecutarAnalisisPiloto(auth.sesion.instanciaId, agenteIAConfigId, opciones);
  if (!resultado.exito) return { exito: false, error: resultado.error };

  revalidatePath("/configuracion");
  return { exito: true, recomendacionesGeneradas: resultado.recomendacionesGeneradas };
}

export async function aprobarRecomendacion(id: string): Promise<Resultado> {
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const recomendacion = await prisma.recomendacionComportamiento.findFirst({ where: { id, instanciaId: auth.sesion.instanciaId }, select: { id: true } });
  if (!recomendacion) return { exito: false, error: "Recomendación no encontrada" };

  // FR-008 — solo cambia estado; nunca toca AgenteIAConfig/AgenteIAConfigVersion.
  await prisma.recomendacionComportamiento.update({
    where: { id },
    data: { estado: "APROBADA", resueltaPorUsuarioId: auth.sesion.usuarioId, resueltaEn: new Date() },
  });
  revalidatePath("/configuracion");
  return { exito: true };
}

export async function rechazarRecomendacion(id: string): Promise<Resultado> {
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const recomendacion = await prisma.recomendacionComportamiento.findFirst({ where: { id, instanciaId: auth.sesion.instanciaId }, select: { id: true } });
  if (!recomendacion) return { exito: false, error: "Recomendación no encontrada" };

  await prisma.recomendacionComportamiento.update({
    where: { id },
    data: { estado: "RECHAZADA", resueltaPorUsuarioId: auth.sesion.usuarioId, resueltaEn: new Date() },
  });
  revalidatePath("/configuracion");
  return { exito: true };
}

export async function asociarRecomendacionAEstrategia(datos: unknown): Promise<Resultado> {
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const validado = AsociarRecomendacionAEstrategiaSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  const [recomendacion, estrategia] = await Promise.all([
    prisma.recomendacionComportamiento.findFirst({ where: { id: validado.data.id, instanciaId: auth.sesion.instanciaId }, select: { id: true } }),
    prisma.playbookEstrategia.findFirst({ where: { id: validado.data.playbookEstrategiaId, instanciaId: auth.sesion.instanciaId }, select: { id: true } }),
  ]);
  if (!recomendacion) return { exito: false, error: "Recomendación no encontrada" };
  if (!estrategia) return { exito: false, error: "Estrategia no encontrada en esta instancia" };

  await prisma.recomendacionComportamiento.update({
    where: { id: validado.data.id },
    data: { playbookEstrategiaAsociadoId: validado.data.playbookEstrategiaId },
  });
  revalidatePath("/configuracion");
  return { exito: true };
}

/**
 * research.md Decisión 4 — redirección al flujo de reglas de 009, nunca una
 * escritura directa a AgenteIAConfig/AgenteIAConfigVersion (FR-008). Se
 * marca CONVERTIDA_REGLA en este mismo paso (simplificación pragmática:
 * detectar "publicó desde ahí" requeriría acoplar 009 a esta spec — ver
 * nota de implementación en tasks.md); el texto sugerido se devuelve para
 * que el administrador lo copie/pegue en la sección Reglas del agente.
 */
export async function convertirRecomendacionEnRegla(id: string): Promise<Resultado<{ redirigirA: string; reglaSugerida: string }>> {
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const recomendacion = await prisma.recomendacionComportamiento.findFirst({
    where: { id, instanciaId: auth.sesion.instanciaId },
    select: { id: true, reglaSugerida: true },
  });
  if (!recomendacion) return { exito: false, error: "Recomendación no encontrada" };

  await prisma.recomendacionComportamiento.update({
    where: { id },
    data: { estado: "CONVERTIDA_REGLA", resueltaPorUsuarioId: auth.sesion.usuarioId, resueltaEn: new Date() },
  });

  revalidatePath("/configuracion");
  return { exito: true, redirigirA: "/configuracion", reglaSugerida: recomendacion.reglaSugerida };
}

export async function convertirRecomendacionEnEjemplo(id: string): Promise<Resultado<{ ejemploId: string }>> {
  const auth = await requirePermisoAction("ia", "modificar");
  if (!auth.ok) return { exito: false, error: auth.error };

  const recomendacion = await prisma.recomendacionComportamiento.findFirst({
    where: { id, instanciaId: auth.sesion.instanciaId },
    select: { id: true, estado: true, agenteIAConfigId: true, confianza: true, basadaEnConversacionesPilotoIds: true },
  });
  if (!recomendacion) return { exito: false, error: "Recomendación no encontrada" };
  // FR-013 — un ejemplo nunca puede originarse en una recomendación ya
  // rechazada (el recuperador de ejemplos confía en esta invariante, ya
  // que EjemploPrompt no tiene FK propia a RecomendacionComportamiento).
  if (recomendacion.estado === "RECHAZADA") return { exito: false, error: "No se puede convertir una recomendación rechazada en ejemplo" };

  const ids = Array.isArray(recomendacion.basadaEnConversacionesPilotoIds)
    ? (recomendacion.basadaEnConversacionesPilotoIds as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  const pilotoOrigenId = ids[0];
  if (!pilotoOrigenId) return { exito: false, error: "La recomendación no tiene ninguna conversación piloto de origen" };

  const piloto = await prisma.conversacionPiloto.findFirst({
    where: { id: pilotoOrigenId, instanciaId: auth.sesion.instanciaId },
    select: { id: true, contenidoAnonimizado: true, clasificacion: true, intencion: true, tipoCliente: true, productoId: true, playbookEstrategiaId: true },
  });
  if (!piloto || !piloto.contenidoAnonimizado) return { exito: false, error: "La conversación piloto de origen no está anonimizada" };

  const calidad = piloto.clasificacion === "POSITIVO" ? Math.max(0.5, recomendacion.confianza) : Math.min(0.4, 1 - recomendacion.confianza);

  const ejemplo = await prisma.ejemploPrompt.create({
    data: {
      instanciaId: auth.sesion.instanciaId,
      agenteIAConfigId: recomendacion.agenteIAConfigId,
      conversacionPilotoOrigenId: piloto.id,
      contenido: piloto.contenidoAnonimizado as unknown as Prisma.InputJsonValue,
      intencion: piloto.intencion,
      tipoCliente: piloto.tipoCliente,
      productoId: piloto.productoId,
      playbookEstrategiaId: piloto.playbookEstrategiaId,
      calidad,
      activo: true,
    },
    select: { id: true },
  });

  await prisma.recomendacionComportamiento.update({
    where: { id },
    data: { estado: "CONVERTIDA_EJEMPLO", resueltaPorUsuarioId: auth.sesion.usuarioId, resueltaEn: new Date() },
  });

  revalidatePath("/configuracion");
  return { exito: true, ejemploId: ejemplo.id };
}
