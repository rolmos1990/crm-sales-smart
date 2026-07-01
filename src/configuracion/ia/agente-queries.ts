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
