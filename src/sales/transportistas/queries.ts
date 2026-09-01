import { prisma } from "@/shared/db/prisma";

export async function obtenerTransportistas(instanciaId: string) {
  return prisma.transportista.findMany({
    where: { instanciaId },
    orderBy: [{ activo: "desc" }, { nombre: "asc" }],
  });
}

// 019-cobertura-geografica-envios
export async function listarCoberturaGeografica(transportistaId: string) {
  return prisma.transportistaCoberturaGeografica.findMany({
    where: { transportistaId },
    include: { pais: true, estadoProvincia: true },
    orderBy: [{ pais: { nombre: "asc" } }, { estadoProvincia: { nombre: "asc" } }],
  });
}
