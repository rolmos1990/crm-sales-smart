"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/shared/db/prisma";
import { requireSesion } from "@/shared/auth/sesion";
import { verificarAcceso } from "@/shared/auth/permisos";
import { AgenteIAConfigSchema, type AgenteIAConfigInput } from "./agente-schema";
import { detectarContradicciones } from "@/ai/prompt/contradicciones";
import {
  obtenerBorradorActivo,
  listarVersionesAgenteIA as listarVersionesAgenteIAQuery,
  obtenerVersionAgenteIA,
} from "./agente-queries";

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

  const payload = construirPayloadAgenteIA(validado.data);

  // 016-niveles-autonomia-automatizacion — solo se siembra la clasificación
  // inicial cuando el AgenteIAConfig se crea por primera vez, nunca en un
  // update de uno ya existente (ver siembra.ts).
  const existente = await prisma.agenteIAConfig.findUnique({ where: { usuarioId }, select: { id: true } });

  const agente = await prisma.agenteIAConfig.upsert({
    where: { usuarioId },
    create: {
      usuarioId,
      instanciaId: sesion.instanciaId,
      tipo: "COMERCIAL",
      ...payload,
    },
    update: payload,
    select: { id: true },
  });

  if (!existente) {
    const { sembrarAutonomiaDefault } = await import("@/ai/autonomia/siembra");
    await sembrarAutonomiaDefault(sesion.instanciaId, agente.id);
  }

  revalidatePath("/configuracion");
  return { exito: true };
}

export async function obtenerAgentesIAComerciales() {
  const sesion = await requireSesion();
  return prisma.agenteIAConfig.findMany({
    where: { instanciaId: sesion.instanciaId, tipo: "COMERCIAL" },
    select: {
      id: true,
      objetivo: true,
      usuario: { select: { nombre: true } },
    },
    orderBy: { usuario: { nombre: "asc" } },
  });
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
      herramientas: true,
      configuracionTono: true,

      // 009-perfil-agente-estructurado-versionado
      nombreAgente: true,
      rol: true,
      idiomaPrincipal: true,
      idiomasPermitidos: true,
      longitudRespuesta: true,
      proactividad: true,
      intensidadComercial: true,
      estiloRecomendacion: true,
      frasesPreferidas: true,
      frasesProhibidas: true,
      comportamientosProhibidos: true,
      reglasPersonalizadas: true,
      condicionesTransferenciaHumano: true,
    },
  });
}

// --- 009-perfil-agente-estructurado-versionado — versionado ---

interface GuardarBorradorResultado {
  exito: boolean;
  versionId?: string;
  error?: string;
}

export async function guardarBorradorAgenteIA(
  agenteIAConfigId: string,
  datos: unknown,
  actualizadoEnEsperado?: Date | string,
): Promise<GuardarBorradorResultado> {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error };

  const agente = await prisma.agenteIAConfig.findFirst({
    where: { id: agenteIAConfigId, instanciaId: sesion.instanciaId },
    select: { id: true },
  });
  if (!agente) return { exito: false, error: "Agente no encontrado en esta instancia" };

  const validado = AgenteIAConfigSchema.safeParse(datos);
  if (!validado.success) return { exito: false, error: "Datos inválidos" };

  const conflicto = validarSinConflictoDeFrases(validado.data);
  if (conflicto) return { exito: false, error: conflicto };

  const borradorExistente = await obtenerBorradorActivo(agenteIAConfigId);

  if (
    borradorExistente &&
    actualizadoEnEsperado &&
    new Date(actualizadoEnEsperado).getTime() !== borradorExistente.actualizadoEn.getTime()
  ) {
    return {
      exito: false,
      error: "La configuración fue modificada por otra persona, recargá antes de guardar",
    };
  }

  const contenido = validado.data as unknown as Prisma.InputJsonValue;

  const version = borradorExistente
    ? await prisma.agenteIAConfigVersion.update({
        where: { id: borradorExistente.id },
        data: { contenido },
      })
    : await prisma.agenteIAConfigVersion.create({
        data: {
          agenteIAConfigId,
          instanciaId: sesion.instanciaId,
          estado: "BORRADOR",
          contenido,
          creadaPorUsuarioId: sesion.usuarioId,
        },
      });

  revalidatePath("/configuracion");
  return { exito: true, versionId: version.id };
}

interface PublicarVersionResultado {
  exito: boolean;
  numero?: number;
  error?: string;
  advertencias?: string[];
}

export async function publicarVersionAgenteIA(
  agenteIAConfigId: string,
  opciones?: { forzar?: boolean },
): Promise<PublicarVersionResultado> {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error };

  const agente = await prisma.agenteIAConfig.findFirst({
    where: { id: agenteIAConfigId, instanciaId: sesion.instanciaId },
    select: { id: true },
  });
  if (!agente) return { exito: false, error: "Agente no encontrado en esta instancia" };

  const borrador = await obtenerBorradorActivo(agenteIAConfigId);
  if (!borrador) return { exito: false, error: "No hay cambios sin publicar" };

  const contenido = borrador.contenido as unknown as AgenteIAConfigInput;

  const conflicto = validarSinConflictoDeFrases(contenido);
  if (conflicto) return { exito: false, error: conflicto };

  const advertencias = detectarContradicciones(contenido.sistemaPrompt ?? null, {
    comportamientosProhibidos: contenido.comportamientosProhibidos ?? undefined,
  });
  if (advertencias.length > 0 && !opciones?.forzar) {
    return { exito: false, error: "Hay contradicciones detectadas — confirmá para publicar igual", advertencias };
  }

  const payload = construirPayloadAgenteIA(contenido);

  const numero = await prisma.$transaction(async (tx) => {
    const ultimaPublicada = await tx.agenteIAConfigVersion.findFirst({
      where: { agenteIAConfigId, estado: "PUBLICADA" },
      orderBy: { numero: "desc" },
      select: { numero: true },
    });
    const siguienteNumero = (ultimaPublicada?.numero ?? 0) + 1;

    await tx.agenteIAConfigVersion.update({
      where: { id: borrador.id },
      data: { estado: "PUBLICADA", numero: siguienteNumero, publicadaEn: new Date() },
    });

    await tx.agenteIAConfig.update({
      where: { id: agenteIAConfigId },
      data: payload,
    });

    return siguienteNumero;
  });

  revalidatePath("/configuracion");
  return { exito: true, numero };
}

export async function duplicarVersionAgenteIA(
  versionId: string,
): Promise<{ exito: boolean; nuevoBorradorId?: string; error?: string }> {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error };

  const version = await obtenerVersionAgenteIA(versionId, sesion.instanciaId);
  if (!version) return { exito: false, error: "Versión no encontrada en esta instancia" };

  const borradorExistente = await obtenerBorradorActivo(version.agenteIAConfigId);

  const nuevoBorrador = borradorExistente
    ? await prisma.agenteIAConfigVersion.update({
        where: { id: borradorExistente.id },
        data: { contenido: version.contenido as Prisma.InputJsonValue },
      })
    : await prisma.agenteIAConfigVersion.create({
        data: {
          agenteIAConfigId: version.agenteIAConfigId,
          instanciaId: sesion.instanciaId,
          estado: "BORRADOR",
          contenido: version.contenido as Prisma.InputJsonValue,
          creadaPorUsuarioId: sesion.usuarioId,
        },
      });

  revalidatePath("/configuracion");
  return { exito: true, nuevoBorradorId: nuevoBorrador.id };
}

export async function restaurarVersionAgenteIA(
  versionId: string,
): Promise<{ exito: boolean; numero?: number; error?: string }> {
  const sesion = await requireSesion();
  const { permitido, error } = verificarAcceso(sesion, "ia", "modificar");
  if (!permitido) return { exito: false, error };

  const version = await obtenerVersionAgenteIA(versionId, sesion.instanciaId);
  if (!version) return { exito: false, error: "Versión no encontrada en esta instancia" };
  if (version.estado !== "PUBLICADA") {
    return { exito: false, error: "Solo se puede restaurar una versión publicada" };
  }

  const contenido = version.contenido as unknown as AgenteIAConfigInput;
  const payload = construirPayloadAgenteIA(contenido);

  const numero = await prisma.$transaction(async (tx) => {
    const ultimaPublicada = await tx.agenteIAConfigVersion.findFirst({
      where: { agenteIAConfigId: version.agenteIAConfigId, estado: "PUBLICADA" },
      orderBy: { numero: "desc" },
      select: { numero: true },
    });
    const siguienteNumero = (ultimaPublicada?.numero ?? 0) + 1;

    await tx.agenteIAConfigVersion.create({
      data: {
        agenteIAConfigId: version.agenteIAConfigId,
        instanciaId: sesion.instanciaId,
        estado: "PUBLICADA",
        numero: siguienteNumero,
        contenido: version.contenido as Prisma.InputJsonValue,
        publicadaEn: new Date(),
        creadaPorUsuarioId: sesion.usuarioId,
      },
    });

    await tx.agenteIAConfig.update({
      where: { id: version.agenteIAConfigId },
      data: payload,
    });

    return siguienteNumero;
  });

  revalidatePath("/configuracion");
  return { exito: true, numero };
}

export async function listarVersionesAgenteIA(agenteIAConfigId: string) {
  const sesion = await requireSesion();
  const agente = await prisma.agenteIAConfig.findFirst({
    where: { id: agenteIAConfigId, instanciaId: sesion.instanciaId },
    select: { id: true },
  });
  if (!agente) return [];
  return listarVersionesAgenteIAQuery(agenteIAConfigId, sesion.instanciaId);
}

// --- helpers internos ---

function construirPayloadAgenteIA(datos: AgenteIAConfigInput) {
  return {
    sistemaPrompt: datos.sistemaPrompt ?? null,
    personalidad: datos.personalidad ?? null,
    objetivo: datos.objetivo ?? null,
    especialidad: datos.especialidad ?? null,
    temperaturaOverride: datos.temperaturaOverride ?? null,
    modeloPreferido: datos.modeloPreferido ?? null,
    memoriaHabilitada: datos.memoriaHabilitada,
    limiteTokensCtx: datos.limiteTokensCtx,
    canalesPermitidos: datos.canalesPermitidos ?? Prisma.JsonNull,
    herramientas: datos.herramientas ?? Prisma.JsonNull,
    configuracionTono: datos.configuracionTono ?? Prisma.JsonNull,

    nombreAgente: datos.nombreAgente ?? null,
    rol: datos.rol ?? null,
    idiomaPrincipal: datos.idiomaPrincipal ?? null,
    idiomasPermitidos: datos.idiomasPermitidos ?? Prisma.JsonNull,
    longitudRespuesta: datos.longitudRespuesta ?? null,
    proactividad: datos.proactividad ?? null,
    intensidadComercial: datos.intensidadComercial ?? null,
    estiloRecomendacion: datos.estiloRecomendacion ?? null,
    frasesPreferidas: datos.frasesPreferidas ?? Prisma.JsonNull,
    frasesProhibidas: datos.frasesProhibidas ?? Prisma.JsonNull,
    comportamientosProhibidos: datos.comportamientosProhibidos ?? Prisma.JsonNull,
    reglasPersonalizadas: datos.reglasPersonalizadas ?? Prisma.JsonNull,
    condicionesTransferenciaHumano: datos.condicionesTransferenciaHumano ?? Prisma.JsonNull,
  };
}

// FR: una misma frase no puede estar en frasesPreferidas y frasesProhibidas a la vez.
function validarSinConflictoDeFrases(datos: AgenteIAConfigInput): string | null {
  const preferidas = new Set((datos.frasesPreferidas ?? []).map((f) => f.trim().toLowerCase()));
  const prohibidas = datos.frasesProhibidas ?? [];
  const enComun = prohibidas.find((f) => preferidas.has(f.trim().toLowerCase()));
  if (enComun) {
    return `La frase "${enComun}" no puede estar marcada como preferida y prohibida a la vez`;
  }
  return null;
}
