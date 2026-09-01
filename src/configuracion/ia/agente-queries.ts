import { prisma } from "@/shared/db/prisma";

const AGENTE_IA_SELECT = {
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
} as const;

export async function obtenerAgenteIAConfigPorUsuario(usuarioId: string) {
  return prisma.agenteIAConfig.findUnique({
    where: { usuarioId },
    select: AGENTE_IA_SELECT,
  });
}

// Mantener por compatibilidad con código existente (orquestar-ia.suscriptor usa findFirst directamente)
export async function obtenerAgenteComercialIA(instanciaId: string) {
  return prisma.agenteIAConfig.findFirst({
    where: { instanciaId, tipo: "COMERCIAL" },
    select: AGENTE_IA_SELECT,
  });
}

// --- 009-perfil-agente-estructurado-versionado — versionado ---

/** El borrador en edición (si existe) para un agente. Como máximo uno por agente. */
export async function obtenerBorradorActivo(agenteIAConfigId: string) {
  return prisma.agenteIAConfigVersion.findFirst({
    where: { agenteIAConfigId, estado: "BORRADOR" },
  });
}

/** Historial de versiones (metadata, sin `contenido` completo) — borrador primero, luego por número descendente. */
export async function listarVersionesAgenteIA(agenteIAConfigId: string, instanciaId: string) {
  const versiones = await prisma.agenteIAConfigVersion.findMany({
    where: { agenteIAConfigId, instanciaId },
    select: {
      id: true,
      numero: true,
      estado: true,
      publicadaEn: true,
      creadoEn: true,
      creadaPorUsuario: { select: { nombre: true } },
    },
    orderBy: [{ estado: "asc" }, { numero: "desc" }],
  });

  // "asc" pone BORRADOR antes que PUBLICADA alfabéticamente — es el orden
  // pedido (borrador primero) sin necesitar un orderBy custom por CASE.
  return versiones.map((v) => ({
    id: v.id,
    numero: v.numero,
    estado: v.estado,
    publicadaEn: v.publicadaEn,
    creadoEn: v.creadoEn,
    creadoPor: v.creadaPorUsuario?.nombre ?? null,
  }));
}

/** Una versión puntual del historial, con su contenido completo (para restaurar/duplicar/inspeccionar). */
export async function obtenerVersionAgenteIA(versionId: string, instanciaId: string) {
  return prisma.agenteIAConfigVersion.findFirst({
    where: { id: versionId, instanciaId },
  });
}
