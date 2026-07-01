"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { AgenteIAConfigSchema } from "./agente-schema";

export async function guardarAgenteIA(usuarioId: string, datos: unknown) {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error };

  const validado = AgenteIAConfigSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  // Verificar que el usuario pertenece a la instancia del solicitante
  const ui = await prisma.usuarioInstancia.findFirst({
    where: { usuarioId, instanciaId: sesion.instanciaId },
    select: { id: true },
  });
  if (!ui) return { exito: false, error: "Agente no encontrado en esta instancia" };

  const payload = {
    tipo: "COMERCIAL" as const,
    sistemaPrompt: validado.data.sistemaPrompt ?? null,
    personalidad: validado.data.personalidad ?? null,
    objetivo: validado.data.objetivo ?? null,
    especialidad: validado.data.especialidad ?? null,
    temperaturaOverride: validado.data.temperaturaOverride ?? null,
    modeloPreferido: validado.data.modeloPreferido ?? null,
    memoriaHabilitada: validado.data.memoriaHabilitada,
    limiteTokensCtx: validado.data.limiteTokensCtx,
    canalesPermitidos: validado.data.canalesPermitidos ?? Prisma.JsonNull,
  };

  await prisma.agenteIAConfig.upsert({
    where: { usuarioId },
    create: {
      usuarioId,
      instanciaId: sesion.instanciaId,
      ...payload,
    },
    update: payload,
  });

  revalidatePath("/configuracion");
  return { exito: true };
}

export async function cargarConfigAgenteIA(usuarioId: string) {
  const sesion = await requireSesion();

  const ui = await prisma.usuarioInstancia.findFirst({
    where: { usuarioId, instanciaId: sesion.instanciaId },
    select: { id: true },
  });
  if (!ui) return null;

  return prisma.agenteIAConfig.findUnique({
    where: { usuarioId },
    select: {
      id: true,
      tipo: true,
      sistemaPrompt: true,
      personalidad: true,
      objetivo: true,
      especialidad: true,
      temperaturaOverride: true,
      modeloPreferido: true,
      memoriaHabilitada: true,
      limiteTokensCtx: true,
      canalesPermitidos: true,
    },
  });
}
