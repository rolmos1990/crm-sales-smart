import { prisma } from "@/shared/db/prisma";

export async function listarMetodosEntregaConfig(instanciaId: string) {
  return prisma.metodoEntregaConfig.findMany({
    where: { instanciaId },
    include: { zonas: { include: { zonaCobertura: true } } },
    orderBy: { metodoEntrega: "asc" },
  });
}

export async function listarZonasCobertura(instanciaId: string) {
  return prisma.zonaCobertura.findMany({ where: { instanciaId }, orderBy: { nombre: "asc" } });
}

export async function listarUbicacionesRetiro(instanciaId: string) {
  return prisma.ubicacionRetiro.findMany({ where: { instanciaId }, orderBy: { nombre: "asc" } });
}
