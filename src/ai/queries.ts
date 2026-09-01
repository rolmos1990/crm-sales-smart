import { prisma } from "@/shared/db/prisma";

export async function obtenerConfiguracionIA(instanciaId: string) {
  return prisma.configuracionIA.findUnique({
    where: { instanciaId },
    include: { instancia: false },
  });
}

export async function obtenerProveedoresActivos(instanciaId: string) {
  return prisma.proveedorIA.findMany({
    where: { instanciaId, activo: true },
    orderBy: { prioridad: "desc" },
  });
}

export async function obtenerProveedorPorId(id: string) {
  return prisma.proveedorIA.findUnique({ where: { id } });
}

export async function obtenerAgenteIAConfig(agenteIAConfigId: string) {
  return prisma.agenteIAConfig.findUnique({ where: { id: agenteIAConfigId } });
}

export async function obtenerAgenteIAConfigPorUsuario(usuarioId: string) {
  return prisma.agenteIAConfig.findUnique({ where: { usuarioId } });
}

// 009-perfil-agente-estructurado-versionado (FR-012) — versión PUBLICADA
// vigente de un agente (mayor `numero`), para trazabilidad en UsoIA.
// `null` si el agente todavía no tiene ninguna versión publicada (agente
// legacy o recién creado) — comportamiento esperado, no un error.
export async function obtenerVersionPublicadaVigenteId(
  agenteIAConfigId: string,
): Promise<string | null> {
  const version = await prisma.agenteIAConfigVersion.findFirst({
    where: { agenteIAConfigId, estado: "PUBLICADA" },
    orderBy: { numero: "desc" },
    select: { id: true },
  });
  return version?.id ?? null;
}

export async function obtenerUsoIA(instanciaId: string, limite = 100) {
  return prisma.usoIA.findMany({
    where: { instanciaId },
    orderBy: { creadoEn: "desc" },
    take: limite,
  });
}

export async function obtenerResumenUsoIA(instanciaId: string) {
  const resultado = await prisma.usoIA.aggregate({
    where: { instanciaId, exito: true },
    _sum: { tokensInput: true, tokensOutput: true },
    _count: { id: true },
  });
  return {
    totalLlamadas: resultado._count.id,
    totalTokensInput: resultado._sum.tokensInput ?? 0,
    totalTokensOutput: resultado._sum.tokensOutput ?? 0,
  };
}

export async function obtenerTokensUsadosHoy(instanciaId: string): Promise<number> {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const resultado = await prisma.usoIA.aggregate({
    where: { instanciaId, exito: true, creadoEn: { gte: hoy } },
    _sum: { tokensInput: true, tokensOutput: true },
  });
  return (resultado._sum.tokensInput ?? 0) + (resultado._sum.tokensOutput ?? 0);
}
